#!/usr/bin/env node

import { createHash } from "node:crypto"
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { extname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_DELIVERY_DIR = fileURLToPath(new URL("../desktop/src-tauri/target/release/customer-delivery", import.meta.url))
const MANIFEST_FILE = "crazor-delivery-manifest.json"
const CHECKSUM_FILE = "crazor-delivery-checksums.txt"
const INSTALLER_EXTENSIONS = new Set([".dmg", ".msi", ".exe", ".deb", ".rpm", ".pkg", ".zip"])

export async function verifyCustomerDeliveryPackage(deliveryDir = DEFAULT_DELIVERY_DIR) {
  const root = resolve(deliveryDir)
  const errors = []
  const warnings = []
  const manifestPath = join(root, MANIFEST_FILE)

  if (!existsSync(root)) {
    return failure(root, [`客户交付目录不存在: ${root}`], warnings)
  }
  if (!existsSync(manifestPath)) {
    return failure(root, [`缺少交付清单: ${MANIFEST_FILE}`], warnings)
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch (error) {
    return failure(root, [`交付清单不是有效 JSON: ${error?.message || error}`], warnings)
  }

  validateManifestShape(manifest, errors)

  const checksumFile = normalizePackagePath(manifest.checksumFile || CHECKSUM_FILE)
  const checksumPath = safeJoin(root, checksumFile)
  if (!checksumPath || !existsSync(checksumPath)) {
    errors.push(`缺少校验和文件: ${checksumFile || CHECKSUM_FILE}`)
  }

  const bundleFiles = Array.isArray(manifest.bundleFiles) ? manifest.bundleFiles : []
  const expectedChecksums = new Map()
  const allowedFiles = new Set([MANIFEST_FILE, checksumFile || CHECKSUM_FILE])
  const installers = []

  for (const file of bundleFiles) {
    const packagePath = normalizePackagePath(file?.path)
    if (!packagePath) {
      errors.push("bundleFiles 包含空路径")
      continue
    }
    if (file?.type !== "installer") {
      errors.push(`交付包只允许 installer 文件，发现 ${packagePath} 的类型为 ${file?.type || "空"}`)
      continue
    }
    if (!isInstallerFile(packagePath)) {
      errors.push(`交付包文件扩展名不受支持: ${packagePath}`)
      continue
    }
    const absolutePath = safeJoin(root, packagePath)
    if (!absolutePath) {
      errors.push(`交付包文件路径不安全: ${packagePath}`)
      continue
    }
    if (!existsSync(absolutePath)) {
      errors.push(`manifest 声明的安装包不存在: ${packagePath}`)
      continue
    }
    const stat = statSync(absolutePath)
    if (!stat.isFile()) {
      errors.push(`manifest 声明的安装包不是文件: ${packagePath}`)
      continue
    }
    if (Number(file.sizeBytes) !== stat.size) {
      errors.push(`安装包大小不一致: ${packagePath} manifest=${file.sizeBytes} actual=${stat.size}`)
    }
    if (!/^[a-f0-9]{64}$/i.test(String(file.sha256 || ""))) {
      errors.push(`manifest 缺少有效 SHA256: ${packagePath}`)
      continue
    }
    const actualSha = await sha256File(absolutePath)
    if (actualSha !== String(file.sha256).toLowerCase()) {
      errors.push(`安装包 SHA256 不一致: ${packagePath} manifest=${file.sha256} actual=${actualSha}`)
    }
    expectedChecksums.set(packagePath, String(file.sha256).toLowerCase())
    allowedFiles.add(packagePath)
    installers.push({ path: packagePath, sizeBytes: stat.size, sha256: actualSha })
  }

  if (checksumPath && existsSync(checksumPath)) {
    const actualChecksums = parseChecksumFile(readFileSync(checksumPath, "utf8"), errors)
    for (const [path, sha] of expectedChecksums) {
      if (actualChecksums.get(path) !== sha) {
        errors.push(`checksum 文件未正确记录 ${path}`)
      }
    }
    for (const path of actualChecksums.keys()) {
      if (!expectedChecksums.has(path)) {
        errors.push(`checksum 文件包含 manifest 未声明的文件: ${path}`)
      }
    }
  }

  for (const unexpected of findUnexpectedFiles(root, allowedFiles)) {
    errors.push(`交付目录包含非交付文件: ${unexpected}`)
  }

  if (errors.length > 0) return failure(root, errors, warnings)
  return {
    ok: true,
    deliveryDir: root,
    manifest,
    installers,
    warnings,
  }
}

function validateManifestShape(manifest, errors) {
  if (manifest?.product !== "Crazor") errors.push("manifest.product 必须为 Crazor")
  for (const key of ["customer", "serverUrl", "platform", "deliveryProtocolVersion", "deliveryIdentityFingerprint", "gitSha", "builtAt"]) {
    if (!String(manifest?.[key] || "").trim()) errors.push(`manifest 缺少 ${key}`)
  }
  if (!isHttpUrl(manifest?.serverUrl)) errors.push("manifest.serverUrl 必须是 http:// 或 https:// 地址")
  if (!/^[a-f0-9]{12}$/i.test(String(manifest?.deliveryIdentityFingerprint || ""))) {
    errors.push("manifest.deliveryIdentityFingerprint 必须是 12 位十六进制交付指纹")
  }
  if (Number.isNaN(Date.parse(String(manifest?.builtAt || "")))) errors.push("manifest.builtAt 不是有效时间")
  if (!Array.isArray(manifest?.bundleFiles) || manifest.bundleFiles.length === 0) {
    errors.push("manifest.bundleFiles 不能为空")
  }
}

function parseChecksumFile(text, errors) {
  const checksums = new Map()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(/^([a-fA-F0-9]{64})\s+(.+)$/)
    if (!match) {
      errors.push(`checksum 行格式错误: ${line}`)
      continue
    }
    const path = normalizePackagePath(match[2])
    if (!path) {
      errors.push(`checksum 文件路径不安全: ${match[2]}`)
      continue
    }
    checksums.set(path, match[1].toLowerCase())
  }
  return checksums
}

function findUnexpectedFiles(root, allowedFiles) {
  const unexpected = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = join(dir, entry.name)
      const packagePath = normalizePackagePath(relative(root, absolutePath))
      if (!packagePath) continue
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase()
        if (lowerName.endsWith(".app") || lowerName === "share" || lowerName === "macos") {
          unexpected.push(packagePath)
          continue
        }
        walk(absolutePath)
        continue
      }
      if (!allowedFiles.has(packagePath)) unexpected.push(packagePath)
    }
  }
  walk(root)
  return unexpected
}

