export interface WebhookMessage {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  queryParams: Record<string, string>;
  sourceIp: string;
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
