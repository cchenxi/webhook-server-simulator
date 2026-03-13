export interface WebhookMessage {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  queryParams: Record<string, string>;
  sourceIp: string;
  protocol: string;
  timestamp: string;
  responseStatusCode: number;
}

export interface ResponseRule {
  id: string;
  pathPattern: string;
  statusCode: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  delayMs: number;
  createdAt: string;
}

export interface ConcurrencyConfig {
  maxConcurrency: number;
  rateLimitPerSecond: number;
  timeoutMs: number;
  rejectOnFull: boolean;
}

const BASE = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return undefined as unknown as T;
}

export async function fetchMessages(search?: string): Promise<WebhookMessage[]> {
  const url = search
    ? `${BASE}/api/messages?search=${encodeURIComponent(search)}`
    : `${BASE}/api/messages`;
  const res = await fetch(url);
  return handleResponse<WebhookMessage[]>(res);
}

export async function fetchMessage(id: string): Promise<WebhookMessage> {
  const res = await fetch(`${BASE}/api/messages/${encodeURIComponent(id)}`);
  return handleResponse<WebhookMessage>(res);
}

export async function clearMessages(): Promise<void> {
  const res = await fetch(`${BASE}/api/messages`, { method: 'DELETE' });
  await handleResponse<void>(res);
}

export async function fetchMessageCount(): Promise<number> {
  const res = await fetch(`${BASE}/api/messages/count`);
  return handleResponse<number>(res);
}

export async function fetchRules(): Promise<ResponseRule[]> {
  const res = await fetch(`${BASE}/api/rules`);
  return handleResponse<ResponseRule[]>(res);
}

export async function createRule(rule: Omit<ResponseRule, 'id' | 'createdAt'>): Promise<ResponseRule> {
  const res = await fetch(`${BASE}/api/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleResponse<ResponseRule>(res);
}

export async function updateRule(id: string, rule: Omit<ResponseRule, 'id' | 'createdAt'>): Promise<ResponseRule> {
  const res = await fetch(`${BASE}/api/rules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleResponse<ResponseRule>(res);
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await handleResponse<void>(res);
}

export async function fetchConcurrencyConfig(): Promise<ConcurrencyConfig> {
  const res = await fetch(`${BASE}/api/concurrency`);
  return handleResponse<ConcurrencyConfig>(res);
}

export async function updateConcurrencyConfig(config: ConcurrencyConfig): Promise<ConcurrencyConfig> {
  const res = await fetch(`${BASE}/api/concurrency`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return handleResponse<ConcurrencyConfig>(res);
}

// ===== Backend Management =====

export interface BackendConfig {
  mode: 'maven' | 'jar';
  port: number;
  backendDir: string;
  jarPath: string;
  javaOpts: string;
}

export interface BackendLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  id: number;
}

export interface BackendStatusResponse {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'external';
  pid: number | null;
  uptime: number | null;
  config: BackendConfig;
  ok?: boolean;
  error?: string;
}

export async function fetchBackendStatus(): Promise<BackendStatusResponse> {
  const res = await fetch(`${BASE}/api/backend/status`);
  return handleResponse<BackendStatusResponse>(res);
}

export async function startBackend(mode?: 'maven' | 'jar'): Promise<BackendStatusResponse> {
  const res = await fetch(`${BASE}/api/backend/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mode ? { mode } : {}),
  });
  return handleResponse<BackendStatusResponse>(res);
}

export async function stopBackend(force = false): Promise<BackendStatusResponse> {
  const res = await fetch(`${BASE}/api/backend/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  return handleResponse<BackendStatusResponse>(res);
}

export async function restartBackend(): Promise<BackendStatusResponse> {
  const res = await fetch(`${BASE}/api/backend/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleResponse<BackendStatusResponse>(res);
}

export async function fetchBackendLogs(since = 0): Promise<{ logs: BackendLogEntry[] }> {
  const res = await fetch(`${BASE}/api/backend/logs?since=${since}`);
  return handleResponse<{ logs: BackendLogEntry[] }>(res);
}

export async function fetchBackendConfig(): Promise<BackendConfig> {
  const res = await fetch(`${BASE}/api/backend/config`);
  return handleResponse<BackendConfig>(res);
}

export async function updateBackendConfig(config: Partial<BackendConfig>): Promise<BackendConfig> {
  const res = await fetch(`${BASE}/api/backend/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return handleResponse<BackendConfig>(res);
}
