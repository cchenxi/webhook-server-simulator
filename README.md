# Webhook Server Simulator

用于开发调试的 webhook 模拟服务端。接收、记录和展示 webhook 消息，支持自定义响应规则和并发控制。

## 功能一览

- **Webhook 接收** — 支持所有 HTTP 方法，HTTP (8080) 和 HTTPS (8443) 双端口，通配路径 `/webhook/**`
- **实时消息展示** — 通过 WebSocket 实时推送，Web UI 即时查看消息详情
- **自定义响应规则** — 按路径模式匹配，自定义状态码、响应体、响应头和延迟时间
- **并发控制** — Semaphore + 令牌桶限流，参数动态调整
- **后端进程管理** — 一键启停后端服务，支持 Maven/JAR 双模式
- **国际化** — 中文 / English 自动切换
- **优雅降级** — 后端不可用时所有页面静默处理网络错误

## 技术栈

- **后端**: Java 17 + Spring Boot 3.3 + Maven
- **前端**: React 18 + Vite + TypeScript
- **实时通信**: WebSocket（STOMP over SockJS）
- **数据存储**: 内存（最近 1000 条消息）
- **HTTPS**: 启动时自动生成自签名证书，端口 8443
- **国际化**: 中文 / English（自动检测浏览器语言）

## 环境要求

| 工具 | 最低版本 | 验证命令 |
|------|----------|----------|
| Java | 17+ | `java --version` |
| Maven | 3.6+ | `mvn --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |

## 快速开始

### 方式一：前后端独立启动（推荐）

#### 1. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端将在 `http://localhost:8080`（HTTP）和 `https://localhost:8443`（HTTPS，自签名证书）上启动。

#### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`，会自动代理 API 请求到后端。

#### 3. 发送测试消息

```bash
# HTTP
curl -X POST http://localhost:8080/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":"hello"}'

# HTTPS（-k 跳过自签名证书验证）
curl -k -X POST https://localhost:8443/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":"hello"}'
```

#### 4. 查看结果

打开浏览器访问 `http://localhost:5173`，即可在 Web UI 中实时看到收到的消息。

### 方式二：纯前端启动（后端由 UI 管理）

仅启动前端，通过 Web UI 的 **后端管理** 标签页一键启停后端服务：

```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`，点击 **后端管理** → **启动** 即可。

前端会自动检测端口上已有的后端进程，若检测到外部后端会标记为 `external` 状态，不会重复启动。

### 定时发送脚本

内置的 `webhook-client.sh` 可每 60 秒自动发送心跳消息：

```bash
# 默认发送到 http://localhost:8080 + https://localhost:8443
./webhook-client.sh

# 自定义路径
./webhook-client.sh http://localhost:8080/webhook/heartbeat https://localhost:8443/webhook/heartbeat
```

## Web UI 功能导览

### 消息页面

打开前端首页即进入消息页面，以表格形式展示所有收到的 webhook：

| 列 | 说明 |
|----|------|
| 时间 | 消息接收时间 |
| 方法 | HTTP 方法（GET/POST/PUT/DELETE 等） |
| 路径 | 请求路径 |
| 协议 | **HTTP** / **HTTPS** 标识 |
| 状态 | 响应状态码 |

- **搜索过滤** — 在搜索框输入关键词，按路径、方法、请求体等过滤消息
- **清空全部** — 一键清空所有已收消息
- **查看详情** — 点击任意消息，右侧展示完整信息：请求头（Headers）、请求体（Body，JSON 自动格式化）、来源 IP、消息 ID 等

### 响应规则页面

创建和管理自定义响应规则，用于模拟不同的后端行为：

- **路径模式** — 支持 `**` 通配符（如 `/webhook/order/**` 匹配任意以 `/webhook/order/` 开头的路径）
- **状态码** — 自定义 HTTP 响应状态码（200、201、404、500 等）
- **响应体** — 自定义响应 Body（JSON 格式）
- **延迟时间** — 模拟慢响应，单位毫秒
- **响应头** — 自定义响应 Headers

