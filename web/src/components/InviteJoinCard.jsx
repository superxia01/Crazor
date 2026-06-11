import React, { useMemo } from "react"
import { UserPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CARD_COPY = {
  badge: "邀请码加入",
  nameLabel: "你的姓名",
  namePlaceholder: "输入你的姓名",
  codeLabel: "团队邀请码",
  codePlaceholder: "输入团队邀请码（czr_invite_...）",
  helper: "邀请码由团队管理员发放，加入后即可使用对应角色权限。",
  submitLabel: "使用邀请码加入",
  page: {
    title: "邀请码加入团队",
    description: "输入姓名和管理员发放的邀请码，加入团队并直接登录。",
  },
  dialog: {
    title: "邀请码加入团队",
    description: "如果管理员给了你团队邀请码，可在这里填写姓名后加入。",
  },
}

export function InviteJoinCard({
  context = "page",
  name,
  code,
  onNameChange,
  onCodeChange,
  onSubmit,
  loading = false,
  className,
}) {
  const copy = useMemo(
    () => ({ ...CARD_COPY, ...(CARD_COPY[context] ?? CARD_COPY.page) }),
    [context]
  )

  return (
    <section
      className={cn(
        "rounded-[1.2rem] border border-slate-200/88 bg-white/96 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-slate-700/72 dark:bg-slate-950/62 dark:shadow-[0_18px_36px_rgba(2,6,23,0.34)]",
        className
      )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/88 bg-primary/10 text-primary dark:border-slate-700/72 dark:bg-primary/14">
          <UserPlusIcon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/88 dark:text-primary/84">{copy.badge}</p>
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-foreground">{copy.nameLabel}</span>
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder={copy.namePlaceholder}
            className="h-11 rounded-xl border-slate-300/90 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 dark:border-slate-600/82 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-foreground">{copy.codeLabel}</span>
          <Input
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.codePlaceholder}
            className="h-11 rounded-xl border-slate-300/90 bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 dark:border-slate-600/82 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>

        <p className="text-[12px] leading-5 text-muted-foreground">{copy.helper}</p>

        <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl text-sm shadow-[0_10px_24px_rgba(37,99,235,0.22)]">
          {loading ? "正在加入" : copy.submitLabel}
        </Button>
      </form>
    </section>
  )
}
