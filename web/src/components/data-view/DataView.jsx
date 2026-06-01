// Copyright (c) 2026 MeeJoy

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
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"
import { ViewFrame } from "@/components/view-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import DataForm from "./DataForm"
import DataGrid from "./DataGrid"
import DataKanban from "./DataKanban"
import DataDetail from "./DataDetail"

const VIEW_MODES = [
  { id: "grid", icon: Grid3x3Icon, label: "表格" },
  { id: "kanban", icon: KanbanIcon, label: "看板" },
]

export default function DataView({ config }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState("grid")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedItem, setSelectedItem] = useState(null)
  const [extraData, setExtraData] = useState(null)
  const [formState, setFormState] = useState({
    open: false,
    mode: "create",
    item: null,
  })

  const canCreate = Boolean(config.createFormExtra || config.formFields?.length)
  const canEdit = Boolean(config.editable && config.formFields?.length)
  const createAllowed = config.canCreate ? Boolean(config.canCreate({ items, extraData })) : true

  // Fetch main data
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set(config.filterParam || "status", filter)
      if (search) params.set("q", search)
      if (config.extraParams) {
        const ep = config.extraParams()
        for (const [k, v] of Object.entries(ep)) {
          if (v) params.set(k, v)
        }
      }
      const resp = await fetch(`${config.apiBase}?${params}`)
      if (resp.ok) setItems(await resp.json())
    } finally {
      setLoading(false)
    }
  }, [config.apiBase, config.filterParam, config.extraParams, filter, search])

  // Fetch extra data (charts, stats from other APIs)
  const loadExtra = useCallback(async () => {
    if (!config.loadExtra) return
    try {
      const data = await config.loadExtra()
      setExtraData(data)
    } catch { /* ignore */ }
  }, [config])

  useEffect(() => {
    void Promise.all([loadItems(), loadExtra()])
  }, [loadItems, loadExtra])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadItems(), loadExtra()])
  }, [loadItems, loadExtra])

  // Listen for external reload triggers (e.g. project selector change)
  useEffect(() => {
    const handler = () => {
      void Promise.all([loadItems(), loadExtra()])
    }
    window.addEventListener("dataview-reload", handler)
    return () => window.removeEventListener("dataview-reload", handler)
  }, [loadItems, loadExtra])

  // Update (for kanban drag)
  const handleMove = useCallback(async (item, from, to) => {
    const resp = await fetch(`${config.apiBase}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [config.kanban.laneKey]: to }),
    })
    if (resp.ok) {
      toast.success("状态已更新")
      await reloadAll()
    } else {
      toast.error(`更新失败 (${resp.status})`)
    }
  }, [config, reloadAll])

  // Delete
  const handleDelete = useCallback(async (item) => {
    if (!confirm("确定删除？")) return
    const resp = await fetch(`${config.apiBase}/${item.id}`, { method: "DELETE" })
    if (resp.ok) {
      toast.success("已删除")
      await reloadAll()
    } else {
      toast.error(`删除失败 (${resp.status})`)
    }
  }, [config, reloadAll])

  const openCreateForm = useCallback(() => {
    if (!canCreate || !createAllowed) return
    setFormState({ open: true, mode: "create", item: null })
  }, [canCreate, createAllowed])

  const openEditForm = useCallback((item) => {
    if (!canEdit) return
    setFormState({ open: true, mode: "edit", item })
  }, [canEdit])

  const closeForm = useCallback(() => {
    setFormState((current) => ({ ...current, open: false }))
  }, [])

  const parseErrorMessage = useCallback(async (resp) => {
    const body = await resp.json().catch(() => null)
    return body?.error || body?.message || `请求失败：${resp.status}`
  }, [])

  const handleCreate = useCallback(async (data) => {
    const payload = config.beforeCreate ? config.beforeCreate(data) : data
    const resp = await fetch(config.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      throw new Error(await parseErrorMessage(resp))
    }

    toast.success(config.createToast || "已创建")
    closeForm()
    await reloadAll()
  }, [closeForm, config, parseErrorMessage, reloadAll])

  const handleUpdate = useCallback(async (data) => {
    if (!formState.item?.id) return

    const payload = config.beforeUpdate ? config.beforeUpdate(data, formState.item) : data
    const resp = await fetch(`${config.apiBase}/${formState.item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      throw new Error(await parseErrorMessage(resp))
    }

    toast.success(config.updateToast || "已保存")
    closeForm()
    await reloadAll()
  }, [closeForm, config, formState.item, parseErrorMessage, reloadAll])

  const handleFormSubmit = useCallback(async (data) => {
    try {
      if (formState.mode === "edit") {
        await handleUpdate(data)
      } else {
        await handleCreate(data)
      }
    } catch (error) {
      toast.error(formState.mode === "edit" ? "保存失败" : "创建失败", {
        description: String(error?.message || error),
      })
    }
  }, [formState.mode, handleCreate, handleUpdate])

  // TanStack Table
  const columns = useMemo(() => config.columns, [config])
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Stats
  const stats = useMemo(() => config.stats?.(items, extraData) || {}, [config, items, extraData])

  const kanbanConfig = config.kanban

  // Allow config to inject extra actions next to view switcher
  const headerActions = config.headerActions ? config.headerActions({ items, extraData, stats, reload: reloadAll }) : null
  const formTitle = formState.mode === "edit"
    ? config.editDialogTitle || `编辑${config.title || "记录"}`
    : config.createDialogTitle || config.createLabel || `新增${config.title || "记录"}`
  const formDescription = formState.mode === "edit"
    ? config.editDialogDesc || "修改后保存即可同步到业务数据。"
    : config.createDialogDesc || "填写必要信息后保存。"
  const formContent = formState.mode === "create" && config.createFormExtra
    ? config.createFormExtra({ onSubmit: handleFormSubmit, onCancel: closeForm })
    : (
      <DataForm
        fields={config.formFields || []}
        initial={formState.mode === "edit" ? formState.item : undefined}
        onSubmit={handleFormSubmit}
        onCancel={closeForm}
        submitLabel={formState.mode === "edit" ? "保存" : (config.createSubmitLabel || "创建")}
      />
    )
  const detailConfig = {
    ...(config.detail || {}),
    detailExtra: config.detail?.detailExtra || config.detailExtra,
  }

  return (
    <ViewFrame
      icon={config.icon}
      badge={config.badge}
      title={config.title}
      description={config.description}
      actions={
        <div className="flex w-full items-center gap-2">
          {config.searchable !== false && (
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={config.searchPlaceholder || "搜索..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-[12px]"
              />
            </div>
          )}
          {headerActions}
          {canCreate && (
            <Button
              size="sm"
              onClick={openCreateForm}
              disabled={!createAllowed}
              title={!createAllowed ? config.createDisabledMessage || "当前条件下不能新增" : undefined}
              className="h-8 rounded-md px-2.5 text-[12px]"
            >
              <PlusIcon className="size-3.5" />
              {config.createLabel || "新增"}
            </Button>
          )}
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
                disabled={vm.id === "kanban" && !kanbanConfig}
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
        {config.statsCards && (
          <div className={cn("grid gap-3", config.statsGridCols || "grid-cols-2 lg:grid-cols-3")}>
            {config.statsCards(stats, extraData).map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        )}

        {/* Before grid/kanban: charts, project selector, etc */}
        {config.beforeGrid && config.beforeGrid({ items, extraData, stats })}

        {/* Filter tabs */}
        {config.filters && (
          <div className="flex gap-1.5">
            {config.filters.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "h-7 rounded-full px-3 text-[12px]",
                  filter === tab.id ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground",
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
            onEdit={canEdit ? openEditForm : undefined}
            onDelete={config.deletable ? handleDelete : undefined}
          />
        )}

        {viewMode === "kanban" && kanbanConfig && (
          <DataKanban
            items={items}
            lanes={kanbanConfig.lanes}
            laneKey={kanbanConfig.laneKey}
            renderCard={kanbanConfig.renderCard}
            onMove={handleMove}
          />
        )}

        {/* After grid/kanban: custom sections */}
        {config.afterGrid && config.afterGrid({ items, extraData, stats })}

        {loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
        )}
      </div>

      {/* Detail dialog */}
      <DataDetail
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        config={detailConfig}
        onReload={reloadAll}
        onItemUpdate={setSelectedItem}
      />

      <Dialog open={formState.open} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-h-[86vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{formDescription}</DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    </ViewFrame>
  )
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
