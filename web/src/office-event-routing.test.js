// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { describeEvent, iconFor, routeEmployee } from "./components/office/data/eventRouting.js"

test("office event routing keeps core business events attached to the right employee", () => {
  assert.equal(routeEmployee({ type: "entity.created", entity: "task" }), "project-assistant")
  assert.equal(routeEmployee({ type: "entity.created", entity: "contact" }), "customer-manager")
  assert.equal(routeEmployee({ type: "entity.created", entity: "transaction" }), "finance-assistant")
  assert.equal(routeEmployee({ type: "entity.created", entity: "channel" }), "moments-operator")
})

test("office event routing prefers MCP tool mappings over entity fallback", () => {
  assert.equal(
    routeEmployee({ type: "mcp.tool_called", entity: "unknown", data: { tool: "create_follow_up" } }),
    "sales-follower",
  )
  assert.equal(
    routeEmployee({ type: "mcp.tool_called", entity: "unknown", data: { tool: "content_update_metrics" } }),
    "data-dashboard",
  )
})

test("office event descriptions stay human-readable for the ticker and log", () => {
  assert.equal(iconFor("create_transaction"), "💰")
  assert.match(
    describeEvent({
      type: "entity.created",
      entity: "task",
      actor_name: "销售同学",
    }),
    /销售同学 创建了任务/,
  )
  assert.match(
    describeEvent({
      type: "mcp.tool_called",
      actor_type: "agent",
      data: { tool: "create_contact" },
    }),
    /数字员工 调用工具 create_contact/,
  )
})
