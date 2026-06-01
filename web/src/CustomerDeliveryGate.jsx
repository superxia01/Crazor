// Copyright (c) 2026 MeeJoy

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon, ServerIcon, WifiOffIcon } from "lucide-react"

import { checkDeliveryReadiness, deliveryCheckStatusLabel, deliveryReadinessLabel } from "@/api/delivery-readiness"
import { getCustomerDeliveryRuntimeInfo } from "@/api/customer-delivery"
import { getRemoteApiRuntimeInfo } from "@/api/remote-api-base"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CustomerDeliveryGate({ children }) {
  const runtime = useMemo(() => {
    const remoteApiInfo = getRemoteApiRuntimeInfo()
    const deliveryInfo = getCustomerDeliveryRuntimeInfo()
    return {
      remoteApiInfo,
      deliveryInfo,
      enabled: Boolean(remoteApiInfo.enabled || deliveryInfo.enabled),
    }
  }, [])
  const [state, setState] = useState({
    phase: runtime.enabled ? "checking" : "ready",
    readiness: null,
    error: "",
  })

  const runCheck = useCallback(async () => {
    if (!runtime.enabled) {
      setState({ phase: "ready", readiness: null, error: "" })
      return
    }

    setState((current) => ({ ...current, phase: "checking", error: "" }))
    try {
      const readiness = await checkDeliveryReadiness()
      setState({
        phase: readiness?.status === "blocked" ? "blocked" : "ready",
        readiness,
        error: "",
      })
    } catch (error) {
      setState({
        phase: "error",
        readiness: null,
        error: error instanceof Error ? error.message : "托管服务连接失败",
      })
    }
  }, [runtime.enabled])

  useEffect(() => {
    void runCheck()
  }, [runCheck])

  if (!runtime.enabled || state.phase === "ready") {
    return children
  }

  const statusLabel =
    state.phase === "checking"
      ? "检测中"
      : state.phase === "error"
        ? "连接失败"
        : deliveryReadinessLabel(state.readiness?.status)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="app-panel-strong w-full max-w-2xl rounded-[18px] border px-6 py-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-[12px]",
              state.phase === "checking" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}>
            {state.phase === "checking" ? (
              <RefreshCwIcon className="size-6 animate-spin" />
            ) : (
              <WifiOffIcon className="size-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">
                {state.phase === "checking" ? "正在连接托管服务" : "无法连接托管服务"}
              </h1>
              <Badge variant={state.phase === "checking" ? "secondary" : "destructive"} className="rounded px-1.5 py-0.5 text-[10px]">
                {statusLabel}
              </Badge>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              客户端会先确认预配置后端、登录入口、对话网关、业务数据和知识库可用。检测通过后会自动进入 Crazor。
            </p>

            <div className="mt-4 grid gap-2 rounded-[10px] border border-border/70 bg-background/60 px-3 py-3 text-xs text-muted-foreground">
              <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
                <span>服务地址</span>
                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {runtime.remoteApiInfo.base || "当前同源服务"}
                </code>
              </div>
              <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
                <span>交付客户</span>
                <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {runtime.deliveryInfo.customerName || "未指定客户"}
                </code>
              </div>
              {runtime.deliveryInfo.buildSha ? (
                <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <span>构建版本</span>
                  <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {runtime.deliveryInfo.buildSha}
                  </code>
                </div>
              ) : null}
              {runtime.deliveryInfo.buildTime ? (
                <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
                  <span>构建时间</span>
                  <code className="min-w-0 break-all rounded bg-muted/55 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {runtime.deliveryInfo.buildTime}
                  </code>
                </div>
              ) : null}
            </div>

            {state.error ? (
              <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-destructive/25 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">{state.error}</span>
              </div>
            ) : null}

            {Array.isArray(state.readiness?.checks) && state.readiness.checks.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {state.readiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className="grid gap-2 rounded-[10px] border border-border/60 bg-muted/20 px-3 py-2 sm:grid-cols-[8rem_minmax(0,1fr)_3.25rem] sm:items-center">
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <CheckCircle2Icon
                        className={cn(
                          "size-3.5",
                          check.status === "ok" ? "text-emerald-500" : check.status === "warn" ? "text-amber-500" : "text-destructive"
                        )}
                      />
                      {check.label}
                    </span>
                    <span className="min-w-0 text-xs leading-5 text-muted-foreground">{check.detail}</span>
                    <Badge
                      variant={check.status === "error" ? "destructive" : check.status === "warn" ? "secondary" : "outline"}
                      className="w-fit rounded px-1.5 py-0.5 text-[10px]">
                      {deliveryCheckStatusLabel(check.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void runCheck()}
                disabled={state.phase === "checking"}
                className="rounded-md">
                <RefreshCwIcon className={cn("size-4", state.phase === "checking" && "animate-spin")} />
                重新检测
              </Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ServerIcon className="size-3.5" />
                后端恢复后无需重新安装客户端
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
