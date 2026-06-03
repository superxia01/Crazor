import React, { useMemo, useState } from "react"
import { EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CARD_COPY = {
  customer: {
    badge: "客户认证",
    label: "客户访问码",
    helper: "访问码由交付负责人单独发放，可随时更换。",
    placeholder: "输入客户访问码",
    submitLabel: "使用访问码登录",
    page: {
      title: "客户访问码登录",
      description: "输入交付给你的客户访问码后即可进入工作台。",
    },
    dialog: {
      title: "客户访问码",
      description: "如果本次交付使用访问码登录，可直接在这里完成验证。",
    },
  },
  internal: {
    badge: "内部演示",
    label: "内部演示码",
    helper: "仅供 CRAZYAIGC 团队成员进入内部后台与连接器配置界面。",
    placeholder: "输入内部演示码",
    submitLabel: "进入内部工作台",
    page: {
      title: "内部演示入口",
      description: "使用内部演示码进入完整后台，用于飞书配置、流程演示和现场支持。",
    },
    dialog: {
      title: "内部演示码",
      description: "当前正在使用内部入口，请输入演示码恢复后台访问。",
    },
  },
}

export function AccessCodeLoginCard({
  context = "page",
  mode = "customer",
  value,
  onChange,
  onSubmit,
  loading = false,
  className,
}) {
  const [revealed, setRevealed] = useState(false)
  const copy = useMemo(() => {
    const variant = CARD_COPY[mode] ?? CARD_COPY.customer
    return {
      ...variant,
      ...(variant[context] ?? variant.page),
    }
  }, [context, mode])

  return (
    <section
      className={cn(
        "rounded-[1.2rem] border border-slate-200/88 bg-white/96 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-slate-700/72 dark:bg-slate-950/62 dark:shadow-[0_18px_36px_rgba(2,6,23,0.34)]",
        className
      )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/88 bg-primary/10 text-primary dark:border-slate-700/72 dark:bg-primary/14">
          <KeyRoundIcon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/88 dark:text-primary/84">{copy.badge}</p>
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-foreground">{copy.label}</span>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            type={revealed ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.placeholder}
            className="h-11 rounded-xl border-slate-300/90 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 dark:border-slate-600/82 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] leading-5 text-muted-foreground">{copy.helper}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-300/90 bg-white/92 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-600/82 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? "隐藏访问码" : "显示访问码"}
            title={revealed ? "隐藏访问码" : "显示访问码"}>
            {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            {revealed ? "隐藏访问码" : "显示访问码"}
          </Button>
        </div>

        <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl text-sm shadow-[0_10px_24px_rgba(37,99,235,0.22)]">
          {loading ? "正在验证" : copy.submitLabel}
        </Button>
      </form>
    </section>
  )
}
