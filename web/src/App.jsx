// Copyright (c) 2026 MeeJoy

import React, { useState, useEffect, useCallback } from "react"
import { I18nProvider } from "@/i18n"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge"
import { AppInner } from "./AppInner"
import { CustomerDeliveryGate } from "./CustomerDeliveryGate"
import { LoginPage } from "./pages/LoginPage"
import { consumeLoginTokenFromLocation } from "./api/login-token-redirect"

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error("Render error:", error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="app-panel-strong max-w-2xl rounded-[2rem] p-8">
            <Badge variant="destructive" className="mb-4 rounded-full px-3 py-1 text-[11px]">
              {this.props.labels.badge}
            </Badge>
            <h2 className="text-2xl font-semibold text-foreground">{this.props.labels.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {this.state.error.message}
            </p>
            <details className="mt-6 overflow-hidden rounded-[1.4rem] border border-border/70 bg-background/70">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">
                {this.props.labels.stack}
              </summary>
              <pre className="overflow-auto border-t border-border/70 px-4 py-4 text-xs text-muted-foreground">
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  // userInfo: null = not logged in, { nickname, avatarUrl } = logged in
  const [userInfo, setUserInfo] = useState(null)
  const [authStatus, setAuthStatus] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const refreshAuth = useCallback(() => {
    setAuthReady(false)
    return Promise.all([
      fetch('/api/auth/status').then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/auth/me').then(r => (r.ok ? r.json() : { loggedIn: false })).catch(() => ({ loggedIn: false })),
    ])
      .then(([status, data]) => {
        setAuthStatus(status)
        if (data.loggedIn) {
          setUserInfo({ nickname: data.nickname, avatarUrl: data.avatarUrl })
        } else {
          setUserInfo(null)
        }
      })
      .catch(() => {
        setAuthStatus(null)
        setUserInfo(null)
      })
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    // Check if token exists in URL (callback redirect)
    consumeLoginTokenFromLocation()

    // Check auth status on mount
    void refreshAuth()

    // Listen for auth expiry
    const handleExpired = () => setUserInfo(null)
    window.addEventListener('crazor:auth-expired', handleExpired)
    return () => window.removeEventListener('crazor:auth-expired', handleExpired)
  }, [refreshAuth])

  const handleLogin = useCallback(() => {
    void refreshAuth()
  }, [refreshAuth])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('crazor_token')
    setUserInfo(null)
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }, [])

  const loginRequired = Boolean(authStatus?.loginRequired)
  const showLoginGate = authReady && loginRequired && !userInfo

  return (
    <I18nProvider>
      <TooltipProvider delayDuration={0}>
        <ErrorBoundary
          labels={{
            badge: "渲染异常",
            title: "界面渲染失败",
            stack: "查看组件堆栈",
          }}>
          <Toaster richColors closeButton />
          <CustomerDeliveryGate>
            {!authReady ? (
              <AuthLoading />
            ) : showLoginGate ? (
              <LoginPage onLogin={handleLogin} allowSkip={false} />
            ) : (
              <AppInner
                userInfo={userInfo}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
            )}
          </CustomerDeliveryGate>
        </ErrorBoundary>
      </TooltipProvider>
    </I18nProvider>
  )
}

function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="app-panel-strong flex w-full max-w-sm items-center gap-3 rounded-[18px] border px-5 py-4 shadow-lg">
        <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <div>
          <h1 className="text-sm font-semibold">正在确认登录状态</h1>
          <p className="mt-1 text-xs text-muted-foreground">连接托管服务并校验当前客户端身份。</p>
        </div>
      </section>
    </main>
  )
}
