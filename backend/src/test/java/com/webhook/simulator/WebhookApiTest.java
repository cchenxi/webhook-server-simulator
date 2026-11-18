package com.webhook.simulator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WebhookApiTest {

    private static final String DEFAULT_CONCURRENCY =
            "{\"maxConcurrency\":10,\"rateLimitPerSecond\":100,\"timeoutMs\":5000,\"rejectOnFull\":false}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void resetState() throws Exception {
        mockMvc.perform(delete("/api/messages")).andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"cleared\"}"));

        String rulesJson = mockMvc.perform(get("/api/rules"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> rules = objectMapper.readValue(
                rulesJson, new TypeReference<List<Map<String, Object>>>() {});
        for (Map<String, Object> rule : rules) {
            mockMvc.perform(delete("/api/rules/" + rule.get("id"))).andExpect(status().isOk())
                    .andExpect(content().json("{\"status\":\"deleted\"}"));
        }

        mockMvc.perform(put("/api/concurrency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(DEFAULT_CONCURRENCY))
                .andExpect(status().isOk());
    }

    @Test
    void receivesWebhookAndKeepsIsoTimestamp() throws Exception {
        mockMvc.perform(post("/webhook/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"event\":\"test\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"received\"}"));

        mockMvc.perform(get("/api/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].path").value("/webhook/test"))
                .andExpect(jsonPath("$[0].method").value("POST"))
                .andExpect(jsonPath("$[0].protocol").value("HTTP"))
                .andExpect(jsonPath("$[0].body").value("{\"event\":\"test\"}"))
                .andExpect(jsonPath("$[0].timestamp", matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.*Z")));

        mockMvc.perform(get("/api/messages/count"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"count\":1}"));

        mockMvc.perform(get("/api/messages").param("search", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/messages").param("search", "missing-keyword"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void matchedRuleOverridesStatusAndBlankPatternDoesNot() throws Exception {
        mockMvc.perform(post("/api/rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pathPattern\":\"   \",\"statusCode\":500,\"responseBody\":\"{\\\"no\\\":true}\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/webhook/plain").content("x"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"received\"}"));

        String created = mockMvc.perform(post("/api/rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pathPattern\":\"/webhook/order/**\",\"statusCode\":422,"
                                + "\"responseBody\":\"{\\\"error\\\":\\\"nope\\\"}\",\"delayMs\":0}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdAt", matchesPattern("\\d{4}-\\d{2}-\\d{2}T.*Z")))
                .andReturn().getResponse().getContentAsString();
        String id = String.valueOf(objectMapper.readValue(created, new TypeReference<Map<String, Object>>() {}).get("id"));

        mockMvc.perform(put("/api/rules/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pathPattern\":\"/webhook/order/**\",\"statusCode\":422,"
                                + "\"responseBody\":\"{\\\"error\\\":\\\"nope\\\"}\",\"delayMs\":200}"))
                .andExpect(status().isOk());

        long started = System.currentTimeMillis();
        mockMvc.perform(post("/webhook/order/9").content("x"))
                .andExpect(status().is(422))
                .andExpect(content().string("{\"error\":\"nope\"}"));
        long elapsed = System.currentTimeMillis() - started;
        org.junit.jupiter.api.Assertions.assertTrue(elapsed >= 150, "delay was " + elapsed + "ms");
    }

    @Test
    void concurrencyLimitRejectsWhenFullAndRateLimitRejectsBurst() throws Exception {
        mockMvc.perform(put("/api/concurrency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maxConcurrency\":0,\"rateLimitPerSecond\":1000,\"timeoutMs\":50,\"rejectOnFull\":true}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/webhook/limited").content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"error\":\"Service unavailable, concurrency limit exceeded\"}"));

        mockMvc.perform(put("/api/concurrency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maxConcurrency\":10,\"rateLimitPerSecond\":0.001,\"timeoutMs\":50,\"rejectOnFull\":true}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/webhook/rated").content("{}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/webhook/rated").content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().json("{\"error\":\"Rate limit exceeded\"}"));
    }
}
