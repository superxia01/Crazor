// Copyright (c) 2026 MeeJoy

import { useState, useCallback } from "react"
import { GlobeIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

const CLAW3D_URL = "http://localhost:3000"

export default function OfficeView() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleReload = useCallback(() => {
    setError(false)
    setLoading(true)
    const iframe = document.querySelector("#claw3d-iframe")
    if (iframe) {
      iframe.src = CLAW3D_URL
    }
  }, [])

  const handleOpenExternal = useCallback(() => {
    window.open(CLAW3D_URL, "_blank")
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <GlobeIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">3D 办公室</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            BETA
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={handleReload}>
            <RefreshCwIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleOpenExternal}>
            <ExternalLinkIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* iframe container */}
      <div className="relative flex-1">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading 3D Office...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3 max-w-md text-center px-4">
              <GlobeIcon className="size-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">3D 办公室未启动</h3>
              <p className="text-sm text-muted-foreground">
                请先启动 Claw3D 服务：
              </p>
              <code className="rounded bg-muted px-3 py-1.5 text-xs">
                cd ~/Documents/GitHub/hermes-office && npm run dev
              </code>
              <Button variant="outline" size="sm" onClick={handleReload}>
                <RefreshCwIcon className="mr-2 size-3.5" />
                重试
              </Button>
            </div>
          </div>
        )}

        <iframe
          id="claw3d-iframe"
          src={CLAW3D_URL}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write"
          onLoad={() => {
            setLoading(false)
            setError(false)
          }}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
        />
      </div>
    </div>
  )
}
