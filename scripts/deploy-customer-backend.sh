#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

MODEL_PROVIDER_SECRET_KEYS=(
  OPENROUTER_API_KEY
  OPENAI_API_KEY
  OPENAI_BASE_URL
  ANTHROPIC_API_KEY
  ANTHROPIC_BASE_URL
  GOOGLE_API_KEY
  GEMINI_API_KEY
  GEMINI_BASE_URL
  DASHSCOPE_API_KEY
  DASHSCOPE_BASE_URL
  HERMES_QWEN_API_KEY
  HERMES_QWEN_BASE_URL
  DEEPSEEK_API_KEY
  DEEPSEEK_BASE_URL
  NOUS_API_KEY
  NOUS_BASE_URL
  GLM_API_KEY
  GLM_BASE_URL
  ZAI_API_KEY
  ZAI_BASE_URL
  Z_AI_API_KEY
  Z_AI_BASE_URL
  KIMI_API_KEY
  KIMI_BASE_URL
  MINIMAX_API_KEY
  MINIMAX_BASE_URL
  MINIMAX_CN_API_KEY
  MINIMAX_CN_BASE_URL
  HF_TOKEN
  HF_BASE_URL
  NVIDIA_API_KEY
  NVIDIA_BASE_URL
  XIAOMI_API_KEY
  XIAOMI_BASE_URL
  XAI_API_KEY
  XAI_BASE_URL
  STEPFUN_API_KEY
  STEPFUN_BASE_URL
  ARCEEAI_API_KEY
  ARCEEAI_BASE_URL
  OLLAMA_API_KEY
  OLLAMA_BASE_URL
  LM_API_KEY
  LM_BASE_URL
  KILOCODE_API_KEY
  KILOCODE_BASE_URL
)

usage() {
  cat <<'EOF'
用法：
  ./scripts/deploy-customer-backend.sh --host wings@100.87.117.18 --customer CRAZYAIGC --server-url http://100.87.117.18:5173 [参数]

参数：
  --host <用户@主机>                 SSH 目标，例如 wings@100.87.117.18
  --remote-dir <目录>                远端项目根目录，默认 /home/wings/docker/crazor
  --ssh-key <路径>                   SSH 私钥路径
  --customer <名称>                  客户名称
  --server-url <URL>                 客户可访问的后端统一入口
  --env-file <路径>                  使用已有客户环境文件；不传则临时生成
  --access-code <访问码>             覆盖/设定客户访问码
  --internal-access-code <访问码>    覆盖/设定内部演示入口码
  --default-workspace <模式>         默认入口模式，支持 customer 或 internal
  --secrets-env-file <路径>          追加白名单内模型 provider 密钥到客户环境
  --hermes-image <镜像>              覆盖客户环境中的 HERMES_IMAGE
  --skip-live-chat                   只验证对话入口和模型列表，不真实调用对话
  --no-smoke                         部署后不运行桌面远程烟测
  --diagnose-only                    不部署，只诊断当前远端 Compose 服务
  --keep-releases <数量>             保留远端 release 数，默认 5
  -h, --help                         显示帮助

说明：
  远端目录结构为：
    <remote-dir>/current             当前代码软链接
    <remote-dir>/releases/<时间戳>   每次部署的代码
    <remote-dir>/shared/data         Compose 相对数据目录
    <remote-dir>/shared/.env.customer 客户后端环境文件
EOF
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

remote_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

extract_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v key="$key" '
    $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[ \t"]+|[ \t"]+$/, "", value)
      gsub(/\\"/, "\"", value)
      gsub(/\$\$/, "$", value)
      print value
      exit
    }
  ' "$file"
}

