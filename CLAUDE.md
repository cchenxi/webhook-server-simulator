# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webhook server simulator for development/debugging. Receives, records, and displays webhook messages with custom response rules and concurrency control. Monorepo with Java backend and React frontend.

## Build & Run Commands

### Backend (Java 17 + Spring Boot 3.3 + Maven)
```bash
cd backend
mvn compile              # compile only
mvn spring-boot:run      # run on port 8080 (HTTP) + 8443 (HTTPS)
```

### Frontend (React 18 + Vite + TypeScript)
```bash
cd frontend
npm install              # install dependencies
npm run dev              # dev server on port 5173 (proxies to backend)
npm run build            # production build
npx tsc --noEmit         # type check without emit
```

Note: The frontend includes a Vite plugin that can start/stop the backend from the UI. Just run `npm run dev` and use the Backend tab to manage the backend process — no need to manually run `mvn spring-boot:run`.

### Testing
```bash
# Send test webhook (HTTP)
curl -X POST http://localhost:8080/webhook/test -H "Content-Type: application/json" -d '{"event":"test"}'

# Send test webhook (HTTPS, -k to skip cert verification)
curl -k -X POST https://localhost:8443/webhook/test -H "Content-Type: application/json" -d '{"event":"test"}'

# Periodic webhook client (every 60s)
./webhook-client.sh [url]
```

## Architecture

### Request Flow
1. HTTP/HTTPS request hits `WebhookReceiverController` at `/webhook/**` (all methods)
2. `ConcurrencyControlService.acquire()` — Semaphore check (503) then RateLimiter check (429)
3. `ResponseRuleService.matchRule(path)` — AntPathMatcher glob matching, first-match wins
4. If rule has `delayMs > 0`, sleep to simulate slow response
5. `MessageStoreService.addMessage()` — stores in ConcurrentLinkedDeque (max 1000, FIFO eviction)
6. `SimpMessagingTemplate.convertAndSend("/topic/messages")` — WebSocket broadcast
7. Return matched rule's response or default `200 {"status":"received"}`
8. Release semaphore in finally block

### Backend Key Design
- **All storage is in-memory** — no database, data lost on restart
- **Thread-safe collections**: ConcurrentLinkedDeque (messages), CopyOnWriteArrayList (rules)
- **Concurrency control**: Semaphore (max concurrent) + Guava RateLimiter (token bucket). `rejectOnFull=true` rejects immediately with 503; `false` queues up to `timeoutMs`
- **Dynamic reconfiguration**: Concurrency params changeable at runtime via API — recreates Semaphore/RateLimiter instances
- **HTTPS support**: `HttpsConnectorConfig` auto-generates a self-signed certificate (RSA 2048, CN=localhost, SAN: localhost + 127.0.0.1) at startup using JDK `sun.security.x509` API, stored in memory KeyStore. Adds a Tomcat HTTPS Connector on port 8443 alongside HTTP 8080. Uses `--add-exports java.base/sun.security.x509=ALL-UNNAMED` for both compile and runtime.

### Frontend-Backend Communication
- **REST**: Frontend fetches `/api/*` endpoints, Vite proxies to `localhost:8080` in dev
- **WebSocket**: STOMP over SockJS at `/ws`, subscribes to `/topic/messages` for real-time updates
- **SockJS requires `global` polyfill** in browser — set via `<script>var global = globalThis;</script>` in index.html

### Frontend Structure
- `App.tsx` — tab router (Messages / Response Rules / Concurrency / Backend), manages WebSocket connection
- `useWebSocket` hook — STOMP client with 3s reconnect, 10s heartbeat
- `useBackendStatus` hook — polls `/api/backend/status` every 3s
- `api.ts` — fetch wrapper for all REST endpoints, exports TypeScript interfaces
- `BackendPanel.tsx` — backend process management UI (start/stop/restart, config, logs)
- Components are self-contained with local state; no external state management library

### Backend Process Management (Vite Plugin)
- `vite-plugin-backend-manager.ts` — Vite plugin that runs as middleware, intercepting `/api/backend/*` before Vite proxy
- Uses Node.js `child_process.spawn` with `detached: true` for process group management
- Supports Maven mode (`mvn spring-boot:run`) and JAR mode (`java -jar`)
- Health check: polls `http://localhost:8080/api/messages/count` every 2s to detect running state
- Port detection: TCP probe on startup to detect external backends
- Process cleanup: SIGTERM → 5s timeout → SIGKILL; auto-cleanup on Vite server close
- Config persisted to `frontend/.backend-config.json` (gitignored)
- Logs stored in memory ring buffer (max 500 entries), supports incremental fetch via `?since=`

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| ANY | `/webhook/**` | Receive webhooks |
| GET/DELETE | `/api/messages` | List (with `?search=`) / Clear messages |
| GET | `/api/messages/{id}` | Message detail |
| CRUD | `/api/rules` | Response rule management |
| GET/PUT | `/api/concurrency` | Concurrency config |
| GET | `/api/backend/status` | Backend process status |
| POST | `/api/backend/start` | Start backend |
| POST | `/api/backend/stop` | Stop backend |
| POST | `/api/backend/restart` | Restart backend |
| GET | `/api/backend/logs` | Backend logs (`?since=` for incremental) |
| GET/PUT | `/api/backend/config` | Backend config (edit only when stopped) |
