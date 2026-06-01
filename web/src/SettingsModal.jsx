// Copyright (c) 2026 MeeJoy

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  CircleAlertIcon,
  CpuIcon,
  LanguagesIcon,
  MonitorCogIcon,
  MoonStarIcon,
  SparklesIcon,
  SunMediumIcon,
  UserRoundIcon,
} from "lucide-react"

import { getAgents, testGatewayConnection, checkDashboardRunning, checkGatewayRunning, restartHermesGateway, restartHermesDashboard, stopHermesGateway, stopHermesDashboard } from "@/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LANGUAGE_OPTIONS, useI18n } from "@/i18n"
import { cn } from "@/lib/utils"
import { loadBrowserEnvVars, saveBrowserEnvVars } from "@/api/browser-utils"
import { getCustomerDeliveryRuntimeInfo } from "@/api/customer-delivery"
import {
  checkDeliveryReadiness,
  deliveryCheckStatusLabel,
  deliveryReadinessLabel,
} from "@/api/delivery-readiness"
import { checkRemoteApiHealth, getRemoteApiRuntimeInfo } from "@/api/remote-api-base"

function deliveryBadgeVariant(status) {
  if (status === "blocked" || status === "error") return "destructive"
  if (status === "degraded" || status === "warn") return "secondary"
  return "outline"
}

