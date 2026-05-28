// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CONFIGURED_ENV_VALUE,
  buildConnectorEnvMap,
  getConnectorStatus,
  parseConnectorFields,
} from "./integrations-utils.js"

const integrationsSource = readFileSync(new URL("./IntegrationsView.jsx", import.meta.url), "utf8")
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
