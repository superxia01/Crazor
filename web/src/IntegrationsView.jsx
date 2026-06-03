// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useState } from "react"
import {
  BookOpenIcon,
  CalendarIcon,
  CloudIcon,
  CodeIcon,
  CreditCardIcon,
  DatabaseIcon,
  DollarSignIcon,
  GlobeIcon,
  HeartIcon,
  LayoutGridIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  MonitorIcon,
  MusicIcon,
  PhoneIcon,
  PlusCircleIcon,
  PlugIcon,
  SaveIcon,
  SendIcon,
  ShoppingCartIcon,
  StoreIcon,
  TrashIcon,
  UsersIcon,
  VideoIcon,
  WebhookIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  CheckSquareIcon,
} from "lucide-react"
import { Card, Chip, Modal, ModalBackdrop, ModalBody, ModalCloseTrigger, ModalContainer, ModalDialog, ModalFooter, ModalHeader, ModalHeading } from "@heroui/react"
import { toast } from "sonner"
import { ViewFrame } from "@/components/view-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getEnvVars, setEnvVar, deleteEnvVar, revealEnvVar } from "@/api/dashboard"
import { readChannelsConfig, writeChannelsConfig } from "@/api/channels"
import { getIntegrationChecks, saveIntegrationConnectorConfig, testIntegrationConnector } from "@/api/integrations"
import {
  buildConnectorEnvMap,
  getConnectorBridge,
  getConnectorBridgeConfig,
  getConnectorBridgeStatus,
  getConnectorStatus,
  getFeishuLinkSteps,
  normalizeIntegrationCheck,
  parseConnectorFields,
} from "@/integrations-utils"
import { cn } from "@/lib/utils"

// ── Preset Connectors ──────────────────────────────────────

