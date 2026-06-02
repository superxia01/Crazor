import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { setCrazorAuthToken } from '@/api/crazor-auth'

export function LoginDialog({ open, onOpenChange, onLogin }) {
  const [qrUrl, setQrUrl] = useState(null)
  const [loginState, setLoginState] = useState("")
  const [loading, setLoading] = useState(true)
  const [accessLoading, setAccessLoading] = useState(false)
  const [error, setError] = useState(null)
  const [polling, setPolling] = useState(false)
  const [authStatus, setAuthStatus] = useState(null)
  const [accessCode, setAccessCode] = useState("")

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
        setPolling(false)
      } else {
        setError(data.error || '获取登录地址失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch login URL when dialog opens
  useEffect(() => {
    if (open) {
      fetchLoginUrl()
    } else {
      setQrUrl(null)
      setLoginState("")
      setError(null)
      setPolling(false)
      setAuthStatus(null)
      setAccessCode("")
      setAccessLoading(false)
    }
  }, [open, fetchLoginUrl])

  // Poll login status
  useEffect(() => {
    if (!polling || !loginState) return
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/auth/wechat/session/${encodeURIComponent(loginState)}`)
        const data = await resp.json()
        if (data.loggedIn && data.token) {
          localStorage.setItem('crazor_token', data.token)
          if (data.actor_token || data.actorToken) setCrazorAuthToken(data.actor_token || data.actorToken)
          setPolling(false)
          onLogin()
          onOpenChange(false)
        } else if (data.expired) {
          setPolling(false)
          setError('登录二维码已过期，请重新打开登录窗口')
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [loginState, polling, onLogin, onOpenChange])

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
      localStorage.setItem('crazor_token', data.token)
      if (data.actor_token || data.actorToken) setCrazorAuthToken(data.actor_token || data.actorToken)
      setPolling(false)
      onLogin()
      onOpenChange(false)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setAccessLoading(false)
    }
  }

  const canUseWechat = Boolean(authStatus?.wechatConfigured && qrUrl)
  const canUseAccessCode = Boolean(authStatus?.accessCodeConfigured)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            登录 Crazor
          </DialogTitle>
          <DialogDescription>使用微信或客户访问码继续</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Error state */}
          {error && (
            <div className="mb-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* WeChat login button */}
          {!loading && canUseWechat && (
            <button
              onClick={handleWechatLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#07C160] px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.492.492 0 01.177-.554C23.025 18.265 24 16.573 24 14.71c0-3.38-3.125-5.852-7.062-5.852zm-2.095 2.926c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.19 0c.535 0 .969.44.969.982a.976.976 0 01-.97.983.976.976 0 01-.968-.983c0-.542.434-.982.969-.982z"/>
              </svg>
              微信扫码登录
            </button>
          )}

          {!loading && canUseAccessCode && (
            <form className="mt-4 space-y-3" onSubmit={handleAccessCodeLogin}>
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                type="password"
                autoComplete="one-time-code"
                placeholder="输入客户访问码"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="submit"
                disabled={accessLoading}
                className="flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accessLoading ? '正在验证' : '使用访问码登录'}
              </button>
            </form>
          )}

          {/* Polling indicator */}
          {polling && (
            <p className="mt-4 text-center text-xs text-muted-foreground animate-pulse">
              等待扫码确认...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
