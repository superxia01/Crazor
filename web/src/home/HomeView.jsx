// Copyright (c) 2026 MeeJoy

import { useEffect, useMemo, useState } from "react"
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  FolderOpenIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  MessageSquarePlusIcon,
  NotebookPenIcon,
  Settings2Icon,
  SparklesIcon,
  TriangleAlertIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"

import { checkDashboardRunning, getCronJobs } from "@/api"
import { getCustomerDeliveryRuntimeInfo } from "@/api/customer-delivery"
import { useI18n } from "@/i18n"
import {
  buildHomeDashboardStats,
  getRecentNotes,
  getRecentSessions,
  resolveHomeDisplayNickname,
} from "@/home-dashboard-utils"

import { HomeFrame, PanelShell, SoftIcon, StatusPill, formatDateTime, formatWorkspacePath, getToneForStatus } from "./shared"
import { buildActivitySeries } from "./home-utils"
import CrmFunnelCard from "./CrmFunnelCard"
import ContentPublishingCard from "./ContentPublishingCard"
import TaskBoardCard from "./TaskBoardCard"
import RecentWorkCard from "./RecentWorkCard"
import SystemStatusCard from "./SystemStatusCard"
import QuickLaunchCard from "./QuickLaunchCard"
import ActivityChartCard from "./ActivityChartCard"
import WorkspaceStatsCard from "./WorkspaceStatsCard"

function getGatewayTone(status) {
  if (status === "connected") return "good"
  if (status === "checking") return "info"
  return "bad"
}