append_selected_secret_env() {
  local source_file="$1"
  local target_file="$2"
  [[ -f "$source_file" ]] || die "密钥环境文件不存在：$source_file"

  local key
  for key in "${MODEL_PROVIDER_SECRET_KEYS[@]}"; do
    local line
    line="$(grep -E "^${key}=" "$source_file" | tail -n 1 || true)"
    [[ -n "$line" ]] || continue
    local value="${line#*=}"
    value="${value%$'\r'}"
    value="${value%\"}"
    value="${value#\"}"
    [[ -n "$value" ]] || continue
    [[ "$value" == 请替换* || "$value" == change-me* ]] && continue
    grep -q "^${key}=" "$target_file" && continue
    printf '%s\n' "$line" >> "$target_file"
  done
}

is_placeholder_secret_value() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  [[ "$value" == 请替换* || "$value" == change-me* || "$value" == please-change* ]] && return 0
  return 1
}

is_model_api_key_name() {
  local key="$1"
  [[ "$key" == *_API_KEY || "$key" == "HF_TOKEN" ]]
}

is_local_model_base_url() {
  local value="$1"
  local lower
  lower="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" =~ ^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|\[::1\]|::1)(:|/|$) ]] && return 0
  [[ "$lower" =~ ^https?://10\. ]] && return 0
  [[ "$lower" =~ ^https?://192\.168\. ]] && return 0
  [[ "$lower" =~ ^https?://172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && return 0
  return 1
}

list_model_provider_connections() {
  local env_file="$1"
  local key
  for key in "${MODEL_PROVIDER_SECRET_KEYS[@]}"; do
    local value
    value="$(extract_env_value "$env_file" "$key" || true)"
    is_placeholder_secret_value "$value" && continue
    if is_model_api_key_name "$key"; then
      printf '%s\n' "$key"
    elif [[ "$key" == *_BASE_URL ]] && is_local_model_base_url "$value"; then
      printf '%s(local)\n' "$key"
    fi
  done
}

require_live_chat_model_connection() {
  local env_file="$1"
  local connections
  connections="$(list_model_provider_connections "$env_file" | awk 'BEGIN { sep = "" } { printf "%s%s", sep, $0; sep = ", " }')"

  if [[ -n "$connections" ]]; then
    printf '真实对话模型连接预检通过：%s\n' "$connections"
    return 0
  fi

  die "真实对话烟测需要模型 Provider API Key/token，或本地/内网模型 Base URL。请通过 --secrets-env-file .env 传入白名单模型变量，或仅做入口验收时加 --skip-live-chat"
}

set_env_value_in_file() {
  local target_file="$1"
  local key="$2"
  local value="$3"
  local tmp_file="${target_file}.tmp"

  awk -v key="$key" -v value="$value" '
    BEGIN { written = 0 }
    $0 ~ "^" key "=" {
      print key "=\"" value "\""
      written = 1
      next
    }
    { print }
    END {
      if (!written) print key "=\"" value "\""
    }
  ' "$target_file" > "$tmp_file"
  mv "$tmp_file" "$target_file"
  chmod 600 "$target_file"
}

download_remote_env_if_exists() {
  local target_file="$1"

  if ssh "${SSH_ARGS[@]}" "$HOST" "test -f $(remote_quote "$REMOTE_SHARED_DIR/.env.customer")"; then
    ssh "${SSH_ARGS[@]}" "$HOST" "cat $(remote_quote "$REMOTE_SHARED_DIR/.env.customer")" > "$target_file"
    chmod 600 "$target_file"
    return 0
  fi

  return 1
}

derive_delivery_identity_fingerprint() {
  local customer="$1"
  local server_url="$2"
  local channel="$3"
  local protocol_version="$4"

  node -e '
const crypto = require("node:crypto")
const payload = JSON.stringify({
  product: "Crazor",
  customer: String(process.argv[1] || "").trim().replace(/\s+/g, " "),
  serverUrl: String(process.argv[2] || "").trim().replace(/\/+$/, ""),
  channel: String(process.argv[3] || "").trim().replace(/\s+/g, " "),
  protocolVersion: String(process.argv[4] || "").trim().replace(/\s+/g, " "),
})
process.stdout.write(crypto.createHash("sha256").update(payload).digest("hex").slice(0, 12))
' "$customer" "$server_url" "$channel" "$protocol_version"
}

HOST=""
REMOTE_DIR="/home/wings/docker/crazor"
SSH_KEY=""
CUSTOMER=""
SERVER_URL=""
ENV_FILE=""
ACCESS_CODE=""
INTERNAL_ACCESS_CODE=""
DEFAULT_WORKSPACE=""
SECRETS_ENV_FILE=""
HERMES_IMAGE=""
RUN_SMOKE=1
SKIP_LIVE_CHAT=0
DIAGNOSE_ONLY=0
KEEP_RELEASES=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --ssh-key)
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --customer)
      CUSTOMER="${2:-}"
      shift 2
      ;;
    --server-url)
      SERVER_URL="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --access-code)
      ACCESS_CODE="${2:-}"
      shift 2
      ;;
    --internal-access-code)
      INTERNAL_ACCESS_CODE="${2:-}"
      shift 2
      ;;
    --default-workspace)
      DEFAULT_WORKSPACE="${2:-}"
      shift 2
      ;;
    --secrets-env-file)
      SECRETS_ENV_FILE="${2:-}"
      shift 2
      ;;
    --hermes-image)
      HERMES_IMAGE="${2:-}"
      shift 2
      ;;
    --skip-live-chat)
      SKIP_LIVE_CHAT=1
      shift
      ;;
    --no-smoke)
      RUN_SMOKE=0
      shift
      ;;
    --diagnose-only)
      DIAGNOSE_ONLY=1
      shift
      ;;
    --keep-releases)
      KEEP_RELEASES="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1"
      ;;
  esac
