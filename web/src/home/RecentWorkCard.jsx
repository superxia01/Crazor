// Copyright (c) 2026 MeeJoy

import { HistoryIcon, FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PanelShell, SoftIcon, WorkRow, EmptyState, formatCompactTime } from "./shared"

function RecentWorkGroup({ title, actionLabel, items, icon, emptyTitle, emptyDescription, onAction, renderItem, className }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <SoftIcon icon={icon} tone="slate" className="size-6 rounded-md" />
          <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        </div>
        <Button variant="ghost" size="xs" onClick={onAction}>{actionLabel}</Button>
      </div>
      <div className="max-h-48 overflow-auto">
        {items.length > 0 ? items.map(renderItem) : (
          <EmptyState title={emptyTitle} description={emptyDescription} actionLabel={actionLabel} onAction={onAction} />
        )}
      </div>
    </div>
  )
}

export default function RecentWorkCard({
  sessions = [], notes = [], language,
  onSelectSession, onSelectNote, onOpenSessions, onOpenNotebook, t,
}) {
  return (
    <PanelShell className="sm:col-span-2 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <SoftIcon icon={HistoryIcon} tone="sky" className="size-8" />
          <div>
            <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">{t("home.continueWork")}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{t("home.continueWorkDescription")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="rounded-lg bg-white text-[11px] dark:bg-white/[0.04]" onClick={onOpenSessions}>
            {t("home.openSessions")}
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg bg-white text-[11px] dark:bg-white/[0.04]" onClick={onOpenNotebook}>
            {t("home.openNotebook")}
          </Button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 flex-1">
        <RecentWorkGroup
          title={t("home.recentConversations")}
          actionLabel={t("home.openSessions")}
          items={sessions}
          icon={HistoryIcon}
          emptyTitle={t("home.emptyConversations")}
          emptyDescription={t("home.emptyConversationsDescription")}
          onAction={onOpenSessions}
          renderItem={(session) => (
            <WorkRow
              key={session.id}
              icon={HistoryIcon}
              title={String(session.title || "").trim() || t("app.newConversationTitle")}
              meta={formatCompactTime(session.updated_at, language)}
              onClick={() => onSelectSession?.(session)}
            />
          )}
        />
        <RecentWorkGroup
          title={t("home.recentNotes")}
          actionLabel={t("home.openNotebook")}
          items={notes}
          icon={FileTextIcon}
          emptyTitle={t("home.emptyNotes")}
          emptyDescription={t("home.emptyNotesDescription")}
          onAction={onOpenNotebook}
          className="border-t border-slate-100 dark:border-white/10 md:border-l md:border-t-0"
          renderItem={(note) => (
            <WorkRow
              key={note.id}
              icon={FileTextIcon}
              title={String(note.title || "").trim() || t("notebook.untitled")}
              meta={formatCompactTime(note.updated_at, language)}
              onClick={() => onSelectNote?.(note)}
            />
          )}
        />
      </div>
    </PanelShell>
  )
}
