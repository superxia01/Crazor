// Copyright (c) 2026 MeeJoy
// SchemaDataView — dynamic, schema-driven read-only data browser
// Fetches field definitions from API, generates columns/kanban/detail dynamically.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import {
  Grid3x3Icon,
  KanbanIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { ViewFrame } from "@/components/view-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import DataGrid from "./DataGrid"
import DataKanban from "./DataKanban"
import DataDetail from "./DataDetail"
import { generateColumns, getKanbanField, generateKanbanLanes } from "./generate-columns.jsx"

const VIEW_MODES = [
  { id: "grid", icon: Grid3x3Icon, label: "表格" },
  { id: "kanban", icon: KanbanIcon, label: "看板" },
]

/**
 * @param {object} props
 * @param {string} props.entity - Entity name (contacts/channels/transactions)
 * @param {string} props.apiBase - API base URL for data fetching
 * @param {object} [props.overrides] - Optional overrides for entity-specific features
 * @param {Function} [props.overrides.stats] - (items, extraData) => stats object
 * @param {Array}    [props.overrides.statsCards] - stats => card array
 * @param {string}   [props.overrides.statsGridCols] - grid cols class
 * @param {Array}    [props.overrides.filters] - filter tab definitions
 * @param {string}   [props.overrides.filterParam] - query param for filter
 * @param {Function} [props.overrides.loadExtra] - async () => extra data
 * @param {Function} [props.overrides.beforeGrid] - render before grid
 * @param {Function} [props.overrides.afterGrid] - render after grid
 * @param {object}   [props.overrides.headerActions] - render header actions
 * @param {object}   [props.overrides.detailOverrides] - overrides for DataDetail config
 * @param {Function} [props.overrides.detailExtra] - extra detail section component
 * @param {object}   [props.overrides.icon] - lucide icon
 * @param {string}   [props.overrides.badge] - badge label
 * @param {string}   [props.overrides.title] - view title
 * @param {string}   [props.overrides.description] - view description
 */