done

[[ -n "$HOST" ]] || die "必须提供 --host"
[[ -n "$CUSTOMER" ]] || die "必须提供 --customer"
[[ -n "$SERVER_URL" ]] || die "必须提供 --server-url"
[[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] || die "--keep-releases 必须是数字"
[[ -z "$DEFAULT_WORKSPACE" || "$DEFAULT_WORKSPACE" == "customer" || "$DEFAULT_WORKSPACE" == "internal" ]] || die "--default-workspace 只支持 customer 或 internal"

need node
need ssh
need tar
need curl

SSH_ARGS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_ARGS=(-i "$SSH_KEY" "${SSH_ARGS[@]}")
fi

REMOTE_SHARED_DIR="$REMOTE_DIR/shared"
REMOTE_CURRENT_DIR="$REMOTE_DIR/current"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

LOCAL_ENV_FILE="$TMP_DIR/.env.customer"
if [[ -n "$ENV_FILE" ]]; then
  [[ -f "$ENV_FILE" ]] || die "客户环境文件不存在：$ENV_FILE"
  cp "$ENV_FILE" "$LOCAL_ENV_FILE"
elif download_remote_env_if_exists "$LOCAL_ENV_FILE"; then
  printf '已读取远端现有客户环境，作为本次部署基底\n'
else
  GENERATED_ENV_ARGS=(
    --customer "$CUSTOMER"
    --server-url "$SERVER_URL"
    --output "$LOCAL_ENV_FILE"
    --force
  )
  if [[ -n "$DEFAULT_WORKSPACE" ]]; then
    GENERATED_ENV_ARGS+=(--default-workspace "$DEFAULT_WORKSPACE")
  fi
  node "$PROJECT_ROOT/scripts/customer-backend-env.mjs" "${GENERATED_ENV_ARGS[@]}" >/dev/null
fi

if [[ -n "$ACCESS_CODE" ]]; then
  set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_CUSTOMER_ACCESS_CODE "$ACCESS_CODE"
fi

if [[ -n "$INTERNAL_ACCESS_CODE" ]]; then
  set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_INTERNAL_ACCESS_CODE "$INTERNAL_ACCESS_CODE"
fi

if [[ -n "$DEFAULT_WORKSPACE" ]]; then
  set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_DEFAULT_WORKSPACE "$DEFAULT_WORKSPACE"
fi

if [[ -n "$SECRETS_ENV_FILE" ]]; then
  append_selected_secret_env "$SECRETS_ENV_FILE" "$LOCAL_ENV_FILE"
fi

if [[ -n "$HERMES_IMAGE" ]]; then
  set_env_value_in_file "$LOCAL_ENV_FILE" HERMES_IMAGE "$HERMES_IMAGE"
fi

if [[ "$SKIP_LIVE_CHAT" == "1" ]]; then
  set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_DELIVERY_MODEL_READINESS "warn"
fi

node "$PROJECT_ROOT/scripts/customer-backend-env.mjs" \
  --check "$LOCAL_ENV_FILE" \
  --customer "$CUSTOMER" \
  --server-url "$SERVER_URL"

if [[ "$RUN_SMOKE" == "1" && "$SKIP_LIVE_CHAT" != "1" ]]; then
  require_live_chat_model_connection "$LOCAL_ENV_FILE"
fi

ACCESS_CODE="$(extract_env_value "$LOCAL_ENV_FILE" CRAZOR_CUSTOMER_ACCESS_CODE)"
DELIVERY_CUSTOMER="$(extract_env_value "$LOCAL_ENV_FILE" CRAZOR_DELIVERY_CUSTOMER)"
DELIVERY_SERVER_URL="$(extract_env_value "$LOCAL_ENV_FILE" CRAZOR_PUBLIC_BASE_URL)"
DELIVERY_CHANNEL="$(extract_env_value "$LOCAL_ENV_FILE" CRAZOR_DELIVERY_CHANNEL)"
DELIVERY_PROTOCOL_VERSION="$(extract_env_value "$LOCAL_ENV_FILE" CRAZOR_DELIVERY_PROTOCOL_VERSION)"
DELIVERY_IDENTITY_FINGERPRINT="$(derive_delivery_identity_fingerprint \
  "$DELIVERY_CUSTOMER" \
  "$DELIVERY_SERVER_URL" \
  "${DELIVERY_CHANNEL:-customer}" \
  "${DELIVERY_PROTOCOL_VERSION:-1}")"
set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_DELIVERY_IDENTITY_FINGERPRINT "$DELIVERY_IDENTITY_FINGERPRINT"
BUILD_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || true)"
BUILD_SHA_SHORT="$(git -C "$PROJECT_ROOT" rev-parse --short=12 HEAD 2>/dev/null || echo manual)"
[[ -n "$BUILD_SHA" ]] || BUILD_SHA="$BUILD_SHA_SHORT"
BUILD_TIME="$(node -e 'process.stdout.write(new Date().toISOString())')"
RELEASE_ID="$(date +%Y%m%d%H%M%S)-$BUILD_SHA_SHORT"
set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_BUILD_SHA "$BUILD_SHA"
set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_BUILD_TIME "$BUILD_TIME"
set_env_value_in_file "$LOCAL_ENV_FILE" CRAZOR_RELEASE_ID "$RELEASE_ID"
REMOTE_RELEASE_DIR="$REMOTE_DIR/releases/$RELEASE_ID"

