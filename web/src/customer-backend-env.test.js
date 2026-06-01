// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCustomerBackendEnv,
  parseEnvText,
  renderCustomerBackendEnv,
  validateCustomerBackendEnv,
} from "../../scripts/customer-backend-env.mjs"

test("customer backend env generator prepares strict hosted delivery settings", () => {
  const env = buildCustomerBackendEnv({
    customer: " CRAZYAIGC 客户 ",
    serverUrl: "https://client.example.com/crazor/",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    wechatAppId: "wx-demo",
    wechatAppSecret: "secret-demo",
  })

  assert.equal(env.CRAZOR_DELIVERY_CUSTOMER, "CRAZYAIGC 客户")
  assert.equal(env.CRAZOR_PUBLIC_BASE_URL, "https://client.example.com/crazor")
  assert.equal(env.CRAZOR_CUSTOMER_SERVER_PREFLIGHT, "strict")
  assert.equal(env.CRAZOR_SEED_DEMO_DATA, "false")
  assert.equal(env.CRAZOR_REQUIRE_WRITE_TOKEN, "true")
  assert.equal(env.CRAZOR_REQUIRE_BUSINESS_READ_TOKEN, "true")
  assert.equal(env.CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN, "true")
  assert.ok(env.CRAZOR_CUSTOMER_ACCESS_CODE.length >= 8)
  assert.equal(env.AGENT_GATEWAY_URL, "http://hermes:8642")
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
    CRAZOR_REQUIRE_WRITE_TOKEN: "false",
    CRAZOR_REQUIRE_BUSINESS_READ_TOKEN: "false",
    CRAZOR_REQUIRE_SENSITIVE_READ_TOKEN: "false",
    JWT_SECRET: "dev-secret-change-in-production",
    CRAZOR_CUSTOMER_ACCESS_CODE: "12345678",
    CORS_ORIGINS: "http://localhost:5173",
    API_SERVER_CORS_ORIGINS: "",
  })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /CRAZOR_DELIVERY_CUSTOMER/)
  assert.match(result.errors.join("\n"), /CRAZOR_CUSTOMER_SERVER_PREFLIGHT/)
  assert.match(result.errors.join("\n"), /CRAZOR_CUSTOMER_ACCESS_CODE/)
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

test("customer backend env renderer round-trips quoted customer values", () => {
  const env = buildCustomerBackendEnv({
    customer: "客户 A $测试",
    serverUrl: "http://192.168.103.4:5173/",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    accessCode: "客户访问码123",
    wechatAppId: "wx-demo",
    wechatAppSecret: "secret-demo",
  })
  const parsed = parseEnvText(renderCustomerBackendEnv(env))

  assert.equal(parsed.CRAZOR_DELIVERY_CUSTOMER, "客户 A $测试")
  assert.equal(parsed.CRAZOR_CUSTOMER_ACCESS_CODE, "客户访问码123")
  assert.equal(parsed.CRAZOR_PUBLIC_BASE_URL, "http://192.168.103.4:5173")
  assert.deepEqual(validateCustomerBackendEnv(parsed).errors, [])
})
