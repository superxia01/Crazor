#!/bin/bash
# Crazor 按客户构建桌面安装包
#
# 用法:
#   ./scripts/build-customer.sh "客户名" "https://123.45.67.1" [macos|windows]
#
# 示例:
#   ./scripts/build-customer.sh "张三公司" "https://123.45.67.1"
#   ./scripts/build-customer.sh "李四工作室" "http://localhost:3001" macos
#
# 输出:
#   desktop/src-tauri/target/release/bundle/dmg/Crazor_1.0.0_aarch64.dmg (macOS)
#   desktop/src-tauri/target/release/bundle/msi/*.msi (Windows)

set -e

CUSTOMER="${1:?用法: build-customer.sh <客户名> <服务器URL> [macos|windows]}"
SERVER_URL="${2:?错误: 请提供服务器 URL}"
PLATFORM="${3:-macos}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$PROJECT_ROOT/desktop/src-tauri/tauri.conf.json"

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

printf "VITE_API_BASE=%s\n" "$SERVER_URL" > "$WEB_ENV"

echo ""
echo "✅ 客户端远程服务地址已写入: $SERVER_URL"
echo ""

# 构建前端静态资源
cd "$PROJECT_ROOT/web"
npm run build:tauri

# 构建 Tauri 安装包
cd "$PROJECT_ROOT/desktop"

if [ "$PLATFORM" = "macos" ]; then
    echo "🍎 构建 macOS 安装包..."
    npx tauri build --target aarch64-apple-darwin
elif [ "$PLATFORM" = "windows" ]; then
    echo "🪟 构建 Windows 安装包..."
    npx tauri build --target x86_64-pc-windows-msvc
else
    echo "📦 构建当前平台..."
    npx tauri build
fi

echo ""
echo "============================================"
echo "  ✅ 构建完成！"
echo "  客户: $CUSTOMER"
echo "  安装包位置:"
echo "  $PROJECT_ROOT/desktop/src-tauri/target/release/bundle/"
echo "============================================"
