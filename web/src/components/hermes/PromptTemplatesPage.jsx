// Copyright (c) 2026 MeeJoy

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpenIcon,
  CheckCircleIcon,
  CrownIcon,
  DatabaseIcon,
  FilterIcon,
  GlobeIcon,
  PlugIcon,
  SearchIcon,
  ServerIcon,
  TagIcon,
  UnlockIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ViewFrame } from "@/components/view-frame"
import { cn } from "@/lib/utils"

// --- Categories & Filters ---

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "运营", label: "运营" },
  { id: "内容", label: "内容" },
  { id: "客户", label: "客户" },
  { id: "管理", label: "管理" },
  { id: "跨境", label: "跨境" },
  { id: "编程", label: "编程" },
  { id: "通用", label: "通用" },
  { id: "基础", label: "基础" },
]

const TYPE_FILTERS = [
  { id: "all", label: "全部", icon: FilterIcon },
  { id: "free", label: "免费", icon: UnlockIcon },
  { id: "paid", label: "付费", icon: CrownIcon },
]

function normalizeText(value) {
  return String(value || "").trim().toLowerCase()
}

function itemMatchesQuery(item, query) {
  const normalized = normalizeText(query)
  if (!normalized) return true
  return [
    item?.name, item?.description, item?.category,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ].some((field) => normalizeText(field).includes(normalized))
}

const META_SECTION = [
  { key: "mcpTools", label: "MCP 工具", icon: WrenchIcon, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "apis", label: "内部 API", icon: ServerIcon, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "dbTables", label: "数据表", icon: DatabaseIcon, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "externalApis", label: "外部 API", icon: GlobeIcon, color: "bg-orange-100 text-orange-700 border-orange-200" },
]

