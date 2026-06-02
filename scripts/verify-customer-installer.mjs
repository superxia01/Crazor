#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { verifyCustomerDeliveryPackage } from "./verify-customer-delivery.mjs"

const DEFAULT_DELIVERY_DIR = fileURLToPath(new URL("../desktop/src-tauri/target/release/customer-delivery", import.meta.url))

export function createInstallerSmokePlan(deliveryResult, hostPlatform = process.platform) {
  const platform = String(deliveryResult?.manifest?.platform || "").toLowerCase()
  const installers = Array.isArray(deliveryResult?.installers) ? deliveryResult.installers : []
  const errors = []
  const warnings = []

  if (!deliveryResult?.ok) {
    errors.push("交付包未通过基础校验，不能继续安装器烟测")
  }
  if (!platform) {
    errors.push("manifest.platform 为空，无法判断目标安装平台")
  }

  if (platform.startsWith("macos")) {
    const installer = installers.find((item) => item.path.toLowerCase().endsWith(".dmg"))
    if (!installer) errors.push("macOS 交付包缺少 .dmg 安装器")
    return {
      ok: errors.length === 0,
      kind: "macos-dmg",
      expectedHost: "darwin",
      hostPlatform,
      hostMatches: hostPlatform === "darwin",
      installer,
      errors,
      warnings,
    }
  }

  if (platform.startsWith("windows")) {
    const installer = installers.find((item) => item.path.toLowerCase().endsWith(".msi"))
    if (!installer) errors.push("Windows 交付包缺少可解包验证的 .msi 安装器")
    return {
      ok: errors.length === 0,
      kind: "windows-msi",
      expectedHost: "win32",
      hostPlatform,
      hostMatches: hostPlatform === "win32",
      installer,
      errors,
      warnings,
    }
  }

  errors.push(`暂不支持平台 ${platform} 的安装器烟测`)
  return {
    ok: false,
    kind: "unsupported",
    expectedHost: "",
    hostPlatform,
    hostMatches: false,
    installer: null,
    errors,
    warnings,
  }
}

export async function verifyCustomerInstaller(deliveryDir = DEFAULT_DELIVERY_DIR, options = {}) {
  const delivery = await verifyCustomerDeliveryPackage(deliveryDir)
  if (!delivery.ok) return failure(deliveryDir, delivery.errors, delivery.warnings || [])

  const plan = createInstallerSmokePlan(delivery, options.hostPlatform || process.platform)
  const warnings = [...(delivery.warnings || []), ...plan.warnings]
  if (!plan.ok) return failure(delivery.deliveryDir, plan.errors, warnings)
  if (!plan.hostMatches) {
    return failure(
      delivery.deliveryDir,
      [`${delivery.manifest.platform} 安装器烟测必须在 ${plan.expectedHost} runner 上执行，当前宿主为 ${plan.hostPlatform}`],
      warnings,
    )
  }

  const installerPath = resolve(delivery.deliveryDir, plan.installer.path)
  if (plan.kind === "macos-dmg") {
    return verifyMacDmg(delivery, installerPath, warnings)
  }
  if (plan.kind === "windows-msi") {
    return verifyWindowsMsi(delivery, installerPath, warnings)
  }
  return failure(delivery.deliveryDir, [`暂不支持 ${plan.kind} 安装器烟测`], warnings)
}

