import React, { useCallback, useEffect, useState } from "react"
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseTrigger,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
} from "@heroui/react"
import { storeCustomerLoginCredentials } from "@/api/crazor-auth"
import { buildWorkspaceEntryHref, resolveRequestedWorkspace } from "@/api/login-entry"
import { AccessCodeLoginCard } from "@/components/AccessCodeLoginCard"
import { InviteJoinCard } from "@/components/InviteJoinCard"

export function LoginDialog({ open, onOpenChange, onLogin }) {
  const requestedWorkspace = resolveRequestedWorkspace()
  const internalEntryRequested = requestedWorkspace === "internal"
  const [loading, setLoading] = useState(true)
  const [accessLoading, setAccessLoading] = useState(false)
  const [internalAccessLoading, setInternalAccessLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authStatus, setAuthStatus] = useState(null)
  const [accessCode, setAccessCode] = useState("")
  const [internalAccessCode, setInternalAccessCode] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteCode, setInviteCode] = useState("")

  const fetchLoginStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await fetch("/api/auth/status")
      const status = await resp.json()
      setAuthStatus(status)

      if (internalEntryRequested && !status.internalAccessCodeConfigured) {
        setError("当前环境未启用内部演示入口，请确认 CRAZOR_INTERNAL_ACCESS_CODE 已配置")
      } else if (!internalEntryRequested && !status.accessCodeConfigured) {
        setError("客户访问码未配置，请设置 CRAZOR_CUSTOMER_ACCESS_CODE")
      }
    } catch {
      setError("网络错误，请重试")
    } finally {
      setLoading(false)
    }
  }, [internalEntryRequested])

  useEffect(() => {
    if (open) {
      fetchLoginStatus()
    } else {
      setError(null)
      setAuthStatus(null)
      setAccessCode("")
      setInternalAccessCode("")
      setInviteName("")
      setInviteCode("")
      setAccessLoading(false)
      setInternalAccessLoading(false)
      setInviteLoading(false)
    }
  }, [open, fetchLoginStatus])

  const handleAccessCodeLogin = async (event) => {
    event.preventDefault()
    const code = accessCode.trim()
    if (!code) {
      setError("请输入客户访问码")
      return
    }
    try {
      setAccessLoading(true)
      setError(null)
      const resp = await fetch("/api/auth/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data.token) {
        setError(data.error || "客户访问码验证失败")
        return
      }
      storeCustomerLoginCredentials(data)
      onLogin()
      onOpenChange(false)
    } catch {
      setError("网络错误，请重试")
    } finally {
      setAccessLoading(false)
    }
  }

  const handleInternalAccessLogin = async (event) => {
    event.preventDefault()
    const code = internalAccessCode.trim()
    if (!code) {
      setError("请输入内部演示码")
      return
    }
    try {
      setInternalAccessLoading(true)
      setError(null)
      const resp = await fetch("/api/auth/internal-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data.token) {
        setError(data.error || "内部演示码验证失败")
        return
      }
      storeCustomerLoginCredentials(data)
      onLogin()
      onOpenChange(false)
    } catch {
      setError("网络错误，请重试")
    } finally {
      setInternalAccessLoading(false)
    }
  }

  const handleInviteRedeem = async (event) => {
    event.preventDefault()
    const name = inviteName.trim()
    const code = inviteCode.trim()
    if (!name || !code) {
      setError("请输入姓名和团队邀请码")
      return
    }
    try {
      setInviteLoading(true)
      setError(null)
      const resp = await fetch("/api/auth/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code, name }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data.token) {
        setError(data.error || "邀请码验证失败")
        return
      }
      storeCustomerLoginCredentials(data)
      onLogin()
      onOpenChange(false)
    } catch {
      setError("网络错误，请重试")
    } finally {
      setInviteLoading(false)
    }
  }

  const canUseAccessCode = !internalEntryRequested && Boolean(authStatus?.accessCodeConfigured)
  const canUseInternalAccessCode = internalEntryRequested && Boolean(authStatus?.internalAccessCodeConfigured)
  const canSwitchToInternalEntry = !internalEntryRequested && Boolean(authStatus?.internalAccessCodeConfigured)
  const internalEntryHref = buildWorkspaceEntryHref("internal")
  const customerEntryHref = buildWorkspaceEntryHref("customer")
  const title = internalEntryRequested ? "进入内部工作台" : "登录 Crazor"
  const description = internalEntryRequested ? "输入内部演示码继续" : "输入客户访问码继续"

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <ModalBackdrop />
      <ModalContainer size="sm">
        <ModalDialog>
          <ModalHeader>
            <ModalHeading className="flex items-center gap-2">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              {title}
            </ModalHeading>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground">{description}</p>

            {(canSwitchToInternalEntry || internalEntryRequested) && (
              <div className="flex items-center justify-center gap-3 text-xs">
                {canSwitchToInternalEntry && (
                  <a
                    href={internalEntryHref}
                    className="inline-flex items-center rounded-full border border-slate-300/88 bg-white/92 px-3 py-1.5 font-medium text-slate-700 transition hover:border-primary/48 hover:text-primary dark:border-slate-600/82 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:border-primary/44 dark:hover:text-primary"
                  >
                    团队内部入口
                  </a>
                )}
                {internalEntryRequested && (
                  <a
                    href={customerEntryHref}
                    className="inline-flex items-center rounded-full border border-slate-300/88 bg-white/92 px-3 py-1.5 font-medium text-slate-700 transition hover:border-primary/48 hover:text-primary dark:border-slate-600/82 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:border-primary/44 dark:hover:text-primary"
                  >
                    返回客户入口
                  </a>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {!loading && canUseAccessCode && (
              <AccessCodeLoginCard
                context="dialog"
                mode="customer"
                value={accessCode}
                onChange={setAccessCode}
                onSubmit={handleAccessCodeLogin}
                loading={accessLoading}
              />
            )}

            {!loading && canUseInternalAccessCode && (
              <AccessCodeLoginCard
                context="dialog"
                mode="internal"
                value={internalAccessCode}
                onChange={setInternalAccessCode}
                onSubmit={handleInternalAccessLogin}
                loading={internalAccessLoading}
              />
            )}

            {!loading && internalEntryRequested && (
              <InviteJoinCard
                context="dialog"
                name={inviteName}
                code={inviteCode}
                onNameChange={setInviteName}
                onCodeChange={setInviteCode}
                onSubmit={handleInviteRedeem}
                loading={inviteLoading}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <ModalCloseTrigger>关闭</ModalCloseTrigger>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </Modal>
  )
}