function SkillMetaPanel({ meta, trigger, onClose }) {
  if (!meta) return null
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">{meta.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Trigger */}
      {trigger && (
        <div className="px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <PlugIcon className="size-3.5 text-muted-foreground" />触发方式
          </div>
          <p className="text-sm text-muted-foreground">{trigger}</p>
        </div>
      )}

      {/* Architecture sections */}
      <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
        {META_SECTION.map(({ key, label, icon: Icon, color }) => {
          const items = meta[key]
          if (!items || items.length === 0) return null
          return (
            <div key={key}>
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Icon className="size-3.5 text-muted-foreground" />{label}
                <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <Badge key={item} variant="outline" className={cn("text-xs font-mono", color)}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )
        })}

        {/* Architecture summary */}
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">架构概览</p>
            <p>Skill 定义 → MCP Tools ({meta.mcpTools?.length ?? 0}) → API ({meta.apis?.length ?? 0}) → DB ({meta.dbTables?.length ?? 0})</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, installed, onInstall, busy, onSelect, selected }) {
  const type = template.type
  const isPaid = type === "paid"
  const isFree = type === "free"
  const isInstalled = isFree && installed

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer",
      isPaid && "border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30",
      isInstalled && "border-emerald-200/60",
      selected && "ring-2 ring-primary",
    )} onClick={() => onSelect?.(template)}>
      {isInstalled && (
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircleIcon className="size-3 mr-1" />已安装
          </Badge>
        </div>
      )}
      {isPaid && (
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
            <CrownIcon className="size-3 mr-1" />¥{template.price}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {template.name}
          {isFree && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">免费</span>}
          {isPaid && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">付费</span>}
        </CardTitle>
        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {template.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              <TagIcon className="size-3 mr-1" />{tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {template.trigger && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
            触发：{template.trigger}
          </p>
        )}
        {isPaid && template.features && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.features.map((f) => (
              <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
            ))}
          </div>
        )}
        <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onInstall?.(template) }}
          disabled={isInstalled || busy}
          variant={isInstalled ? "outline" : "default"}>
          {busy ? "安装中..." : isInstalled ? "已安装" : "安装使用"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function PromptTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [catalog, setCatalog] = useState([])
  const [installedIds, setInstalledIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedMeta, setSelectedMeta] = useState(null)
  const [metaLoading, setMetaLoading] = useState(false)

  const loadCatalog = useCallback(async () => {
    try {
      const resp = await fetch("/api/crazor/skills/catalog")
      if (resp.ok) setCatalog(await resp.json())
    } catch { /* ignore */ }
  }, [])

  const loadInstalled = useCallback(async () => {
    try {
      const resp = await fetch("/api/crazor/skills/installed")
      if (resp.ok) setInstalledIds(new Set(await resp.json()))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void loadCatalog(); void loadInstalled() }, [loadCatalog, loadInstalled])

  const allTemplates = useMemo(() => {
    const paidSkills = catalog.map((s) => ({ ...s, type: "paid" }))
    return [...paidSkills]
  }, [catalog])

  const filteredTemplates = useMemo(() => {
    let templates = allTemplates
    if (activeCategory !== "all") templates = templates.filter((t) => t.category === activeCategory)
    if (typeFilter !== "all") templates = templates.filter((t) => t.type === typeFilter)
    if (searchQuery) templates = templates.filter((t) => itemMatchesQuery(t, searchQuery))
    return templates
  }, [activeCategory, typeFilter, searchQuery, allTemplates])

  const counts = useMemo(() => {
    const byCategory = activeCategory === "all" ? allTemplates : allTemplates.filter((t) => t.category === activeCategory)
    return {
      all: byCategory.length,
      free: byCategory.filter((t) => t.type === "free").length,
      paid: byCategory.filter((t) => t.type === "paid").length,
    }
  }, [activeCategory, allTemplates])

  const handleInstall = useCallback(async (template) => {
    setBusyId(template.id)
    try {
      const resp = await fetch("/api/crazor/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      })
      const result = await resp.json()
      if (result.success) {
        toast.success(`${template.name} 已安装为技能`)
        await loadInstalled()
      } else {
        toast.error(result.error || "安装失败")
      }
    } catch (err) {
      toast.error("安装失败", { description: String(err) })
    } finally {
      setBusyId(null)
    }
  }, [loadInstalled])

  // Find the trigger string from catalog for a paid skill
  const catalogMap = useMemo(() => new Map(catalog.map((s) => [s.id, s])), [catalog])

  const handleSelect = useCallback(async (template) => {
    if (template.type !== "paid") return
    if (selectedId === template.id) {
      setSelectedId(null)
      setSelectedMeta(null)
      return
    }
    setSelectedId(template.id)
    setMetaLoading(true)
    try {
      const resp = await fetch(`/api/crazor/skills/meta/${encodeURIComponent(template.id)}`)
      if (resp.ok) {
        setSelectedMeta(await resp.json())
      } else {
        setSelectedMeta(null)
      }
    } catch {
      setSelectedMeta(null)
    } finally {
      setMetaLoading(false)
    }
  }, [selectedId])

  const selectedTrigger = selectedId ? catalogMap.get(selectedId)?.trigger : null

  return (
    <ViewFrame title="AI数字员工" description="安装和管理AI数字员工，提升工作效率">
      <div className="flex-1 overflow-hidden relative flex">
      {/* Main content */}
      <div className={`flex-1 overflow-auto p-4 md:p-6 transition-all duration-200 ${selectedId ? "mr-0 md:mr-[420px]" : ""}`}>
        {/* Row 1: Category by function */}
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map((cat) => (
            <Button key={cat.id} variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm" onClick={() => setActiveCategory(cat.id)}>
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Row 2: Type filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TYPE_FILTERS.map((f) => {
            const Icon = f.icon
            const active = typeFilter === f.id
            const colorMap = {
              all: "",
              free: active ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200" : "",
              paid: active ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200" : "",
            }
            const badgeColorMap = {
              free: "bg-emerald-200 text-emerald-800",
              paid: "bg-amber-200 text-amber-800",
            }
            return (
              <Button key={f.id} variant={active ? "outline" : "ghost"}
                size="sm" onClick={() => setTypeFilter(f.id)}
                className={cn("flex items-center gap-1.5", colorMap[f.id])}>
                <Icon className="size-3.5" />{f.label}
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded ml-1",
                  active && f.id !== "all" ? badgeColorMap[f.id] : "bg-muted text-muted-foreground"
                )}>{counts[f.id]}</span>
              </Button>
            )
          })}
        </div>

        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="搜索数字员工..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template}
              installed={installedIds.has(template.id)}
              busy={busyId === template.id}
              selected={selectedId === template.id}
              onInstall={handleInstall}
              onSelect={handleSelect} />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <SearchIcon className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">没有找到匹配的数字员工</h3>
            <p className="text-muted-foreground mt-1">尝试调整搜索条件或选择其他筛选</p>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {selectedId && !metaLoading && selectedMeta && (
        <SkillMetaPanel
          meta={selectedMeta}
          trigger={selectedTrigger}
          onClose={() => { setSelectedId(null); setSelectedMeta(null) }}
        />
      )}
      </div>
    </ViewFrame>
  )
}