const PRESET_CONNECTORS = [
  // ── 国内办公协作 ──
  {
    id: "feishu",
    name: "飞书",
    description: "企业协作与开放平台",
    icon: MessageSquareIcon,
    color: "bg-blue-500/10 text-blue-600",
    fields: ["FEISHU_APP_ID", "FEISHU_APP_SECRET"],
  },
  {
    id: "dingtalk",
    name: "钉钉",
    description: "企业通讯与流程自动化",
    icon: PhoneIcon,
    color: "bg-sky-500/10 text-sky-600",
    fields: ["DINGTALK_APP_KEY", "DINGTALK_APP_SECRET"],
  },
  {
    id: "wecom",
    name: "企业微信",
    description: "微信生态企业连接",
    icon: MessageCircleIcon,
    color: "bg-green-500/10 text-green-600",
    fields: ["WECOM_CORP_ID", "WECOM_AGENT_ID", "WECOM_SECRET"],
  },

  // ── 社媒内容 ──
  {
    id: "wechat-mp",
    name: "微信公众平台",
    description: "公众号开发与管理",
    icon: MessageCircleIcon,
    color: "bg-green-500/10 text-green-600",
    fields: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"],
  },
  {
    id: "xiaohongshu",
    name: "小红书",
    description: "内容发布与数据运营",
    icon: HeartIcon,
    color: "bg-rose-500/10 text-rose-600",
    fields: ["XHS_COOKIE"],
  },
  {
    id: "douyin",
    name: "抖音",
    description: "短视频内容与直播管理",
    icon: VideoIcon,
    color: "bg-zinc-500/10 text-zinc-600",
    fields: ["DOUYIN_CLIENT_KEY", "DOUYIN_CLIENT_SECRET"],
  },
  {
    id: "weibo",
    name: "微博",
    description: "社交媒体内容分发",
    icon: GlobeIcon,
    color: "bg-red-500/10 text-red-600",
    fields: ["WEIBO_APP_KEY", "WEIBO_APP_SECRET"],
  },

  // ── 项目协作 ──
  {
    id: "notion",
    name: "Notion",
    description: "All-in-one 文档与协作",
    icon: BookOpenIcon,
    color: "bg-zinc-500/10 text-zinc-600",
    fields: ["NOTION_API_KEY", "NOTION_DATABASE_ID"],
  },
  {
    id: "linear",
    name: "Linear",
    description: "项目管理与 Issue 追踪",
    icon: CheckSquareIcon,
    color: "bg-violet-500/10 text-violet-600",
    fields: ["LINEAR_API_KEY"],
  },

  // ── CRM/销售 ──
  {
    id: "salesforce",
    name: "Salesforce",
    description: "CRM 客户关系管理",
    icon: CloudIcon,
    color: "bg-sky-500/10 text-sky-600",
    fields: ["SF_CLIENT_ID", "SF_CLIENT_SECRET", "SF_USERNAME", "SF_SECURITY_TOKEN"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "营销、销售与服务一体化",
    icon: UsersIcon,
    color: "bg-orange-500/10 text-orange-600",
    fields: ["HUBSPOT_API_KEY"],
  },

  // ── 电商 ──
  {
    id: "shopify",
    name: "Shopify",
    description: "跨境电商独立站",
    icon: ShoppingCartIcon,
    color: "bg-emerald-500/10 text-emerald-600",
    fields: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_SHOP_DOMAIN"],
  },
  {
    id: "youzan",
    name: "有赞",
    description: "社交电商与私域经营",
    icon: StoreIcon,
    color: "bg-amber-500/10 text-amber-600",
    fields: ["YOUZAN_CLIENT_ID", "YOUZAN_CLIENT_SECRET", "YOUZAN_SHOP_ID"],
  },

  // ── 邮件通讯 ──
  {
    id: "gmail",
    name: "Gmail",
    description: "Google 邮件服务",
    icon: MailIcon,
    color: "bg-red-500/10 text-red-600",
    fields: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "团队通讯与集成平台",
    icon: SendIcon,
    color: "bg-violet-500/10 text-violet-600",
    fields: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "即时通讯 Bot 接口",
    icon: SendIcon,
    color: "bg-blue-500/10 text-blue-600",
    fields: ["TELEGRAM_BOT_TOKEN"],
  },

  // ── 开发 ──
  {
    id: "github",
    name: "GitHub",
    description: "代码托管与 CI/CD",
    icon: CodeIcon,
    color: "bg-zinc-500/10 text-zinc-600",
    fields: ["GITHUB_TOKEN"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "DevOps 一体化平台",
    icon: CodeIcon,
    color: "bg-orange-500/10 text-orange-600",
    fields: ["GITLAB_TOKEN", "GITLAB_BASE_URL"],
  },

  // ── 支付财务 ──
  {
    id: "stripe",
    name: "Stripe",
    description: "全球在线支付",
    icon: CreditCardIcon,
    color: "bg-violet-500/10 text-violet-600",
    fields: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    id: "kingdee",
    name: "金蝶",
    description: "ERP 财务与供应链",
    icon: DollarSignIcon,
    color: "bg-blue-500/10 text-blue-600",
    fields: ["KINGDEE_APP_ID", "KINGDEE_APP_SECRET", "KINGDEE_SERVER_URL"],
  },

  // ── 知识/笔记 ──
  {
    id: "getbiji",
    name: "Get 笔记",
    description: "知识管理与素材采集",
    icon: BookOpenIcon,
    color: "bg-amber-500/10 text-amber-600",
    fields: ["GETBIJI_TOKEN", "GETBIJI_USER_ID"],
  },
]

// Categories for grouping display
const CONNECTOR_CATEGORIES = [
  { label: "国内办公协作", ids: ["feishu", "dingtalk", "wecom"] },
  { label: "社媒内容", ids: ["wechat-mp", "xiaohongshu", "douyin", "weibo"] },
  { label: "项目协作", ids: ["notion", "linear"] },
  { label: "CRM / 销售", ids: ["salesforce", "hubspot"] },
  { label: "电商", ids: ["shopify", "youzan"] },
  { label: "邮件通讯", ids: ["gmail", "slack", "telegram"] },
  { label: "开发", ids: ["github", "gitlab"] },
  { label: "支付财务", ids: ["stripe", "kingdee"] },
  { label: "知识笔记", ids: ["getbiji"] },
]

const STATUS_CONFIG = {
  connected: { label: "凭证完整", dot: "bg-emerald-500", badgeWrapper: "bg-emerald-100", badgeLabel: "text-emerald-700" },
  partial: { label: "部分填写", dot: "bg-amber-500", badgeWrapper: "bg-amber-100", badgeLabel: "text-amber-700" },
  disconnected: { label: "未配置", dot: "bg-zinc-300", badgeWrapper: "bg-zinc-100", badgeLabel: "text-zinc-500" },
}

const CONNECTIVITY_STATUS_CONFIG = {
  idle: { label: "未验证", dot: "bg-zinc-300", badgeWrapper: "bg-zinc-100", badgeLabel: "text-zinc-500" },
  missing_credentials: { label: "缺少凭证", dot: "bg-zinc-300", badgeWrapper: "bg-zinc-100", badgeLabel: "text-zinc-500" },
  ok: { label: "连通通过", dot: "bg-emerald-500", badgeWrapper: "bg-emerald-100", badgeLabel: "text-emerald-700" },
  warning: { label: "需要处理", dot: "bg-amber-500", badgeWrapper: "bg-amber-100", badgeLabel: "text-amber-700" },
  error: { label: "测试失败", dot: "bg-rose-500", badgeWrapper: "bg-rose-100", badgeLabel: "text-rose-700" },
}

const BRIDGE_STATUS_CONFIG = {
  synced: { dot: "bg-emerald-500", text: "text-emerald-700" },
  channel_only: { dot: "bg-blue-500", text: "text-blue-700" },
  env_only: { dot: "bg-amber-500", text: "text-amber-700" },
  out_of_sync: { dot: "bg-amber-500", text: "text-amber-700" },
  missing: { dot: "bg-zinc-300", text: "text-zinc-500" },
  not_applicable: { dot: "bg-zinc-300", text: "text-zinc-500" },
}

const LINK_STEP_STATUS_CONFIG = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200 bg-emerald-50/60" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200 bg-amber-50/60" },
  error: { dot: "bg-rose-500", text: "text-rose-700", border: "border-rose-200 bg-rose-50/60" },
  pending: { dot: "bg-zinc-300", text: "text-zinc-500", border: "border-border/70 bg-background/70" },
}

