import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

type BackendStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'external';
type StartMode = 'maven' | 'jar';

interface LogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  id: number;
}

interface BackendConfig {
  mode: StartMode;
  port: number;
  backendDir: string;
  jarPath: string;
  javaOpts: string;
}

const DEFAULT_CONFIG: BackendConfig = {
  mode: 'maven',
  port: 8080,
  backendDir: '../backend',
  jarPath: '../backend/target/webhook-server-0.0.1-SNAPSHOT.jar',
  javaOpts: '',
};

const CONFIG_FILE = '.backend-config.json';
const MAX_LOGS = 500;
const HEALTH_CHECK_INTERVAL = 2000;
const STOP_TIMEOUT = 5000;

export default function backendManager(): Plugin {
  let status: BackendStatus = 'stopped';
  let proc: ChildProcess | null = null;
  let logs: LogEntry[] = [];
  let logIdCounter = 0;
  let config: BackendConfig = { ...DEFAULT_CONFIG };
  let startTime: number | null = null;
  let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  let pluginRoot = '';

  function loadConfig(root: string) {
    pluginRoot = root;
    // env vars override
    const envMode = process.env.BACKEND_MODE as StartMode | undefined;
    const envPort = process.env.BACKEND_PORT;
    const envDir = process.env.BACKEND_DIR;
    const envJar = process.env.BACKEND_JAR;

    // file config
    const configPath = path.resolve(root, CONFIG_FILE);
    let fileConfig: Partial<BackendConfig> = {};
    try {
      if (fs.existsSync(configPath)) {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch {
      // ignore malformed config
    }

    config = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...(envMode ? { mode: envMode } : {}),
      ...(envPort ? { port: parseInt(envPort, 10) } : {}),
      ...(envDir ? { backendDir: envDir } : {}),
      ...(envJar ? { jarPath: envJar } : {}),
    };
  }

  function saveConfig() {
    try {
      const configPath = path.resolve(pluginRoot, CONFIG_FILE);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch {
      // ignore
    }
  }

  function addLog(stream: LogEntry['stream'], text: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      stream,
      text,
      id: ++logIdCounter,
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }
  }

  function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = net.connect({ port, host: '127.0.0.1' }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(1000, () => {
        sock.destroy();
        resolve(false);
      });
    });
  }

  function healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        `http://127.0.0.1:${config.port}/api/messages/count`,
        { timeout: 3000 },
        (res) => {
          res.resume();
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  function startHealthChecks() {
    stopHealthChecks();
    healthCheckTimer = setInterval(async () => {
      if (status === 'starting') {
        const alive = await healthCheck();
        if (alive) {
          status = 'running';
          addLog('system', `Backend is running on port ${config.port}`);
        }
      } else if (status === 'running') {
        const alive = await healthCheck();
        if (!alive && proc && proc.exitCode !== null) {
          status = 'stopped';
          addLog('system', 'Backend process exited unexpectedly');
          stopHealthChecks();
        }
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  function stopHealthChecks() {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
  }

  async function startBackend(mode?: StartMode): Promise<{ ok: boolean; error?: string }> {
    if (status === 'running' || status === 'starting') {
      return { ok: false, error: 'Backend is already running or starting' };
    }
    if (status === 'external') {
      return { ok: false, error: 'An external backend is already running on the port' };
    }

    const portInUse = await checkPort(config.port);
    if (portInUse) {
      status = 'external';
      addLog('system', `Port ${config.port} already in use — detected external backend`);
      return { ok: false, error: 'Port already in use by an external process' };
    }

    const useMode = mode || config.mode;
    const cwd = path.resolve(pluginRoot, config.backendDir);

    if (!fs.existsSync(cwd)) {
      return { ok: false, error: `Backend directory not found: ${cwd}` };
    }

    status = 'starting';
    startTime = Date.now();
    addLog('system', `Starting backend in ${useMode} mode...`);

    try {
      if (useMode === 'maven') {
        // Check if mvnw exists
        const mvnw = path.join(cwd, 'mvnw');
        const cmd = fs.existsSync(mvnw) ? './mvnw' : 'mvn';
        proc = spawn(cmd, ['spring-boot:run'], {
          cwd,
          shell: true,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            ...(config.javaOpts ? { MAVEN_OPTS: config.javaOpts } : {}),
          },
        });
      } else {
        const jarPath = path.resolve(pluginRoot, config.jarPath);
        if (!fs.existsSync(jarPath)) {
          status = 'stopped';
          return { ok: false, error: `JAR file not found: ${jarPath}` };
        }
        const args = [
          ...(config.javaOpts ? config.javaOpts.split(' ') : []),
          '-jar',
          jarPath,
        ];
        proc = spawn('java', args, {
          cwd,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        text.split('\n').filter(Boolean).forEach((line) => addLog('stdout', line));
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        text.split('\n').filter(Boolean).forEach((line) => addLog('stderr', line));
      });

      proc.on('exit', (code, signal) => {
        addLog('system', `Backend process exited (code=${code}, signal=${signal})`);
        if (status !== 'stopping') {
          status = 'stopped';
        }
        proc = null;
        startTime = null;
        stopHealthChecks();
      });

      proc.on('error', (err) => {
        addLog('system', `Failed to start backend: ${err.message}`);
        status = 'stopped';
        proc = null;
        startTime = null;
      });

      startHealthChecks();
      return { ok: true };
    } catch (err: unknown) {
      status = 'stopped';
      const msg = err instanceof Error ? err.message : String(err);
      addLog('system', `Start failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  async function stopBackend(force = false): Promise<{ ok: boolean; error?: string }> {
    if (status === 'external') {
      return { ok: false, error: 'Cannot stop an external backend process' };
    }
    if (status === 'stopped') {
      return { ok: false, error: 'Backend is not running' };
    }
    if (!proc) {
      status = 'stopped';
      return { ok: true };
    }

    status = 'stopping';
    addLog('system', force ? 'Force stopping backend...' : 'Stopping backend...');
    stopHealthChecks();

    return new Promise((resolve) => {
      const pid = proc!.pid;
      if (!pid) {
        status = 'stopped';
        proc = null;
        resolve({ ok: true });
        return;
      }

      const onExit = () => {
        clearTimeout(killTimer);
        status = 'stopped';
        proc = null;
        startTime = null;
        addLog('system', 'Backend stopped');
        resolve({ ok: true });
      };

      proc!.once('exit', onExit);

      if (force) {
        try { process.kill(-pid, 'SIGKILL'); } catch { /* ignore */ }
      } else {
        try { process.kill(-pid, 'SIGTERM'); } catch { /* ignore */ }
      }

      const killTimer = setTimeout(() => {
        if (proc && proc.exitCode === null) {
          addLog('system', 'Graceful shutdown timed out, force killing...');
          try { process.kill(-pid, 'SIGKILL'); } catch { /* ignore */ }
        }
      }, STOP_TIMEOUT);
    });
  }

  function getStatusResponse() {
    return {
      status,
      pid: proc?.pid ?? null,
      uptime: startTime ? Date.now() - startTime : null,
      config,
    };
  }

  function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
      });
    });
  }

  return {
    name: 'backend-manager',
    configureServer(server: ViteDevServer) {
      loadConfig(server.config.root);

      // Check if backend is already running on startup
      checkPort(config.port).then((inUse) => {
        if (inUse) {
          status = 'external';
          addLog('system', `Detected existing backend on port ${config.port}`);
        }
      });

      // Middleware — runs before Vite proxy
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (!url.startsWith('/api/backend/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        const sendJson = (statusCode: number, data: unknown) => {
          res.writeHead(statusCode);
          res.end(JSON.stringify(data));
        };

        const route = url.replace(/\?.*$/, '').replace('/api/backend/', '');

        try {
          if (route === 'status' && req.method === 'GET') {
            sendJson(200, getStatusResponse());
          } else if (route === 'start' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await startBackend(body.mode as StartMode | undefined);
            sendJson(result.ok ? 200 : 400, { ...result, ...getStatusResponse() });
          } else if (route === 'stop' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await stopBackend(!!body.force);
            sendJson(result.ok ? 200 : 400, { ...result, ...getStatusResponse() });
          } else if (route === 'restart' && req.method === 'POST') {
            if (status === 'running' || status === 'starting') {
              await stopBackend();
            }
            // Small delay to let port release
            await new Promise((r) => setTimeout(r, 500));
            const result = await startBackend();
            sendJson(result.ok ? 200 : 400, { ...result, ...getStatusResponse() });
          } else if (route === 'logs' && req.method === 'GET') {
            const params = new URL(url, 'http://localhost').searchParams;
            const since = parseInt(params.get('since') || '0', 10);
            const filtered = since ? logs.filter((l) => l.id > since) : logs;
            sendJson(200, { logs: filtered });
          } else if (route === 'config' && req.method === 'GET') {
            sendJson(200, config);
          } else if (route === 'config' && req.method === 'PUT') {
            if (status !== 'stopped') {
              sendJson(400, { error: 'Stop the backend before changing configuration' });
            } else {
              const body = await parseBody(req);
              config = { ...config, ...body } as BackendConfig;
              saveConfig();
              sendJson(200, config);
            }
          } else {
            sendJson(404, { error: 'Not found' });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          sendJson(500, { error: msg });
        }
      });

      // Cleanup on server close
      server.httpServer?.on('close', () => {
        stopHealthChecks();
        if (proc && proc.pid && proc.exitCode === null) {
          addLog('system', 'Vite server closing — stopping backend...');
          try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* ignore */ }
          setTimeout(() => {
            if (proc && proc.pid && proc.exitCode === null) {
              try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* ignore */ }
            }
          }, 3000);
        }
      });
    },
  };
}
