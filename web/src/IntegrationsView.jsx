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
  CheckSquareIcon,
} from "lucide-react"
import { ViewFrame } from "@/components/view-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getEnvVars, setEnvVar, deleteEnvVar, revealEnvVar } from "@/api/dashboard"
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

// ── Helpers ────────────────────────────────────────────────

function getConnectorStatus(connector, envMap) {
  const vals = connector.fields.map((f) => envMap[f])
  const filled = vals.filter(Boolean).length
  if (filled === 0) return "disconnected"
  if (filled === connector.fields.length) return "connected"
  return "partial"
}

const STATUS_CONFIG = {
  connected: { label: "已连接", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  partial: { label: "部分配置", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  disconnected: { label: "未配置", dot: "bg-zinc-300", badge: "bg-zinc-100 text-zinc-500" },
}

// ── Connector Config Dialog ────────────────────────────────

function ConnectorDialog({ connector, open, onClose, envMap, onRefresh }) {
  const [values, setValues] = useState({})
  const [revealed, setRevealed] = useState({})
  const [saving, setSaving] = useState(false)

  // Load values when dialog opens
  useEffect(() => {
    if (!open || !connector) return
    const initial = {}
    const revealPromises = connector.fields.map(async (key) => {
      initial[key] = envMap[key] || ""
      if (envMap[key]) {
        try {
          const real = await revealEnvVar(key)
          initial[key] = real?.value || real || envMap[key] || ""
        } catch {
          initial[key] = envMap[key]
        }
      }
    })
    Promise.all(revealPromises).then(() => setValues({ ...initial }))
    setRevealed({})
  }, [open, connector, envMap])

  if (!connector) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const key of connector.fields) {
        const val = (values[key] || "").trim()
        if (val) {
          await setEnvVar(key, val)
        } else if (envMap[key]) {
          await deleteEnvVar(key)
        }
      }
      await onRefresh()
      onClose()
    } catch (err) {
      console.error("Failed to save:", err)
    } finally {
      setSaving(false)
    }
  }

  const Icon = connector.icon

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn("flex size-10 items-center justify-center rounded-lg", connector.color)}>
              <Icon className="size-5" />
            </div>
            <div>
              <div>{connector.name}</div>
              <DialogDescription className="text-[12px]">{connector.description}</DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {connector.fields.map((key) => (
            <div key={key} className="space-y-1">
              <label className="text-[12px] font-medium text-muted-foreground">{key}</label>
              <div className="flex gap-1.5">
                <Input
                  type={revealed[key] ? "text" : "password"}
                  value={values[key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  placeholder={`输入 ${key}...`}
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
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          {envMap && connector.fields.some((k) => envMap[k]) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                for (const key of connector.fields) {
                  if (envMap[key]) await deleteEnvVar(key).catch(() => {})
                }
                await onRefresh()
                onClose()
              }}
            >
              <TrashIcon className="size-3.5 mr-1" />
              清除配置
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <SaveIcon className="size-3.5 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PlusCircleIcon className="size-5" />
            </div>
            <div>
              <div>自定义连接器</div>
              <DialogDescription className="text-[12px]">添加一个新的外部服务连接</DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

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

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            <SaveIcon className="size-3.5 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────

export default function IntegrationsView() {
  const [envMap, setEnvMap] = useState({})
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
        fields: value.split(",").filter(Boolean),
      })
    }
    return result
  }, [envMap])

  const refresh = useCallback(async () => {
    try {
      const vars = await getEnvVars()
      const map = {}
      if (Array.isArray(vars)) {
        for (const v of vars) {
          if (v.key && v.value !== undefined) map[v.key] = v.value
        }
      }
      setEnvMap(map)
    } catch {
      setEnvMap({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const allConnectors = [...PRESET_CONNECTORS, ...customConnectors()]

  return (
    <ViewFrame
      title="连接器"
      description="管理外部服务集成与 API 绑定"
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
                  const Icon = conn.icon
                  return (
                    <Card
                      key={conn.id}
                      className="cursor-pointer py-3 gap-3 hover:border-primary/40 transition-colors"
                      onClick={() => setSelected(conn)}
                    >
                      <CardContent className="px-4 py-0">
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
                        <Badge variant="outline" className={cn("text-[10px] h-5 mt-2", cfg.badge)}>
                          {cfg.label}
                        </Badge>
                      </CardContent>
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
                const Icon = conn.icon
                return (
                  <Card
                    key={conn.id}
                    className="cursor-pointer py-3 gap-3 hover:border-primary/40 transition-colors"
                    onClick={() => setSelected(conn)}
                  >
                    <CardContent className="px-4 py-0">
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
                      <Badge variant="outline" className={cn("text-[10px] h-5 mt-2", cfg.badge)}>
                        {cfg.label}
                      </Badge>
                    </CardContent>
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
              className="cursor-pointer py-3 gap-3 border-dashed hover:border-primary/40 transition-colors"
              onClick={() => setCustomOpen(true)}
            >
              <CardContent className="px-4 py-0 flex flex-col items-center justify-center min-h-[120px]">
                <PlusCircleIcon className="size-8 text-muted-foreground/50" />
                <div className="text-[12px] text-muted-foreground mt-2">自定义连接器</div>
              </CardContent>
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
        onRefresh={refresh}
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