run_remote_diagnostics() {
  ssh "${SSH_ARGS[@]}" "$HOST" "
    set -Eeuo pipefail
    if [ ! -d $(remote_quote "$REMOTE_CURRENT_DIR") ]; then
      echo '远端 current 目录不存在，尚无可诊断的部署。' >&2
      exit 1
    fi
    cd $(remote_quote "$REMOTE_CURRENT_DIR")
    echo '--- Compose 服务状态 ---'
    docker compose --env-file .env.customer ps || true
    echo '--- crazor-server -> hermes:8642 健康检查 ---'
    docker compose --env-file .env.customer exec -T crazor-server sh -lc 'wget -qO- http://hermes:8642/health || curl -fsS http://hermes:8642/health || true' || true
    echo
    echo '--- hermes 容器本机 8642 健康检查 ---'
    docker compose --env-file .env.customer exec -T hermes sh -lc 'wget -qO- http://127.0.0.1:8642/health || curl -fsS http://127.0.0.1:8642/health || true' || true
    echo
    echo '--- hermes 日志 tail ---'
    docker compose --env-file .env.customer logs --tail=160 hermes || true
    echo '--- crazor-server 日志 tail ---'
    docker compose --env-file .env.customer logs --tail=80 crazor-server || true
  "
}

wait_for_delivery_readiness() {
  printf '等待客户交付自检进入可交付状态：%s/api/delivery/readiness\n' "$SERVER_URL"
  for _ in $(seq 1 60); do
    if node -e '
      const url = process.argv[1]
      const summarizeIssues = (data) => {
        const checks = Array.isArray(data?.checks) ? data.checks : []
        return checks
          .filter((check) => check?.status === "error" || check?.status === "warn")
          .map((check) => `${check.label || check.id || "检查项"}${check.status === "error" ? "失败" : "警告"}: ${check.detail || "无详情"}`)
      }
      fetch(url, { headers: { Accept: "application/json" } }).then(async (resp) => {
        const data = await resp.json().catch(() => ({}))
        const status = String(data.status || "")
        const issues = summarizeIssues(data)
        console.log(`客户交付自检状态：${status || "unknown"}${issues.length ? `；${issues.join("；")}` : ""}`)
        process.exit(resp.ok && ["ready", "degraded"].includes(status) ? 0 : 1)
      }).catch((error) => {
        console.log(`客户交付自检暂不可用：${error.message || error}`)
        process.exit(1)
      })
    ' "$SERVER_URL/api/delivery/readiness"; then
      return 0
    fi
    sleep 2
  done
  curl -fsS "$SERVER_URL/api/delivery/readiness" || true
  run_remote_diagnostics
  die "客户交付自检未进入 ready/degraded"
}

