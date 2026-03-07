import { useState, useEffect, useCallback } from 'react';
import type { ResponseRule } from '../services/api';
import { fetchRules, createRule, updateRule, deleteRule } from '../services/api';

interface HeaderEntry {
  key: string;
  value: string;
}

const emptyForm = {
  pathPattern: '',
  statusCode: 200,
  responseBody: '',
  delayMs: 0,
};

export default function RuleEditor() {
  const [rules, setRules] = useState<ResponseRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const resetForm = () => {
    setForm(emptyForm);
    setHeaders([]);
    setEditingId(null);
  };

  const startEdit = (rule: ResponseRule) => {
    setEditingId(rule.id);
    setForm({
      pathPattern: rule.pathPattern,
      statusCode: rule.statusCode,
      responseBody: rule.responseBody,
      delayMs: rule.delayMs,
    });
    setHeaders(
      Object.entries(rule.responseHeaders || {}).map(([key, value]) => ({ key, value }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const responseHeaders: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim()) responseHeaders[h.key.trim()] = h.value;
    });
    const payload = { ...form, responseHeaders };

    try {
      if (editingId) {
        await updateRule(editingId, payload);
      } else {
        await createRule(payload);
      }
      resetForm();
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
      if (editingId === id) resetForm();
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (idx: number) => setHeaders(headers.filter((_, i) => i !== idx));
  const updateHeader = (idx: number, field: 'key' | 'value', val: string) => {
    setHeaders(headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h)));
  };

  return (
    <div className="rule-editor">
      <div className="rule-form-section">
        <h3>{editingId ? 'Edit Rule' : 'Create New Rule'}</h3>
        <form onSubmit={handleSubmit} className="rule-form">
          <div className="form-row">
            <label>Path Pattern</label>
            <input
              type="text"
              placeholder="/webhook/example/**"
              value={form.pathPattern}
              onChange={(e) => setForm({ ...form, pathPattern: e.target.value })}
              required
            />
          </div>
          <div className="form-row-group">
            <div className="form-row">
              <label>Status Code</label>
              <input
                type="number"
                min={100}
                max={599}
                value={form.statusCode}
                onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-row">
              <label>Delay (ms)</label>
              <input
                type="number"
                min={0}
                value={form.delayMs}
                onChange={(e) => setForm({ ...form, delayMs: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-row">
            <label>Response Body</label>
            <textarea
              rows={4}
              placeholder='{"status": "ok"}'
              value={form.responseBody}
              onChange={(e) => setForm({ ...form, responseBody: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>
              Response Headers
              <button type="button" className="btn btn-sm btn-secondary" onClick={addHeader}>+ Add</button>
            </label>
            {headers.map((h, idx) => (
              <div key={idx} className="header-entry">
                <input
                  type="text"
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Header value"
                  value={h.value}
                  onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                />
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeHeader(idx)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Rule' : 'Create Rule'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="rule-list-section">
        <h3>Existing Rules</h3>
        {loading && rules.length === 0 && <p>Loading rules...</p>}
        {!loading && rules.length === 0 && (
          <div className="empty-state">
            <p>No response rules configured</p>
            <p className="empty-state-hint">Create a rule above to customize webhook responses</p>
          </div>
        )}
        {rules.length > 0 && (
          <table className="rules-table">
            <thead>
              <tr>
                <th>Path Pattern</th>
                <th>Status</th>
                <th>Delay</th>
                <th>Response Body</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className={editingId === rule.id ? 'editing' : ''}>
                  <td><code>{rule.pathPattern}</code></td>
                  <td>
                    <span className={`status-badge ${rule.statusCode >= 400 ? 'status-error' : 'status-ok'}`}>
                      {rule.statusCode}
                    </span>
                  </td>
                  <td>{rule.delayMs}ms</td>
                  <td className="rule-body-cell">
                    {rule.responseBody ? (
                      <code className="truncate">{rule.responseBody.substring(0, 80)}{rule.responseBody.length > 80 ? '...' : ''}</code>
                    ) : (
                      <span className="empty-body">-</span>
                    )}
                  </td>
                  <td className="action-cell">
                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(rule)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(rule.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
