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
    assert.equal(result.startGuide.path, "crazor-start-here.md")
    assert.ok(result.startGuide.sizeBytes > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("customer delivery verifier accepts a Windows installer package", async () => {
  const dir = createDeliveryFixture({
    installerPath: "msi/Crazor_1.0.0_x64_en-US.msi",
    platform: "windows-current",
  })
  try {
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, true)
    assert.equal(result.manifest.platform, "windows-current")
    assert.deepEqual(
      result.installers.map((item) => item.path),
      ["msi/Crazor_1.0.0_x64_en-US.msi"],
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

test("customer delivery verifier rejects packages without the customer start guide", async () => {
  const dir = createDeliveryFixture()
  try {
    rmSync(join(dir, "crazor-start-here.md"), { force: true })
    const result = await verifyCustomerDeliveryPackage(dir)

    assert.equal(result.ok, false)
    assert.match(result.errors.join("\n"), /缺少客户交付说明/)
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

function createDeliveryFixture(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "crazor-delivery-"))
  const installerPath = options.installerPath || "dmg/Crazor_1.0.0_aarch64.dmg"
  const platform = options.platform || "macos-current"
  const installerContent = "fake installer"
  const sha256 = createHash("sha256").update(installerContent).digest("hex")
  const installerDir = installerPath.split("/").slice(0, -1).join("/")

  mkdirSync(join(dir, installerDir), { recursive: true })
  writeFileSync(join(dir, installerPath), installerContent)
  writeFileSync(join(dir, "crazor-delivery-checksums.txt"), `${sha256}  ${installerPath}\n`)
  const manifest = createManifest({ installerPath, installerContent, platform, sha256 })
  writeFileSync(
    join(dir, "crazor-delivery-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  )
  writeFileSync(
    join(dir, "crazor-start-here.md"),
    renderStartGuide(manifest),
  )
  return dir
}

function createManifest({ installerPath, installerContent, platform, sha256 }) {
  return {
    product: "Crazor",
    customer: "测试客户",
    serverUrl: "https://crazor.example.com",
    platform,
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
  }
}

function renderStartGuide(manifest) {
  return `# Crazor 客户交付说明

- 客户: ${manifest.customer}
- Web 统一入口: ${manifest.serverUrl}
- 桌面客户端后端: ${manifest.serverUrl}
- 交付协议: ${manifest.deliveryProtocolVersion}
- 交付指纹: ${manifest.deliveryIdentityFingerprint}

## 桌面安装包

${manifest.bundleFiles.map((file) => `- ${file.path}`).join("\n")}

## 验收文件

- crazor-delivery-manifest.json
- crazor-delivery-checksums.txt
`
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
