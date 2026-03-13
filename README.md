# Webhook Server Simulator

用于开发调试的 webhook 模拟服务端。接收、记录和展示 webhook 消息，支持自定义响应规则和并发控制。

## 技术栈

- **后端**: Java 17 + Spring Boot 3.3 + Maven
- **前端**: React 18 + Vite + TypeScript
- **实时通信**: WebSocket（STOMP over SockJS）
- **数据存储**: 内存（最近 1000 条消息）
- **HTTPS**: 自签名证书，端口 8443
- **国际化**: 中文 / English（自动检测浏览器语言）

## 快速开始

### 1. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`，打开浏览器访问即可看到 Web UI。

### 2. 启动后端

在 Web UI 中点击 **Backend** 标签页，点击 **Start** 按钮即可一键启动后端（默认 Maven 模式）。

也可以手动启动：

```bash
cd backend
mvn spring-boot:run
```

后端运行在 `http://localhost:8080`（HTTP）和 `https://localhost:8443`（HTTPS，自签名证书）。前端会自动检测到已运行的后端并标记为 `external` 状态。

### 3. 发送 Webhook

手动发送单条测试消息：

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

使用内置客户端脚本每 60 秒自动发送心跳消息（同时发送到 HTTP 和 HTTPS）：

```bash
# 默认发送到 localhost:8080 (HTTP) + localhost:8443 (HTTPS)
./webhook-client.sh

# 自定义 URL
./webhook-client.sh http://localhost:8080/webhook/heartbeat https://localhost:8443/webhook/heartbeat
```

发送后在 Web UI 中即可实时看到消息。

### 4. 配置响应规则

通过 API 创建自定义响应规则（也可在 Web UI 的 Response Rules 页面操作）：

```bash
# 创建规则：/webhook/order/** 路径返回 201 + 自定义 body
curl -X POST http://localhost:8080/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "pathPattern": "/webhook/order/**",
    "statusCode": 201,
    "responseBody": "{\"ok\":true}",
    "delayMs": 0
  }'

# 验证规则生效
curl -X POST http://localhost:8080/webhook/order/123 \
  -d '{"orderId":"ORD-001"}'
# 返回 201 {"ok":true}
```

### 5. 调整并发控制

通过 API 调整并发参数（也可在 Web UI 的 Concurrency 页面操作）：

```bash
curl -X PUT http://localhost:8080/api/concurrency \
  -H "Content-Type: application/json" \
  -d '{
    "maxConcurrency": 5,
    "rateLimitPerSecond": 10,
    "timeoutMs": 3000,
    "rejectOnFull": true
  }'
```

## 功能

### Webhook 接收

- 支持所有 HTTP 方法（GET/POST/PUT/DELETE/PATCH）
- 支持 HTTP（8080）和 HTTPS（8443）双端口
- 通配路径 `/webhook/**`，接收任意子路径
- 记录：路径、方法、协议（HTTP/HTTPS）、Headers、Body、Query Params、来源 IP、时间戳

### Web UI

- **消息列表**: 实时显示收到的 webhook 消息，支持搜索过滤，显示协议标识（HTTP/HTTPS）
- **消息详情**: 查看完整 Headers、Body（JSON 自动格式化）、协议、元信息
- **响应规则编辑器**: 管理自定义响应规则（路径模式、状态码、响应体、延迟）
- **并发控制面板**: 查看和动态调整并发/限流参数
- **后端管理面板**: 一键启停后端服务，支持 Maven/JAR 模式切换、配置编辑、实时日志查看

### 自定义响应规则

- 按路径模式匹配（支持 `**` 通配符，如 `/webhook/order/**`）
- 可配置：HTTP 状态码、响应 Body、响应 Headers、响应延迟
- 首个匹配的规则生效；无匹配时返回 `200 OK` + `{"status":"received"}`

### 并发控制

- **最大并发数**: Semaphore 限制，超出可排队等待或直接拒绝（503）
- **限流**: 令牌桶算法，超出速率返回 429
- **动态调整**: 通过 API 或 Web UI 实时修改参数

### 后端进程管理

- **一键启停**: 通过 Web UI 启动、停止、重启后端，无需命令行操作
- **双模式**: 支持 Maven 开发模式和 JAR 部署模式
- **外部检测**: 自动检测端口上已运行的外部后端，避免冲突
- **实时日志**: 深色终端风格日志查看器，区分 stdout/stderr/系统消息
- **配置可编辑**: 端口、后端目录、JAR 路径、Java 参数均可在 UI 中修改
- **自动清理**: Vite dev server 关闭时自动终止后端子进程

## API 参考

| 方法 | 路径 | 说明 |
|------|------|------|
| ANY | `/webhook/**` | 接收 webhook 请求 |
| GET | `/api/messages` | 查询消息列表（?search= 过滤） |
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
| GET | `/api/backend/logs` | 查询后端日志（?since= 增量） |
| GET/PUT | `/api/backend/config` | 查询/更新后端配置 |

## 项目结构

```
webhook-server-simulator/
├── backend/                  # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/java/com/webhook/simulator/
│       ├── controller/       # REST 控制器
│       ├── model/            # 数据模型
│       ├── service/          # 业务逻辑
│       ├── websocket/        # WebSocket 配置
│       └── config/           # Web 配置
├── frontend/                 # React + Vite 前端
│   ├── vite-plugin-backend-manager.ts  # Vite 插件：后端进程管理
│   └── src/
│       ├── components/       # UI 组件（含 BackendPanel）
│       ├── hooks/            # WebSocket / 后端状态 hooks
│       ├── i18n/            # 国际化（中文/English）
│       └── services/         # API 调用
└── webhook-client.sh         # 定时发送 webhook 的测试客户端
```
