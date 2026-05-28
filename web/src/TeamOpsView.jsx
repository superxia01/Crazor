// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIcon,
  BotIcon,
  CheckCircle2Icon,
  ClipboardCopyIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"
import { ViewFrame } from "@/components/view-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const ACTOR_TYPE_LABELS = {
  human: "成员",
  agent: "Agent",
}

const TOKEN_TYPE_LABELS = {
  api: "API token",
  agent: "Agent token",
}

const STATUS_LABELS = {
  active: "启用",
  revoked: "已撤销",
  disabled: "停用",
}

const TOKEN_SCOPE_PRESETS = [
  { value: "*", label: "全部写入" },
  { value: "crm:* docs:* project:create", label: "客户协作" },
  { value: "docs:*", label: "文档知识库" },
  { value: "project:* task:*", label: "项目交付" },
  { value: "content:* docs:*", label: "内容运营" },
  { value: "identity:*", label: "身份管理" },
]

const ENTITY_LABELS = {
  contact: "客户",
  team_member: "团队成员",
  actor_token: "接入凭证",
  follow_up: "跟进",
  transaction: "流水",
  project: "项目",
  task: "任务",
  content_piece: "内容",
  doc_note: "文档",
  doc_folder: "文件夹",
}

const fieldClassName =
  "h-9 w-full rounded-[8px] border border-input bg-card/86 px-3 text-[13px] text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/18"

async function fetchJson(path, options = {}) {
  const resp = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await resp.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!resp.ok) {
    const message = typeof data?.error === "string" ? data.error : `${resp.status} ${resp.statusText}`
    throw new Error(message)
  }
  return data
}

function formatTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusBadgeClass(status) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "revoked") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-amber-200 bg-amber-50 text-amber-700"
}

function formatScopes(scopes) {
  const values = Array.isArray(scopes)
    ? scopes
    : String(scopes || "")
      .split(/[\s,，]+/)
      .filter(Boolean)
  if (values.length === 0) return "-"
  if (values.includes("*")) return "全部写入"
  return values.join(" · ")
}

