// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

import {
  buildCustomerBackendEnv,
  parseEnvText,
  renderCustomerBackendEnv,
  validateCustomerBackendEnv,
} from "../../scripts/customer-backend-env.mjs"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)

test("customer backend env generator prepares strict hosted delivery settings", () => {
  const env = buildCustomerBackendEnv({
    customer: " CRAZYAIGC 客户 ",
    serverUrl: "https://client.example.com/crazor/",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    internalAccessCode: "internal-demo-001",
    wechatAppId: "wx-demo",
    wechatAppSecret: "secret-demo",
  })

  assert.equal(env.CRAZOR_DELIVERY_CUSTOMER, "CRAZYAIGC 客户")
  assert.equal(env.CRAZOR_DELIVERY_CONTACT_ID, "")
  assert.equal(env.CRAZOR_PUBLIC_BASE_URL, "https://client.example.com/crazor")
  assert.match(env.CRAZOR_DELIVERY_IDENTITY_FINGERPRINT, /^[a-f0-9]{12}$/)
  assert.equal(env.CRAZOR_CUSTOMER_SERVER_PREFLIGHT, "strict")
  assert.equal(env.CRAZOR_SEED_DEMO_DATA, "false")
  assert.equal(env.CRAZOR_REQUIRE_WRITE_TOKEN, "true")
  assert.equal(env.CRAZOR_REQUIRE_BUSINESS_READ_TOKEN, "true")
  assert.equal(env.CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN, "true")
  assert.equal(env.CRAZOR_DEFAULT_WORKSPACE, "customer")
  assert.ok(env.CRAZOR_CUSTOMER_ACCESS_CODE.length >= 8)
  assert.equal(env.CRAZOR_INTERNAL_ACCESS_CODE, "internal-demo-001")
  assert.equal(env.AGENT_GATEWAY_URL, "http://hermes:8642")
  assert.ok(env.AGENT_GATEWAY_API_KEY.length >= 32)
  assert.equal(env.HERMES_API_SERVER_KEY, env.AGENT_GATEWAY_API_KEY)
  assert.equal(env.HERMES_DASHBOARD_BIND, "127.0.0.1")
  assert.equal(env.HERMES_DASHBOARD_HOST, "0.0.0.0")
  assert.equal(env.HERMES_DASHBOARD_INSECURE, "1")
  assert.equal(env.HERMES_WORKSPACE_ROOT, "/opt/workspaces")
  assert.equal(env.HERMES_USER_WORKDIR, "/opt/workspaces/users/default")
  assert.match(env.COMPOSE_PROJECT_NAME, /^crazor-/)
  assert.ok(env.CORS_ORIGINS.includes("https://client.example.com/crazor"))
  assert.ok(env.CORS_ORIGINS.includes("tauri://localhost"))
})

test("customer backend env validator rejects unsafe customer handoff config", () => {
  const result = validateCustomerBackendEnv({
    CRAZOR_DELIVERY_CUSTOMER: "",
    CRAZOR_PUBLIC_BASE_URL: "ftp://client.example.com",
    CRAZOR_DELIVERY_CHANNEL: "local",
    CRAZOR_DELIVERY_PROTOCOL_VERSION: "",
    CRAZOR_CUSTOMER_SERVER_PREFLIGHT: "warn",
    CRAZOR_SEED_DEMO_DATA: "true",
    COMPOSE_PROFILES: "",
    AGENT_GATEWAY_URL: "http://127.0.0.1:8642",
    AGENT_GATEWAY_API_KEY: "change-me-run-scripts-hermes-init",
    HERMES_API_SERVER_KEY: "different-key",
    HERMES_DASHBOARD_BIND: "0.0.0.0",
    HERMES_DASHBOARD_HOST: "127.0.0.1",
    HERMES_DASHBOARD_INSECURE: "",
    HERMES_WORKSPACE_ROOT: "/opt/data/workspaces",
    HERMES_USER_WORKDIR: "/opt/data/workspaces/users/default",
    CRAZOR_REQUIRE_WRITE_TOKEN: "false",
    CRAZOR_REQUIRE_BUSINESS_READ_TOKEN: "false",
    CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN: "false",
    JWT_SECRET: "dev-secret-change-in-production",
    CRAZOR_CUSTOMER_ACCESS_CODE: "12345678",
    CRAZOR_INTERNAL_ACCESS_CODE: "demo",
    CORS_ORIGINS: "http://localhost:5173",
    API_SERVER_CORS_ORIGINS: "",
  })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /CRAZOR_DELIVERY_CUSTOMER/)
  assert.match(result.errors.join("\n"), /CRAZOR_CUSTOMER_SERVER_PREFLIGHT/)
  assert.match(result.errors.join("\n"), /CRAZOR_CUSTOMER_ACCESS_CODE/)
  assert.match(result.errors.join("\n"), /CRAZOR_INTERNAL_ACCESS_CODE/)
  assert.match(result.errors.join("\n"), /AGENT_GATEWAY_API_KEY/)
  assert.match(result.errors.join("\n"), /HERMES_API_SERVER_KEY/)
  assert.match(result.errors.join("\n"), /HERMES_DASHBOARD_BIND/)
  assert.match(result.errors.join("\n"), /HERMES_DASHBOARD_HOST/)
  assert.match(result.errors.join("\n"), /HERMES_DASHBOARD_INSECURE/)
  assert.match(result.errors.join("\n"), /HERMES_WORKSPACE_ROOT/)
  assert.match(result.errors.join("\n"), /HERMES_USER_WORKDIR/)
  assert.match(result.errors.join("\n"), /演示数据/)
  assert.match(result.errors.join("\n"), /Tauri 来源/)
})

