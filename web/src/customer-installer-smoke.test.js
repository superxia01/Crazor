// Copyright (c) 2026 MeeJoy

import assert from "node:assert/strict"
import test from "node:test"

import { createInstallerSmokePlan } from "../../scripts/verify-customer-installer.mjs"

test("customer installer smoke plans macOS DMG validation on macOS runners", () => {
  const plan = createInstallerSmokePlan(deliveryResult("macos-current", [
    { path: "dmg/Crazor_1.0.0_aarch64.dmg" },
  ]), "darwin")

  assert.equal(plan.ok, true)
  assert.equal(plan.kind, "macos-dmg")
  assert.equal(plan.expectedHost, "darwin")
  assert.equal(plan.hostMatches, true)
  assert.equal(plan.installer.path, "dmg/Crazor_1.0.0_aarch64.dmg")
})

test("customer installer smoke plans Windows MSI extraction on Windows runners", () => {
  const plan = createInstallerSmokePlan(deliveryResult("windows-current", [
    { path: "nsis/Crazor_1.0.0_x64-setup.exe" },
    { path: "msi/Crazor_1.0.0_x64_en-US.msi" },
  ]), "win32")

  assert.equal(plan.ok, true)
  assert.equal(plan.kind, "windows-msi")
  assert.equal(plan.expectedHost, "win32")
  assert.equal(plan.hostMatches, true)
  assert.equal(plan.installer.path, "msi/Crazor_1.0.0_x64_en-US.msi")
})

test("customer installer smoke rejects Windows packages without an MSI", () => {
  const plan = createInstallerSmokePlan(deliveryResult("windows-current", [
    { path: "nsis/Crazor_1.0.0_x64-setup.exe" },
  ]), "win32")

  assert.equal(plan.ok, false)
  assert.match(plan.errors.join("\n"), /缺少可解包验证的 \.msi/)
})

test("customer installer smoke reports host mismatches before running system tools", () => {
  const plan = createInstallerSmokePlan(deliveryResult("windows-current", [
    { path: "msi/Crazor_1.0.0_x64_en-US.msi" },
  ]), "darwin")

  assert.equal(plan.ok, true)
  assert.equal(plan.hostMatches, false)
  assert.equal(plan.expectedHost, "win32")
})

function deliveryResult(platform, installers) {
  return {
    ok: true,
    manifest: { platform },
    installers,
  }
}