export default function SchemaDataView({ entity, apiBase, overrides = {} }) {
  const [fieldDefs, setFieldDefs] = useState([])
  const [items, setItems] = useState([])
  const [extraData, setExtraData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [viewMode, setViewMode] = useState("grid")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedItem, setSelectedItem] = useState(null)
  const [columnVisibility, setColumnVisibility] = useState({})

  // ── Fetch schema ──
  const loadSchema = useCallback(async () => {
    setSchemaLoading(true)
    try {
      const resp = await fetch(`/api/crazor/schema/${entity}`)
      if (resp.ok) {
        const defs = await resp.json()
        setFieldDefs(defs)
        // Default: hide non-visible fields
        const vis = {}
        defs.forEach((f) => {
          if (f.visible === 0) vis[f.field_key] = false
        })
        setColumnVisibility(vis)
      }
    } finally {
      setSchemaLoading(false)
    }
  }, [entity])

  // ── Fetch data ──
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set(overrides.filterParam || "status", filter)
      if (search) params.set("q", search)
      if (overrides.extraParams) {
        const ep = overrides.extraParams()
        for (const [k, v] of Object.entries(ep)) {
          if (v) params.set(k, v)
        }
      }
      const resp = await fetch(`${apiBase}?${params}`)
      if (resp.ok) setItems(await resp.json())
    } finally {
      setLoading(false)
    }
  }, [apiBase, overrides.filterParam, overrides.extraParams, filter, search])

  // ── Fetch extra data ──
  const loadExtra = useCallback(async () => {
    if (!overrides.loadExtra) return
    try {
      setExtraData(await overrides.loadExtra())
    } catch { /* ignore */ }
  }, [overrides.loadExtra])

  useEffect(() => {
    void Promise.all([loadSchema(), loadItems(), loadExtra()])
  }, [loadSchema, loadItems, loadExtra])

  // ── Reload on filter/search change ──
  useEffect(() => {
    void Promise.all([loadItems(), loadExtra()])
  }, [loadItems, loadExtra])

  // ── Kanban move (read-only: this does NOT write to DB) ──
  // In the read-only design, kanban drag is disabled by default.
  // If overrides.onKanbanMove is provided, it can handle the move.
  const kanbanField = useMemo(() => getKanbanField(fieldDefs), [fieldDefs])
  const kanbanLanes = useMemo(() => generateKanbanLanes(kanbanField), [kanbanField])

  const handleKanbanMove = useCallback(async (item, from, to) => {
    if (overrides.onKanbanMove) {
      await overrides.onKanbanMove(item, from, to)
      await Promise.all([loadItems(), loadExtra()])
    }
    // No-op in read-only mode
  }, [overrides.onKanbanMove, loadItems, loadExtra])

  // ── Generate TanStack columns from schema ──
  const columns = useMemo(() => {
    if (fieldDefs.length === 0) return []
    return generateColumns(fieldDefs, {
      cellOverrides: overrides.cellOverrides || {},
      hiddenFields: overrides.hiddenFields || [],
    })
  }, [fieldDefs, overrides.cellOverrides, overrides.hiddenFields])

  const table = useReactTable({
    data: items,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // ── Stats ──
  const stats = useMemo(
    () => overrides.stats?.(items, extraData) || {},
    [overrides, items, extraData],
  )

  // ── Detail config from schema ──
  const detailConfig = useMemo(() => {
    if (fieldDefs.length === 0) return null
    const titleField = fieldDefs.find((f) => f.render_hint === "title") || fieldDefs[0]
    return {
      detailMaxWidth: overrides.detailOverrides?.detailMaxWidth || "max-w-2xl",
      detailTitleKey: titleField?.field_key || "name",
      detailIcon: overrides.detailOverrides?.detailIcon,
      detailIconBg: overrides.detailOverrides?.detailIconBg,
      detailSubtitle: overrides.detailOverrides?.detailSubtitle,
      detailBadges: overrides.detailOverrides?.detailBadges,
      detailFields: fieldDefs
        .filter((f) => f.visible !== 0 && f.field_key !== titleField?.field_key)
        .map((f) => ({
          key: f.field_key,
          label: f.label,
          icon: getFieldIcon(f.field_type),
          render: getFieldRenderer(f),
        })),
      detailExtra: overrides.detailExtra,
    }
  }, [fieldDefs, overrides.detailOverrides, overrides.detailExtra])

  const headerActions = overrides.headerActions
    ? overrides.headerActions({ items, extraData, stats })
    : null

  return (
    <ViewFrame
      icon={overrides.icon}
      badge={overrides.badge}
      title={overrides.title}
      description={overrides.description}
      actions={
        <div className="flex w-full items-center gap-2">
          {overrides.searchable !== false && (
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={overrides.searchPlaceholder || "搜索..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-[12px]"
              />
            </div>
          )}
          {headerActions}
          {/* Column visibility toggle */}
          <ColumnVisibilityDropdown table={table} fieldDefs={fieldDefs} />
          {/* View switcher */}
          <div className="flex rounded-lg border p-0.5">
            {VIEW_MODES.map((vm) => (
              <Button
                key={vm.id}
                variant="ghost"
                size="sm"
                onClick={() => setViewMode(vm.id)}
                className={cn(
                  "h-7 px-2 text-[11px]",
                  viewMode === vm.id ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
                disabled={vm.id === "kanban" && !kanbanField}
              >
                <vm.icon className="size-3.5 mr-1" />
                {vm.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* Stats strip */}
        {overrides.statsCards && (
          <div className={cn("grid gap-3", overrides.statsGridCols || "grid-cols-2 lg:grid-cols-3")}>
            {overrides.statsCards(stats, extraData).map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        )}

        {/* Before grid */}
        {overrides.beforeGrid && overrides.beforeGrid({ items, extraData, stats })}

        {/* Filter tabs */}
        {overrides.filters && (
          <div className="flex gap-1.5">
            {overrides.filters.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "h-7 rounded-full px-3 text-[12px]",
                  filter === tab.id
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        {/* View content */}
        {viewMode === "grid" && (
          <DataGrid
            table={table}
            onView={(item) => setSelectedItem(item)}
          />
        )}

        {viewMode === "kanban" && kanbanField && (
          <DataKanban
            items={items}
            lanes={kanbanLanes}
            laneKey={kanbanField.field_key}
            renderCard={overrides.kanbanCard || defaultKanbanCard(fieldDefs)}
            onMove={handleKanbanMove}
          />
        )}

        {/* After grid */}
        {overrides.afterGrid && overrides.afterGrid({ items, extraData, stats })}

        {loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
        )}
      </div>

      {/* Detail dialog */}
      {detailConfig && (
        <DataDetail
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          config={detailConfig}
        />
      )}
    </ViewFrame>
  )
}

// ── Column visibility dropdown ────────────────────────────────

function ColumnVisibilityDropdown({ table, fieldDefs }) {
  const [open, setOpen] = useState(false)
  const visibleCols = table.getAllLeafColumns().filter((c) => {
    const f = fieldDefs.find((fd) => fd.field_key === c.id)
    return f && f.visible !== 0
  })

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => setOpen(!open)}
      >
        <Settings2Icon className="size-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border bg-popover p-2 shadow-md">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5">显示列</div>
            {visibleCols.map((col) => {
              const f = fieldDefs.find((fd) => fd.field_key === col.id)
              return (
                <label key={col.id} className="flex items-center gap-2 py-1 px-1 text-[12px] hover:bg-muted/50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="rounded"
                  />
                  {f?.label || col.id}
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Default kanban card renderer ──────────────────────────────

function defaultKanbanCard(fieldDefs) {
  const titleField = fieldDefs.find((f) => f.render_hint === "title") || fieldDefs[0]
  const badgeFields = fieldDefs.filter(
    (f) => f.field_type === "select" && f.field_key !== titleField?.field_key,
  ).slice(0, 2)
  const currencyField = fieldDefs.find((f) => f.field_type === "currency")

  return (item) => (
    <div className="rounded-lg border bg-card p-2.5 shadow-none hover:shadow-sm transition-shadow">
      <div className="text-[12px] font-medium">{item[titleField?.field_key] || `#${item.id}`}</div>
      {badgeFields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {badgeFields.map((f) =>
            item[f.field_key] ? (
              <Badge key={f.field_key} variant="outline" className="text-[10px] h-4">
                {item[f.field_key]}
              </Badge>
            ) : null,
          )}
        </div>
      )}
      {currencyField && item[currencyField.field_key] > 0 && (
        <div className="mt-1 text-[11px] font-medium text-primary">
          ¥{item[currencyField.field_key] >= 10000
            ? `${(item[currencyField.field_key] / 10000).toFixed(1)}万`
            : item[currencyField.field_key].toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function getFieldIcon(fieldType) {
  const icons = {
    text: null,
    number: null,
    select: null,
    date: null,
    checkbox: null,
    currency: null,
    textarea: null,
    relation: null,
  }
  return icons[fieldType] || null
}

function getFieldRenderer(fieldDef) {
  if (fieldDef.field_type === "currency") {
    return (v) => v ? `¥${v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString()}` : "-"
  }
  if (fieldDef.field_type === "checkbox") {
    return (v) => v ? "是" : "否"
  }
  if (fieldDef.field_type === "relation") {
    return (v) => v || "-"
  }
  return undefined // use default String(val)
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="shadow-none rounded-lg border bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className={cn("flex size-8 items-center justify-center rounded-lg bg-muted/60", color)}>
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-[12px] text-muted-foreground">{label}</div>
          <div className={cn("text-lg font-semibold", color)}>{value}</div>
        </div>
      </div>
    </div>
  )
}