test("customer backend env validator accepts access code login without WeChat", () => {
  const env = buildCustomerBackendEnv({
    customer: "本机验证",
    serverUrl: "http://127.0.0.1:5173",
    jwtSecret: "0123456789abcdef0123456789abcdef",
  })
  const result = validateCustomerBackendEnv(env)

  assert.equal(result.ok, true)
  assert.match(result.warnings.join("\n"), /本机地址/)
  assert.equal(validateCustomerBackendEnv(env, { strict: true }).ok, false)
})

test("customer backend env treats shared address space as private delivery network", () => {
  const env = buildCustomerBackendEnv({
    customer: "Tailscale 客户",
    serverUrl: "http://100.87.117.18:5173",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    accessCode: "handoff-code",
    agentGatewayApiKey: "abcdef0123456789abcdef0123456789",
  })
  const result = validateCustomerBackendEnv(env, { strict: true })

  assert.equal(result.ok, true)
  assert.equal(result.warnings.join("\n").includes("公网客户交付建议使用 HTTPS"), false)
})

test("customer backend env renderer round-trips quoted customer values", () => {
  const env = buildCustomerBackendEnv({
    customer: "客户 A $测试",
    contactId: "contact_demo",
    serverUrl: "http://192.168.103.4:5173/",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    accessCode: "客户访问码123",
    wechatAppId: "wx-demo",
    wechatAppSecret: "secret-demo",
  })
  const parsed = parseEnvText(renderCustomerBackendEnv(env))

  assert.equal(parsed.CRAZOR_DELIVERY_CUSTOMER, "客户 A $测试")
  assert.equal(parsed.CRAZOR_DELIVERY_CONTACT_ID, "contact_demo")
  assert.equal(parsed.CRAZOR_CUSTOMER_ACCESS_CODE, "客户访问码123")
  assert.equal(parsed.CRAZOR_INTERNAL_ACCESS_CODE, "")
  assert.equal(parsed.CRAZOR_DEFAULT_WORKSPACE, "customer")
  assert.equal(parsed.CRAZOR_PUBLIC_BASE_URL, "http://192.168.103.4:5173")
  assert.deepEqual(validateCustomerBackendEnv(parsed).errors, [])
})

test("customer desktop build resolves package inputs from generated backend env", () => {
  const dir = mkdtempSync(join(tmpdir(), "crazor-customer-build-env-"))
  const envFile = join(dir, ".env.customer")
  const env = buildCustomerBackendEnv({
    customer: "客户 A",
    serverUrl: "http://192.168.103.4:5173/",
    protocolVersion: "1",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    accessCode: "handoff-code",
  })
  writeFileSync(envFile, renderCustomerBackendEnv(env))

  try {
    const output = execFileSync("bash", [
      resolve(repoRoot, "scripts/build-customer.sh"),
      "--env-file",
      envFile,
      "--platform",
      "current",
      "--dry-run",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
    })

    assert.match(output, /客户后端环境校验通过/)
    assert.match(output, /客户构建配置已解析: 客户 A -> http:\/\/192\.168\.103\.4:5173，协议 1/)
    assert.match(output, /交付指纹: [a-f0-9]{12}/)
    assert.match(output, /dry-run 完成/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