export default function HomeView({
  sessions = [],
  notebookTree = { notes: [] },
  currentWorkspace = null,
  gatewayStatus = "checking",
  gatewayStatusDetail = "",
  installedHermesDisplay = null,
  userNickname = "",
  onNavigate,
  onNewConversation,
  onSelectSession,
  onCreateNote,
  onSelectNote,
  onOpenSettings,
}) {
  const { lang, t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  const [cronJobs, setCronJobs] = useState([])
  const [cronError, setCronError] = useState("")
  const [dashboardRunning, setDashboardRunning] = useState(false)
  const [overview, setOverview] = useState(null)
  const [contentPieces, setContentPieces] = useState([])

  // Fetch cron jobs
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const jobs = await getCronJobs()
        if (!cancelled) { setCronError(""); setCronJobs(Array.isArray(jobs) ? jobs : []) }
      } catch (error) {
        if (!cancelled) setCronError(String(error?.message || error))
      }
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  // Clock tick
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Dashboard check
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try { const r = await checkDashboardRunning(); if (!cancelled) setDashboardRunning(Boolean(r)) }
      catch { if (!cancelled) setDashboardRunning(false) }
    }
    const timer = window.setTimeout(() => void check(), 0)
    const interval = window.setInterval(() => void check(), 30_000)
    return () => { cancelled = true; window.clearTimeout(timer); window.clearInterval(interval) }
  }, [])

  // Fetch analytics overview
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch("/api/crazor/analytics/overview")
        if (resp.ok && !cancelled) setOverview(await resp.json())
      } catch { /* ignore */ }
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  // Fetch content pieces
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch("/api/crazor/content-pieces")
        if (resp.ok && !cancelled) setContentPieces(await resp.json())
      } catch { /* ignore */ }
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  // Derived data
  const stats = useMemo(
    () => buildHomeDashboardStats({ sessions, notebookTree, cronJobs, gatewayStatus, cronLoadError: cronError, now }),
    [cronError, cronJobs, gatewayStatus, notebookTree, now, sessions]
  )
  const notes = useMemo(() => notebookTree?.notes || [], [notebookTree])
  const recentSessions = useMemo(() => getRecentSessions(sessions, 10), [sessions])
  const recentNotes = useMemo(() => getRecentNotes(notes, 10), [notes])
  const displayNickname = resolveHomeDisplayNickname(userNickname, t("home.guestNickname"))
  const deliveryInfo = useMemo(() => getCustomerDeliveryRuntimeInfo(), [])
  const activityData = useMemo(
    () => buildActivitySeries({ sessions, notes, cronJobs, now, language: lang }),
    [cronJobs, lang, notes, now, sessions]
  )

  // Status pills
  const healthTone = stats.healthLevel === "healthy" ? "good" : stats.healthLevel === "checking" ? "info" : stats.healthLevel === "critical" ? "bad" : "warning"
  const HealthIcon = stats.healthLevel === "healthy" ? CheckCircle2Icon : stats.healthLevel === "critical" ? TriangleAlertIcon : GaugeIcon
  const healthLabel = stats.healthLevel === "healthy" ? t("home.healthHealthy") : stats.healthLevel === "checking" ? t("home.healthChecking") : stats.healthLevel === "critical" ? t("home.healthCritical") : t("home.healthWarning")
  const gatewayTone = getGatewayTone(gatewayStatus)
  const gatewayLabel = gatewayStatus === "connected" ? t("home.gatewayConnected") : gatewayStatus === "checking" ? t("home.gatewayChecking") : t("home.gatewayDisconnected")

  const quickActions = [
    { id: "chat", title: t("home.quickNewChat"), icon: MessageSquarePlusIcon, tone: "sky", onClick: onNewConversation },
    { id: "note", title: t("home.quickNewNote"), icon: NotebookPenIcon, tone: "blue", onClick: onCreateNote },
    { id: "cron", title: t("home.quickCron"), icon: CalendarClockIcon, tone: "emerald", onClick: () => onNavigate?.("cron") },
    { id: "files", title: t("home.quickFiles"), icon: FolderOpenIcon, tone: "amber", onClick: () => onNavigate?.("files") },
    { id: "hermes", title: t("home.quickHermes"), icon: SparklesIcon, tone: "sky", onClick: () => onNavigate?.("hermes") },
    { id: "settings", title: t("home.quickSettings"), icon: Settings2Icon, tone: "slate", onClick: onOpenSettings },
  ]

  const systemRows = [
    { id: "gateway", icon: gatewayStatus === "connected" ? WifiIcon : WifiOffIcon, label: t("home.gateway"), value: gatewayLabel, tone: gatewayTone },
    { id: "hermes", icon: SparklesIcon, label: t("home.hermes"), value: installedHermesDisplay || t("home.versionUnknown"), tone: installedHermesDisplay ? "good" : "warning" },
    { id: "dashboard", icon: LayoutDashboardIcon, label: t("home.dashboardStatus"), value: dashboardRunning ? t("home.dashboardStarted") : t("home.dashboardStopped"), tone: dashboardRunning ? "good" : "warning" },
    { id: "workspace", icon: FolderOpenIcon, label: t("home.workspace"), value: currentWorkspace?.name || t("home.workspaceFallback"), tone: "neutral" },
    deliveryInfo.releaseId ? { id: "delivery-release", icon: LayoutDashboardIcon, label: "交付版本", value: deliveryInfo.releaseId, tone: "info" } : null,
    deliveryInfo.buildTime ? { id: "delivery-build-time", icon: CalendarClockIcon, label: "构建时间", value: deliveryInfo.buildTime, tone: "neutral" } : null,
  ].filter(Boolean)

  return (
    <HomeFrame>
      {/* Welcome header - full width */}
      <PanelShell className="border-sky-100/90 px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-sky-500 text-white shadow-[0_8px_16px_rgba(14,165,233,0.2)]">
              <LayoutDashboardIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold leading-tight text-slate-950 dark:text-slate-50">
                {t("home.welcomeLogin", { nickname: displayNickname })}
              </h1>
              <div className="mt-1 truncate text-[12px] text-slate-500 dark:text-slate-400">
                {t("home.workspaceToday")} · {formatDateTime(now, lang)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={gatewayTone} icon={gatewayStatus === "connected" ? WifiIcon : WifiOffIcon}>
              {gatewayLabel}
            </StatusPill>
            <StatusPill tone={healthTone} icon={HealthIcon}>
              {healthLabel}
            </StatusPill>
            <StatusPill tone={stats.cronErrorCount > 0 ? "warning" : "good"} icon={CheckCircle2Icon}>
              {stats.cronErrorCount > 0 ? t("home.healthWarning") : t("home.runtimeReady")}
            </StatusPill>
          </div>
        </div>
      </PanelShell>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* LEFT: Card grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <CrmFunnelCard contacts={overview?.contacts} reminders={overview?.followUpReminders} />
          <ContentPublishingCard contentPieces={contentPieces} />
          <TaskBoardCard projects={overview?.projects} cronJobs={cronJobs} />
          <WorkspaceStatsCard stats={{
            todaySessions: stats.todaySessions,
            totalSessions: sessions.length,
            noteCount: stats.noteCount,
            activeCronJobs: stats.activeCronJobs,
            cronErrorCount: stats.cronErrorCount,
          }} />
          <RecentWorkCard
            sessions={recentSessions}
            notes={recentNotes}
            language={lang}
            onSelectSession={onSelectSession}
            onSelectNote={onSelectNote}
            onOpenSessions={() => onNavigate?.("sessions")}
            onOpenNotebook={() => onNavigate?.("notebook")}
            t={t}
          />
        </div>

        {/* RIGHT: System sidebar */}
        <div className="grid gap-3 content-start">
          <SystemStatusCard rows={systemRows} />
          <QuickLaunchCard actions={quickActions} />
          <ActivityChartCard data={activityData} />
        </div>
      </div>
    </HomeFrame>
  )
}