export default function TeamOpsView() {
  const [members, setMembers] = useState([])
  const [tokens, setTokens] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [currentActor, setCurrentActor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [memberSaving, setMemberSaving] = useState(false)
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenResult, setTokenResult] = useState(null)
  const [memberForm, setMemberForm] = useState({
    name: "",
    actor_type: "human",
    role: "member",
    status: "active",
  })
  const [tokenForm, setTokenForm] = useState({
    member_id: "",
    token_type: "api",
    label: "",
    scopes: "*",
  })
  const [auditFilter, setAuditFilter] = useState({
    entity: "",
    actor_id: "",
    limit: "80",
  })

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members]
  )
  const activeTokens = useMemo(
    () => tokens.filter((token) => token.status === "active"),
    [tokens]
  )
  const agentCount = useMemo(
    () => members.filter((member) => member.actor_type === "agent").length,
    [members]
  )

  const loadIdentity = useCallback(async () => {
    setLoading(true)
    try {
      const [me, memberList, tokenList] = await Promise.all([
        fetchJson("/api/crazor/identity/me"),
        fetchJson("/api/crazor/identity/members"),
        fetchJson("/api/crazor/identity/tokens"),
      ])
      setCurrentActor(me)
      setMembers(Array.isArray(memberList) ? memberList : [])
      setTokens(Array.isArray(tokenList) ? tokenList : [])
    } catch (error) {
      toast.error("身份数据加载失败", { description: String(error?.message || error) })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true)
    try {
      const params = new URLSearchParams()
      if (auditFilter.entity.trim()) params.set("entity", auditFilter.entity.trim())
      if (auditFilter.actor_id.trim()) params.set("actor_id", auditFilter.actor_id.trim())
      params.set("limit", auditFilter.limit || "80")
      const data = await fetchJson(`/api/crazor/audit-logs?${params.toString()}`)
      setAuditLogs(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error("审计日志加载失败", { description: String(error?.message || error) })
    } finally {
      setAuditLoading(false)
    }
  }, [auditFilter])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadIdentity(), loadAuditLogs()])
  }, [loadAuditLogs, loadIdentity])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!tokenForm.member_id && activeMembers.length > 0) {
      setTokenForm((current) => ({ ...current, member_id: activeMembers[0].id }))
    }
  }, [activeMembers, tokenForm.member_id])

  async function createMember(event) {
    event.preventDefault()
    const name = memberForm.name.trim()
    if (!name) {
      toast.error("请填写成员名称")
      return
    }
    setMemberSaving(true)
    try {
      await fetchJson("/api/crazor/identity/members", {
        method: "POST",
        body: JSON.stringify({ ...memberForm, name }),
      })
      setMemberForm({ name: "", actor_type: "human", role: "member", status: "active" })
      toast.success("成员已创建")
      await loadIdentity()
    } catch (error) {
      toast.error("成员创建失败", { description: String(error?.message || error) })
    } finally {
      setMemberSaving(false)
    }
  }

  async function deleteMember(member) {
    if (!window.confirm(`删除「${member.name}」及其 token？`)) return
    try {
      await fetchJson(`/api/crazor/identity/members/${encodeURIComponent(member.id)}`, {
        method: "DELETE",
      })
      toast.success("成员已删除")
      await loadIdentity()
      await loadAuditLogs()
    } catch (error) {
      toast.error("成员删除失败", { description: String(error?.message || error) })
    }
  }

  async function createToken(event) {
    event.preventDefault()
    if (!tokenForm.member_id) {
      toast.error("请选择成员或 Agent")
      return
    }
    setTokenSaving(true)
    try {
      const created = await fetchJson("/api/crazor/identity/tokens", {
        method: "POST",
        body: JSON.stringify(tokenForm),
      })
      setTokenResult(created)
      setTokenForm((current) => ({ ...current, label: "" }))
      toast.success("Token 已签发")
      await loadIdentity()
    } catch (error) {
      toast.error("Token 签发失败", { description: String(error?.message || error) })
    } finally {
      setTokenSaving(false)
    }
  }

  async function revokeToken(token) {
    if (!window.confirm(`撤销 ${token.token_prefix}？`)) return
    try {
      await fetchJson(`/api/crazor/identity/tokens/${encodeURIComponent(token.id)}`, {
        method: "DELETE",
      })
      toast.success("Token 已撤销")
      await loadIdentity()
      await loadAuditLogs()
    } catch (error) {
      toast.error("Token 撤销失败", { description: String(error?.message || error) })
    }
  }

  async function copyToken() {
    if (!tokenResult?.token) return
    await navigator.clipboard.writeText(tokenResult.token)
    toast.success("Token 已复制")
  }

  const stats = [
    { label: "活跃成员", value: activeMembers.length, icon: UsersIcon, tone: "text-blue-600" },
    { label: "Agent 身份", value: agentCount, icon: BotIcon, tone: "text-violet-600" },
    { label: "有效 Token", value: activeTokens.length, icon: KeyRoundIcon, tone: "text-emerald-600" },
    { label: "审计记录", value: auditLogs.length, icon: ActivityIcon, tone: "text-amber-600" },
  ]

  return (
    <ViewFrame
      icon={ShieldCheckIcon}
      badge="Team Audit"
      title="协作审计"
      description="团队身份、Agent 接入凭证与写入审计"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={loading || auditLoading}
          className="h-8 gap-1.5 rounded-[8px]">
          <RefreshCwIcon className={cn("size-3.5", (loading || auditLoading) && "animate-spin")} />
          刷新
        </Button>
      }>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((item) => (
            <Card key={item.label} className="shadow-none">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-muted-foreground">{item.label}</div>
                  <div className={cn("text-lg font-semibold", item.tone)}>{item.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <StatusPill label="身份来源" value="Token 派生" state="已接入" tone="emerald" />
          <StatusPill label="Token 存储" value="SHA-256 hash" state="已接入" tone="emerald" />
          <StatusPill label="统一入口" value="REST / MCP" state="已验证" tone="blue" />
          <StatusPill label="权限范围" value="Token Scope" state="已接入" tone="emerald" />
        </div>

        <Tabs defaultValue="identity" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-fit rounded-[8px]">
            <TabsTrigger value="identity" className="gap-1.5 rounded-[7px] text-[12px]">
              <UsersIcon className="size-3.5" />
              身份与凭证
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 rounded-[7px] text-[12px]">
              <ActivityIcon className="size-3.5" />
              审计日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-3 min-h-0 flex-1">
            <div className="grid min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[13px] font-medium">
                      <UserPlusIcon className="size-4 text-blue-600" />
                      新建身份
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="flex flex-col gap-3" onSubmit={createMember}>
                      <Input
                        value={memberForm.name}
                        onChange={(event) =>
                          setMemberForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="成员或 Agent 名称"
                        className="h-9 rounded-[8px] text-[13px]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={memberForm.actor_type}
                          onChange={(event) =>
                            setMemberForm((current) => ({ ...current, actor_type: event.target.value }))
                          }
                          className={fieldClassName}>
                          <option value="human">团队成员</option>
                          <option value="agent">Agent</option>
                        </select>
                        <select
                          value={memberForm.role}
                          onChange={(event) =>
                            setMemberForm((current) => ({ ...current, role: event.target.value }))
                          }
                          className={fieldClassName}>
                          <option value="member">成员</option>
                          <option value="admin">管理员</option>
                          <option value="viewer">只读</option>
                        </select>
                      </div>
                      <Button type="submit" disabled={memberSaving} className="h-9 rounded-[8px]">
                        {memberSaving ? "创建中" : "创建身份"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[13px] font-medium">
                      <KeyRoundIcon className="size-4 text-emerald-600" />
                      签发 Token
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="flex flex-col gap-3" onSubmit={createToken}>
                      <select
                        value={tokenForm.member_id}
                        onChange={(event) =>
                          setTokenForm((current) => ({ ...current, member_id: event.target.value }))
                        }
                        className={fieldClassName}>
                        <option value="">选择身份</option>
                        {activeMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} · {ACTOR_TYPE_LABELS[member.actor_type] || member.actor_type}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={tokenForm.token_type}
                          onChange={(event) =>
                            setTokenForm((current) => ({ ...current, token_type: event.target.value }))
                          }
                          className={fieldClassName}>
                          <option value="api">API token</option>
                          <option value="agent">Agent token</option>
                        </select>
                        <Input
                          value={tokenForm.label}
                          onChange={(event) =>
                            setTokenForm((current) => ({ ...current, label: event.target.value }))
                          }
                          placeholder="标签"
                          className="h-9 rounded-[8px] text-[13px]"
                        />
                      </div>
                      <select
                        value={tokenForm.scopes}
                        onChange={(event) =>
                          setTokenForm((current) => ({ ...current, scopes: event.target.value }))
                        }
                        className={fieldClassName}>
                        {TOKEN_SCOPE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label} · {preset.value}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" disabled={tokenSaving || activeMembers.length === 0} className="h-9 rounded-[8px]">
                        {tokenSaving ? "签发中" : "签发 Token"}
                      </Button>
                    </form>

                    {tokenResult?.token && (
                      <div className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium">新 Token</span>
                          <Button type="button" size="sm" variant="outline" onClick={copyToken} className="h-7 gap-1 rounded-[7px] bg-white">
                            <ClipboardCopyIcon className="size-3.5" />
                            复制
                          </Button>
                        </div>
                        <code className="block break-all rounded-[7px] bg-white px-2 py-1.5 text-[11px]">
                          {tokenResult.token}
                        </code>
                        <div className="mt-2 text-[11px]">
                          权限：{formatScopes(tokenResult.scopes)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid min-h-0 gap-3 2xl:grid-cols-2">
                <Card className="min-h-[360px] shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-[13px] font-medium">
                      <span>团队身份</span>
                      <Badge variant="outline" className="text-[10px]">{members.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden rounded-[8px] border">
                      <table className="w-full table-fixed text-left text-[12px]">
                        <thead className="bg-muted/55 text-muted-foreground">
                          <tr>
                            <th className="w-[34%] px-3 py-2 font-medium">名称</th>
                            <th className="w-[20%] px-3 py-2 font-medium">类型</th>
                            <th className="w-[20%] px-3 py-2 font-medium">角色</th>
                            <th className="w-[16%] px-3 py-2 font-medium">状态</th>
                            <th className="w-[10%] px-2 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => (
                            <tr key={member.id} className="border-t">
                              <td className="truncate px-3 py-2 font-medium">{member.name}</td>
                              <td className="px-3 py-2">{ACTOR_TYPE_LABELS[member.actor_type] || member.actor_type}</td>
                              <td className="px-3 py-2">{member.role}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(member.status))}>
                                  {STATUS_LABELS[member.status] || member.status}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Button type="button" variant="ghost" size="icon" onClick={() => deleteMember(member)} className="size-7 rounded-[7px]">
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {members.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                                暂无团队身份
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-h-[360px] shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-[13px] font-medium">
                      <span>接入凭证</span>
                      <Badge variant="outline" className="text-[10px]">{tokens.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden rounded-[8px] border">
                      <table className="w-full table-fixed text-left text-[12px]">
                        <thead className="bg-muted/55 text-muted-foreground">
                          <tr>
                            <th className="w-[28%] px-3 py-2 font-medium">归属</th>
                            <th className="w-[20%] px-3 py-2 font-medium">前缀</th>
                            <th className="w-[16%] px-3 py-2 font-medium">类型</th>
                            <th className="w-[20%] px-3 py-2 font-medium">权限</th>
                            <th className="w-[10%] px-3 py-2 font-medium">状态</th>
                            <th className="w-[6%] px-2 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {tokens.map((token) => (
                            <tr key={token.id} className="border-t">
                              <td className="truncate px-3 py-2">
                                <div className="truncate font-medium">{token.member_name || token.member_id}</div>
                                {token.label && <div className="truncate text-[11px] text-muted-foreground">{token.label}</div>}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px]">{token.token_prefix}</td>
                              <td className="px-3 py-2">{TOKEN_TYPE_LABELS[token.token_type] || token.token_type}</td>
                              <td className="truncate px-3 py-2 text-[11px] text-muted-foreground">{formatScopes(token.scopes)}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(token.status))}>
                                  {STATUS_LABELS[token.status] || token.status}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={token.status !== "active"}
                                  onClick={() => revokeToken(token)}
                                  className="size-7 rounded-[7px]">
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {tokens.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                                暂无接入凭证
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-3 min-h-0 flex-1">
            <Card className="min-h-[520px] shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-col gap-3 text-[13px] font-medium xl:flex-row xl:items-center xl:justify-between">
                  <span>写入审计</span>
                  <div className="grid gap-2 sm:grid-cols-[150px_180px_90px_auto]">
                    <Input
                      value={auditFilter.entity}
                      onChange={(event) =>
                        setAuditFilter((current) => ({ ...current, entity: event.target.value }))
                      }
                      placeholder="实体"
                      className="h-8 rounded-[8px] text-[12px]"
                    />
                    <Input
                      value={auditFilter.actor_id}
                      onChange={(event) =>
                        setAuditFilter((current) => ({ ...current, actor_id: event.target.value }))
                      }
                      placeholder="Actor ID"
                      className="h-8 rounded-[8px] text-[12px]"
                    />
                    <select
                      value={auditFilter.limit}
                      onChange={(event) =>
                        setAuditFilter((current) => ({ ...current, limit: event.target.value }))
                      }
                      className={cn(fieldClassName, "h-8 text-[12px]")}>
                      <option value="40">40</option>
                      <option value="80">80</option>
                      <option value="160">160</option>
                    </select>
                    <Button type="button" variant="outline" size="sm" onClick={loadAuditLogs} className="h-8 rounded-[8px]">
                      查询
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <CheckCircle2Icon className="size-3" />
                    当前入口：{currentActor?.actor_id || "anonymous"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    来源：{currentActor?.source || "rest-api"}
                  </Badge>
                </div>
                <div className="overflow-hidden rounded-[8px] border">
                  <table className="w-full table-fixed text-left text-[12px]">
                    <thead className="bg-muted/55 text-muted-foreground">
                      <tr>
                        <th className="w-[15%] px-3 py-2 font-medium">时间</th>
                        <th className="w-[11%] px-3 py-2 font-medium">动作</th>
                        <th className="w-[14%] px-3 py-2 font-medium">实体</th>
                        <th className="w-[18%] px-3 py-2 font-medium">Actor</th>
                        <th className="w-[13%] px-3 py-2 font-medium">来源</th>
                        <th className="w-[19%] px-3 py-2 font-medium">Payload hash</th>
                        <th className="w-[10%] px-3 py-2 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground">{formatTime(log.created_at)}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                          </td>
                          <td className="truncate px-3 py-2">
                            <div className="truncate font-medium">{ENTITY_LABELS[log.entity] || log.entity}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground">{log.entity_id || "-"}</div>
                          </td>
                          <td className="truncate px-3 py-2">
                            <div className="truncate font-medium">{log.actor_id || "-"}</div>
                            <div className="truncate text-[10px] text-muted-foreground">{log.actor_type || "-"}</div>
                          </td>
                          <td className="px-3 py-2">{log.source || "-"}</td>
                          <td className="truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {log.payload_hash || "-"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                              已记录
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                            暂无审计记录
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ViewFrame>
  )
}

function StatusPill({ label, value, state, tone }) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone]

  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border bg-card/70 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate text-[13px] font-medium">{value}</div>
      </div>
      <Badge variant="outline" className={cn("text-[10px]", toneClass)}>
        {state}
      </Badge>
    </div>
  )
}
