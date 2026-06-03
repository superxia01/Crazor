// Copyright (c) 2026 MeeJoy

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
import { cn } from "@/lib/utils"

// Keys to skip when rendering custom fields
const SKIP_KEYS = new Set([
  "id", "created_at", "updated_at", "custom_data", "tags",
])

export default function DataDetail({ open, onClose, item, config }) {
  if (!item || !config) return null

  // Collect known field keys from config
  const knownKeys = new Set((config.detailFields || []).map((f) => f.key))
  // Also skip the title field (it's shown in the header)
  if (config.detailTitleKey) knownKeys.add(config.detailTitleKey)
  // Collect badge labels to skip
  const badgeKeys = new Set()
  if (config.detailBadges) {
    // badges render status/stage/source etc, skip from custom
    for (const k of ["status", "stage", "source", "level", "type", "rating", "is_public", "cooperation_mode"]) {
      badgeKeys.add(k)
    }
  }

  // Find custom fields: any key on item not in known, badge, or skip set
  const customFields = Object.entries(item).filter(([k, v]) =>
    !SKIP_KEYS.has(k) &&
    !knownKeys.has(k) &&
    !badgeKeys.has(k) &&
    v !== undefined && v !== null && v !== ""
  )

  return (
    <Modal isOpen={open} onOpenChange={onClose}>
      <ModalBackdrop />
      <ModalContainer size="md">
        <ModalDialog>
          <ModalHeader>
            <ModalHeading className="flex items-center gap-3">
              {config.detailIcon && (
                <div className={cn("flex size-10 items-center justify-center rounded-lg", config.detailIconBg || "bg-primary/10 text-primary")}>
                  <config.detailIcon className="size-5" />
                </div>
              )}
              <div>
                <div>{item[config.detailTitleKey] || config.detailTitle || "详情"}</div>
                {config.detailSubtitle && (
                  <p className="text-[12px]">{config.detailSubtitle(item)}</p>
                )}
              </div>
            </ModalHeading>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Badges */}
              {config.detailBadges && (
                <div className="flex flex-wrap gap-1.5">
                  {config.detailBadges(item).filter(Boolean).map((b, i) => (
                    <span key={i} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", b.cls)}>{b.label}</span>
                  ))}
                </div>
              )}

              {/* Known fields grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                {config.detailFields.map((f) => {
                  const val = item[f.key]
                  if (val === undefined || val === null || val === "") return null
                  return (
                    <div key={f.key} className="text-muted-foreground">
                      {f.icon && <f.icon className="inline size-3.5 mr-1.5 -mt-0.5" />}
                      {f.label}: <span className="text-foreground font-medium">{f.render ? f.render(val, item) : String(val)}</span>
                    </div>
                  )
                })}
              </div>

              {/* Custom fields (from custom_data) */}
              {customFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] border-t pt-3">
                  <div className="col-span-2 mb-1 text-[11px] font-medium text-muted-foreground">自定义字段</div>
                  {customFields.map(([k, v]) => (
                    <div key={k} className="text-muted-foreground">
                      {k}: <span className="text-foreground font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Extra sections (e.g. follow-ups, referrals) */}
              {config.detailExtra && (
                typeof config.detailExtra === "function"
                  ? <config.detailExtra item={item} />
                  : config.detailExtra
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalCloseTrigger>关闭</ModalCloseTrigger>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </Modal>
  )
}
