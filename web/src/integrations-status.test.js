// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CONFIGURED_ENV_VALUE,
  buildConnectorEnvMap,
  getConnectorBridgeStatus,
  getConnectorStatus,
  getFeishuLinkSteps,
  normalizeIntegrationCheck,
  parseConnectorFields,
} from "./integrations-utils.js"

const integrationsSource = readFileSync(new URL("./IntegrationsView.jsx", import.meta.url), "utf8")
const integrationsUtilsSource = readFileSync(new URL("./integrations-utils.js", import.meta.url), "utf8")
const zhLocaleSource = readFileSync(new URL("./locales/zh.json", import.meta.url), "utf8")

test("integration cards distinguish credentials from real connected workflows", () => {
  assert.ok(
    integrationsSource.includes('connected: { label: "凭证完整"'),
    "filled env vars should be shown as complete credentials"
  )
  assert.ok(
    !integrationsSource.includes('connected: { label: "已连接"'),
    "filled env vars must not imply the external workflow is connected"
  )
  assert.ok(
    integrationsSource.includes('description="管理外部服务凭证与接入状态"'),
    "integration page copy should avoid claiming full API workflow completion"
  )
  assert.ok(
    zhLocaleSource.includes('"integrationsDescription": "管理外部服务凭证与接入状态"'),
    "navigation copy should describe credential management instead of completed integrations"
  )
  assert.ok(
    zhLocaleSource.includes('"marketIndexNote": "市场数据经 Crazor 服务端轻量代理读取"'),
    "skill market copy should match the server proxy implementation"
  )
  assert.ok(
    integrationsSource.includes('placeholder={envMap[key] ? "留空则保留当前配置"'),
    "configured connector fields should preserve existing credentials when left blank"
  )
  assert.ok(
    !integrationsSource.includes("} else if (envMap[key])"),
    "saving a connector should not delete existing credentials just because a field was left blank"
  )
})

test("connector env map supports dashboard metadata objects", () => {
  const envMap = buildConnectorEnvMap({
    FEISHU_APP_ID: { is_set: true, redacted_value: "cli_123" },
    FEISHU_APP_SECRET: { is_set: true },
    DINGTALK_APP_KEY: { is_set: false, redacted_value: null },
    CONNECTOR_CODEX_AUDIT_FIELDS: { is_set: true, redacted_value: "CODEX_TOKEN,CODEX_SPACE" },
  })

  assert.deepEqual(envMap, {
    FEISHU_APP_ID: "cli_123",
    FEISHU_APP_SECRET: CONFIGURED_ENV_VALUE,
    DINGTALK_APP_KEY: "",
    CONNECTOR_CODEX_AUDIT_FIELDS: "CODEX_TOKEN,CODEX_SPACE",
  })
  assert.equal(
    getConnectorStatus(
      { fields: ["FEISHU_APP_ID", "FEISHU_APP_SECRET"] },
      envMap
    ),
    "connected"
  )
  assert.equal(
    getConnectorStatus(
      { fields: ["FEISHU_APP_ID", "DINGTALK_APP_KEY"] },
      envMap
    ),
    "partial"
  )
  assert.deepEqual(parseConnectorFields(envMap.CONNECTOR_CODEX_AUDIT_FIELDS), [
    "CODEX_TOKEN",
    "CODEX_SPACE",
  ])
})

test("connector env map remains compatible with legacy array payloads", () => {
  const envMap = buildConnectorEnvMap([
    { key: "GITHUB_TOKEN", value: "ghp_xxx" },
    { key: "LINEAR_API_KEY", is_set: true },
    { key: "", value: "ignored" },
  ])

  assert.deepEqual(envMap, {
    GITHUB_TOKEN: "ghp_xxx",
    LINEAR_API_KEY: CONFIGURED_ENV_VALUE,
  })
})

test("feishu connector bridge status reflects Hermes sync state", () => {
  const connector = { id: "feishu" }

  assert.deepEqual(
    getConnectorBridgeStatus(
      connector,
      {
        FEISHU_APP_ID: "cli_demo",
        FEISHU_APP_SECRET: CONFIGURED_ENV_VALUE,
      },
      {
        feishu: {
          appId: "cli_demo",
          appSecret: CONFIGURED_ENV_VALUE,
        },
      }
    ),
    {
      state: "synced",
      label: "Hermes 已写入",
      description: "飞书凭证已写入 Hermes Dashboard .env；运行时状态以真实链路为准。",
    }
  )

  assert.equal(
    getConnectorBridgeStatus(
      connector,
      {
        FEISHU_APP_ID: "cli_demo",
        FEISHU_APP_SECRET: CONFIGURED_ENV_VALUE,
      },
      {}
    ).state,
    "synced"
  )

  assert.equal(
    getConnectorBridgeStatus(
      connector,
      {},
      {
        feishu: {
          appId: "cli_demo",
          appSecret: CONFIGURED_ENV_VALUE,
        },
      }
    ).state,
    "missing"
  )
})

