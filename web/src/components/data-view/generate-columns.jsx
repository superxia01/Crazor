// Copyright (c) 2026 MeeJoy
// Generate TanStack Table columns from field_definitions schema

import REGISTRY, { getCellRenderer, getFilterComponent } from "./field-type-registry"

/**
 * Generate TanStack Table column definitions from field_definitions.
 * @param {Array} fieldDefs - Array of field definition objects from API
 * @param {object} options - Optional overrides
 * @param {Function} options.onView - Click handler for row view action
 * @param {Array} options.hiddenFields - Field keys to skip
 * @param {object} options.cellOverrides - Per-field cell render overrides { fieldKey: CellComponent }
 * @returns {Array} TanStack Table column definitions
 */
export function generateColumns(fieldDefs, options = {}) {
  const { hiddenFields = [], cellOverrides = {} } = options

  return fieldDefs
    .filter((f) => f.visible !== 0 && !hiddenFields.includes(f.field_key))
    .map((f) => {
      const Cell = cellOverrides[f.field_key] || getCellRenderer(f.field_type)
      const Filter = f.filterable ? getFilterComponent(f.field_type) : undefined
      const options = parseOptions(f.options)

      const col = {
        accessorKey: f.field_key,
        header: f.label,
        enableSorting: !!f.sortable,
        enableColumnFilter: !!f.filterable,
        size: f.width || 150,
        minSize: 60,
      }

      // Cell renderer
      col.cell = ({ getValue, row }) => {
        const value = getValue()
        const props = { value }
        if (f.field_type === "select") props.options = options
        if (f.field_type === "relation") props.relationEntity = f.relation_entity
        if (f.render_hint === "title") return REGISTRY.text.Cell === Cell ? <TitleCell value={value} /> : <Cell {...props} />
        return <Cell {...props} />
      }

      // Filter function
      if (Filter && f.filterable) {
        if (f.field_type === "select") {
          col.filterFn = (row, columnId, filterValue) => {
            if (!filterValue) return true
            return String(row.getValue(columnId)) === String(filterValue)
          }
        } else if (f.field_type === "checkbox") {
          col.filterFn = (row, columnId, filterValue) => {
            if (!filterValue) return true
            const val = row.getValue(columnId)
            return String(!!val) === String(filterValue)
          }
        } else {
          col.filterFn = "includesString"
        }
      }

      return col
    })
}

/**
 * Get the kanban lane field from field definitions (the one with render_hint === 'kanban_lane').
 * @param {Array} fieldDefs
 * @returns {object|null} The field definition for kanban lanes
 */
export function getKanbanField(fieldDefs) {
  return fieldDefs.find((f) => f.render_hint === "kanban_lane") || null
}

/**
 * Generate kanban lane config from a kanban field definition.
 * @param {object} field - The field definition with render_hint === 'kanban_lane'
 * @returns {Array} Lane objects [{ id, label, color }]
 */
export function generateKanbanLanes(field) {
  if (!field) return []
  const options = parseOptions(field.options)
  return options.map((o) => {
    const val = typeof o === "object" ? o.value : o
    const label = typeof o === "object" ? o.label : o
    const color = typeof o === "object" ? o.color : ""
    // Convert bg-*-100 text-*-700 to a dot color (bg-*-400)
    const dotColor = color ? color.replace(/bg-(\w+)-100/, "bg-$1-400").split(" ")[0] : "bg-zinc-400"
    return { id: val, label, color: dotColor }
  })
}

/**
 * Get fields organized by section for detail view.
 * @param {Array} fieldDefs
 * @returns {Array} [{ section: string, fields: [...] }]
 */
export function getFieldsBySection(fieldDefs) {
  const sections = []
  const sectionMap = new Map()

  for (const f of fieldDefs) {
    const section = f.section || ""
    if (!sectionMap.has(section)) {
      const entry = { section, fields: [] }
      sectionMap.set(section, entry)
      sections.push(entry)
    }
    sectionMap.get(section).fields.push(f)
  }

  return sections
}

/**
 * Get the title field (render_hint === 'title') from field definitions.
 */
export function getTitleField(fieldDefs) {
  return fieldDefs.find((f) => f.render_hint === "title") || fieldDefs[0] || null
}

// ── Helpers ──────────────────────────────────────────────────

function parseOptions(options) {
  if (Array.isArray(options)) return options
  if (typeof options === "string") {
    try { return JSON.parse(options) } catch { return [] }
  }
  return []
}

// TitleCell for render_hint=title fields
function TitleCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  return <span className="font-medium">{String(value)}</span>
}