export default function SettingsModal({
  open,
  onOpenChange,
  currentTheme,
  currentLanguage,
  currentAgent,
  currentUserNickname,
  currentGatewayHost,
  currentGatewayPort,
  onThemeChange,
  onLanguageChange,
  onApply,
  highlightSection,
}) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState(highlightSection || "userInfo")
  const [theme, setTheme] = useState(currentTheme)
  const [language, setLanguage] = useState(currentLanguage)
  const [agent, setAgent] = useState(currentAgent)
  const [userNickname, setUserNickname] = useState(currentUserNickname || "")
  const [gatewayHost, setGatewayHost] = useState(currentGatewayHost)
  const [gatewayPort, setGatewayPort] = useState(String(currentGatewayPort))
  const [agents, setAgents] = useState([])
  const [saving, setSaving] = useState(false)
  const [savingUserInfo, setSavingUserInfo] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState(null)
  const [remoteApiInfo, setRemoteApiInfo] = useState(() => getRemoteApiRuntimeInfo())
  const [deliveryInfo, setDeliveryInfo] = useState(() => getCustomerDeliveryRuntimeInfo())
  const [deliveryReadiness, setDeliveryReadiness] = useState(null)
  const [checkingDeliveryReadiness, setCheckingDeliveryReadiness] = useState(false)
  const [checkingRemoteApi, setCheckingRemoteApi] = useState(false)
  const [remoteApiStatus, setRemoteApiStatus] = useState(null)
  const [serverHost, setServerHost] = useState("127.0.0.1")
  const [dashboardHost] = useState(() => loadBrowserEnvVars().DASHBOARD_HOST || "127.0.0.1")
  const [dashboardPort, setDashboardPort] = useState(() => loadBrowserEnvVars().DASHBOARD_PORT || "9119")
  const [testingDashboard, setTestingDashboard] = useState(false)
  const [dashboardTestResult, setDashboardTestResult] = useState(null)
  const [savingDashboard, setSavingDashboard] = useState(false)
  const [dashboardSaved, setDashboardSaved] = useState(true)
  const [gatewayStatus, setGatewayStatus] = useState("checking") // "checking" | "running" | "stopped"
  const [dashboardStatus, setDashboardStatus] = useState("checking")
  const [startingGateway, setStartingGateway] = useState(false)
  const [stoppingGateway, setStoppingGateway] = useState(false)
  const [startingDashboard, setStartingDashboard] = useState(false)
  const [stoppingDashboard, setStoppingDashboard] = useState(false)
  const isCustomerDeliveryMode = Boolean(remoteApiInfo.enabled || deliveryInfo.enabled)
  const currentLanguageOption =
    LANGUAGE_OPTIONS.find((option) => option.id === language) || LANGUAGE_OPTIONS[0]
  const themeOptions = [
    {
      id: "light",
      label: t("settings.themeLight"),
      desc: t("settings.themeLightDescription"),
      icon: SunMediumIcon,
    },
    {
      id: "dark",
      label: t("settings.themeDark"),
      desc: t("settings.themeDarkDescription"),
      icon: MoonStarIcon,
    },
    {
      id: "system",
      label: t("settings.themeSystem"),
      desc: t("settings.themeSystemDescription"),
      icon: MonitorCogIcon,
    },
  ]
  const visibleAgents = agents.filter((item) => item.id === "hermes-agent")
  const hasAgentChange = agent !== currentAgent
  const hasUserInfoChange =
    userNickname.trim() !== String(currentUserNickname || "").trim()
  const hasConnectionChange =
    gatewayHost.trim() !== currentGatewayHost.trim() ||
    gatewayPort.trim() !== String(currentGatewayPort)
  const connectionBadgeLabel = isCustomerDeliveryMode
    ? deliveryInfo.enabled
      ? "客户包"
      : "远程后端"
    : hasConnectionChange
      ? t("settings.pendingSave")
      : t("settings.saved")
  const connectionBadgeVariant = isCustomerDeliveryMode
    ? "secondary"
    : hasConnectionChange
      ? "secondary"
      : "outline"
  const connectionSectionActive = highlightSection === "connection"
  const userInfoSectionActive = highlightSection === "userInfo"
  const navItems = useMemo(
    () => [
      {
        id: "userInfo",
        label: t("settings.userInfo"),
        summary: t("settings.userInfoSummary"),
        icon: UserRoundIcon,
        badge: hasUserInfoChange ? t("settings.pendingSave") : t("settings.saved"),
        badgeVariant: hasUserInfoChange ? "secondary" : "outline",
      },
      {
        id: "appearance",
        label: t("settings.appearance"),
        summary: t("settings.appearanceSummary"),
        icon: SunMediumIcon,
        badge: t("settings.liveApplyCompactHint"),
        badgeVariant: "outline",
      },
      {
        id: "language",
        label: t("settings.language"),
        summary: t("settings.languageSummary"),
        icon: LanguagesIcon,
        badge: t("settings.liveApplyCompactHint"),
        badgeVariant: "outline",
      },
      {
        id: "connection",
        label: t("settings.connection"),
        summary: t("settings.connectionSummary"),
        icon: CircleAlertIcon,
        badge: connectionBadgeLabel,
        badgeVariant: connectionBadgeVariant,
      },
      {
        id: "agent",
        label: t("settings.agent"),
        summary: t("settings.agentSummary"),
        icon: CpuIcon,
        badge: t("settings.currentAgent"),
        badgeVariant: "outline",
      },
    ],
    [connectionBadgeLabel, connectionBadgeVariant, hasUserInfoChange, t]
  )

  useEffect(() => {
    if (!open) return

    setActiveSection(highlightSection || "userInfo")
    setTheme(currentTheme)
    setLanguage(currentLanguage)
    setAgent(currentAgent)
    setUserNickname(currentUserNickname || "")
    setGatewayHost(currentGatewayHost)
    setGatewayPort(String(currentGatewayPort))
    setConnectionTestResult(null)
    setRemoteApiInfo(getRemoteApiRuntimeInfo())
    setDeliveryInfo(getCustomerDeliveryRuntimeInfo())
    setDeliveryReadiness(null)
    setRemoteApiStatus(null)
    setSavingUserInfo(false)
  }, [
    currentAgent,
    currentGatewayHost,
    currentGatewayPort,
    currentLanguage,
    currentTheme,
    currentUserNickname,
    highlightSection,
    open,
  ])

  useEffect(() => {
    if (!open || !highlightSection) return
    setActiveSection(highlightSection)
  }, [highlightSection, open])

  useEffect(() => {
    if (!open) return

    getAgents()
      .then((result) => setAgents(result))
      .catch((error) => {
        console.error("Failed to load agents:", error)
        setAgents([
          { id: "hermes-agent", name: "Hermes Agent", description: t("settings.genericAgent") },
        ])
      })
  }, [open, t])

  // Check Gateway and Dashboard status when connection section is active
  useEffect(() => {
    if (!open || activeSection !== "connection") return

    const nextRemoteApiInfo = getRemoteApiRuntimeInfo()
    const nextDeliveryInfo = getCustomerDeliveryRuntimeInfo()
    const nextCustomerDeliveryMode = Boolean(nextRemoteApiInfo.enabled || nextDeliveryInfo.enabled)

    setRemoteApiInfo(nextRemoteApiInfo)
    setDeliveryInfo(nextDeliveryInfo)
    setConnectionTestResult(null)
    setDashboardTestResult(null)
    setRemoteApiStatus(null)
    setDeliveryReadiness(null)

    if (nextCustomerDeliveryMode) return

    const checkStatus = async () => {
      try {
        const [gwRunning, dashRunning] = await Promise.all([
          checkGatewayRunning(),
          checkDashboardRunning(),
        ])
        setGatewayStatus(gwRunning ? "running" : "stopped")
        setDashboardStatus(dashRunning ? "running" : "stopped")
      } catch (e) {
        console.error("Failed to check service status:", e)
        setGatewayStatus("stopped")
        setDashboardStatus("stopped")
      }
    }
    void checkStatus()
  }, [open, activeSection])

  const handleThemeSelect = async (nextTheme) => {
    if (!nextTheme || nextTheme === theme) return
    setTheme(nextTheme)
    await onThemeChange?.(nextTheme)
  }

  const handleLanguageSelect = async (nextLanguage) => {
    if (!nextLanguage || nextLanguage === language) return
    setLanguage(nextLanguage)
    await onLanguageChange?.(nextLanguage)
  }

  const handleSaveConnection = async () => {
    if (!hasConnectionChange && !hasAgentChange) return

    const nextHost = gatewayHost.trim()
    const nextPort = gatewayPort.trim()
    const nextUserNickname = userNickname.trim()

    if (!nextHost) {
      toast.error(t("settings.invalidHost"))
      return
    }

    if (!/^\d+$/.test(nextPort)) {
      toast.error(t("settings.invalidPort"))
      return
    }

    setSaving(true)
    try {
      setUserNickname(nextUserNickname)
      await onApply?.({
        theme,
        language,
        agent,
        userNickname: nextUserNickname,
        gatewayHost: nextHost,
        gatewayPort: nextPort,
      })
      setConnectionTestResult(null)
      toast.success(t("settings.saveConnectionSuccess"))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveUserInfo = async () => {
    const nextUserNickname = userNickname.trim()

    if (nextUserNickname === String(currentUserNickname || "").trim()) return

    setSavingUserInfo(true)
    try {
      setUserNickname(nextUserNickname)
      await onApply?.({ userNickname: nextUserNickname })
    } finally {
      setSavingUserInfo(false)
    }
  }

  const handleTestConnection = async () => {
    const nextHost = gatewayHost.trim()
    const nextPort = gatewayPort.trim()

    if (!nextHost) {
      toast.error(t("settings.invalidHost"))
      return
    }

    if (!/^\d+$/.test(nextPort)) {
      toast.error(t("settings.invalidPort"))
      return
    }

    setTestingConnection(true)
    setConnectionTestResult(null)
    try {
      const result = await testGatewayConnection(nextHost, nextPort)
      setConnectionTestResult({ type: "success", target: result.target || `${nextHost}:${nextPort}` })
      toast.success(t("settings.testConnectionSuccess", { target: result.target || `${nextHost}:${nextPort}` }))
    } catch (error) {
      const message = String(error?.message || error)
      setConnectionTestResult({ type: "error", message })
      toast.error(t("settings.testConnectionError"), {
        description: message,
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleTestRemoteApi = async () => {
    const info = getRemoteApiRuntimeInfo()
    setRemoteApiInfo(info)
    setCheckingRemoteApi(true)
    setRemoteApiStatus(null)

    try {
      const result = await checkRemoteApiHealth()
      setRemoteApiInfo(result)
      setRemoteApiStatus({
        type: "success",
        status: result.status,
        latencyMs: result.latencyMs,
      })
      toast.success("客户端后端连接成功", {
        description: result.enabled ? result.base : "当前同源后端",
      })
    } catch (error) {
      const message = String(error?.message || error)
      setRemoteApiStatus({ type: "error", message })
      toast.error("客户端后端连接失败", {
        description: message,
      })
    } finally {
      setCheckingRemoteApi(false)
    }
  }

  const handleCheckDeliveryReadiness = async () => {
    setCheckingDeliveryReadiness(true)
    setDeliveryReadiness(null)

    try {
      const result = await checkDeliveryReadiness()
      setDeliveryReadiness(result)
      const label = deliveryReadinessLabel(result?.status)
      if (result?.status === "blocked") {
        toast.error("交付自检存在阻塞", { description: label })
      } else {
        toast.success("交付自检完成", { description: label })
      }
    } catch (error) {
      const message = String(error?.message || error)
      setDeliveryReadiness({
        status: "blocked",
        checks: [{ id: "delivery-readiness", label: "交付自检", status: "error", detail: message }],
      })
      toast.error("交付自检失败", { description: message })
    } finally {
      setCheckingDeliveryReadiness(false)
    }
  }

  // Gateway 启动/停止/重启
  const handleStartGateway = async () => {
    setStartingGateway(true)
    try {
      await restartHermesGateway()
      toast.success("Gateway 重启成功")
      setGatewayStatus("running")
    } catch (error) {
      toast.error(String(error?.message || error) || "Gateway 操作失败")
    } finally {
      setStartingGateway(false)
    }
  }

  const handleStopGateway = async () => {
    setStoppingGateway(true)
    try {
      await stopHermesGateway()
      toast.success("Gateway 已停止")
      setGatewayStatus("stopped")
    } catch (error) {
      toast.error(String(error?.message || error) || "Gateway 停止失败")
    } finally {
      setStoppingGateway(false)
    }
  }

  // Dashboard 启动/停止/重启
  const handleStartDashboard = async () => {
    setStartingDashboard(true)
    try {
      await restartHermesDashboard()
      toast.success("Dashboard 重启成功")
      setDashboardStatus("running")
    } catch (error) {
      toast.error(String(error?.message || error) || "Dashboard 操作失败")
    } finally {
      setStartingDashboard(false)
    }
  }

  const handleStopDashboard = async () => {
    setStoppingDashboard(true)
    try {
      await stopHermesDashboard()
      toast.success("Dashboard 已停止")
      setDashboardStatus("stopped")
    } catch (error) {
      toast.error(String(error?.message || error) || "Dashboard 停止失败")
    } finally {
      setStoppingDashboard(false)
    }
  }

  const handleTestDashboard = async () => {
    const host = dashboardHost.trim()
    const port = dashboardPort.trim()
    if (!host) {
      toast.error("请输入 Dashboard 地址")
      return
    }
    if (!/^\d+$/.test(port)) {
      toast.error("请输入有效端口")
      return
    }
    setTestingDashboard(true)
    setDashboardTestResult(null)
    try {
      const running = await checkDashboardRunning()
      if (running) {
        setDashboardTestResult({ type: "success", target: `${host}:${port}` })
        toast.success("Dashboard 连接成功")
      } else {
        setDashboardTestResult({ type: "error", message: "Dashboard 未响应" })
        toast.error("Dashboard 连接失败")
      }
    } catch (error) {
      const message = String(error?.message || error)
      setDashboardTestResult({ type: "error", message })
      toast.error("Dashboard 连接失败", { description: message })
    } finally {
      setTestingDashboard(false)
    }
  }

  const handleSaveDashboard = async () => {
    const nextPort = dashboardPort.trim()
    if (!/^\d+$/.test(nextPort)) {
      toast.error("请输入有效端口")
      return
    }

    setSavingDashboard(true)
    try {
      // Dashboard 配置目前仅用于显示，保存到本地存储
      const current = loadBrowserEnvVars()
      saveBrowserEnvVars({ ...current, DASHBOARD_HOST: dashboardHost, DASHBOARD_PORT: nextPort })
      setDashboardSaved(true)
      toast.success("Dashboard 设置已保存")
    } catch {
      toast.error("保存失败")
    } finally {
      setSavingDashboard(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden rounded-[12px] border-border/70 bg-background/95 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
              <SparklesIcon className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-lg">{t("settings.title")}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">{t("settings.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[272px_minmax(0,1fr)]">
          <aside className="border-r border-border/60 bg-gradient-to-b from-background/72 to-background/42 px-4 py-5 backdrop-blur-xl">
            <div className="mb-4 rounded-[12px] border border-border/60 bg-background/55 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("settings.navigationTitle")}
              </div>
              <p className="mt-1 text-[11px] leading-4.5 text-muted-foreground">
                {t("settings.description")}
              </p>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "group relative flex w-full items-start gap-3 overflow-hidden rounded-[12px] border px-3 py-3 text-left transition-all",
                    activeSection === item.id
                      ? "border-primary/20 bg-primary/[0.085] shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_10%,transparent)]"
                      : "border-transparent hover:border-border/55 hover:bg-background/52"
                  )}>
                  <span
                    className={cn(
                      "absolute inset-y-2 left-1 w-1 rounded-full transition-colors",
                      activeSection === item.id ? "bg-primary" : "bg-transparent group-hover:bg-border/70"
                    )}
                  />
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/85 text-primary group-hover:bg-background"
                    )}>
                    <item.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium leading-5 text-foreground">
                        {item.label}
                      </span>
                      <ChevronRightIcon
                        className={cn(
                          "mt-0.5 size-4 shrink-0 transition-all",
                          activeSection === item.id
                            ? "translate-x-0 text-primary"
                            : "-translate-x-1 text-muted-foreground/0 group-hover:translate-x-0 group-hover:text-muted-foreground"
                        )}
                      />
                    </div>
                    <p className="text-[11px] leading-4.5 text-muted-foreground">
                      {item.summary}
                    </p>
                    <Badge
                      variant={item.badgeVariant}
                      className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px]">
                      {item.badge}
                    </Badge>
                  </div>
                </button>
              ))}
            </nav>
          </aside>

          <ScrollArea className="max-h-[calc(88vh-8.5rem)]">
            <div className="px-5 py-5">
              {activeSection === "userInfo" && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t("settings.userInfo")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.userInfoSummary")}
                      </p>
                    </div>
                    <Badge
                      variant={hasUserInfoChange ? "secondary" : "outline"}
                      className="rounded px-1.5 py-0.5 text-[10px]">
                      {hasUserInfoChange ? t("settings.pendingSave") : t("settings.saved")}
                    </Badge>
                  </div>

                  <div
                    className={cn(
                      "app-panel space-y-4 rounded-[12px] border px-4 py-4 transition-colors",
                      userInfoSectionActive && "border-primary/25 bg-primary/[0.04] ring-1 ring-primary/18"
                    )}>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">
                        {t("settings.userNickname")}
                      </div>
                      <Input
                        value={userNickname}
                        onChange={(event) => setUserNickname(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return
                          event.preventDefault()
                          void handleSaveUserInfo()
                        }}
                        placeholder={t("settings.userNicknamePlaceholder")}
                        className="h-9 rounded-md border-border/70 bg-background/70"
                      />
                      <div className="text-xs leading-5 text-muted-foreground">
                        {t("settings.userNicknameHint")}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => void handleSaveUserInfo()}
                        disabled={savingUserInfo || !hasUserInfoChange}
                        className="rounded-md">
                        {savingUserInfo ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "appearance" && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t("settings.appearance")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.appearanceSummary")}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                      {t("settings.liveApplyCompactHint")}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {themeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => void handleThemeSelect(option.id)}
                        className={cn(
                          "app-panel rounded-[12px] border px-3 py-3 text-left transition-transform hover:-translate-y-0.5",
                          theme === option.id
                            ? "border-primary/30 bg-primary/8"
                            : "border-border/70 bg-background/55"
                        )}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex size-8 items-center justify-center rounded-[10px] bg-background/70 text-primary">
                            <option.icon className="size-4" />
                          </div>
                          {theme === option.id && <CheckIcon className="size-4 text-primary" />}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">{option.label}</div>
                          <p className="text-xs leading-5 text-muted-foreground">{option.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {activeSection === "language" && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t("settings.language")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.languageSummary")}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                      {t("settings.liveApplyCompactHint")}
                    </Badge>
                  </div>

                  <div className="app-panel rounded-[12px] border px-4 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {currentLanguageOption.nativeLabel}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {currentLanguageOption.description}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="rounded-md">
                            <LanguagesIcon className="size-4" />
                            {currentLanguageOption.label}
                            <ChevronDownIcon className="size-4 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="end"
                          className="w-64 rounded-[12px] border-border/70 bg-popover/95 p-2 backdrop-blur-xl">
                          <DropdownMenuLabel className="px-2 pb-1 text-xs text-muted-foreground">
                            {t("settings.languageSelect")}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup
                            value={language}
                            onValueChange={(value) => void handleLanguageSelect(value)}>
                            {LANGUAGE_OPTIONS.map((option) => (
                              <DropdownMenuRadioItem
                                key={option.id}
                                value={option.id}
                                className="items-start rounded-md py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium text-foreground">
                                    {option.nativeLabel}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {option.description}
                                  </span>
                                </div>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "connection" && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t("settings.connection")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.connectionSummary")}
                      </p>
                    </div>
                    <Badge
                      variant={connectionBadgeVariant}
                      className="rounded px-1.5 py-0.5 text-[10px]">
                      {connectionBadgeLabel}
                    </Badge>
                  </div>

                  <div
                    className={cn(
                      "app-panel space-y-4 rounded-[12px] border px-4 py-4 transition-colors",
                      connectionSectionActive && "border-primary/25 bg-primary/[0.04] ring-1 ring-primary/18"
                    )}>

                    {isCustomerDeliveryMode ? (
                      <div className="rounded-[10px] border border-primary/20 bg-primary/[0.045] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">客户交付模式</span>
                          <Badge variant="secondary" className="rounded px-1.5 py-0.5 text-[10px]">
                            后端托管
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          当前安装包连接预配置后端，Agent Gateway、Dashboard 和业务数据由后端服务维护。桌面端不需要启动本机 Hermes，也不提供本机端口控制。
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* ===== 服务状态 ===== */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">服务状态</div>

                          {/* Gateway 状态行 */}
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                gatewayStatus === "running" ? "bg-emerald-500" : gatewayStatus === "checking" ? "bg-amber-400" : "bg-rose-500"
                              )}
                            />
                            <span className="text-sm font-medium text-foreground w-20">Gateway</span>
                            {gatewayStatus === "stopped" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleStartGateway()}
                                disabled={startingGateway}
                                className="rounded-md text-[10px] h-6 px-2">
                                {startingGateway ? "启动中..." : "启动"}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleStopGateway()}
                                  disabled={stoppingGateway}
                                  className="rounded-md text-[10px] h-6 px-2">
                                  {stoppingGateway ? "停止中..." : "停止"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleStartGateway()}
                                  disabled={startingGateway}
                                  className="rounded-md text-[10px] h-6 px-2">
                                  {startingGateway ? "重启中..." : "重启"}
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Dashboard 状态行 */}
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                dashboardStatus === "running" ? "bg-emerald-500" : dashboardStatus === "checking" ? "bg-amber-400" : "bg-rose-500"
                              )}
                            />
                            <span className="text-sm font-medium text-foreground w-20">Dashboard</span>
                            {dashboardStatus === "stopped" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleStartDashboard()}
                                disabled={startingDashboard}
                                className="rounded-md text-[10px] h-6 px-2">
                                {startingDashboard ? "启动中..." : "启动"}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleStopDashboard()}
                                  disabled={stoppingDashboard}
                                  className="rounded-md text-[10px] h-6 px-2">
                                  {stoppingDashboard ? "停止中..." : "停止"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleStartDashboard()}
                                  disabled={startingDashboard}
                                  className="rounded-md text-[10px] h-6 px-2">
                                  {startingDashboard ? "重启中..." : "重启"}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ===== 客户端后端 ===== */}
                    <div className="rounded-[10px] border border-border/60 bg-background/55 px-3 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">客户端后端</span>
                            <Badge
                              variant={remoteApiInfo.enabled ? "default" : "outline"}
                              className="rounded px-1.5 py-0.5 text-[10px]">
                              {remoteApiInfo.enabled ? "远程服务" : "同源服务"}
                            </Badge>
                            <Badge
                              variant={deliveryInfo.enabled ? "secondary" : "outline"}
                              className="rounded px-1.5 py-0.5 text-[10px]">
                              {deliveryInfo.enabled ? "客户包" : "本地模式"}
                            </Badge>
                            {remoteApiStatus?.type === "success" && (
                              <Badge className="rounded px-1.5 py-0.5 text-[10px]">
                                HTTP {remoteApiStatus.status} · {remoteApiStatus.latencyMs}ms
                              </Badge>
                            )}
                            {remoteApiStatus?.type === "error" && (
                              <Badge variant="destructive" className="rounded px-1.5 py-0.5 text-[10px]">
                                连接失败
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
                            <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                              <span>服务地址</span>
                              <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {remoteApiInfo.base || "当前同源 /api"}
                              </code>
                            </div>
                            <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                              <span>交付客户</span>
                              <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {deliveryInfo.customerName || "未指定客户"}
                              </code>
                            </div>
                            <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                              <span>交付通道</span>
                              <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {deliveryInfo.channel}
                              </code>
                            </div>
                            {deliveryInfo.protocolVersion && (
                              <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                                <span>交付协议</span>
                                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  {deliveryInfo.protocolVersion}
                                </code>
                              </div>
                            )}
                            {deliveryInfo.deliveryFingerprint && (
                              <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                                <span>交付指纹</span>
                                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  {deliveryInfo.deliveryFingerprint}
                                </code>
                              </div>
                            )}
                            {deliveryInfo.buildSha && (
                              <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                                <span>构建版本</span>
                                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  {deliveryInfo.buildSha}
                                </code>
                              </div>
                            )}
                            {deliveryInfo.buildTime && (
                              <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                                <span>构建时间</span>
                                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  {deliveryInfo.buildTime}
                                </code>
                              </div>
                            )}
                            <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                              <span>检测端点</span>
                              <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {remoteApiInfo.healthUrl}
                              </code>
                            </div>
                            {remoteApiStatus?.type === "error" && (
                              <div className="text-rose-500">{remoteApiStatus.message}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTestRemoteApi()}
                          disabled={checkingRemoteApi}
                          className="h-8 rounded-md text-[11px]">
                          {checkingRemoteApi ? "检测中..." : "检测后端"}
                        </Button>
                      </div>
                    </div>

                    {/* ===== 交付自检 ===== */}
                    <div className="rounded-[10px] border border-border/60 bg-background/55 px-3 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">交付自检</span>
                            <Badge
                              variant={deliveryBadgeVariant(deliveryReadiness?.status)}
                              className="rounded px-1.5 py-0.5 text-[10px]">
                              {deliveryReadinessLabel(deliveryReadiness?.status)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            检测后端 API、登录入口、对话网关、会话能力、业务数据和知识库目录。
                          </p>
                          {Array.isArray(deliveryReadiness?.checks) && deliveryReadiness.checks.length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {deliveryReadiness.checks.map((check) => (
                                <div
                                  key={check.id}
                                  className="grid gap-1 rounded-md border border-border/50 bg-muted/25 px-2 py-2 sm:grid-cols-[7rem_minmax(0,1fr)_3.25rem] sm:items-center">
                                  <span className="text-xs font-medium text-foreground">{check.label}</span>
                                  <span className="min-w-0 text-xs leading-5 text-muted-foreground">
                                    {check.detail}
                                  </span>
                                  <Badge
                                    variant={deliveryBadgeVariant(check.status)}
                                    className="w-fit rounded px-1.5 py-0.5 text-[10px]">
                                    {deliveryCheckStatusLabel(check.status)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCheckDeliveryReadiness()}
                          disabled={checkingDeliveryReadiness}
                          className="h-8 rounded-md text-[11px]">
                          {checkingDeliveryReadiness ? "自检中..." : "运行自检"}
                        </Button>
                      </div>
                    </div>

                    {!isCustomerDeliveryMode && (
                      <>
                        {/* 分隔线 */}
                        <div className="border-t border-border/50" />

                        {/* ===== 服务器 IP ===== */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">服务器 IP</div>
                          <Input
                            value={serverHost}
                            onChange={(event) => setServerHost(event.target.value)}
                            placeholder="127.0.0.1"
                            className="h-9 rounded-md border-border/70 bg-background/70"
                          />
                        </div>

                        {/* 分隔线 */}
                        <div className="border-t border-border/50" />

                        {/* ===== Gateway 端口配置 ===== */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">Gateway</span>
                            <span className="text-xs text-muted-foreground">端口:</span>
                            <Input
                              value={gatewayPort}
                              onChange={(event) => setGatewayPort(event.target.value.replace(/[^\d]/g, ""))}
                              inputMode="numeric"
                              placeholder="8642"
                              className="h-8 w-24 rounded-md border-border/70 bg-background/70 text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleTestConnection()}
                              disabled={testingConnection}
                              className="rounded-md text-[10px] h-7 px-2">
                              {testingConnection ? "测试中..." : "测试"}
                            </Button>
                            {connectionTestResult?.type === "success" && (
                              <Badge className="rounded px-1.5 py-0.5 text-[10px]">成功</Badge>
                            )}
                            {connectionTestResult?.type === "error" && (
                              <Badge variant="destructive" className="rounded px-1.5 py-0.5 text-[10px]">失败</Badge>
                            )}
                            <Button
                              size="sm"
                              className="rounded-md text-[10px] h-7 px-2 ml-auto"
                              onClick={() => void handleSaveConnection()}
                              disabled={saving}>
                              {saving ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div>

                        {/* ===== Dashboard 端口配置 ===== */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">Dashboard</span>
                            <span className="text-xs text-muted-foreground">端口:</span>
                            <Input
                              value={dashboardPort}
                              onChange={(event) => {
                                setDashboardPort(event.target.value.replace(/[^\d]/g, ""))
                                setDashboardSaved(false)
                              }}
                              inputMode="numeric"
                              placeholder="9119"
                              className="h-8 w-24 rounded-md border-border/70 bg-background/70 text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleTestDashboard()}
                              disabled={testingDashboard}
                              className="rounded-md text-[10px] h-7 px-2">
                              {testingDashboard ? "测试中..." : "测试"}
                            </Button>
                            {dashboardTestResult?.type === "success" && (
                              <Badge className="rounded px-1.5 py-0.5 text-[10px]">成功</Badge>
                            )}
                            {dashboardTestResult?.type === "error" && (
                              <Badge variant="destructive" className="rounded px-1.5 py-0.5 text-[10px]">失败</Badge>
                            )}
                            <Button
                              size="sm"
                              className="rounded-md text-[10px] h-7 px-2 ml-auto"
                              onClick={() => void handleSaveDashboard()}
                              disabled={dashboardSaved || savingDashboard}>
                              {savingDashboard ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {activeSection === "agent" && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t("settings.agent")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.agentSummary")}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px]">
                      {t("settings.currentAgent")}
                    </Badge>
                  </div>

                  <div className="app-panel rounded-[12px] border px-4 py-4">
                    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border/70 bg-background/55 px-3 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {visibleAgents[0]?.name || "Hermes Agent"}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {t("settings.agentHint")}
                        </p>
                      </div>
                      <Badge className="rounded px-1.5 py-0.5 text-[10px]">
                        {t("settings.currentAgent")}
                      </Badge>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-md">
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
