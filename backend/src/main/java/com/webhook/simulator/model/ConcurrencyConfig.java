package com.webhook.simulator.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConcurrencyConfig {
    @Builder.Default
    private int maxConcurrency = 10;
    @Builder.Default
    private double rateLimitPerSecond = 100.0;
    @Builder.Default
    private long timeoutMs = 5000;
    @Builder.Default
    private boolean rejectOnFull = false;
}