function cleanString(value) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function formatCheckedAt(value) {
  const text = cleanString(value)
  if (!text) return "尚未测试"

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

async function revealPresetConnectorEnvMap(baseEnvMap = {}, connectors = PRESET_CONNECTORS) {
  const nextEnvMap = { ...(baseEnvMap || {}) }
  const fields = Array.from(new Set(
    connectors.flatMap((connector) => Array.isArray(connector.fields) ? connector.fields : [])
  ))

  await Promise.all(fields.map(async (key) => {
    if (cleanString(nextEnvMap[key])) return
    try {
      const revealed = await revealEnvVar(key)
      const value = cleanString(revealed?.value || revealed)
      if (value) nextEnvMap[key] = value
    } catch {
      // Most preset connector vars are intentionally absent until configured.
    }
  }))

  return nextEnvMap
}

// ── Connector Config Dialog ────────────────────────────────

function ConnectorDialog({
  connector,
  open,
  onClose,
  envMap,
  channelConfigs,
  integrationChecks,
  onRefresh,
  onCheckUpdated,
}) {
  const [values, setValues] = useState({})
  const [revealed, setRevealed] = useState({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const bridge = getConnectorBridge(connector)
  const bridgeConfig = getConnectorBridgeConfig(connector, channelConfigs)
  const bridgeStatus = getConnectorBridgeStatus(connector, envMap, channelConfigs)
  const bridgeStatusConfig = BRIDGE_STATUS_CONFIG[bridgeStatus.state] || BRIDGE_STATUS_CONFIG.missing
  const check = normalizeIntegrationCheck(integrationChecks?.[connector?.id])
  const checkConfig = CONNECTIVITY_STATUS_CONFIG[check.status] || CONNECTIVITY_STATUS_CONFIG.idle
  const feishuLinkSteps = connector?.id === "feishu"
    ? getFeishuLinkSteps(envMap, channelConfigs, check)
    : []

  // Load values when dialog opens
  useEffect(() => {
    if (!open || !connector) return
    const initial = {}
    const bridgeFieldMap = bridge?.fieldMap || {}
    const revealPromises = connector.fields.map(async (key) => {
      initial[key] = ""
      if (envMap[key]) {
        try {
          const real = await revealEnvVar(key)
          initial[key] = real?.value || real || envMap[key] || ""
        } catch {
          initial[key] = ""
        }
      } else {
        const channelKey = bridgeFieldMap[key]
        if (channelKey && bridgeConfig[channelKey]) {
          initial[key] = cleanString(bridgeConfig[channelKey])
        }
      }
    })
    Promise.all(revealPromises).then(() => setValues({ ...initial }))
    setRevealed({})
  }, [open, connector, envMap, bridge, bridgeConfig])

  if (!connector) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const nextValues = {}
      for (const key of connector.fields) {
        const val = cleanString(values[key])
        nextValues[key] = val
        if (val && connector.id !== "feishu") {
          await setEnvVar(key, val)
        }
      }

      let saveResult = null
      if (connector.id === "feishu") {
        saveResult = await saveIntegrationConnectorConfig(connector.id, nextValues)
      } else if (bridge) {
        const nextChannelConfigs = { ...(channelConfigs || {}) }
        const nextChannelConfig = {
          ...(bridgeConfig || {}),
        }
        for (const [envKey, channelKey] of Object.entries(bridge.fieldMap)) {
          const nextValue = cleanString(nextValues[envKey])
          if (nextValue) {
            nextChannelConfig[channelKey] = nextValue
          } else if (cleanString(bridgeConfig?.[channelKey])) {
            nextChannelConfig[channelKey] = cleanString(bridgeConfig[channelKey])
          }
        }
        nextChannelConfigs[bridge.channelId] = nextChannelConfig
        await writeChannelsConfig(nextChannelConfigs)
      }

      await onRefresh()
      toast.success(saveResult?.summary || `${connector.name} 配置已保存`)
      onClose()
    } catch (err) {
      console.error("Failed to save:", err)
      toast.error(`${connector.name} 保存失败`, {
        description: String(err?.message || err),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!connector?.id) return
    setTesting(true)
    try {
      if (connector.id === "feishu") {
        const pendingValues = {}
        for (const key of connector.fields) {
          const value = cleanString(values[key])
          if (value) pendingValues[key] = value
        }
        await saveIntegrationConnectorConfig(connector.id, pendingValues)
      }
      const result = await testIntegrationConnector(connector.id)
      onCheckUpdated?.(connector.id, result)
      await onRefresh()
      const normalized = normalizeIntegrationCheck(result)
      if (normalized.status === "ok") {
        toast.success(normalized.summary || `${connector.name} 已连通`)
      } else if (normalized.status === "warning") {
        toast.warning(normalized.summary || `${connector.name} 需要处理`)
      } else {
        toast.error(normalized.summary || `${connector.name} 测试失败`)
      }
    } catch (err) {
      toast.error(`${connector.name} 测试失败`, {
        description: String(err?.message || err),
      })
    } finally {
      setTesting(false)
    }
  }

  const Icon = connector.icon

  return (
    <Modal isOpen={open} onOpenChange={onClose}>
      <ModalBackdrop>
        <ModalContainer size="sm">
          <ModalDialog>
            <ModalHeader>
              <ModalHeading className="flex items-center gap-3">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", connector.color)}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <div>{connector.name}</div>
                </div>
              </ModalHeading>
            </ModalHeader>

          <ModalBody>
            <p className="text-[12px] text-muted-foreground">{connector.description}</p>
            <div className="flex flex-col gap-3 py-2">
              {bridge && (
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-medium">Hermes 接入</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{bridgeStatus.description}</div>
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", bridgeStatusConfig.text)}>
                      <span className={cn("size-2 rounded-full", bridgeStatusConfig.dot)} />
                      {bridgeStatus.label}
                    </div>
                  </div>
                </div>
              )}

              {connector.fields.map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-[12px] font-medium text-muted-foreground">{key}</label>
                  <div className="flex gap-1.5">
                    <Input
                      type={revealed[key] ? "text" : "password"}
                      value={values[key] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder={envMap[key] ? "留空则保留当前配置" : `输入 ${key}...`}
                      className="text-[12px] h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setRevealed((r) => ({ ...r, [key]: !r[key] }))}
                    >
                      {revealed[key] ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}

              {connector.id === "feishu" && (
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-medium">连通性验证</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        会用当前凭证请求飞书官方 OpenAPI，并核对 Hermes 配置与运行时监听状态。
                      </div>
                    </div>
                    <Chip variant="tertiary" className={cn("h-5", checkConfig.badgeWrapper)}>
                      <Chip.Label className={cn("text-[10px]", checkConfig.badgeLabel)}>
                        {checkConfig.label}
                      </Chip.Label>
                    </Chip>
                  </div>
                  <div className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <div className="text-[12px] font-medium">{check.summary || "还没有做过飞书连通测试"}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      最近一次：{formatCheckedAt(check.checked_at)}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-medium text-muted-foreground">真实链路</div>
                    {feishuLinkSteps.map((step) => {
                      const stepConfig = LINK_STEP_STATUS_CONFIG[step.state] || LINK_STEP_STATUS_CONFIG.pending
                      return (
                        <div
                          key={step.id}
                          className={cn("rounded-lg border px-3 py-2", stepConfig.border)}
                        >
                          <div className="flex items-start gap-2">
                            <span className={cn("mt-1 size-2 shrink-0 rounded-full", stepConfig.dot)} />
                            <div className="min-w-0">
                              <div className={cn("text-[11px] font-medium", stepConfig.text)}>{step.label}</div>
                              <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || saving}>
                      <RefreshCwIcon className={cn("mr-1 size-3.5", testing && "animate-spin")} />
                      {testing ? "测试中..." : "测试连接"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            {(envMap && connector.fields.some((k) => envMap[k])) ||
            (bridge && Object.values(bridge.fieldMap).some((fieldKey) => cleanString(bridgeConfig?.[fieldKey]))) ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  for (const key of connector.fields) {
                    if (envMap[key]) await deleteEnvVar(key).catch(() => {})
                  }
                  if (bridge) {
                    const nextChannelConfigs = { ...(channelConfigs || {}) }
                    nextChannelConfigs[bridge.channelId] = {
                      ...(bridgeConfig || {}),
                      ...Object.fromEntries(Object.values(bridge.fieldMap).map((fieldKey) => [fieldKey, ""])),
                    }
                    await writeChannelsConfig(nextChannelConfigs)
                  }
                  await onRefresh()
                  toast.success(`${connector.name} 配置已清除`)
                  onClose()
                }}
              >
                <TrashIcon className="size-3.5 mr-1" />
                清除配置
              </Button>
            ) : null}
            <ModalCloseTrigger>
              <Button variant="outline" size="sm">取消</Button>
            </ModalCloseTrigger>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <SaveIcon className="size-3.5 mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
      </ModalBackdrop>
    </Modal>
  )
}

// ── Custom Connector Dialog ────────────────────────────────

function CustomConnectorDialog({ open, onClose, onRefresh }) {
  const [name, setName] = useState("")
  const [fields, setFields] = useState([{ key: "", value: "" }])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      // Save fields as env vars with CONNECTOR_ prefix
      for (const f of fields) {
        if (f.key.trim() && f.value.trim()) {
          await setEnvVar(f.key.trim().toUpperCase(), f.value.trim())
        }
      }
      // Save connector definition
      await setEnvVar(
        `CONNECTOR_${name.trim().toUpperCase().replace(/\s+/g, "_")}_FIELDS`,
        fields.filter((f) => f.key.trim()).map((f) => f.key.trim().toUpperCase()).join(",")
      )
      await onRefresh()
      onClose()
      setName("")
      setFields([{ key: "", value: "" }])
    } catch (err) {
      console.error("Failed to save:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={open} onOpenChange={onClose}>
      <ModalBackdrop>
        <ModalContainer size="sm">
          <ModalDialog>
            <ModalHeader>
              <ModalHeading className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlusCircleIcon className="size-5" />
                </div>
                <div>
                  <div>自定义连接器</div>
                </div>
              </ModalHeading>
            </ModalHeader>

          <ModalBody>
            <p className="text-[12px] text-muted-foreground">添加一个新的外部服务连接</p>
            <div className="flex flex-col gap-3 py-2">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-muted-foreground">连接器名称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Shopify"
                  className="text-[12px] h-8"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-medium text-muted-foreground">配置字段</label>
                {fields.map((f, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input
                      value={f.key}
                      onChange={(e) => {
                        const next = [...fields]
                        next[i] = { ...next[i], key: e.target.value }
                        setFields(next)
                      }}
                      placeholder="ENV_KEY"
                      className="text-[12px] h-8 font-mono"
                    />
                    <Input
                      value={f.value}
                      onChange={(e) => {
                        const next = [...fields]
                        next[i] = { ...next[i], value: e.target.value }
                        setFields(next)
                      }}
                      placeholder="Value"
                      type="password"
                      className="text-[12px] h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() => setFields((f) => f.filter((_, j) => j !== i))}
                      disabled={fields.length <= 1}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[12px] w-full"
                  onClick={() => setFields((f) => [...f, { key: "", value: "" }])}
                >
                  <PlusCircleIcon className="size-3.5 mr-1" />
                  添加字段
                </Button>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <ModalCloseTrigger>
              <Button variant="outline" size="sm">取消</Button>
            </ModalCloseTrigger>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              <SaveIcon className="size-3.5 mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
      </ModalBackdrop>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────

export default function IntegrationsView() {
  const [envMap, setEnvMap] = useState({})
  const [channelConfigs, setChannelConfigs] = useState({})
  const [integrationChecks, setIntegrationChecks] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)

  // Parse custom connectors from env vars (CONNECTOR_*_FIELDS pattern)
  const customConnectors = useCallback(() => {
    const result = []
    for (const [key, value] of Object.entries(envMap)) {
      const match = key.match(/^CONNECTOR_(.+)_FIELDS$/)
      if (!match) continue
      const id = match[1].toLowerCase()
      const name = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      result.push({
        id: `custom-${id}`,
        name,
        description: "自定义连接器",
        icon: PlugIcon,
        color: "bg-primary/10 text-primary",
        fields: parseConnectorFields(value),
      })
    }
    return result
  }, [envMap])

  const refresh = useCallback(async () => {
    try {
      const [vars, channels, checks] = await Promise.all([
        getEnvVars(),
        readChannelsConfig().catch(() => ({})),
        getIntegrationChecks().catch(() => ({})),
      ])
      const baseMap = buildConnectorEnvMap(vars)
      const nextMap = await revealPresetConnectorEnvMap(baseMap, PRESET_CONNECTORS)
      setEnvMap(nextMap)
      setChannelConfigs(channels && typeof channels === "object" ? channels : {})
      setIntegrationChecks(checks && typeof checks === "object" ? checks : {})
    } catch {
      setEnvMap({})
      setChannelConfigs({})
      setIntegrationChecks({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const allConnectors = [...PRESET_CONNECTORS, ...customConnectors()]
  const handleCheckUpdated = useCallback((connectorId, check) => {
    const normalizedId = cleanString(connectorId)
    if (!normalizedId) return
    setIntegrationChecks((prev) => ({
      ...(prev || {}),
      [normalizedId]: check,
    }))
  }, [])

  return (
    <ViewFrame
      title="连接器"
      description="管理外部服务凭证与接入状态"
      icon={PlugIcon}
    >
      <div className="flex-1 overflow-auto">
      <div className="flex flex-col gap-8 p-4">
        {CONNECTOR_CATEGORIES.map((cat) => {
          const connectors = cat.ids
            .map((id) => allConnectors.find((c) => c.id === id))
            .filter(Boolean)
          if (connectors.length === 0) return null
          return (
            <div key={cat.label}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat.label}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {connectors.map((conn) => {
                  const status = getConnectorStatus(conn, envMap)
                  const cfg = STATUS_CONFIG[status]
                  const bridgeStatus = getConnectorBridgeStatus(conn, envMap, channelConfigs)
                  const bridgeCfg = BRIDGE_STATUS_CONFIG[bridgeStatus.state] || BRIDGE_STATUS_CONFIG.missing
                  const check = normalizeIntegrationCheck(integrationChecks?.[conn.id])
                  const connectivityCfg = CONNECTIVITY_STATUS_CONFIG[check.status] || CONNECTIVITY_STATUS_CONFIG.idle
                  const Icon = conn.icon
                  return (
                    <Card
                      key={conn.id}
                      variant="default"
                      className="cursor-pointer py-3 gap-3 transition-all duration-200 hover:shadow-md"
                      onClick={() => setSelected(conn)}
                    >
                      <Card.Content className="px-4 py-0">
                        <div className="flex items-start justify-between">
                          <div className={cn("flex size-9 items-center justify-center rounded-lg", conn.color)}>
                            <Icon className="size-4.5" />
                          </div>
                          <div className={cn("size-2 rounded-full mt-1", cfg.dot)} />
                        </div>
                        <div className="mt-2.5">
                          <div className="text-[13px] font-medium leading-tight">{conn.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{conn.description}</div>
                        </div>
                        <Chip variant="tertiary" className={cn("h-5 mt-2", cfg.badgeWrapper)}>
                          <Chip.Label className={cn("text-[10px]", cfg.badgeLabel)}>
                            {cfg.label}
                          </Chip.Label>
                        </Chip>
                        {bridgeStatus.label && (
                          <div className={cn("mt-2 flex items-center gap-1.5 text-[10px] font-medium", bridgeCfg.text)}>
                            <span className={cn("size-1.5 rounded-full", bridgeCfg.dot)} />
                            {bridgeStatus.label}
                          </div>
                        )}
                        {conn.id === "feishu" && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className={cn("size-1.5 rounded-full", connectivityCfg.dot)} />
                            <span>{connectivityCfg.label}</span>
                          </div>
                        )}
                      </Card.Content>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Custom connectors */}
        {customConnectors().length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">自定义</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {customConnectors().map((conn) => {
                const status = getConnectorStatus(conn, envMap)
                const cfg = STATUS_CONFIG[status]
                const check = normalizeIntegrationCheck(integrationChecks?.[conn.id])
                const connectivityCfg = CONNECTIVITY_STATUS_CONFIG[check.status] || CONNECTIVITY_STATUS_CONFIG.idle
                const Icon = conn.icon
                return (
                  <Card
                    key={conn.id}
                    variant="default"
                    className="cursor-pointer py-3 gap-3 transition-all duration-200 hover:shadow-md"
                    onClick={() => setSelected(conn)}
                  >
                    <Card.Content className="px-4 py-0">
                      <div className="flex items-start justify-between">
                        <div className={cn("flex size-9 items-center justify-center rounded-lg", conn.color)}>
                          <Icon className="size-4.5" />
                        </div>
                        <div className={cn("size-2 rounded-full mt-1", cfg.dot)} />
                      </div>
                      <div className="mt-2.5">
                        <div className="text-[13px] font-medium leading-tight">{conn.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{conn.description}</div>
                      </div>
                      <Chip variant="tertiary" className={cn("h-5 mt-2", cfg.badgeWrapper)}>
                        <Chip.Label className={cn("text-[10px]", cfg.badgeLabel)}>
                          {cfg.label}
                        </Chip.Label>
                      </Chip>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", connectivityCfg.dot)} />
                        <span>{connectivityCfg.label}</span>
                      </div>
                    </Card.Content>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Add custom connector */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <Card
              variant="outlined"
              className="cursor-pointer py-3 gap-3 border-dashed hover:border-primary/40 transition-colors"
              onClick={() => setCustomOpen(true)}
            >
              <Card.Content className="px-4 py-0 flex flex-col items-center justify-center min-h-[120px]">
                <PlusCircleIcon className="size-8 text-muted-foreground/50" />
                <div className="text-[12px] text-muted-foreground mt-2">自定义连接器</div>
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>
      </div>

      {/* Connector detail dialog */}
      <ConnectorDialog
        connector={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        envMap={envMap}
        channelConfigs={channelConfigs}
        integrationChecks={integrationChecks}
        onRefresh={refresh}
        onCheckUpdated={handleCheckUpdated}
      />

      {/* Custom connector dialog */}
      <CustomConnectorDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onRefresh={refresh}
      />
    </ViewFrame>
  )
}
