package com.webhook.simulator.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResponseRule {
    private String id;
    private String pathPattern;
    @Builder.Default
    private int statusCode = 200;
    private String responseBody;
    private Map<String, String> responseHeaders;
    @Builder.Default
    private long delayMs = 0;
    private Instant createdAt;
}
