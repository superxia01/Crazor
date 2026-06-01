// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { evaluateDeliveryIdentity } from "./api/delivery-identity.js"

test("delivery identity passes when packaged customer matches hosted backend", () => {
  const result = evaluateDeliveryIdentity(
    {
      enabled: true,
      customerName: " CRAZYAIGC 内部 ",
      protocolVersion: "1",
      serverUrl: "https://client.example.com/",
    },
    {
      delivery: {
        customer: "CRAZYAIGC 内部",
        protocol_version: "1",
        public_base_url: "https://client.example.com",
      },
    }
  )
  assert.equal(result.status, "ok")
})

test("delivery identity blocks packaged client when hosted backend does not declare customer", () => {
  const result = evaluateDeliveryIdentity(
    { enabled: true, customerName: "CRAZYAIGC 内部" },
    { delivery: { customer: "" } }
  )
  assert.equal(result.status, "error")
  assert.match(result.message, /未声明交付客户/)
})

test("delivery identity blocks packaged client when hosted backend declares another customer", () => {
  const result = evaluateDeliveryIdentity(
    { enabled: true, customerName: "CRAZYAIGC 内部" },
    { delivery: { customer: "测试环境" } }
  )
  assert.equal(result.status, "error")
  assert.match(result.message, /测试环境/)
})

test("delivery identity blocks packaged client when delivery protocol mismatches", () => {
  const result = evaluateDeliveryIdentity(
    { enabled: true, customerName: "CRAZYAIGC 内部", protocolVersion: "2" },
    { delivery: { customer: "CRAZYAIGC 内部", protocol_version: "1" } }
  )
  assert.equal(result.status, "error")
  assert.match(result.message, /交付协议 2/)
})

test("delivery identity blocks packaged client when hosted public URL is missing", () => {
  const result = evaluateDeliveryIdentity(
    {
      enabled: true,
      customerName: "CRAZYAIGC 内部",
      protocolVersion: "1",
      serverUrl: "https://client.example.com",
    },
    { delivery: { customer: "CRAZYAIGC 内部", protocol_version: "1" } }
  )
  assert.equal(result.status, "error")
  assert.match(result.message, /未声明公开地址/)
})

test("delivery identity blocks packaged client when hosted public URL mismatches", () => {
  const result = evaluateDeliveryIdentity(
    {
      enabled: true,
      customerName: "CRAZYAIGC 内部",
      protocolVersion: "1",
      serverUrl: "https://client.example.com/",
    },
    {
      delivery: {
        customer: "CRAZYAIGC 内部",
        protocol_version: "1",
        public_base_url: "https://other.example.com/",
      },
    }
  )
  assert.equal(result.status, "error")
  assert.match(result.message, /公开地址/)
  assert.match(result.message, /https:\/\/client\.example\.com/)
  assert.match(result.message, /https:\/\/other\.example\.com/)
})

test("delivery identity stays open for local development clients", () => {
  const result = evaluateDeliveryIdentity(
    { enabled: false, customerName: "" },
    { delivery: { customer: "" } }
  )
  assert.equal(result.status, "ok")
})
