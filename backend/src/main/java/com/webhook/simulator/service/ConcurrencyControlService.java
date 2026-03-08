package com.webhook.simulator.service;

import com.google.common.util.concurrent.RateLimiter;
import com.webhook.simulator.model.ConcurrencyConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class ConcurrencyControlService {

    private volatile ConcurrencyConfig config;
    private volatile Semaphore semaphore;
    private volatile RateLimiter rateLimiter;

    public ConcurrencyControlService() {
        this.config = ConcurrencyConfig.builder().build();
        this.semaphore = new Semaphore(config.getMaxConcurrency());
        this.rateLimiter = RateLimiter.create(config.getRateLimitPerSecond());
        log.info("ConcurrencyControlService initialized: maxConcurrency={}, rateLimitPerSecond={}",
                config.getMaxConcurrency(), config.getRateLimitPerSecond());
    }

    /**
     * Acquire a permit from the semaphore and rate limiter.
     * Throws RateLimitExceededException if rate limit is exceeded.
     * Throws ConcurrencyLimitExceededException if concurrency limit is exceeded.
     */
    public void acquire() throws RateLimitExceededException, ConcurrencyLimitExceededException {
        if (!rateLimiter.tryAcquire(0, TimeUnit.MILLISECONDS)) {
            log.warn("Rate limit exceeded, rejecting request");
            throw new RateLimitExceededException("Rate limit exceeded");
        }

        try {
            if (config.isRejectOnFull()) {
                if (!semaphore.tryAcquire()) {
                    log.warn("Concurrency limit exceeded (rejectOnFull=true), available permits: 0");
                    throw new ConcurrencyLimitExceededException("Concurrency limit exceeded, request rejected");
                }
            } else {
                boolean acquired = semaphore.tryAcquire(config.getTimeoutMs(), TimeUnit.MILLISECONDS);
                if (!acquired) {
                    log.warn("Concurrency limit exceeded, timed out after {}ms", config.getTimeoutMs());
                    throw new ConcurrencyLimitExceededException("Concurrency limit exceeded, timed out waiting for permit");
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while waiting for concurrency permit");
            throw new ConcurrencyLimitExceededException("Interrupted while waiting for concurrency permit");
        }
    }

    public void release() {
        semaphore.release();
    }

    public ConcurrencyConfig getConfig() {
        return config;
    }

    public void updateConfig(ConcurrencyConfig newConfig) {
        log.info("Updating concurrency config: maxConcurrency={}, rateLimitPerSecond={}, timeoutMs={}, rejectOnFull={}",
                newConfig.getMaxConcurrency(), newConfig.getRateLimitPerSecond(), newConfig.getTimeoutMs(), newConfig.isRejectOnFull());
        this.config = newConfig;
        this.semaphore = new Semaphore(newConfig.getMaxConcurrency());
        this.rateLimiter = RateLimiter.create(newConfig.getRateLimitPerSecond());
    }

    public static class RateLimitExceededException extends Exception {
        public RateLimitExceededException(String message) {
            super(message);
        }
    }

    public static class ConcurrencyLimitExceededException extends Exception {
        public ConcurrencyLimitExceededException(String message) {
            super(message);
        }
    }
}
