package com.webhook.simulator.service;

import com.webhook.simulator.model.ResponseRule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.AntPathMatcher;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
public class ResponseRuleService {

    private final CopyOnWriteArrayList<ResponseRule> rules = new CopyOnWriteArrayList<>();
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public ResponseRule addRule(ResponseRule rule) {
        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId(UUID.randomUUID().toString());
        }
        if (rule.getCreatedAt() == null) {
            rule.setCreatedAt(Instant.now());
        }
        rules.add(rule);
        log.info("Added response rule [{}] with pattern: {}", rule.getId(), rule.getPathPattern());
        return rule;
    }

    public List<ResponseRule> getRules() {
        return Collections.unmodifiableList(new ArrayList<>(rules));
    }

    public Optional<ResponseRule> getRule(String id) {
        return rules.stream()
                .filter(r -> r.getId().equals(id))
                .findFirst();
    }

    public Optional<ResponseRule> updateRule(String id, ResponseRule updatedRule) {
        for (int i = 0; i < rules.size(); i++) {
            ResponseRule existing = rules.get(i);
            if (existing.getId().equals(id)) {
                updatedRule.setId(id);
                if (updatedRule.getCreatedAt() == null) {
                    updatedRule.setCreatedAt(existing.getCreatedAt());
                }
                rules.set(i, updatedRule);
                log.info("Updated response rule [{}], pattern: {}", id, updatedRule.getPathPattern());
                return Optional.of(updatedRule);
            }
        }
        log.warn("Rule [{}] not found for update", id);
        return Optional.empty();
    }

    public boolean deleteRule(String id) {
        boolean removed = rules.removeIf(r -> r.getId().equals(id));
        if (removed) {
            log.info("Deleted response rule [{}]", id);
        } else {
            log.warn("Rule [{}] not found for deletion", id);
        }
        return removed;
    }

    public Optional<ResponseRule> matchRule(String path) {
        Optional<ResponseRule> matched = rules.stream()
                .filter(rule -> {
                    String pattern = rule.getPathPattern();
                    if (pattern == null || pattern.isBlank()) {
                        return false;
                    }
                    return pathMatcher.match(pattern, path);
                })
                .findFirst();
        if (matched.isPresent()) {
            log.debug("Path {} matched rule [{}] with pattern {}", path, matched.get().getId(), matched.get().getPathPattern());
        } else {
            log.debug("No matching rule found for path {}", path);
        }
        return matched;
    }
}
