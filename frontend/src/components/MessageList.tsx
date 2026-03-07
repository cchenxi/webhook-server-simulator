import { useState, useEffect, useCallback } from 'react';
import type { WebhookMessage } from '../services/api';
import { fetchMessages, clearMessages as apiClearMessages } from '../services/api';

interface MessageListProps {
  onSelectMessage: (message: WebhookMessage) => void;
  selectedMessageId: string | null;
  latestWsMessage: WebhookMessage | null;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'method-get';
    case 'POST': return 'method-post';
    case 'PUT': return 'method-put';
    case 'DELETE': return 'method-delete';
    case 'PATCH': return 'method-patch';
    default: return 'method-other';
  }
}

export default function MessageList({ onSelectMessage, selectedMessageId, latestWsMessage }: MessageListProps) {
  const [messages, setMessages] = useState<WebhookMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMessages(query);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (latestWsMessage) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === latestWsMessage.id);
        if (exists) return prev;
        return [latestWsMessage, ...prev];
      });
    }
  }, [latestWsMessage]);

  const handleSearch = () => {
    loadMessages(search || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = async () => {
    if (!confirm('Clear all messages?')) return;
    try {
      await apiClearMessages();
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear messages');
    }
  };

  return (
    <div className="message-list">
      <div className="message-list-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleSearch} className="btn btn-secondary">Search</button>
        </div>
        <button onClick={handleClear} className="btn btn-danger">Clear All</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && messages.length === 0 && (
        <div className="empty-state">Loading messages...</div>
      )}

      {!loading && messages.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">&#128233;</div>
          <p>No messages yet</p>
          <p className="empty-state-hint">Send a webhook to <code>/webhook/...</code> to see it here</p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="message-table-wrapper">
          <table className="message-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr
                  key={msg.id}
                  className={`message-row ${selectedMessageId === msg.id ? 'selected' : ''}`}
                  onClick={() => onSelectMessage(msg)}
                >
                  <td className="msg-time">{formatTimestamp(msg.timestamp)}</td>
                  <td>
                    <span className={`method-badge ${methodClass(msg.method)}`}>
                      {msg.method}
                    </span>
                  </td>
                  <td className="msg-path">{msg.path}</td>
                  <td>
                    <span className={`status-badge ${msg.responseStatusCode >= 400 ? 'status-error' : 'status-ok'}`}>
                      {msg.responseStatusCode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
