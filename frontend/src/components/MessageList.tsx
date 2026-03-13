import { useState, useEffect, useCallback } from 'react';
import type { WebhookMessage } from '../services/api';
import { fetchMessages, clearMessages as apiClearMessages } from '../services/api';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();

  const loadMessages = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMessages(query);
      setMessages(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('HTTP 500')) {
        return;
      }
      setError(msg || t('messages.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    if (!confirm(t('messages.clearConfirm'))) return;
    try {
      await apiClearMessages();
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.failedToClear'));
    }
  };

  return (
    <div className="message-list">
      <div className="message-list-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('messages.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleSearch} className="btn btn-secondary">{t('messages.search')}</button>
        </div>
        <button onClick={handleClear} className="btn btn-danger">{t('messages.clearAll')}</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && messages.length === 0 && (
        <div className="empty-state">{t('messages.loadingMessages')}</div>
      )}

      {!loading && messages.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">&#128233;</div>
          <p>{t('messages.noMessages')}</p>
          <p className="empty-state-hint">{t('messages.noMessagesHint').replace('{0}', '')}<code>/webhook/...</code></p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="message-table-wrapper">
          <table className="message-table">
            <thead>
              <tr>
                <th>{t('messages.time')}</th>
                <th>{t('messages.method')}</th>
                <th>{t('messages.path')}</th>
                <th>{t('messageDetail.protocol')}</th>
                <th>{t('messages.status')}</th>
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
                    <span className={`protocol-badge ${msg.protocol === 'HTTPS' ? 'protocol-https' : 'protocol-http'}`}>
                      {msg.protocol || 'HTTP'}
                    </span>
                  </td>
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
