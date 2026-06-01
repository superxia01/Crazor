// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import { verifyCustomerDeliveryPackage } from "../../scripts/verify-customer-delivery.mjs"

test("customer delivery verifier accepts a focused handoff package", async () => {
  const dir = createDeliveryFixture()
  try {
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, true)
    assert.equal(result.manifest.platform, "macos-current")
    assert.deepEqual(
      result.installers.map((item) => item.path),
      ["dmg/Crazor_1.0.0_aarch64.dmg"],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer delivery verifier accepts a generated handoff report", async () => {
  const dir = createDeliveryFixture()
  try {
    writeFileSync(join(dir, "crazor-handoff-report.md"), "# Crazor 客户交付验收报告\n\n- 验收结果: 通过\n")
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, true)
    assert.equal(result.handoffReport.path, "crazor-handoff-report.md")
    assert.ok(result.handoffReport.sizeBytes > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer delivery verifier rejects invalid handoff reports", async () => {
  const dir = createDeliveryFixture()
  try {
    writeFileSync(join(dir, "crazor-handoff-report.md"), "# 随意报告\n")
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /不是有效的客户交付验收报告/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer delivery verifier rejects checksum mismatches", async () => {
  const dir = createDeliveryFixture()
  try {
    writeFileSync(join(dir, "dmg", "Crazor_1.0.0_aarch64.dmg"), "tampered")
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /SHA256 不一致/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer delivery verifier rejects build helper files", async () => {
  const dir = createDeliveryFixture()
  try {
    mkdirSync(join(dir, "share", "create-dmg"), { recursive: true })
    writeFileSync(join(dir, "share", "create-dmg", "template.applescript"), "helper")
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /非交付文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createDeliveryFixture() {
  const dir = mkdtempSync(join(tmpdir(), "crazor-delivery-"))
  const installerPath = "dmg/Crazor_1.0.0_aarch64.dmg"
  const installerContent = "fake installer"
  const sha256 = createHash("sha256").update(installerContent).digest("hex")

  mkdirSync(join(dir, "dmg"), { recursive: true })
  writeFileSync(join(dir, installerPath), installerContent)
  writeFileSync(join(dir, "crazor-delivery-checksums.txt"), `${sha256}  ${installerPath}\n`)
  writeFileSync(
    join(dir, "crazor-delivery-manifest.json"),
    JSON.stringify(
      {
        product: "Crazor",
        customer: "测试客户",
        serverUrl: "https://crazor.example.com",
        platform: "macos-current",
        serverPreflight: {
          mode: "strict",
          result: "passed",
        },
        deliveryProtocolVersion: "1",
        deliveryIdentityFingerprint: deliveryFingerprint("测试客户", "https://crazor.example.com", "customer", "1"),
        gitSha: "abc123",
        workflowSha: "def456",
        githubRunId: "123",
        builtAt: "2026-06-01T20:00:00.000Z",
        checksumFile: "crazor-delivery-checksums.txt",
        bundleFiles: [
          {
            path: installerPath,
            type: "installer",
            sizeBytes: Buffer.byteLength(installerContent),
            sha256,
          },
        ],
      },
      null,
      2,
    ) + "\n",
  )
  return dir
}

function deliveryFingerprint(customer, serverUrl, channel, protocolVersion) {
  return createHash("sha256")
    .update(JSON.stringify({
      product: "Crazor",
      customer,
      serverUrl,
      channel,
      protocolVersion,
    }))
    .digest("hex")
    .slice(0, 12)
}