function normalizePackagePath(value) {
  const text = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "")
  if (!text || text.includes("\0")) return ""
  if (isAbsolute(text)) return ""
  const parts = text.split("/")
  if (parts.some((part) => !part || part === "." || part === "..")) return ""
  return parts.join("/")
}

function safeJoin(root, packagePath) {
  const normalized = normalizePackagePath(packagePath)
  if (!normalized) return ""
  const absolutePath = resolve(root, ...normalized.split("/"))
  const relativePath = relative(root, absolutePath)
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) return ""
  return absolutePath
}

function isInstallerFile(packagePath) {
  const lower = packagePath.toLowerCase()
  return lower.endsWith(".appimage") || INSTALLER_EXTENSIONS.has(extname(lower))
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""))
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function sha256File(filePath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolvePromise(hash.digest("hex")))
  })
}

function failure(deliveryDir, errors, warnings) {
  return { ok: false, deliveryDir, errors, warnings }
}

async function main() {
  const deliveryDir = process.argv[2] || DEFAULT_DELIVERY_DIR
  const result = await verifyCustomerDeliveryPackage(deliveryDir)
  if (!result.ok) {
    console.error("客户交付包校验失败:")
    for (const error of result.errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log("客户交付包校验通过:")
  console.log(`- 目录: ${result.deliveryDir}`)
  console.log(`- 客户: ${result.manifest.customer}`)
  console.log(`- 服务地址: ${result.manifest.serverUrl}`)
  console.log(`- 平台: ${result.manifest.platform}`)
  for (const installer of result.installers) {
    console.log(`- 安装包: ${installer.path} (${installer.sizeBytes} bytes, sha256=${installer.sha256})`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`客户交付包校验失败: ${error?.message || error}`)
    process.exit(1)
  })
}
