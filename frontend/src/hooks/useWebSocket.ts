import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { WebhookMessage } from '../services/api';

interface UseWebSocketResult {
  latestMessage: WebhookMessage | null;
  connected: boolean;
}

export function useWebSocket(): UseWebSocketResult {
  const [latestMessage, setLatestMessage] = useState<WebhookMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  const connect = useCallback(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/messages', (frame) => {
          try {
            const message: WebhookMessage = JSON.parse(frame.body);
            setLatestMessage(message);
          } catch {
            // ignore malformed messages
          }
        });
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: () => {
        setConnected(false);
      },
      onWebSocketClose: () => {
        setConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [connect]);

  return { latestMessage, connected };
}
