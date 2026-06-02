// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const repoRoot = resolve(new URL("../..", import.meta.url).pathname)
const serverIndex = readFileSync(resolve(repoRoot, "server/src/index.ts"), "utf8")
const agentGatewaySource = readFileSync(resolve(repoRoot, "server/src/services/agent-gateway.ts"), "utf8")
const agentApiSource = readFileSync(resolve(repoRoot, "web/src/api/agent.js"), "utf8")
const smokeSource = readFileSync(resolve(repoRoot, "scripts/crazor-smoke.mjs"), "utf8")

test("Agent Provider Adapter exposes runtime descriptor and capabilities", () => {
  assert.ok(
    serverIndex.includes("app.get('/api/agent/provider'"),
    "server should expose the provider runtime descriptor"
  )
  assert.ok(
    serverIndex.includes("app.get('/api/agent/provider/capabilities'"),
    "server should expose provider capability metadata"
  )
  assert.ok(
    agentGatewaySource.includes("getAgentProviderDescriptor") &&
      agentGatewaySource.includes("AGENT_PROVIDER_CAPABILITIES") &&
      agentGatewaySource.includes("AgentProviderCapabilityId"),
    "agent gateway service should define a provider descriptor contract"
  )
  assert.ok(
    agentGatewaySource.includes("'gateway.chat_completions'") &&
      agentGatewaySource.includes("'dashboard.skills'") &&
      agentGatewaySource.includes("'crazor.mcp'"),
    "provider contract should separate gateway, dashboard, and Crazor-owned capabilities"
  )
  assert.ok(
    serverIndex.includes("AGENT_PROVIDER_CAPABILITY_ROUTES") &&
      serverIndex.includes("requiredAgentProviderCapability") &&
      serverIndex.includes("unsupportedAgentProviderCapability(capability)"),
    "server should gate provider-specific routes by declared capabilities"
  )
  assert.ok(
    agentApiSource.includes("getAgentProvider") &&
      agentApiSource.includes("getAgentProviderCapabilities"),
    "web API layer should read provider metadata through generic agent APIs"
  )
  assert.ok(
    smokeSource.includes("Agent Provider Adapter 状态") &&
      smokeSource.includes("/api/agent/provider") &&
      smokeSource.includes("gateway.chat_completions") &&
      smokeSource.includes("crazor.mcp"),
    "delivery smoke test should verify the provider adapter endpoint"
  )
})

test("Agent Provider Adapter returns stable JSON errors for customer model and chat probes", () => {
  assert.ok(
    serverIndex.includes("upstreamConnectionFailedResponse") &&
      serverIndex.includes("proxyGatewayJsonResponse") &&
      serverIndex.includes("proxyDashboardJsonResponse"),
    "server should centralize upstream proxy failures into stable JSON responses"
  )
  assert.ok(
    serverIndex.includes("app.get('/api/models'") &&
      serverIndex.includes("return proxyGatewayJsonResponse(c, '/v1/models')"),
    "customer model probes should preserve Agent Gateway HTTP status and error payloads"
  )
  assert.ok(
    serverIndex.includes("app.post('/api/chat/completions'") &&
      serverIndex.includes("resp = await gatewayFetch('/v1/chat/completions'") &&
      serverIndex.includes("return upstreamConnectionFailedResponse(c, 'Agent Gateway', error)"),
    "non-streaming customer chat probes should return a diagnosable 502 JSON response when the Gateway is unreachable"
  )
  assert.ok(
    serverIndex.includes("app.post('/api/responses'") &&
      serverIndex.includes("resp = await gatewayFetch('/v1/responses'"),
    "Responses API proxies should use the same Gateway wrapper and authentication headers"
  )
  assert.ok(
    serverIndex.includes("app.get('/api/model/info'") &&
      serverIndex.includes("if (!resp.ok) return proxyJsonResponse(c, resp)") &&
      serverIndex.includes("return proxyDashboardJsonResponse(c, `/api/model/options`)") &&
      serverIndex.includes("return proxyDashboardJsonResponse(c, `/api/model/set`,"),
    "customer model configuration endpoints should avoid unhandled Dashboard parse failures"
  )
})
