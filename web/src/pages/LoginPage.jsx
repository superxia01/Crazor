import React, { useState, useEffect, useCallback } from 'react'
import { storeCustomerLoginCredentials } from '@/api/crazor-auth'
import { consumeLoginTokenFromLocation } from '@/api/login-token-redirect'
import { AccessCodeLoginCard } from '@/components/AccessCodeLoginCard'

export function LoginPage({ onLogin, allowSkip = true }) {
  const [qrUrl, setQrUrl] = useState(null)
  const [loginState, setLoginState] = useState("")
  const [loading, setLoading] = useState(true)
  const [accessLoading, setAccessLoading] = useState(false)
  const [error, setError] = useState(null)
  const [polling, setPolling] = useState(false)
  const [authStatus, setAuthStatus] = useState(null)
  const [accessCode, setAccessCode] = useState("")

  // Check URL for token (callback redirect)
  useEffect(() => {
    if (consumeLoginTokenFromLocation()) {
      onLogin()
      return
    }
  }, [onLogin])

  // Fetch WeChat login URL
  const fetchLoginUrl = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await fetch('/api/auth/status')
      const status = await resp.json()
      setAuthStatus(status)

      if (!status.wechatConfigured && !status.accessCodeConfigured) {
        setError('登录方式未配置，请设置 WECHAT_APP_ID / WECHAT_APP_SECRET 或 CRAZOR_CUSTOMER_ACCESS_CODE')
        setLoading(false)
        return
      }

      if (!status.wechatConfigured) return

      const urlResp = await fetch('/api/auth/wechat/url')
      const data = await urlResp.json()
      if (data.url && data.state) {
        setQrUrl(data.url)
        setLoginState(data.state)
        setPolling(true)
      } else {
        setError(data.error || '获取登录地址失败')
      }
    } catch (e) {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLoginUrl()
  }, [fetchLoginUrl])

  // Poll login status
  useEffect(() => {
    if (!polling || !loginState) return
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/auth/wechat/session/${encodeURIComponent(loginState)}`)
        const data = await resp.json()
        if (data.loggedIn && data.token) {
          storeCustomerLoginCredentials(data)
          setPolling(false)
          onLogin()
        } else if (data.expired) {
          setPolling(false)
          setError('登录二维码已过期，请刷新后重试')
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [loginState, polling, onLogin])

  // Handle WeChat login button
  const handleWechatLogin = () => {
    if (qrUrl) {
      window.open(qrUrl, '_blank', 'width=600,height=500')
      setPolling(true)
    }
  }

  const handleAccessCodeLogin = async (event) => {
    event.preventDefault()
    const code = accessCode.trim()
    if (!code) {
      setError('请输入客户访问码')
      return
    }
    try {
      setAccessLoading(true)
      setError(null)
      const resp = await fetch('/api/auth/access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data.token) {
        setError(data.error || '客户访问码验证失败')
        return
      }
      storeCustomerLoginCredentials(data)
      onLogin()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setAccessLoading(false)
    }
  }

  const canUseWechat = Boolean(authStatus?.wechatConfigured && qrUrl)
  const canUseAccessCode = Boolean(authStatus?.accessCodeConfigured)
  const pageSubtitle = canUseWechat
    ? canUseAccessCode
      ? '微信扫码或客户访问码均可登录'
      : '扫码即可开始使用'
    : canUseAccessCode
      ? '输入客户访问码后继续进入工作台'
      : '正在确认可用的登录方式'
  const pageHint = canUseWechat
    ? '推荐先使用微信扫码；如交付负责人已提供访问码，也可以直接登录。'
    : canUseAccessCode
      ? '本次交付未启用微信扫码，请使用交付负责人单独发放的客户访问码。'
      : '登录方式将在服务端准备完成后显示。'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_var(--background)_0%,_color-mix(in_srgb,var(--background)_82%,white_18%)_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_28%),linear-gradient(180deg,_var(--background)_0%,_color-mix(in_srgb,var(--background)_88%,black_12%)_100%)]">
      <div className="w-full max-w-lg">
        <div className="rounded-[2rem] border border-slate-200/88 bg-white/96 p-10 text-center shadow-[0_26px_80px_rgba(15,23,42,0.12)] dark:border-slate-700/72 dark:bg-slate-950/72 dark:shadow-[0_32px_96px_rgba(2,6,23,0.42)]">
          {/* Logo / Title */}
          <div className="mb-8">
            <div className="mx-auto mb-3 inline-flex rounded-full border border-primary/16 bg-primary/8 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary">
              客户认证
            </div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-primary/10 dark:border-slate-700/72 dark:bg-primary/14">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Crazor 数字员工系统</h1>
            <p className="mt-2 text-sm text-muted-foreground">{pageSubtitle}</p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-muted-foreground">{pageHint}</p>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* WeChat login button */}
          {!loading && !error && canUseWechat && (
            <div className="space-y-4">
              <button
                onClick={handleWechatLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#07C160] px-6 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 01.177-.554C23.025 18.265 24 16.573 24 14.71c0-3.38-3.125-5.852-7.062-5.852zm-2.095 2.926c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.19 0c.535 0 .969.44.969.982a.976.976 0 01-.97.983.976.976 0 01-.968-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                微信扫码登录
              </button>
            </div>
          )}

          {!loading && canUseWechat && canUseAccessCode && (
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border/70" />
              <span>或使用访问码</span>
              <div className="h-px flex-1 bg-border/70" />
            </div>
          )}

          {!loading && canUseAccessCode && (
            <AccessCodeLoginCard
              context="page"
              value={accessCode}
              onChange={setAccessCode}
              onSubmit={handleAccessCodeLogin}
              loading={accessLoading}
              className={canUseWechat ? "mt-0" : "mt-2"}
            />
          )}

          {/* Skip login (dev / no WeChat config) */}
          {!loading && allowSkip && (
            <button
              onClick={onLogin}
              className="mt-4 w-full rounded-xl border border-border px-6 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
            >
              直接进入（跳过登录）
            </button>
          )}

          {polling && (
            <p className="mt-4 text-xs text-muted-foreground animate-pulse">
              等待扫码确认...
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Crazor v1.0 · 企业 AI 操作系统
        </p>
      </div>
    </div>
  )
}
