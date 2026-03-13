# HTTPS Support Design

## Context

后端当前只支持 HTTP (port 8080)。本地开发场景下，部分 webhook 提供方要求回调地址为 HTTPS，需要为后端增加 HTTPS 支持。

## Requirements

- 本地开发使用，非生产环境
- HTTP 8080 和 HTTPS 8443 同时可用
- 启动时自动生成自签名证书，零配置开箱即用
- 前端 Vite 开发服务器不需要调整

## Approach

**方案 B：HTTP 为主，编程添加 HTTPS Connector**

保持现有 HTTP 8080 默认配置不动，通过 `WebServerFactoryCustomizer` 编程添加一个 HTTPS 8443 Connector。

选择理由：
- 对现有代码零改动，HTTPS 是纯增量功能
- 和项目"全内存、无外部依赖"的设计哲学一致

## Design

### 1. Self-signed Certificate Generation

- `KeyPairGenerator` 生成 RSA 2048 密钥对
- 使用 JDK 内部 API (`sun.security.x509`) 生成自签名证书
  - CN=localhost
  - SAN: localhost + 127.0.0.1
  - 有效期 1 年
- 存入内存 `KeyStore` 对象，不落盘
- 零外部依赖（不引入 Bouncy Castle）

### 2. Tomcat HTTPS Connector

新增 `HttpsConnectorConfig.java`：

- `@Configuration` 类
- 注入 `WebServerFactoryCustomizer<TomcatServletWebServerFactory>`
- 创建额外 Tomcat `Connector`（Http11NioProtocol），端口 8443
- 通过 `SSLHostConfig` + `SSLHostConfigCertificate` 挂载内存 KeyStore

### 3. Startup Logging

用 `@EventListener(ApplicationReadyEvent)` 在启动完成后打印：

```
HTTP  server started on port 8080
HTTPS server started on port 8443 (self-signed certificate)
```

提示 curl 用法：`curl -k https://localhost:8443/webhook/test`

## File Changes

| File | Action |
|------|--------|
| `backend/src/.../config/HttpsConnectorConfig.java` | 新增 — 证书生成 + Connector 注册 + 启动日志 |

## Impact

- 新增依赖：无
- 对现有功能影响：无
- HTTP 8080 行为完全不变
