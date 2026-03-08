import { useState, useEffect, useRef, useCallback } from 'react';
import { useBackendStatus } from '../hooks/useBackendStatus';
import {
  startBackend,
  stopBackend,
  restartBackend,
  fetchBackendLogs,
  updateBackendConfig,
} from '../services/api';
import type { BackendLogEntry, BackendConfig } from '../services/api';

const LOG_POLL_INTERVAL = 2000;

export default function BackendPanel() {
  const { status, pid, uptime, config, error: statusError, refresh } = useBackendStatus();

  const [logs, setLogs] = useState<BackendLogEntry[]>([]);
  const [lastLogId, setLastLogId] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mode, setMode] = useState<'maven' | 'jar'>('maven');
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<BackendConfig>>({});

  const logContainerRef = useRef<HTMLDivElement>(null);
  const logTimerRef = useRef<ReturnType<typeof setInterval>>();
  const autoScrollRef = useRef(true);

  // Sync mode from config
  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setConfigForm(config);
    }
  }, [config]);

  // Poll logs
  const pollLogs = useCallback(async () => {
    try {
      const result = await fetchBackendLogs(lastLogId);
      if (result.logs.length > 0) {
        setLogs((prev) => {
          const combined = [...prev, ...result.logs];
          return combined.slice(-500);
        });
        setLastLogId(result.logs[result.logs.length - 1].id);
      }
    } catch {
      // ignore
    }
  }, [lastLogId]);

  useEffect(() => {
    pollLogs();
    logTimerRef.current = setInterval(pollLogs, LOG_POLL_INTERVAL);
    return () => clearInterval(logTimerRef.current);
  }, [pollLogs]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleLogScroll = () => {
    if (!logContainerRef.current) return;
    const el = logContainerRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  async function handleStart() {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await startBackend(mode);
      if (result.error) setActionError(result.error);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Start failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop(force = false) {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await stopBackend(force);
      if (result.error) setActionError(result.error);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Stop failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestart() {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await restartBackend();
      if (result.error) setActionError(result.error);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveConfig() {
    setActionError(null);
    try {
      await updateBackendConfig(configForm);
      setEditingConfig(false);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save config');
    }
  }

  function formatUptime(ms: number | null): string {
    if (!ms) return '-';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }

  const statusClass =
    status === 'running' ? 'backend-running' :
    status === 'starting' ? 'backend-starting' :
    status === 'external' ? 'backend-external' :
    status === 'stopping' ? 'backend-stopping' :
    'backend-stopped';

  const canStart = status === 'stopped';
  const canStop = status === 'running' || status === 'starting';
  const canRestart = status === 'running';

  return (
    <div className="backend-panel">
      {/* Status & Controls */}
      <div className="backend-status-section">
        <h3>Backend Server</h3>
        <div className="backend-controls">
          <div className="backend-status-display">
            <span className={`backend-status-dot ${statusClass}`} />
            <span className="backend-status-text">{status.toUpperCase()}</span>
            {pid && <span className="backend-pid">PID: {pid}</span>}
            {uptime && <span className="backend-uptime">{formatUptime(uptime)}</span>}
          </div>
          <div className="backend-actions">
            <div className="backend-mode-select">
              <label>Mode:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'maven' | 'jar')}
                disabled={!canStart}
              >
                <option value="maven">Maven</option>
                <option value="jar">JAR</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleStart} disabled={!canStart || actionLoading}>
              {actionLoading && status === 'stopped' ? 'Starting...' : 'Start'}
            </button>
            <button className="btn btn-danger" onClick={() => handleStop()} disabled={!canStop || actionLoading}>
              Stop
            </button>
            <button className="btn btn-secondary" onClick={handleRestart} disabled={!canRestart || actionLoading}>
              Restart
            </button>
          </div>
        </div>
      </div>

      {(actionError || statusError) && (
        <div className="error-banner">{actionError || statusError}</div>
      )}

      {/* Config */}
      {config && (
        <div className="backend-config-section">
          <div className="backend-config-header">
            <h3>Configuration</h3>
            {!editingConfig && status === 'stopped' && (
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingConfig(true)}>
                Edit
              </button>
            )}
          </div>
          {editingConfig ? (
            <div className="backend-config-form">
              <div className="form-row-group">
                <div className="form-row">
                  <label>Port</label>
                  <input
                    type="number"
                    value={configForm.port ?? config.port}
                    onChange={(e) => setConfigForm({ ...configForm, port: Number(e.target.value) })}
                  />
                </div>
                <div className="form-row">
                  <label>Backend Dir</label>
                  <input
                    type="text"
                    value={configForm.backendDir ?? config.backendDir}
                    onChange={(e) => setConfigForm({ ...configForm, backendDir: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <label>JAR Path</label>
                <input
                  type="text"
                  value={configForm.jarPath ?? config.jarPath}
                  onChange={(e) => setConfigForm({ ...configForm, jarPath: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Java Opts</label>
                <input
                  type="text"
                  value={configForm.javaOpts ?? config.javaOpts}
                  onChange={(e) => setConfigForm({ ...configForm, javaOpts: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSaveConfig}>Save</button>
                <button className="btn btn-secondary" onClick={() => setEditingConfig(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="config-cards">
              <div className="config-card">
                <div className="config-card-value">{config.port}</div>
                <div className="config-card-label">Port</div>
              </div>
              <div className="config-card">
                <div className="config-card-value">{config.mode}</div>
                <div className="config-card-label">Mode</div>
              </div>
              <div className="config-card">
                <div className="config-card-value backend-config-path" title={config.backendDir}>
                  {config.backendDir.split('/').pop() || config.backendDir}
                </div>
                <div className="config-card-label">Backend Dir</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="backend-logs-section">
        <div className="backend-logs-header">
          <h3>Logs</h3>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setLogs([]); setLastLogId(0); }}
          >
            Clear
          </button>
        </div>
        <div
          className="backend-logs-viewer"
          ref={logContainerRef}
          onScroll={handleLogScroll}
        >
          {logs.length === 0 ? (
            <div className="backend-logs-empty">No logs yet. Start the backend to see output.</div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className={`log-line log-${entry.stream}`}>
                <span className="log-time">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="log-text">{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