匹配规则：首个匹配的规则生效；无匹配时返回 `200 OK` + `{"status":"received"}`。

### 并发控制页面

实时查看和调整并发/限流参数：

| 参数 | 说明 |
|------|------|
| 最大并发数 | Semaphore 限制同时处理的请求数，超出时可排队或拒绝 |
| 每秒速率 | 令牌桶算法限流，超出返回 429 |
| 超时时间 | 排队等待超时（毫秒） |
| 拒绝策略 | `true` 立即拒绝（503）/ `false` 排队等待 |

所有参数修改后即时生效，无需重启服务。

### 后端管理页面

通过 Web UI 管理后端进程，无需操作命令行：

- **一键启停** — Start / Stop / Restart 按钮
- **双模式** — Maven 开发模式（`mvn spring-boot:run`）和 JAR 部署模式（`java -jar`）
- **配置编辑** — 端口、后端目录、JAR 路径、Java VM 参数均可修改（仅在停止状态可编辑）
- **实时日志** — 深色终端风格日志查看器，支持 stdout/stderr/系统消息区分
- **自动清理** — Vite dev server 关闭时自动终止后端子进程

### 语言切换

页面右上角显示 **EN** / **中** 按钮，点击在中英文之间切换。默认自动检测浏览器语言。

## 使用场景

### 调试 webhook 回调

在开发第三方支付、GitHub Webhook、Stripe 事件等回调功能时，将回调地址指向此服务即可查看完整的请求内容：

```bash
# 模拟 GitHub push 事件
curl -X POST http://localhost:8080/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","commits":[{"id":"abc123","message":"fix bug"}]}'
```

在 Web UI 中查看完整的 Headers 和 Body，确认回调数据格式是否正确。

### 模拟慢响应

测试客户端的超时重试逻辑：

```bash
# 创建规则：/webhook/slow/** 延迟 5 秒响应
curl -X POST http://localhost:8080/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "pathPattern": "/webhook/slow/**",
    "statusCode": 200,
    "responseBody": "{\"slow\":true}",
    "delayMs": 5000
  }'

# 发送测试请求（5 秒后才返回）
time curl -X POST http://localhost:8080/webhook/slow/test \
  -d '{"test":"slow response"}'
```

### 模拟错误响应

测试客户端的错误处理逻辑：

```bash
# 创建 500 错误规则
curl -X POST http://localhost:8080/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "pathPattern": "/webhook/error/**",
    "statusCode": 500,
    "responseBody": "{\"error\":\"internal_error\",\"message\":\"数据库连接失败\"}"
  }'

# 创建 404 规则
curl -X POST http://localhost:8080/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "pathPattern": "/webhook/notfound/**",
    "statusCode": 404,
    "responseBody": "{\"error\":\"not_found\"}"
  }'
```

### 压力测试

调整并发参数后用脚本批量发送请求：

```bash
# 设置较低并发数
curl -X PUT http://localhost:8080/api/concurrency \
  -H "Content-Type: application/json" \
  -d '{
    "maxConcurrency": 3,
    "rateLimitPerSecond": 5,
    "timeoutMs": 1000,
    "rejectOnFull": true
  }'

# 批量发送 20 个请求（观察哪些被拒绝）
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:8080/webhook/stress \
    -d "{\"seq\":$i}" &
done
wait
```

## 故障排查

### 后端启动失败

**错误：端口被占用**
```bash
# 查找占用 8080 端口的进程
lsof -i :8080
# 结束进程
kill -9 <PID>
```

**错误：`Unable to create tempDir` / `Operation not permitted`**
- macOS 沙箱或权限问题，确保 Java 有 `/tmp` 目录写入权限
- 可设置自定义临时目录：`java -Djava.io.tmpdir=/path/to/tmp -jar app.jar`