if [[ "$DIAGNOSE_ONLY" == "1" ]]; then
  run_remote_diagnostics
  exit 0
fi

printf '准备部署客户后端：%s -> %s\n' "$CUSTOMER" "$SERVER_URL"
printf '远端目录：%s\n' "$REMOTE_DIR"
printf 'Release：%s\n' "$RELEASE_ID"

ssh "${SSH_ARGS[@]}" "$HOST" \
  "mkdir -p $(remote_quote "$REMOTE_RELEASE_DIR") $(remote_quote "$REMOTE_SHARED_DIR/data")"

SOURCE_ARCHIVE="$TMP_DIR/crazor-source.tar.gz"
ARCHIVE_ENTRIES=(
  docker-compose.yml
  docker
  server
  web
  scripts
  README.md
  docs
)
[[ -d "$PROJECT_ROOT/desktop" ]] && ARCHIVE_ENTRIES+=(desktop)
[[ -d "$PROJECT_ROOT/.github" ]] && ARCHIVE_ENTRIES+=(.github)
[[ -f "$PROJECT_ROOT/.dockerignore" ]] && ARCHIVE_ENTRIES+=(.dockerignore)
[[ -f "$PROJECT_ROOT/.env.example" ]] && ARCHIVE_ENTRIES+=(.env.example)
[[ -f "$PROJECT_ROOT/.gitignore" ]] && ARCHIVE_ENTRIES+=(.gitignore)

COPYFILE_DISABLE=1 tar -czf - \
  --exclude='web/node_modules' \
  --exclude='web/dist' \
  --exclude='web/.vite' \
  --exclude='desktop/node_modules' \
  --exclude='desktop/src-tauri/target' \
  --exclude='server/node_modules' \
  --exclude='*.log' \
  -C "$PROJECT_ROOT" "${ARCHIVE_ENTRIES[@]}" > "$SOURCE_ARCHIVE"

