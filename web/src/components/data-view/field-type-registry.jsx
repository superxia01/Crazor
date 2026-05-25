// Copyright (c) 2026 MeeJoy
// Field type registry — maps field_type strings to render/filter components
// All cells are read-only. No editors needed.

import { BadgeCell, CurrencyCell } from "./DataGrid"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CheckCircle2Icon,
  XCircleIcon,
  ExternalLinkIcon,
} from "lucide-react"

// ── Cell renderers (read-only) ────────────────────────────────

function TextCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  return <span>{String(value)}</span>
}

function TitleCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  return <span className="font-medium">{String(value)}</span>
}

function NumberCell({ value }) {
  if (value == null) return <span className="text-muted-foreground">-</span>
  return <span className="font-medium tabular-nums">{Number(value).toLocaleString()}</span>
}

function SelectCell({ value, options = [] }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  // Find matching option for color
  const opt = options.find((o) => (o.value ?? o) === value)
  const color = opt?.color
  if (color) return <BadgeCell value={String(value)} colorMap={{ [String(value)]: color }} />
  return <Badge variant="outline" className="text-[10px] h-4">{String(value)}</Badge>
}

function DateCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  // Show YYYY-MM-DD or short date
  const d = String(value).slice(0, 10)
  return <span className="tabular-nums">{d}</span>
}

function CheckboxCell({ value }) {
  if (value) return <CheckCircle2Icon className="size-4 text-emerald-500" />
  return <XCircleIcon className="size-4 text-zinc-300" />
}

function CurrencyCellLocal({ value }) {
  return <CurrencyCell value={value} />
}

function TextareaCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  const text = String(value)
  if (text.length > 40) return <span title={text}>{text.slice(0, 40)}…</span>
  return <span>{text}</span>
}

function RelationCell({ value, relationEntity }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  return (
    <span className="inline-flex items-center gap-1 text-primary">
      {String(value)}
      <ExternalLinkIcon className="size-3" />
    </span>
  )
}

// ── Filter UI components ──────────────────────────────────────
// For now, simple text/selection filters. TanStack Table column filters.

function TextFilter({ column }) {
  const value = column.getFilterValue() || ""
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => column.setFilterValue(e.target.value)}
      placeholder="筛选..."
      className="h-6 w-full rounded border px-2 text-[11px]"
    />
  )
}

function SelectFilter({ column, options = [] }) {
  const value = column.getFilterValue() || ""
  return (
    <select
      value={value}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      className="h-6 w-full rounded border px-1 text-[11px]"
    >
      <option value="">全部</option>
      {options.map((o) => {
        const val = typeof o === "object" ? o.value : o
        const label = typeof o === "object" ? o.label : o
        return <option key={val} value={val}>{label}</option>
      })}
    </select>
  )
}

// ── Registry ──────────────────────────────────────────────────
// Maps field_type → { Cell, Filter } components

const REGISTRY = {
  text: {
    Cell: TextCell,
    Filter: TextFilter,
  },
  number: {
    Cell: NumberCell,
    Filter: TextFilter, // could be range, but text works for basic
  },
  select: {
    Cell: SelectCell,
    Filter: SelectFilter,
  },
  date: {
    Cell: DateCell,
    Filter: TextFilter,
  },
  checkbox: {
    Cell: CheckboxCell,
    Filter: SelectFilter,
    filterOptions: [
      { value: "true", label: "是" },
      { value: "false", label: "否" },
    ],
  },
  currency: {
    Cell: CurrencyCellLocal,
    Filter: TextFilter,
  },
  textarea: {
    Cell: TextareaCell,
    Filter: TextFilter,
  },
  relation: {
    Cell: RelationCell,
    Filter: null, // no filter for relation fields
  },
}

export function getRegistry() {
  return REGISTRY
}

export function getCellRenderer(fieldType) {
  return REGISTRY[fieldType]?.Cell || TextCell
}

export function getFilterComponent(fieldType) {
  return REGISTRY[fieldType]?.Filter || TextFilter
}

export default REGISTRY