**错误：HTTPS 证书生成失败**
- 确保使用 JDK（而非 JRE），`sun.security.x509` 包需要 JDK 运行时
- Maven 启动时需配置 `--add-exports` JVM 参数（已在 `pom.xml` 中配置）

### Maven 编译失败

```bash
# 清理后重新编译
cd backend
mvn clean compile

# 跳过测试
mvn spring-boot:run -DskipTests
```

### 前端启动失败

**错误：`EPERM: operation not permitted 127.0.0.1:5173`**
- 端口 5173 被占用或沙箱限制
- 修改 Vite 端口：在 `frontend/vite.config.ts` 中配置 `server.port`
- 或终止占用进程：`lsof -i :5173`

**错误：前端连不上后端（"后端: stopped" 一直显示）**
- 确认后端已启动：`curl http://localhost:8080/api/messages/count`
- 前端自动检测后端状态需要时间（每 3 秒轮询），等待片刻
- Vite 代理配置是否正确？检查 `frontend/vite.config.ts` 中的 `proxy` 设置

### HTTPS 证书问题

```bash
# 使用 curl 测试 HTTPS 时跳过证书验证
curl -k https://localhost:8443/webhook/test -d '{"test":"hello"}'

# 或使用客户端脚本（自动添加 -k）
./webhook-client.sh
```

浏览器访问 HTTPS 端口时也会提示证书风险，这是自签名证书的正常行为，点击"高级"→"继续访问"即可。

## API 参考

| 方法 | 路径 | 说明 |
|------|------|------|
| ANY | `/webhook/**` | 接收 webhook 请求 |
| GET | `/api/messages` | 查询消息列表（`?search=` 过滤） |
| GET | `/api/messages/{id}` | 查询消息详情 |
| DELETE | `/api/messages` | 清空所有消息 |
| GET | `/api/rules` | 查询所有响应规则 |
| POST | `/api/rules` | 创建响应规则 |
| PUT | `/api/rules/{id}` | 更新响应规则 |
| DELETE | `/api/rules/{id}` | 删除响应规则 |
| GET | `/api/concurrency` | 查询并发配置 |
| PUT | `/api/concurrency` | 更新并发配置 |
| GET | `/api/backend/status` | 查询后端运行状态 |
| POST | `/api/backend/start` | 启动后端 |
| POST | `/api/backend/stop` | 停止后端 |
| POST | `/api/backend/restart` | 重启后端 |
| GET | `/api/backend/logs` | 查询后端日志（`?since=` 增量） |
| GET/PUT | `/api/backend/config` | 查询 / 更新后端配置 |

## 项目结构

```
webhook-server-simulator/
├── backend/                      # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/java/com/webhook/simulator/
│       ├── WebhookSimulatorApplication.java  # 入口
│       ├── controller/           # REST 控制器
│       ├── model/                # 数据模型
│       ├── service/              # 业务逻辑
│       ├── websocket/            # WebSocket 配置
│       └── config/               # Web 配置 + HTTPS
├── frontend/                     # React + Vite 前端
│   ├── vite-plugin-backend-manager.ts  # Vite 插件：后端进程管理
│   └── src/
│       ├── components/           # UI 组件
│       ├── hooks/                # WebSocket / 后端状态 hooks
│       ├── i18n/                 # 国际化（中文 / English）
│       └── services/             # API 调用
└── webhook-client.sh             # 定时发送 webhook 的测试客户端
```

## 设计要点

- **纯内存存储** — 所有数据存储在内存中，重启即丢失，适合开发调试使用
- **线程安全** — 使用 `ConcurrentLinkedDeque`（消息）和 `CopyOnWriteArrayList`（规则）保证并发安全
- **动态配置** — 并发控制参数可在运行时动态调整，无需重启
- **HTTPS 开箱即用** — 启动时自动生成自签名 RSA 2048 证书，配置 Tomcat HTTPS 连接器
- **前后端一体化** — Vite 插件管理后端进程生命周期，开发体验流畅
