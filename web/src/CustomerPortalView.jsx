// Copyright (c) 2026 MeeJoy

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  BookOpenTextIcon,
  Building2Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  DownloadIcon,
  FileTextIcon,
  FolderArchiveIcon,
  LoaderCircleIcon,
  PackageCheckIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react"
import { toast } from "sonner"

import { getCustomerPortal, getCustomerPortalDoc, submitCustomerDeliveryAcceptance } from "@/api/customer-portal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const EMPTY_ARRAY = []

export default function CustomerPortalView() {
  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [docDialog, setDocDialog] = useState({ open: false, note: null, loading: false, error: "" })
  const [feedbackDrafts, setFeedbackDrafts] = useState({})
  const [submittingDeliveryId, setSubmittingDeliveryId] = useState("")

  const loadPortal = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const data = await getCustomerPortal()
      setPortal(data)
    } catch (nextError) {
      setError(String(nextError?.message || nextError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPortal()
  }, [loadPortal])

  const deliveries = Array.isArray(portal?.deliveries) ? portal.deliveries : EMPTY_ARRAY
  const tasks = Array.isArray(portal?.tasks) ? portal.tasks : EMPTY_ARRAY
  const docs = Array.isArray(portal?.docs) ? portal.docs : EMPTY_ARRAY
  const projects = Array.isArray(portal?.projects) ? portal.projects : EMPTY_ARRAY
  const contactAttachments = Array.isArray(portal?.attachments?.contact) ? portal.attachments.contact : EMPTY_ARRAY
  const projectAttachmentGroups = Array.isArray(portal?.attachments?.projects) ? portal.attachments.projects : EMPTY_ARRAY
  const deliveryAttachmentGroups = Array.isArray(portal?.attachments?.deliveries) ? portal.attachments.deliveries : EMPTY_ARRAY
  const summaryCards = useMemo(() => ([
    {
      id: "deliveries",
      label: "交付项",
      value: Number(portal?.summary?.deliveries || 0),
      icon: PackageCheckIcon,
    },
    {
      id: "pending",
      label: "待确认",
      value: Number(portal?.summary?.pendingAcceptance || 0),
      icon: Clock3Icon,
    },
    {
      id: "docs",
      label: "文档资料",
      value: Number(portal?.summary?.docs || 0),
      icon: BookOpenTextIcon,
    },
    {
      id: "attachments",
      label: "归档附件",
      value: Number(portal?.summary?.attachments || 0),
      icon: FolderArchiveIcon,
    },
  ]), [portal])

  const openDoc = useCallback(async (noteId) => {
    setDocDialog({ open: true, note: null, loading: true, error: "" })
    try {
      const note = await getCustomerPortalDoc(noteId)
      setDocDialog({ open: true, note, loading: false, error: "" })
    } catch (nextError) {
      setDocDialog({
        open: true,
        note: null,
        loading: false,
        error: String(nextError?.message || nextError),
      })
    }
  }, [])

  const handleAcceptance = useCallback(async (deliveryId, status) => {
    setSubmittingDeliveryId(deliveryId)
    try {
      const feedback = String(feedbackDrafts[deliveryId] || "").trim()
      await submitCustomerDeliveryAcceptance(deliveryId, {
        status,
        feedback,
      })
      toast.success(status === "need-rework" ? "已提交返工意见" : "已确认当前交付")
      setFeedbackDrafts((current) => ({ ...current, [deliveryId]: "" }))
      await loadPortal({ silent: true })
    } catch (nextError) {
      toast.error("提交失败", {
        description: String(nextError?.message || nextError),
      })
    } finally {
      setSubmittingDeliveryId("")
    }
  }, [feedbackDrafts, loadPortal])

  if (loading) {
    return (
      <main className="h-full overflow-auto bg-background">
        <div className="mx-auto flex min-h-full max-w-7xl items-center justify-center px-6 py-10">
          <div className="app-panel-strong flex w-full max-w-md items-center gap-3 rounded-[14px] border px-5 py-4">
            <LoaderCircleIcon className="size-5 animate-spin text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">正在加载客户交付工作台</h1>
              <p className="mt-1 text-xs text-muted-foreground">读取交付进度、文档资料和验收状态。</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="h-full overflow-auto bg-background">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <section className="app-panel-strong rounded-[14px] border px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangleIcon className="size-4" />
                  <span className="text-sm font-semibold">客户交付工作台加载失败</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadPortal()}>
                <RefreshCwIcon className="size-4" />
                重新加载
              </Button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="app-panel-strong rounded-[14px] border px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded px-2 py-0.5 text-[10px]">
                    客户交付工作台
                  </Badge>
                  <Badge variant={portal?.binding?.status === "bound" ? "outline" : "destructive"} className="rounded px-2 py-0.5 text-[10px]">
                    {portal?.binding?.status === "bound" ? "已绑定真实客户" : "待绑定联系人"}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-foreground">
                  {portal?.customer?.name || portal?.contact?.company || portal?.contact?.name || "客户交付"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  这里集中展示当前客户的交付状态、协作节点、归档资料和验收动作。页面只展示已经真实落在系统里的内容，不补演示数据。
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadPortal()}>
                <RefreshCwIcon className="size-4" />
                刷新
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.id} className="rounded-[12px] border border-border/70 bg-background/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                    <card.icon className="size-4 text-primary" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{card.value}</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-[12px] border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">客户信息</CardTitle>
                <CardDescription>当前交付绑定到的真实联系人与交付环境。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="联系人" value={portal?.contact?.name || "未绑定"} />
                <InfoRow label="公司" value={portal?.contact?.company || portal?.customer?.name || "未填写"} />
                <InfoRow label="项目类型" value={portal?.contact?.project_type || "未填写"} />
                <InfoRow label="内部负责人" value={portal?.contact?.sales_person || "未填写"} />
                <InfoRow label="下次跟进" value={formatDate(portal?.contact?.next_follow_up)} />
                <InfoRow label="交付协议" value={portal?.customer?.protocolVersion || "未声明"} />
                <InfoRow label="发布批次" value={portal?.customer?.releaseId || "未写入"} mono />
                <InfoRow label="构建版本" value={portal?.customer?.buildSha || "未写入"} mono />
                <InfoRow label="构建时间" value={formatDateTime(portal?.customer?.buildTime)} />
              </CardContent>
            </Card>

            {portal?.binding?.status !== "bound" ? (
              <Card className="rounded-[12px] border-destructive/25 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <AlertTriangleIcon className="size-4" />
                    尚未绑定客户联系人
                  </CardTitle>
                  <CardDescription className="text-destructive/80">
                    {portal?.binding?.message || "请先绑定真实客户联系人。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  当前页面不会补造演示数据。完成绑定后，这里会自动展示该客户对应的交付、任务、文档和附件。
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[12px] border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">项目范围</CardTitle>
                <CardDescription>当前联系人已经关联到的项目线。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.length > 0 ? projects.map((project) => (
                  <div key={project.id} className="rounded-[10px] border border-border/60 bg-background/70 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{project.name || project.id}</span>
                      <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                        {project.status || "active"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>负责人 {project.team || "未填写"}</span>
                      <span>预算 {formatCurrency(project.budget)}</span>
                      <span>截止 {formatDate(project.deadline)}</span>
                    </div>
                  </div>
                )) : (
                  <EmptyBlock icon={Building2Icon} title="暂无项目范围" description="该客户还没有挂接项目记录。" />
                )}
              </CardContent>
            </Card>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">
            <Tabs defaultValue="deliveries" className="min-w-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="deliveries">交付进度</TabsTrigger>
                <TabsTrigger value="tasks">协作节点</TabsTrigger>
                <TabsTrigger value="docs">文档资料</TabsTrigger>
              </TabsList>

              <TabsContent value="deliveries" className="mt-4 space-y-3">
                {deliveries.length > 0 ? deliveries.map((delivery) => {
                  const isSubmitting = submittingDeliveryId === delivery.id
                  const acceptanceStatus = String(delivery.acceptance_status || "")
                  return (
                    <Card key={delivery.id} className="rounded-[12px] border-border/70 shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base">{delivery.title || "未命名交付"}</CardTitle>
                            <CardDescription className="mt-1">
                              {delivery.delivery_type || "交付项"} · 阶段 {delivery.stage || "未设置"}
                            </CardDescription>
                          </div>
                          <Badge
                            variant={acceptanceStatus === "已验收" ? "outline" : acceptanceStatus === "需返工" ? "destructive" : "secondary"}
                            className="rounded px-1.5 py-0.5 text-[10px]">
                            {acceptanceStatus || "未验收"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <InfoRow label="内部负责人" value={delivery.owner || "未填写"} />
                          <InfoRow label="客户负责人" value={delivery.customer_owner || "未填写"} />
                          <InfoRow label="开始时间" value={formatDate(delivery.start_date)} />
                          <InfoRow label="计划验收" value={formatDate(delivery.due_date)} />
                        </div>

                        {Array.isArray(delivery.deliverables) && delivery.deliverables.length > 0 ? (
                          <div>
                            <h3 className="text-xs font-medium text-foreground">交付物</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {delivery.deliverables.map((item) => (
                                <Badge key={item} variant="secondary" className="rounded px-2 py-0.5 text-[10px]">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {delivery.handover_doc ? (
                          <button
                            type="button"
                            onClick={() => void openDoc(delivery.handover_doc.id)}
                            className="flex w-full items-start gap-3 rounded-[10px] border border-border/70 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-accent/40">
                            <FileTextIcon className="mt-0.5 size-4 text-primary" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{delivery.handover_doc.title}</p>
                              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                {delivery.handover_doc.excerpt || "点击查看完整交付文档。"}
                              </p>
                            </div>
                          </button>
                        ) : null}

                        {Array.isArray(delivery.attachments) && delivery.attachments.length > 0 ? (
                          <AttachmentList title="交付附件" items={delivery.attachments} />
                        ) : null}

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-foreground">客户反馈</label>
                          <Textarea
                            value={feedbackDrafts[delivery.id] || ""}
                            onChange={(event) => setFeedbackDrafts((current) => ({
                              ...current,
                              [delivery.id]: event.target.value,
                            }))}
                            placeholder="填写验收说明、待调整项或补充意见"
                            className="min-h-24 rounded-[10px]"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleAcceptance(delivery.id, "accepted")}
                            disabled={isSubmitting}
                            className="rounded-md">
                            {isSubmitting ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />}
                            确认验收
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleAcceptance(delivery.id, "need-rework")}
                            disabled={isSubmitting}
                            className="rounded-md">
                            {isSubmitting ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                            申请返工
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }) : (
                  <EmptyBlock icon={PackageCheckIcon} title="暂无交付记录" description="该客户目前还没有可展示的交付项。" />
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-4 space-y-3">
                {tasks.length > 0 ? tasks.map((task) => (
                  <Card key={task.id} className="rounded-[12px] border-border/70 shadow-none">
                    <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{task.title || "未命名任务"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.project_name || "未关联项目"} · 负责人 {task.owner || "未填写"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={task.status === "done" ? "outline" : "secondary"} className="rounded px-1.5 py-0.5 text-[10px]">
                          {task.status || "todo"}
                        </Badge>
                        <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                          截止 {formatDate(task.due_date)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <EmptyBlock icon={CircleDashedIcon} title="暂无协作节点" description="该客户当前没有已排入系统的任务节点。" />
                )}
              </TabsContent>

              <TabsContent value="docs" className="mt-4 space-y-3">
                {docs.length > 0 ? docs.map((note) => (
                  <Card key={note.id} className="rounded-[12px] border-border/70 shadow-none">
                    <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{note.title}</p>
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">
                          {note.excerpt || "暂无摘要"}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          更新于 {formatDateTime(note.updated_at)}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => void openDoc(note.id)}>
                        <BookOpenTextIcon className="size-4" />
                        查看正文
                      </Button>
                    </CardContent>
                  </Card>
                )) : (
                  <EmptyBlock icon={BookOpenTextIcon} title="暂无客户文档" description="该客户还没有归档到知识库的文档。" />
                )}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-[12px] border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">联系人附件</CardTitle>
                <CardDescription>需求材料、合同和基础归档。</CardDescription>
              </CardHeader>
              <CardContent>
                {contactAttachments.length > 0 ? (
                  <AttachmentList items={contactAttachments} />
                ) : (
                  <EmptyInline text="暂无联系人附件" />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[12px] border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">项目附件</CardTitle>
                <CardDescription>按项目聚合已经归档的材料。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {projectAttachmentGroups.length > 0 ? projectAttachmentGroups.map((group) => (
                  <div key={group.project_id} className="space-y-2">
                    <p className="text-xs font-medium text-foreground">{group.project_name || group.project_id}</p>
                    <AttachmentList items={group.items} compact />
                  </div>
                )) : (
                  <EmptyInline text="暂无项目附件" />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[12px] border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">交付附件汇总</CardTitle>
                <CardDescription>按交付项聚合归档的交付包与验收材料。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliveryAttachmentGroups.length > 0 ? deliveryAttachmentGroups.map((group) => (
                  <div key={group.delivery_id} className="space-y-2">
                    <p className="text-xs font-medium text-foreground">{group.delivery_title || group.delivery_id}</p>
                    <AttachmentList items={group.items} compact />
                  </div>
                )) : (
                  <EmptyInline text="暂无交付附件" />
                )}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>

      <Dialog open={docDialog.open} onOpenChange={(open) => setDocDialog((current) => ({ ...current, open }))}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{docDialog.note?.title || "客户文档"}</DialogTitle>
            <DialogDescription>
              {docDialog.note?.updated_at ? `更新于 ${formatDateTime(docDialog.note.updated_at)}` : "查看已经归档的客户文档正文"}
            </DialogDescription>
          </DialogHeader>
          {docDialog.loading ? (
            <div className="flex items-center gap-3 rounded-[10px] border border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              正在加载文档内容
            </div>
          ) : docDialog.error ? (
            <div className="rounded-[10px] border border-destructive/25 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              {docDialog.error}
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh] rounded-[10px] border border-border/70 bg-background/80">
              <pre className="whitespace-pre-wrap px-4 py-4 text-sm leading-7 text-foreground">
                {docDialog.note?.content || "暂无正文"}
              </pre>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDocDialog({ open: false, note: null, loading: false, error: "" })}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function AttachmentList({ title = "", items = EMPTY_ARRAY, compact = false }) {
  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="space-y-2">
      {title ? <h3 className="text-xs font-medium text-foreground">{title}</h3> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.entity_id || "entity"}-${item.filename}`}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border/60 bg-background/70 px-3 py-3",
              compact && "px-2.5 py-2.5",
            )}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.filename}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(item.category || "未分类")}{item.size_bytes ? ` · ${formatBytes(item.size_bytes)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.preview_url ? (
                <Button asChild variant="outline" size="sm">
                  <a href={item.preview_url} target="_blank" rel="noreferrer">预览</a>
                </Button>
              ) : null}
              {item.download_url ? (
                <Button asChild variant="outline" size="sm">
                  <a href={item.download_url} target="_blank" rel="noreferrer">
                    <DownloadIcon className="size-4" />
                    下载
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-foreground", mono && "font-mono text-[12px]")}>
        {value || "未填写"}
      </span>
    </div>
  )
}

function EmptyInline({ text }) {
  return <p className="text-sm text-muted-foreground">{text}</p>
}

function EmptyBlock({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border/70 bg-background/70 px-5 py-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return "未填写"
  try {
    return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatDateTime(value) {
  if (!value) return "未填写"
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return "未填写"
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
