package com.webhook.simulator.service;

import com.webhook.simulator.model.WebhookMessage;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class MessageStoreService {

    private static final int MAX_MESSAGES = 1000;

    private final ConcurrentLinkedDeque<WebhookMessage> messages = new ConcurrentLinkedDeque<>();

    public void addMessage(WebhookMessage message) {
        messages.addFirst(message);
        while (messages.size() > MAX_MESSAGES) {
            messages.removeLast();
        }
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
        messages.clear();
    }

    public int getMessageCount() {
        return messages.size();
    }
}
