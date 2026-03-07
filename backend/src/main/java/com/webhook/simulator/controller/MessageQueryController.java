package com.webhook.simulator.controller;

import com.webhook.simulator.model.WebhookMessage;
import com.webhook.simulator.service.MessageStoreService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
public class MessageQueryController {

    private final MessageStoreService messageStoreService;

    public MessageQueryController(MessageStoreService messageStoreService) {
        this.messageStoreService = messageStoreService;
    }

    @GetMapping
    public ResponseEntity<List<WebhookMessage>> getMessages(
            @RequestParam(value = "search", required = false) String search) {
        List<WebhookMessage> messages = messageStoreService.getMessages();
        if (search != null && !search.isBlank()) {
            String lowerSearch = search.toLowerCase();
            messages = messages.stream()
                    .filter(m -> {
                        boolean matchesPath = m.getPath() != null &&
                                m.getPath().toLowerCase().contains(lowerSearch);
                        boolean matchesBody = m.getBody() != null &&
                                m.getBody().toLowerCase().contains(lowerSearch);
                        return matchesPath || matchesBody;
                    })
                    .toList();
        }
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WebhookMessage> getMessage(@PathVariable String id) {
        return messageStoreService.getMessage(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> clearMessages() {
        messageStoreService.clearMessages();
        return ResponseEntity.ok(Map.of("status", "cleared"));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Integer>> getMessageCount() {
        return ResponseEntity.ok(Map.of("count", messageStoreService.getMessageCount()));
    }
}
