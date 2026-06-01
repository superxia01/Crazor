#!/bin/bash
# Crazor 按客户构建桌面安装包
#
# 用法:
#   ./scripts/build-customer.sh "客户名" "https://123.45.67.1" [macos|macos-arm64|macos-x64|macos-current|windows|windows-x64|windows-current|current]
#
# 示例:
#   ./scripts/build-customer.sh "张三公司" "https://123.45.67.1"
#   ./scripts/build-customer.sh "李四工作室" "http://localhost:3001" macos-arm64
#   ./scripts/build-customer.sh "王五企业" "https://crazor.example.com" macos-current
#   ./scripts/build-customer.sh "本机验证" "http://localhost:5173" current
#
# 输出:
#   desktop/src-tauri/target/release/bundle/dmg/Crazor_1.0.0_aarch64.dmg (macOS)
#   desktop/src-tauri/target/release/bundle/msi/*.msi (Windows)

set -e

CUSTOMER="${1:?用法: build-customer.sh <客户名> <服务器URL> [macos|macos-arm64|macos-x64|macos-current|windows|windows-x64|windows-current|current]}"
SERVER_URL="${2:?错误: 请提供服务器 URL}"
PLATFORM="${3:-macos}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$PROJECT_ROOT/desktop/src-tauri/tauri.conf.json"
BUNDLE_DIR="$PROJECT_ROOT/desktop/src-tauri/target/release/bundle"
DELIVERY_MANIFEST="$BUNDLE_DIR/crazor-delivery-manifest.json"
DELIVERY_CHECKSUMS="$BUNDLE_DIR/crazor-delivery-checksums.txt"

echo "============================================"
echo "  Crazor 客户定制构建"
echo "============================================"
echo "  客户: $CUSTOMER"
echo "  服务器: $SERVER_URL"
echo "  平台: $PLATFORM"
echo "============================================"

# 检查 tauri.conf.json 存在
if [ ! -f "$TAURI_CONF" ]; then
    echo "错误: 找不到 $TAURI_CONF"
    exit 1
fi

# 备份原始配置
cp "$TAURI_CONF" "$TAURI_CONF.bak"
trap 'mv "$TAURI_CONF.bak" "$TAURI_CONF" 2>/dev/null' EXIT

WEB_ENV="$PROJECT_ROOT/web/.env.tauri"
WEB_ENV_BAK="$WEB_ENV.bak"

if ! command -v node >/dev/null 2>&1; then
    echo "错误: 未找到 node，请先安装 Node.js 依赖环境"
    exit 1
fi

NORMALIZED_SERVER_URL="$(SERVER_URL="$SERVER_URL" node <<'NODE'
const text = String(process.env.SERVER_URL || "").trim().replace(/\/+$/, "")
try {
  const url = new URL(text)
  if (url.protocol === "http:" || url.protocol === "https:") {
    process.stdout.write(`${url.origin}${url.pathname.replace(/\/+$/, "")}`)
  }
} catch {
}
NODE
)"
if [ -z "$NORMALIZED_SERVER_URL" ]; then
    echo "错误: 服务器 URL 必须是 http:// 或 https:// 开头的有效地址"
    exit 1
fi

SERVER_URL="$NORMALIZED_SERVER_URL"
export PATH="$HOME/.cargo/bin:$PATH"
DELIVERY_PROTOCOL_VERSION="${CRAZOR_DELIVERY_PROTOCOL_VERSION:-1}"
export CRAZOR_DELIVERY_PROTOCOL_VERSION="$DELIVERY_PROTOCOL_VERSION"

if ! command -v npm >/dev/null 2>&1; then
    echo "错误: 未找到 npm，请先安装 Node.js 依赖环境"
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "错误: 未找到 npx，请先安装 Node.js 依赖环境"
    exit 1
fi

HOST_OS="$(uname -s 2>/dev/null || echo unknown)"
require_current_platform_host() {
    local expected="$1"
    local label="$2"
    case "$expected:$HOST_OS" in
        macos:Darwin*) return 0 ;;
        windows:MINGW*|windows:MSYS*|windows:CYGWIN*) return 0 ;;
        *)
            echo "错误: $label 只能在对应系统 runner 上构建，当前宿主系统为 $HOST_OS"
            exit 1
            ;;
    esac
}

SERVER_PREFLIGHT_MODE="${CRAZOR_CUSTOMER_SERVER_PREFLIGHT:-warn}"
SERVER_PREFLIGHT_RESULT="skipped"

case "$SERVER_PREFLIGHT_MODE" in
    skip|off|false|0)
        echo "跳过客户服务预检: CRAZOR_CUSTOMER_SERVER_PREFLIGHT=$SERVER_PREFLIGHT_MODE"
        ;;
    strict|warn)
        echo ""
        echo "🔎 检查客户托管服务: $SERVER_URL"
        if node "$PROJECT_ROOT/scripts/verify-customer-server.mjs" "$CUSTOMER" "$SERVER_URL"; then
            SERVER_PREFLIGHT_RESULT="passed"
        else
            SERVER_PREFLIGHT_RESULT="warning"
            if [ "$SERVER_PREFLIGHT_MODE" = "strict" ] || [ "${CRAZOR_REQUIRE_CUSTOMER_SERVER_READY:-}" = "1" ]; then
                echo "错误: 客户服务预检未通过，已按 strict 模式停止构建"
                exit 1
            fi
            echo "警告: 客户服务预检未通过，本次按 warn 模式继续构建"
        fi
        echo ""
        ;;
    *)
        echo "错误: CRAZOR_CUSTOMER_SERVER_PREFLIGHT 只支持 warn、strict 或 skip"
        exit 1
        ;;
