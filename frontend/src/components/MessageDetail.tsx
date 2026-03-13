import type { WebhookMessage } from '../services/api';
import { useTranslation } from '../i18n';

interface MessageDetailProps {
  message: WebhookMessage | null;
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

function tryFormatJson(body: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
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

export default function MessageDetail({ message }: MessageDetailProps) {
  const { t } = useTranslation();

  if (!message) {
    return (
      <div className="message-detail empty-detail">
        <div className="empty-state">
          <div className="empty-state-icon">&#128270;</div>
          <p>{t('messageDetail.selectMessage')}</p>
        </div>
      </div>
    );
  }

  const headers = message.headers || {};
  const queryParams = message.queryParams || {};
  const headerEntries = Object.entries(headers);
  const queryEntries = Object.entries(queryParams);

  return (
    <div className="message-detail">
      <div className="detail-section">
        <h3>{t('messageDetail.generalInfo')}</h3>
        <div className="detail-grid">
          <div className="detail-label">{t('messageDetail.method')}</div>
          <div className="detail-value">
            <span className={`method-badge ${methodClass(message.method)}`}>{message.method}</span>
          </div>
          <div className="detail-label">{t('messageDetail.path')}</div>
          <div className="detail-value"><code>{message.path}</code></div>
          <div className="detail-label">{t('messageDetail.protocol')}</div>
          <div className="detail-value">
            <span className={`protocol-badge ${message.protocol === 'HTTPS' ? 'protocol-https' : 'protocol-http'}`}>
              {message.protocol || 'HTTP'}
            </span>
          </div>
          <div className="detail-label">{t('messageDetail.sourceIp')}</div>
          <div className="detail-value">{message.sourceIp}</div>
          <div className="detail-label">{t('messageDetail.timestamp')}</div>
          <div className="detail-value">{formatTimestamp(message.timestamp)}</div>
          <div className="detail-label">{t('messageDetail.responseStatus')}</div>
          <div className="detail-value">
            <span className={`status-badge ${message.responseStatusCode >= 400 ? 'status-error' : 'status-ok'}`}>
              {message.responseStatusCode}
            </span>
          </div>
          <div className="detail-label">{t('messageDetail.messageId')}</div>
          <div className="detail-value"><code className="id-code">{message.id}</code></div>
        </div>
      </div>

      {headerEntries.length > 0 && (
        <div className="detail-section">
          <h3>{t('messageDetail.headers')}</h3>
          <table className="kv-table">
            <thead>
              <tr>
                <th>{t('messageDetail.headerName')}</th>
                <th>{t('messageDetail.headerValue')}</th>
              </tr>
            </thead>
            <tbody>
              {headerEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="kv-key">{key}</td>
                  <td className="kv-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {queryEntries.length > 0 && (
        <div className="detail-section">
          <h3>{t('messageDetail.queryParams')}</h3>
          <table className="kv-table">
            <thead>
              <tr>
                <th>{t('messageDetail.paramName')}</th>
                <th>{t('messageDetail.paramValue')}</th>
              </tr>
            </thead>
            <tbody>
              {queryEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="kv-key">{key}</td>
                  <td className="kv-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="detail-section">
        <h3>{t('messageDetail.body')}</h3>
        {message.body ? (
          <pre className="code-block">{tryFormatJson(message.body)}</pre>
        ) : (
          <p className="empty-body">{t('messageDetail.noBody')}</p>
        )}
      </div>
    </div>
  );
}
