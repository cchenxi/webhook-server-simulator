import { useState, useEffect, useCallback } from 'react';
import type { ConcurrencyConfig } from '../services/api';
import { fetchConcurrencyConfig, updateConcurrencyConfig } from '../services/api';

export default function ConcurrencyPanel() {
  const [config, setConfig] = useState<ConcurrencyConfig | null>(null);
  const [form, setForm] = useState<ConcurrencyConfig>({
    maxConcurrency: 10,
    rateLimitPerSecond: 100,
    timeoutMs: 30000,
    rejectOnFull: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConcurrencyConfig();
      setConfig(data);
      setForm(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateConcurrencyConfig(form);
      setConfig(updated);
      setForm(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return <div className="concurrency-panel"><p>Loading configuration...</p></div>;
  }

  return (
    <div className="concurrency-panel">
      <div className="concurrency-status">
        <h3>Current Configuration</h3>
        {config && (
          <div className="config-cards">
            <div className="config-card">
              <div className="config-card-value">{config.maxConcurrency}</div>
              <div className="config-card-label">Max Concurrency</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.rateLimitPerSecond}</div>
              <div className="config-card-label">Rate Limit / sec</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.timeoutMs}ms</div>
              <div className="config-card-label">Timeout</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.rejectOnFull ? 'Yes' : 'No'}</div>
              <div className="config-card-label">Reject on Full</div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">Configuration updated successfully!</div>}

      <div className="concurrency-form-section">
        <h3>Update Configuration</h3>
        <form onSubmit={handleSave} className="concurrency-form">
          <div className="form-row-group">
            <div className="form-row">
              <label>Max Concurrency</label>
              <input
                type="number"
                min={1}
                value={form.maxConcurrency}
                onChange={(e) => setForm({ ...form, maxConcurrency: Number(e.target.value) })}
                required
              />
              <span className="form-hint">Maximum concurrent webhook processing</span>
            </div>
            <div className="form-row">
              <label>Rate Limit (per second)</label>
              <input
                type="number"
                min={1}
                value={form.rateLimitPerSecond}
                onChange={(e) => setForm({ ...form, rateLimitPerSecond: Number(e.target.value) })}
                required
              />
              <span className="form-hint">Maximum requests per second</span>
            </div>
          </div>
          <div className="form-row-group">
            <div className="form-row">
              <label>Timeout (ms)</label>
              <input
                type="number"
                min={100}
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
                required
              />
              <span className="form-hint">Request processing timeout in milliseconds</span>
            </div>
            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.rejectOnFull}
                  onChange={(e) => setForm({ ...form, rejectOnFull: e.target.checked })}
                />
                Reject on Full
              </label>
              <span className="form-hint">Reject requests when concurrency limit is reached</span>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadConfig}>Reset</button>
          </div>
        </form>
      </div>
    </div>
  );
}