esac

if ! command -v cargo >/dev/null 2>&1; then
    echo "错误: 未找到 cargo，请先安装 Rust 工具链后再构建 Tauri 安装包"
    echo "参考: https://www.rust-lang.org/tools/install"
    exit 1
fi

BUILD_SHA="${CRAZOR_HEAD_SHA:-${GITHUB_HEAD_SHA:-${GITHUB_SHA:-}}}"
if [ -z "$BUILD_SHA" ] && command -v git >/dev/null 2>&1; then
    BUILD_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || true)"
fi
BUILD_TIME="$(node -e 'process.stdout.write(new Date().toISOString())')"

if [ -f "$WEB_ENV" ]; then
    cp "$WEB_ENV" "$WEB_ENV_BAK"
    trap 'mv "$TAURI_CONF.bak" "$TAURI_CONF" 2>/dev/null; mv "$WEB_ENV_BAK" "$WEB_ENV" 2>/dev/null' EXIT
else
    trap 'mv "$TAURI_CONF.bak" "$TAURI_CONF" 2>/dev/null; rm -f "$WEB_ENV" "$WEB_ENV_BAK" 2>/dev/null' EXIT
fi

write_web_env() {
    local key="$1"
    local value="$2"
    node -e '
const key = process.argv[1]
const value = String(process.argv[2] || "")
  .replace(/\\/g, "\\\\")
  .replace(/\n/g, "\\n")
  .replace(/\r/g, "\\r")
  .replace(/"/g, "\\\"")
process.stdout.write(`${key}="${value}"\n`)
' "$key" "$value" >> "$WEB_ENV"
}

: > "$WEB_ENV"
write_web_env "VITE_API_BASE" "$SERVER_URL"
write_web_env "VITE_CRAZOR_CUSTOMER_NAME" "$CUSTOMER"
write_web_env "VITE_CRAZOR_DELIVERY_CHANNEL" "customer"
write_web_env "VITE_CRAZOR_DELIVERY_PROTOCOL_VERSION" "$DELIVERY_PROTOCOL_VERSION"
write_web_env "VITE_CRAZOR_BUILD_SHA" "$BUILD_SHA"
write_web_env "VITE_CRAZOR_BUILD_TIME" "$BUILD_TIME"

echo ""
echo "✅ 客户端远程服务地址已写入: $SERVER_URL"
echo ""

# 构建前端静态资源
cd "$PROJECT_ROOT/web"
npm run build:tauri

# 清理旧 bundle，避免不同客户或不同平台的历史安装包混入本次交付清单。
rm -rf "$BUNDLE_DIR"

# 构建 Tauri 安装包
cd "$PROJECT_ROOT/desktop"

if [ "$PLATFORM" = "macos" ] || [ "$PLATFORM" = "macos-arm64" ]; then
    echo "🍎 构建 macOS Apple Silicon 安装包..."
    npx tauri build --target aarch64-apple-darwin
elif [ "$PLATFORM" = "macos-x64" ]; then
    echo "🍎 构建 macOS Intel 安装包..."
    npx tauri build --target x86_64-apple-darwin
elif [ "$PLATFORM" = "macos-current" ]; then
    require_current_platform_host macos "$PLATFORM"
    echo "🍎 构建 macOS 当前 runner 架构安装包..."
    npx tauri build
elif [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "windows-x64" ]; then
    echo "🪟 构建 Windows x64 安装包..."
    npx tauri build --target x86_64-pc-windows-msvc
elif [ "$PLATFORM" = "windows-current" ]; then
    require_current_platform_host windows "$PLATFORM"
    echo "🪟 构建 Windows 当前 runner 架构安装包..."
    npx tauri build
elif [ "$PLATFORM" = "current" ]; then
    echo "📦 构建当前平台..."
    npx tauri build
else
    echo "错误: 不支持的平台 $PLATFORM"
    echo "可选: macos, macos-arm64, macos-x64, macos-current, windows, windows-x64, windows-current, current"
    exit 1
fi

echo ""
echo "🔎 验证客户交付产物..."

if ! grep -R -F "$SERVER_URL" "$PROJECT_ROOT/web/dist" >/dev/null 2>&1; then
    echo "错误: 前端构建产物中未找到服务器地址 $SERVER_URL"
    exit 1
fi

if ! grep -R -F "$CUSTOMER" "$PROJECT_ROOT/web/dist" >/dev/null 2>&1; then
    echo "错误: 前端构建产物中未找到客户名称 $CUSTOMER"
    exit 1
fi

if [ ! -d "$BUNDLE_DIR" ]; then
    echo "错误: 找不到 Tauri bundle 目录 $BUNDLE_DIR"
    exit 1
