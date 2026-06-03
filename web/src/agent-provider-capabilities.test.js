// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import {
  filterSidebarGroups,
  getAvailableHermesSubmenuIds,
  getDefaultHermesSubmenuView,
  supportsCapabilityRule,
  supportsViewCapability,
} from "./agent-provider-capabilities.js"

test("view capability rules hide provider-specific areas when the provider does not declare support", () => {
  const capabilities = ["gateway.sessions", "dashboard.logs"]

  assert.equal(supportsViewCapability("sessions", capabilities), true)
  assert.equal(supportsViewCapability("chat", capabilities), true)
  assert.equal(supportsViewCapability("memory", capabilities), true)
  assert.equal(supportsViewCapability("integrations", capabilities), false)
  assert.equal(supportsViewCapability("hermes-skills", capabilities), false)
})

test("sidebar group filtering preserves generic entries but removes unsupported provider modules", () => {
  const groups = [
    {
      group: "ai",
      items: [
        { id: "home" },
        { id: "sessions" },
        { id: "hermes-skills" },
        { id: "integrations" },
      ],
    },
    {
      group: "business",
      items: [{ id: "contacts" }, { id: "files" }],
    },
  ]

  const filtered = filterSidebarGroups(groups, ["gateway.sessions"])

  assert.deepEqual(filtered, [
    {
      group: "ai",
      items: [{ id: "home" }, { id: "sessions" }],
    },
    {
      group: "business",
      items: [{ id: "contacts" }],
    },
  ])
})

test("hermes submenu chooses the first supported capability view and keeps generic tools", () => {
  const minimalCapabilities = ["dashboard.logs"]
  assert.deepEqual(getAvailableHermesSubmenuIds(minimalCapabilities), [
    "prompt-market",
    "logs",
    "commands",
    "terminal",
  ])
  assert.equal(getDefaultHermesSubmenuView(minimalCapabilities), "prompt-market")

  const fullCapabilities = [
    "dashboard.status",
    "dashboard.model_config",
    "dashboard.channels",
    "dashboard.memory",
    "dashboard.logs",
    "dashboard.agents",
  ]
  assert.deepEqual(getAvailableHermesSubmenuIds(fullCapabilities), [
    "analytics",
    "model-config",
    "prompt-market",
    "channels",
    "memory",
    "logs",
    "agents",
    "commands",
    "terminal",
  ])
  assert.equal(getDefaultHermesSubmenuView(fullCapabilities), "model-config")
})

test("capability helper supports all/any rules and treats unknown capability sets as permissive", () => {
  assert.equal(
    supportsCapabilityRule(["dashboard.logs", "dashboard.status"], { all: ["dashboard.logs"] }),
    true
  )
  assert.equal(
    supportsCapabilityRule(["dashboard.logs"], { any: ["dashboard.status", "dashboard.logs"] }),
    true
  )
  assert.equal(
    supportsCapabilityRule(["dashboard.logs"], { all: ["dashboard.status"] }),
    false
  )
  assert.equal(
    supportsCapabilityRule(null, { all: ["dashboard.status"] }),
    true
  )
})
