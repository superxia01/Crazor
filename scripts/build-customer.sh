#!/bin/bash
# Crazor 按客户构建桌面安装包
#
# 用法:
#   ./scripts/build-customer.sh "客户名" "https://123.45.67.1" [macos|macos-arm64|macos-x64|windows|windows-x64|current]
#
# 示例:
#   ./scripts/build-customer.sh "张三公司" "https://123.45.67.1"
#   ./scripts/build-customer.sh "李四工作室" "http://localhost:3001" macos-arm64
#   ./scripts/build-customer.sh "本机验证" "http://localhost:5173" current
#
# 输出:
#   desktop/src-tauri/target/release/bundle/dmg/Crazor_1.0.0_aarch64.dmg (macOS)
#   desktop/src-tauri/target/release/bundle/msi/*.msi (Windows)

set -e

CUSTOMER="${1:?用法: build-customer.sh <客户名> <服务器URL> [macos|macos-arm64|macos-x64|windows|windows-x64|current]}"
SERVER_URL="${2:?错误: 请提供服务器 URL}"
PLATFORM="${3:-macos}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$PROJECT_ROOT/desktop/src-tauri/tauri.conf.json"
BUNDLE_DIR="$PROJECT_ROOT/desktop/src-tauri/target/release/bundle"
DELIVERY_MANIFEST="$BUNDLE_DIR/crazor-delivery-manifest.json"

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

if [[ "$SERVER_URL" != http://* && "$SERVER_URL" != https://* ]]; then
    echo "错误: 服务器 URL 必须以 http:// 或 https:// 开头"
    exit 1
fi

SERVER_URL="${SERVER_URL%/}"
export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
    echo "错误: 未找到 npm，请先安装 Node.js 依赖环境"
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "错误: 未找到 npx，请先安装 Node.js 依赖环境"
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "错误: 未找到 node，请先安装 Node.js 依赖环境"
    exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
    echo "错误: 未找到 cargo，请先安装 Rust 工具链后再构建 Tauri 安装包"
    echo "参考: https://www.rust-lang.org/tools/install"
    exit 1
fi

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

echo ""
echo "✅ 客户端远程服务地址已写入: $SERVER_URL"
echo ""

# 构建前端静态资源
cd "$PROJECT_ROOT/web"
npm run build:tauri

# 构建 Tauri 安装包
cd "$PROJECT_ROOT/desktop"

if [ "$PLATFORM" = "macos" ] || [ "$PLATFORM" = "macos-arm64" ]; then
    echo "🍎 构建 macOS Apple Silicon 安装包..."
    npx tauri build --target aarch64-apple-darwin
elif [ "$PLATFORM" = "macos-x64" ]; then
    echo "🍎 构建 macOS Intel 安装包..."
    npx tauri build --target x86_64-apple-darwin
elif [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "windows-x64" ]; then
    echo "🪟 构建 Windows x64 安装包..."
    npx tauri build --target x86_64-pc-windows-msvc
elif [ "$PLATFORM" = "current" ]; then
    echo "📦 构建当前平台..."
    npx tauri build
else
    echo "错误: 不支持的平台 $PLATFORM"
    echo "可选: macos, macos-arm64, macos-x64, windows, windows-x64, current"
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
    macos|macos-arm64|macos-x64)
        if ! find "$BUNDLE_DIR" -name "*.app" -type d | grep -q .; then
            echo "错误: 未找到 macOS .app 产物"
            exit 1
        fi
        if ! find "$BUNDLE_DIR" -name "*.dmg" -type f | grep -q .; then
            echo "错误: 未找到 macOS .dmg 安装包"
            exit 1
        fi
        ;;
    windows|windows-x64)
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
export CUSTOMER SERVER_URL PLATFORM DELIVERY_MANIFEST
node -e '
const { writeFileSync } = require("node:fs")
const manifest = {
  product: "Crazor",
  customer: process.env.CUSTOMER,
  serverUrl: process.env.SERVER_URL,
  platform: process.env.PLATFORM,
  gitSha: process.env.CRAZOR_HEAD_SHA || process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || "",
  workflowSha: process.env.GITHUB_SHA || "",
  githubRunId: process.env.GITHUB_RUN_ID || "",
  builtAt: new Date().toISOString(),
}
writeFileSync(process.env.DELIVERY_MANIFEST, JSON.stringify(manifest, null, 2) + "\n")
'

echo "✅ 交付产物验证通过"
echo "  Manifest: $DELIVERY_MANIFEST"

echo ""
echo "============================================"
echo "  ✅ 构建完成！"
echo "  客户: $CUSTOMER"
echo "  安装包位置:"
echo "  $PROJECT_ROOT/desktop/src-tauri/target/release/bundle/"
echo "============================================"
