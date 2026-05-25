// Copyright (c) 2026 MeeJoy

import { flexRender } from "@tanstack/react-table"
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function DataGrid({ table, onView, onEdit, onDelete }) {
  return (
    <div className="overflow-auto rounded-lg border">
      <table className="w-full text-[12px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-muted/40">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground",
                    header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && <ChevronUpIcon className="size-3" />}
                    {header.column.getIsSorted() === "desc" && <ChevronDownIcon className="size-3" />}
                  </div>
                </th>
              ))}
              {(onView || onEdit || onDelete) && (
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">操作</th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length + (onView || onEdit || onDelete ? 1 : 0)}
                className="py-12 text-center text-muted-foreground"
              >
                暂无数据
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 max-w-[200px] truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                {(onView || onEdit || onDelete) && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onView && (
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => onView(row.original)}>
                          <EyeIcon className="size-3.5" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(row.original)}>
                          <PencilIcon className="size-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="size-7 text-rose-500 hover:text-rose-600" onClick={() => onDelete(row.original)}>
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Helper: render a badge-style cell
export function BadgeCell({ value, colorMap }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  const cls = colorMap?.[value] || "bg-zinc-100 text-zinc-600"
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", cls)}>{value}</span>
}

// Helper: render currency
export function CurrencyCell({ value }) {
  if (!value) return <span className="text-muted-foreground">-</span>
  if (Math.abs(value) >= 10000) return <span className="font-medium">{`¥${(value / 10000).toFixed(1)}万`}</span>
  return <span className="font-medium">{`¥${value.toLocaleString()}`}</span>
}