fi

case "$PLATFORM" in
    macos|macos-arm64|macos-x64|macos-current)
        if ! find "$BUNDLE_DIR" -name "*.app" -type d | grep -q .; then
            echo "错误: 未找到 macOS .app 产物"
            exit 1
        fi
        if ! find "$BUNDLE_DIR" -name "*.dmg" -type f | grep -q .; then
            echo "错误: 未找到 macOS .dmg 安装包"
            exit 1
        fi
        ;;
    windows|windows-x64|windows-current)
        if ! find "$BUNDLE_DIR" \( -name "*.msi" -o -name "*.exe" \) -type f | grep -q .; then
            echo "错误: 未找到 Windows 安装包"
            exit 1
        fi
        ;;
    current)
        if ! find "$BUNDLE_DIR" \( -name "*.dmg" -o -name "*.app" -o -name "*.msi" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" \) | grep -q .; then
            echo "错误: 未找到当前平台安装包产物"
            exit 1
        fi
        ;;
esac

mkdir -p "$BUNDLE_DIR"
export CUSTOMER SERVER_URL PLATFORM DELIVERY_PROTOCOL_VERSION BUILD_SHA BUILD_TIME BUNDLE_DIR DELIVERY_MANIFEST DELIVERY_CHECKSUMS SERVER_PREFLIGHT_MODE SERVER_PREFLIGHT_RESULT
node <<'NODE'
const { createHash } = require("node:crypto")
const { createReadStream, readdirSync, statSync, writeFileSync } = require("node:fs")
const { extname, join, relative } = require("node:path")

const bundleDir = process.env.BUNDLE_DIR
const deliveryManifest = process.env.DELIVERY_MANIFEST
const deliveryChecksums = process.env.DELIVERY_CHECKSUMS
const fileExtensions = new Set([".dmg", ".msi", ".exe", ".deb", ".rpm", ".pkg", ".zip"])

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/")
}

function walkInstallables(dir) {
  const entries = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name)
    const lowerName = entry.name.toLowerCase()

    if (entry.isDirectory()) {
      if (lowerName.endsWith(".app")) {
        entries.push({ absolutePath, type: "application-bundle" })
        continue
      }
      entries.push(...walkInstallables(absolutePath))
      continue
    }

    if (
      entry.isFile() &&
      (fileExtensions.has(extname(lowerName)) || lowerName.endsWith(".appimage"))
    ) {
      entries.push({ absolutePath, type: "installer" })
    }
  }
  return entries
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

async function main() {
  const installables = walkInstallables(bundleDir).sort((a, b) =>
    normalizePath(relative(bundleDir, a.absolutePath)).localeCompare(
      normalizePath(relative(bundleDir, b.absolutePath))
    )
  )

  if (installables.length === 0) {
    throw new Error(`未找到可交付安装包产物: ${bundleDir}`)
  }

  const bundleFiles = []
  for (const item of installables) {
    const relativePath = normalizePath(relative(bundleDir, item.absolutePath))
    const stat = statSync(item.absolutePath)
    const fileRecord = {
      path: relativePath,
      type: item.type,
      sizeBytes: stat.isFile() ? stat.size : null,
      sha256: stat.isFile() ? await sha256File(item.absolutePath) : null,
    }
    bundleFiles.push(fileRecord)
  }

  const checksumLines = bundleFiles
    .filter((file) => file.sha256)
    .map((file) => `${file.sha256}  ${file.path}`)
    .join("\n")

  writeFileSync(deliveryChecksums, checksumLines ? `${checksumLines}\n` : "")

  const manifest = {
    product: "Crazor",
    customer: process.env.CUSTOMER,
    serverUrl: process.env.SERVER_URL,
    platform: process.env.PLATFORM,
    serverPreflight: {
      mode: process.env.SERVER_PREFLIGHT_MODE || "",
      result: process.env.SERVER_PREFLIGHT_RESULT || "",
    },
    deliveryProtocolVersion: process.env.DELIVERY_PROTOCOL_VERSION || "",
    gitSha: process.env.BUILD_SHA || process.env.CRAZOR_HEAD_SHA || process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || "",
    workflowSha: process.env.GITHUB_SHA || "",
    githubRunId: process.env.GITHUB_RUN_ID || "",
    builtAt: process.env.BUILD_TIME || new Date().toISOString(),
    checksumFile: normalizePath(relative(bundleDir, deliveryChecksums)),
    bundleFiles,
  }

  writeFileSync(deliveryManifest, JSON.stringify(manifest, null, 2) + "\n")
}

main().catch((error) => {
  console.error(`错误: ${error.message}`)
  process.exit(1)
})
NODE

echo "✅ 交付产物验证通过"
echo "  Manifest: $DELIVERY_MANIFEST"
echo "  Checksums: $DELIVERY_CHECKSUMS"

echo ""
echo "============================================"
echo "  ✅ 构建完成！"
echo "  客户: $CUSTOMER"
echo "  安装包位置:"
echo "  $PROJECT_ROOT/desktop/src-tauri/target/release/bundle/"
echo "============================================"
