package com.webhook.simulator.service;

import com.webhook.simulator.model.WebhookMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;

@Slf4j
@Service
public class MessageStoreService {

    private static final int MAX_MESSAGES = 1000;

    private final ConcurrentLinkedDeque<WebhookMessage> messages = new ConcurrentLinkedDeque<>();

    public void addMessage(WebhookMessage message) {
        messages.addFirst(message);
        while (messages.size() > MAX_MESSAGES) {
            messages.removeLast();
            log.debug("Message store exceeded max capacity ({}), oldest message evicted", MAX_MESSAGES);
        }
        log.debug("Message stored [{}], total count: {}", message.getId(), messages.size());
    }

    public List<WebhookMessage> getMessages() {
        return Collections.unmodifiableList(new ArrayList<>(messages));
    }

    public Optional<WebhookMessage> getMessage(String id) {
        return messages.stream()
                .filter(m -> m.getId().equals(id))
                .findFirst();
    }

    public void clearMessages() {
        int count = messages.size();
        messages.clear();
        log.info("Cleared {} stored messages", count);
    }

    public int getMessageCount() {
        return messages.size();
    }
}
