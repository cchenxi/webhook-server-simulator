package com.webhook.simulator.controller;

import com.webhook.simulator.model.ResponseRule;
import com.webhook.simulator.model.WebhookMessage;
import com.webhook.simulator.service.ConcurrencyControlService;
import com.webhook.simulator.service.MessageStoreService;
import com.webhook.simulator.service.ResponseRuleService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestController
public class WebhookReceiverController {

    private final MessageStoreService messageStoreService;
    private final ResponseRuleService responseRuleService;
    private final ConcurrencyControlService concurrencyControlService;
    private final SimpMessagingTemplate messagingTemplate;

    public WebhookReceiverController(MessageStoreService messageStoreService,
                                     ResponseRuleService responseRuleService,
                                     ConcurrencyControlService concurrencyControlService,
                                     SimpMessagingTemplate messagingTemplate) {
        this.messageStoreService = messageStoreService;
        this.responseRuleService = responseRuleService;
        this.concurrencyControlService = concurrencyControlService;
        this.messagingTemplate = messagingTemplate;
    }

    @RequestMapping(value = "/webhook/**", method = {
            RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
            RequestMethod.DELETE, RequestMethod.PATCH
    })
    public ResponseEntity<String> handleWebhook(HttpServletRequest request,
                                                 @RequestBody(required = false) String body) {
        try {
            concurrencyControlService.acquire();
        } catch (ConcurrencyControlService.RateLimitExceededException e) {
            log.warn("Rate limit exceeded for {} {}", request.getMethod(), request.getRequestURI());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body("{\"error\":\"Rate limit exceeded\"}");
        } catch (ConcurrencyControlService.ConcurrencyLimitExceededException e) {
            log.warn("Concurrency limit exceeded for {} {}", request.getMethod(), request.getRequestURI());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("{\"error\":\"Service unavailable, concurrency limit exceeded\"}");
        }

        try {
            String path = request.getRequestURI();
            String method = request.getMethod();

            Map<String, String> headers = new LinkedHashMap<>();
            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                headers.put(name, request.getHeader(name));
            }

            Map<String, String> queryParams = new LinkedHashMap<>();
            if (request.getQueryString() != null) {
                for (String param : request.getQueryString().split("&")) {
                    String[] parts = param.split("=", 2);
                    String key = parts[0];
                    String value = parts.length > 1 ? parts[1] : "";
                    queryParams.put(key, value);
                }
            }

            String sourceIp = request.getRemoteAddr();

            Optional<ResponseRule> matchedRule = responseRuleService.matchRule(path);

            int statusCode = 200;
            String responseBody = "{\"status\":\"received\"}";
            Map<String, String> responseHeaders = new LinkedHashMap<>();

            if (matchedRule.isPresent()) {
                ResponseRule rule = matchedRule.get();
                log.info("Matched rule [{}] for path {}, statusCode={}, delayMs={}",
                        rule.getId(), path, rule.getStatusCode(), rule.getDelayMs());

                if (rule.getDelayMs() > 0) {
                    log.debug("Applying delay of {}ms for path {}", rule.getDelayMs(), path);
                    try {
                        Thread.sleep(rule.getDelayMs());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }

                statusCode = rule.getStatusCode();
                if (rule.getResponseBody() != null) {
                    responseBody = rule.getResponseBody();
                }
                if (rule.getResponseHeaders() != null) {
                    responseHeaders = rule.getResponseHeaders();
                }
            }

            WebhookMessage message = WebhookMessage.builder()
                    .id(UUID.randomUUID().toString())
                    .path(path)
                    .method(method)
                    .headers(headers)
                    .body(body)
                    .queryParams(queryParams)
                    .sourceIp(sourceIp)
                    .timestamp(Instant.now())
                    .responseStatusCode(statusCode)
                    .build();

            messageStoreService.addMessage(message);
            log.info("Webhook received: {} {} from {} -> {}", method, path, sourceIp, statusCode);

            messagingTemplate.convertAndSend("/topic/messages", message);

            ResponseEntity.BodyBuilder responseBuilder = ResponseEntity.status(statusCode);
            for (Map.Entry<String, String> entry : responseHeaders.entrySet()) {
                responseBuilder.header(entry.getKey(), entry.getValue());
            }

            return responseBuilder.body(responseBody);

        } finally {
            concurrencyControlService.release();
        }
    }
}