tar -tzf "$SOURCE_ARCHIVE" | grep -q '^web/src/components/office/data/officeLayout.js$' ||
  die "交付源码包缺少 web/src/components/office/data/officeLayout.js"

ssh "${SSH_ARGS[@]}" "$HOST" \
  "tar -xzf - -C $(remote_quote "$REMOTE_RELEASE_DIR")" < "$SOURCE_ARCHIVE"

ssh "${SSH_ARGS[@]}" "$HOST" "
  set -Eeuo pipefail
  mkdir -p $(remote_quote "$REMOTE_SHARED_DIR/backups")
  if [ -f $(remote_quote "$REMOTE_SHARED_DIR/.env.customer") ]; then
    cp $(remote_quote "$REMOTE_SHARED_DIR/.env.customer") $(remote_quote "$REMOTE_SHARED_DIR/backups/.env.customer.$RELEASE_ID")
  fi
"

ssh "${SSH_ARGS[@]}" "$HOST" \
  "cat > $(remote_quote "$REMOTE_SHARED_DIR/.env.customer") && chmod 600 $(remote_quote "$REMOTE_SHARED_DIR/.env.customer")" < "$LOCAL_ENV_FILE"

ssh "${SSH_ARGS[@]}" "$HOST" "
  set -Eeuo pipefail
  cp $(remote_quote "$REMOTE_SHARED_DIR/.env.customer") $(remote_quote "$REMOTE_RELEASE_DIR/.env.customer")
  rm -rf $(remote_quote "$REMOTE_RELEASE_DIR/data")
  ln -sfn $(remote_quote "$REMOTE_SHARED_DIR/data") $(remote_quote "$REMOTE_RELEASE_DIR/data")
  ln -sfnT $(remote_quote "$REMOTE_RELEASE_DIR") $(remote_quote "$REMOTE_CURRENT_DIR")
  cd $(remote_quote "$REMOTE_CURRENT_DIR")
  docker compose --env-file .env.customer config --quiet
  docker compose --env-file .env.customer up -d --build --quiet-pull
  docker compose --env-file .env.customer ps
  if [ $KEEP_RELEASES -gt 0 ]; then
    find $(remote_quote "$REMOTE_DIR/releases") -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +\$(( $KEEP_RELEASES + 1 )) | xargs -r rm -rf
  fi
"

printf '等待后端健康检查：%s/api/health\n' "$SERVER_URL"
for _ in $(seq 1 30); do
  if curl -fsS "$SERVER_URL/api/health" >/dev/null; then
    printf '后端健康检查通过\n'
    break
  fi
  sleep 2
done
curl -fsS "$SERVER_URL/api/health" >/dev/null

printf '验证 Web 前端入口：%s/\n' "$SERVER_URL"
node "$PROJECT_ROOT/scripts/verify-customer-web.mjs" "$SERVER_URL"
wait_for_delivery_readiness

if [[ "$RUN_SMOKE" == "1" ]]; then
  if [[ "$SKIP_LIVE_CHAT" == "1" ]]; then
    if ! CRAZOR_DESKTOP_SMOKE_SKIP_LIVE_CHAT=1 \
      CRAZOR_DESKTOP_SMOKE_ACCESS_CODE="$ACCESS_CODE" \
      node "$PROJECT_ROOT/scripts/customer-desktop-smoke.mjs" "$CUSTOMER" "$SERVER_URL"; then
      run_remote_diagnostics
      exit 1
    fi
  else
    if ! CRAZOR_DESKTOP_SMOKE_ACCESS_CODE="$ACCESS_CODE" \
      node "$PROJECT_ROOT/scripts/customer-desktop-smoke.mjs" "$CUSTOMER" "$SERVER_URL"; then
      run_remote_diagnostics
      exit 1
    fi
  fi
fi

printf '客户后端部署完成：%s\n' "$SERVER_URL"