test("integration check normalizer keeps stable defaults", () => {
  assert.deepEqual(normalizeIntegrationCheck(null), {
    connector_id: "",
    status: "idle",
    summary: "",
    details: {},
    checked_at: "",
    updated_at: "",
  })

  assert.deepEqual(
    normalizeIntegrationCheck({
      connector_id: "feishu",
      status: "warning",
      summary: "飞书认证通过，但 Hermes 配置尚未写入",
      details: { auth_status: 200 },
      checked_at: "2026-06-03T09:00:00.000Z",
      updated_at: "2026-06-03T09:00:01.000Z",
    }),
    {
      connector_id: "feishu",
      status: "warning",
      summary: "飞书认证通过，但 Hermes 配置尚未写入",
      details: { auth_status: 200 },
      checked_at: "2026-06-03T09:00:00.000Z",
      updated_at: "2026-06-03T09:00:01.000Z",
    }
  )
})

test("feishu link steps expose the real backend to Hermes to Feishu chain", () => {
  const steps = getFeishuLinkSteps(
    {
      FEISHU_APP_ID: "cli_demo",
      FEISHU_APP_SECRET: CONFIGURED_ENV_VALUE,
    },
    {
      feishu: {
        appId: "cli_demo",
        appSecret: CONFIGURED_ENV_VALUE,
      },
    },
    {
      connector_id: "feishu",
      status: "warning",
      summary: "飞书认证成功，但企业信息读取失败",
      checked_at: "2026-06-03T09:00:00.000Z",
      details: {
        auth_status: 200,
        auth_code: 0,
        tenant_status: 400,
        tenant_code: 99991672,
        tenant_message: "Missing tenant readonly scope",
        hermes_binding: {
          env_configured: true,
          hermes_configured: true,
          synchronized: true,
          runtime_connected: false,
          runtime_state: "missing",
        },
      },
    }
  )

  assert.deepEqual(
    steps.map((step) => [step.id, step.state]),
    [
      ["crazor_config", "ok"],
      ["hermes_config", "ok"],
      ["binding_sync", "ok"],
      ["runtime_listener", "warning"],
      ["feishu_auth", "ok"],
      ["tenant_scope", "warning"],
    ]
  )
  assert.match(
    steps.find((step) => step.id === "hermes_config").detail,
    /Hermes Dashboard \.env/
  )
  assert.match(
    steps.find((step) => step.id === "runtime_listener").detail,
    /运行时尚未登记飞书平台/
  )
})

test("feishu link steps mark runtime listener as connected only from Hermes runtime state", () => {
  const steps = getFeishuLinkSteps(
    {
      FEISHU_APP_ID: "cli_demo",
      FEISHU_APP_SECRET: CONFIGURED_ENV_VALUE,
    },
    {
      feishu: {
        appId: "cli_demo",
        appSecret: CONFIGURED_ENV_VALUE,
      },
    },
    {
      connector_id: "feishu",
      status: "ok",
      summary: "飞书认证成功",
      checked_at: "2026-06-03T09:00:00.000Z",
      details: {
        auth_status: 200,
        auth_code: 0,
        tenant_status: 200,
        tenant_code: 0,
        hermes_binding: {
          env_configured: true,
          hermes_configured: true,
          synchronized: true,
          runtime_connected: true,
          runtime_state: "connected",
        },
      },
    }
  )

  assert.equal(steps.find((step) => step.id === "runtime_listener").state, "ok")
  assert.match(
    steps.find((step) => step.id === "runtime_listener").detail,
    /运行时已连接飞书平台/
  )
})

test("integration page exposes Hermes bridge and live connectivity copy", () => {
  assert.ok(
    integrationsSource.includes("Hermes 接入"),
    "connector dialog should explain whether credentials are synced into Hermes"
  )
  assert.ok(
    integrationsSource.includes("测试连接"),
    "feishu connector should expose an explicit connectivity test action"
  )
  assert.ok(
    integrationsSource.includes("会用当前凭证请求飞书官方 OpenAPI"),
    "connector dialog should explain that the connectivity test is real"
  )
  assert.ok(
    integrationsSource.includes("saveIntegrationConnectorConfig"),
    "feishu connector should save through a backend atomic sync endpoint"
  )
  assert.ok(
    integrationsSource.includes("revealPresetConnectorEnvMap"),
    "integration page should detect saved connector env vars even when dashboard env metadata omits them"
  )
  assert.ok(
    integrationsSource.includes("真实链路") && integrationsSource.includes("getFeishuLinkSteps"),
    "feishu connector should render real link steps instead of only showing a save result"
  )
  assert.ok(
    integrationsUtilsSource.includes("运行时监听"),
    "feishu connector should expose Hermes runtime listener state"
  )
})
