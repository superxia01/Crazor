// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

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
})
