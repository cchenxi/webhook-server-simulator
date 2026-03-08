package com.webhook.simulator.controller;

import com.webhook.simulator.model.ResponseRule;
import com.webhook.simulator.service.ResponseRuleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/rules")
public class RuleConfigController {

    private final ResponseRuleService responseRuleService;

    public RuleConfigController(ResponseRuleService responseRuleService) {
        this.responseRuleService = responseRuleService;
    }

    @GetMapping
    public ResponseEntity<List<ResponseRule>> getRules() {
        return ResponseEntity.ok(responseRuleService.getRules());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseRule> getRule(@PathVariable String id) {
        return responseRuleService.getRule(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ResponseRule> createRule(@RequestBody ResponseRule rule) {
        ResponseRule created = responseRuleService.addRule(rule);
        log.info("Created response rule [{}] for pattern: {}, statusCode={}",
                created.getId(), created.getPathPattern(), created.getStatusCode());
        return ResponseEntity.status(201).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseRule> updateRule(@PathVariable String id,
                                                   @RequestBody ResponseRule rule) {
        log.info("Updating response rule [{}]", id);
        return responseRuleService.updateRule(id, rule)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteRule(@PathVariable String id) {
        boolean deleted = responseRuleService.deleteRule(id);
        if (deleted) {
            log.info("Deleted response rule [{}]", id);
            return ResponseEntity.ok(Map.of("status", "deleted"));
        }
        log.warn("Attempted to delete non-existent rule [{}]", id);
        return ResponseEntity.notFound().build();
    }
}
