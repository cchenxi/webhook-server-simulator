import { useState, useEffect, useCallback } from 'react';
import type { ConcurrencyConfig } from '../services/api';
import { fetchConcurrencyConfig, updateConcurrencyConfig } from '../services/api';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConcurrencyConfig();
      setConfig(data);
      setForm(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Failed to fetch') || msg.includes('HTTP 500')) {
        return;
      }
      setError(msg || t('concurrency.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(err instanceof Error ? err.message : t('concurrency.failedToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return <div className="concurrency-panel"><p>{t('concurrency.loadingConfig')}</p></div>;
  }

  return (
    <div className="concurrency-panel">
      <div className="concurrency-status">
        <h3>{t('concurrency.currentConfig')}</h3>
        {config && (
          <div className="config-cards">
            <div className="config-card">
              <div className="config-card-value">{config.maxConcurrency}</div>
              <div className="config-card-label">{t('concurrency.maxConcurrency')}</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.rateLimitPerSecond}</div>
              <div className="config-card-label">{t('concurrency.rateLimitPerSec')}</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.timeoutMs}ms</div>
              <div className="config-card-label">{t('concurrency.timeout')}</div>
            </div>
            <div className="config-card">
              <div className="config-card-value">{config.rejectOnFull ? t('common.yes') : t('common.no')}</div>
              <div className="config-card-label">{t('concurrency.rejectOnFull')}</div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{t('concurrency.updateSuccess')}</div>}

      <div className="concurrency-form-section">
        <h3>{t('concurrency.updateConfig')}</h3>
        <form onSubmit={handleSave} className="concurrency-form">
          <div className="form-row-group">
            <div className="form-row">
              <label>{t('concurrency.maxConcurrency')}</label>
              <input
                type="number"
                min={1}
                value={form.maxConcurrency}
                onChange={(e) => setForm({ ...form, maxConcurrency: Number(e.target.value) })}
                required
              />
              <span className="form-hint">{t('concurrency.maxConcurrencyHint')}</span>
            </div>
            <div className="form-row">
              <label>{t('concurrency.rateLimitPerSec')}</label>
              <input
                type="number"
                min={1}
                value={form.rateLimitPerSecond}
                onChange={(e) => setForm({ ...form, rateLimitPerSecond: Number(e.target.value) })}
                required
              />
              <span className="form-hint">{t('concurrency.rateLimitHint')}</span>
            </div>
          </div>
          <div className="form-row-group">
            <div className="form-row">
              <label>{t('concurrency.timeout')} (ms)</label>
              <input
                type="number"
                min={100}
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
                required
              />
              <span className="form-hint">{t('concurrency.timeoutHint')}</span>
            </div>
            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.rejectOnFull}
                  onChange={(e) => setForm({ ...form, rejectOnFull: e.target.checked })}
                />
                {t('concurrency.rejectOnFull')}
              </label>
              <span className="form-hint">{t('concurrency.rejectOnFullHint')}</span>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('concurrency.saving') : t('concurrency.saveConfig')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadConfig}>{t('common.reset')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
