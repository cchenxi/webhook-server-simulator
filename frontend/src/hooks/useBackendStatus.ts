import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchBackendStatus } from '../services/api';
import type { BackendStatusResponse } from '../services/api';

const POLL_INTERVAL = 3000;

export function useBackendStatus() {
  const [data, setData] = useState<BackendStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      const result = await fetchBackendStatus();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch backend status');
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  return {
    status: data?.status ?? 'stopped',
    pid: data?.pid ?? null,
    uptime: data?.uptime ?? null,
    config: data?.config ?? null,
    error,
    refresh,
  };
}
