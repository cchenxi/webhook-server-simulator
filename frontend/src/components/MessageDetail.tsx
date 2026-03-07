import type { WebhookMessage } from '../services/api';

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
  if (!message) {
    return (
      <div className="message-detail empty-detail">
        <div className="empty-state">
          <div className="empty-state-icon">&#128270;</div>
          <p>Select a message to view details</p>
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
        <h3>General Info</h3>
        <div className="detail-grid">
          <div className="detail-label">Method</div>
          <div className="detail-value">
            <span className={`method-badge ${methodClass(message.method)}`}>{message.method}</span>
          </div>
          <div className="detail-label">Path</div>
          <div className="detail-value"><code>{message.path}</code></div>
          <div className="detail-label">Source IP</div>
          <div className="detail-value">{message.sourceIp}</div>
          <div className="detail-label">Timestamp</div>
          <div className="detail-value">{formatTimestamp(message.timestamp)}</div>
          <div className="detail-label">Response Status</div>
          <div className="detail-value">
            <span className={`status-badge ${message.responseStatusCode >= 400 ? 'status-error' : 'status-ok'}`}>
              {message.responseStatusCode}
            </span>
          </div>
          <div className="detail-label">Message ID</div>
          <div className="detail-value"><code className="id-code">{message.id}</code></div>
        </div>
      </div>

      {headerEntries.length > 0 && (
        <div className="detail-section">
          <h3>Headers</h3>
          <table className="kv-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
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
          <h3>Query Parameters</h3>
          <table className="kv-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
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
        <h3>Body</h3>
        {message.body ? (
          <pre className="code-block">{tryFormatJson(message.body)}</pre>
        ) : (
          <p className="empty-body">No body content</p>
        )}
      </div>
    </div>
  );
}
