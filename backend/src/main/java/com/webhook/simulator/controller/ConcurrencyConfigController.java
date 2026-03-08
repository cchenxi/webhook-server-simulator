package com.webhook.simulator.controller;

import com.webhook.simulator.model.ConcurrencyConfig;
import com.webhook.simulator.service.ConcurrencyControlService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/concurrency")
public class ConcurrencyConfigController {

    private final ConcurrencyControlService concurrencyControlService;

    public ConcurrencyConfigController(ConcurrencyControlService concurrencyControlService) {
        this.concurrencyControlService = concurrencyControlService;
    }

    @GetMapping
    public ResponseEntity<ConcurrencyConfig> getConfig() {
        return ResponseEntity.ok(concurrencyControlService.getConfig());
    }

    @PutMapping
    public ResponseEntity<ConcurrencyConfig> updateConfig(@RequestBody ConcurrencyConfig config) {
        log.info("Updating concurrency config: maxConcurrency={}, rateLimitPerSecond={}, timeoutMs={}, rejectOnFull={}",
                config.getMaxConcurrency(), config.getRateLimitPerSecond(), config.getTimeoutMs(), config.isRejectOnFull());
        concurrencyControlService.updateConfig(config);
        return ResponseEntity.ok(concurrencyControlService.getConfig());
    }
}
