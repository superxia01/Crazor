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
    }),
    {
      enabled: true,
      customerName: "CRAZYAIGC 内部",
      channel: "customer",
      serverUrl: "https://crazor.example.com",
    },
  )
})

test("customer delivery runtime info stays local when no package env is embedded", () => {
  assert.deepEqual(getCustomerDeliveryRuntimeInfo({}), {
    enabled: false,
    customerName: "",
    channel: "local",
    serverUrl: "",
  })
})
