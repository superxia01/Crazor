// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { getCustomerDeliveryRuntimeInfo } from "./api/customer-delivery.js"

test("customer delivery runtime info exposes packaged customer identity", () => {
  assert.deepEqual(
    getCustomerDeliveryRuntimeInfo({
      VITE_API_BASE: " https://crazor.example.com/ ",
      VITE_CRAZOR_CUSTOMER_NAME: " CRAZYAIGC 内部 ",
      VITE_CRAZOR_DELIVERY_CHANNEL: " customer ",
      VITE_CRAZOR_DELIVERY_PROTOCOL_VERSION: " 1 ",
      VITE_CRAZOR_DELIVERY_FINGERPRINT: " abc123def456 ",
      VITE_CRAZOR_BUILD_SHA: " abc123 ",
      VITE_CRAZOR_BUILD_TIME: " 2026-06-01T17:02:17.391Z ",
    }),
    {
      enabled: true,
      customerName: "CRAZYAIGC 内部",
      channel: "customer",
      protocolVersion: "1",
      deliveryFingerprint: "abc123def456",
      serverUrl: "https://crazor.example.com",
      buildSha: "abc123",
      buildTime: "2026-06-01T17:02:17.391Z",
    },
  )
})

test("customer delivery runtime info stays local when no package env is embedded", () => {
  assert.deepEqual(getCustomerDeliveryRuntimeInfo({}), {
    enabled: false,
    customerName: "",
    channel: "local",
    protocolVersion: "",
    deliveryFingerprint: "",
    serverUrl: "",
    buildSha: "",
    buildTime: "",
  })
})
