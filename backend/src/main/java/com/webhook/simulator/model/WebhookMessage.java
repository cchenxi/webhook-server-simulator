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
public class WebhookMessage {
    private String id;
    private String path;
    private String method;
    private Map<String, String> headers;
    private String body;
    private Map<String, String> queryParams;
    private String sourceIp;
    private Instant timestamp;
    private int responseStatusCode;
}