function verifyMacDmg(delivery, installerPath, warnings) {
  runCommand("hdiutil", ["verify", installerPath], "DMG 完整性验证失败")

  const mountDir = mkdtempSync(join(tmpdir(), "crazor-dmg-"))
  let mounted = false
  try {
    runCommand("hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mountDir, installerPath], "DMG 挂载失败")
    mounted = true

    const appPath = findFirst(mountDir, (path, entry) => entry.isDirectory() && entry.name.toLowerCase().endsWith(".app"))
    if (!appPath) throw new Error("DMG 中未找到 .app 应用包")

    const infoPlist = join(appPath, "Contents", "Info.plist")
    const executableDir = join(appPath, "Contents", "MacOS")
    if (!existsSync(infoPlist)) throw new Error(`App 缺少 Info.plist: ${infoPlist}`)
    if (!existsSync(executableDir)) throw new Error(`App 缺少 Contents/MacOS: ${executableDir}`)

    const codesign = runCommand(
      "codesign",
      ["--verify", "--deep", "--strict", "--verbose=4", appPath],
      "App 签名校验失败",
      { allowFailure: true },
    )
    handleTrustResult(codesign, "macOS codesign", warnings)

    const spctl = runCommand(
      "spctl",
      ["--assess", "--type", "execute", "--verbose=4", appPath],
      "App Gatekeeper 校验失败",
      { allowFailure: true },
    )
    handleTrustResult(spctl, "macOS Gatekeeper", warnings)

    return {
      ok: true,
      deliveryDir: delivery.deliveryDir,
      platform: delivery.manifest.platform,
      installer: installerPath,
      checks: ["hdiutil verify", "hdiutil attach", `${basename(appPath)} bundle`],
      warnings,
    }
  } finally {
    if (mounted) {
      runCommand("hdiutil", ["detach", mountDir], "DMG 卸载失败", { allowFailure: true })
    }
    rmSync(mountDir, { recursive: true, force: true })
  }
}

function verifyWindowsMsi(delivery, installerPath, warnings) {
  const extractDir = mkdtempSync(join(tmpdir(), "crazor-msi-"))
  try {
    runCommand(
      "msiexec",
      ["/a", installerPath, "/qn", `TARGETDIR=${extractDir}`],
      "MSI 行政解包失败",
    )
    const executable = findFirst(extractDir, (path, entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
    if (!executable) throw new Error("MSI 解包后未找到可执行文件")
    if (statSync(executable).size <= 0) throw new Error(`MSI 解包出的可执行文件为空: ${executable}`)

    const signature = readWindowsSignature(installerPath)
    handleTrustResult(signature, "Windows Authenticode", warnings, (output) =>
      /"Status"\s*:\s*"Valid"/.test(output) || /"Status"\s*:\s*0\b/.test(output)
    )

    return {
      ok: true,
      deliveryDir: delivery.deliveryDir,
      platform: delivery.manifest.platform,
      installer: installerPath,
      checks: ["msiexec administrative extract", `${basename(executable)} extracted`],
      warnings,
    }
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

function handleTrustResult(result, label, warnings, isValid = (output) => result.status === 0 && output.trim().length > 0) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim()
  if (isValid(output)) return
  const message = `${label} 未通过，当前安装包仍属于测试交付包`
  if (process.env.CRAZOR_REQUIRE_INSTALLER_TRUST === "1") {
    throw new Error(`${message}: ${output || "无输出"}`)
  }
  warnings.push(message)
}

function readWindowsSignature(installerPath) {
  const command = [
    "$sig = Get-AuthenticodeSignature -LiteralPath $args[0]",
    "$sig | Select-Object Status,StatusMessage | ConvertTo-Json -Compress",
  ].join("; ")
  return runCommand(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command, installerPath],
    "Windows 签名状态读取失败",
    { allowFailure: true },
  )
}

function findFirst(root, predicate) {
  const entries = readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = join(root, entry.name)
    if (predicate(absolutePath, entry)) return absolutePath
    if (entry.isDirectory()) {
      const found = findFirst(absolutePath, predicate)
      if (found) return found
    }
  }
  return ""
}

function runCommand(command, args, failureMessage, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  if (result.status !== 0 && !options.allowFailure) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim()
    throw new Error(`${failureMessage}: ${output || `exit ${result.status}`}`)
  }
  return result
}

function failure(deliveryDir, errors, warnings) {
  return { ok: false, deliveryDir: resolve(deliveryDir), errors, warnings }
}

async function main() {
  const deliveryDir = process.argv[2] || DEFAULT_DELIVERY_DIR
  try {
    const result = await verifyCustomerInstaller(deliveryDir)
    if (!result.ok) {
      console.error("客户安装器烟测失败:")
      for (const error of result.errors) console.error(`- ${error}`)
      for (const warning of result.warnings || []) console.error(`警告: ${warning}`)
      process.exit(1)
    }

    console.log("客户安装器烟测通过:")
    console.log(`- 目录: ${result.deliveryDir}`)
    console.log(`- 平台: ${result.platform}`)
    console.log(`- 安装器: ${result.installer}`)
    for (const check of result.checks) console.log(`- ${check}: 通过`)
    for (const warning of result.warnings || []) console.log(`警告: ${warning}`)
  } catch (error) {
    console.error(`客户安装器烟测失败: ${error?.message || error}`)
    process.exit(1)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
