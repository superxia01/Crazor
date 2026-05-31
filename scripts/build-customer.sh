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

# 替换服务器地址
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|__CUSTOMER_SERVER_URL__|${SERVER_URL}|g" "$TAURI_CONF"
else
    sed -i "s|__CUSTOMER_SERVER_URL__|${SERVER_URL}|g" "$TAURI_CONF"
fi

echo ""
echo "✅ 服务器地址已写入: $SERVER_URL"
echo ""

# 构建
cd "$PROJECT_ROOT/desktop"

export PATH="$HOME/.cargo/bin:$PATH"

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
