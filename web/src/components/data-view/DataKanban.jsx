// Copyright (c) 2026 MeeJoy

import { useCallback } from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@heroui/react"
import { cn } from "@/lib/utils"

export default function DataKanban({ items, lanes, laneKey, renderCard, onMove }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Group items by laneKey
  const grouped = {}
  lanes.forEach((lane) => { grouped[lane.id] = [] })
  items.forEach((item) => {
    const key = item[laneKey] || lanes[0]?.id
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      // Find which lane the card was dropped into
      // The over.id could be a lane or a card — resolve to lane
      let targetLane = null
      for (const lane of lanes) {
        if (lane.id === over.id) { targetLane = lane.id; break }
      }
      if (!targetLane) {
        // over is a card — find its lane
        for (const [laneId, laneItems] of Object.entries(grouped)) {
          if (laneItems.some((it) => String(it.id) === String(over.id))) {
            targetLane = laneId
            break
          }
        }
      }

      // Find source lane
      let sourceLane = null
      for (const [laneId, laneItems] of Object.entries(grouped)) {
        if (laneItems.some((it) => String(it.id) === String(active.id))) {
          sourceLane = laneId
          break
        }
      }

      if (targetLane && sourceLane && targetLane !== sourceLane) {
        const item = items.find((it) => String(it.id) === String(active.id))
        if (item) onMove?.(item, sourceLane, targetLane)
      }
    },
    [items, lanes, onMove],
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {lanes.map((lane) => (
          <KanbanLane key={lane.id} lane={lane} items={grouped[lane.id] || []} renderCard={renderCard} />
        ))}
      </div>
    </DndContext>
  )
}

function KanbanLane({ lane, items, renderCard }) {
  return (
    <div className="flex w-[280px] min-w-[280px] flex-col rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          {lane.color && <span className={cn("size-2.5 rounded-full", lane.color)} />}
          <span className="text-[12px] font-medium">{lane.label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      <SortableContext items={items.map((it) => String(it.id))} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-[100px]">
          {items.map((item) => (
            <KanbanCard key={item.id} item={item} renderCard={renderCard} />
          ))}
          {items.length === 0 && (
            <div className="py-6 text-center text-[11px] text-muted-foreground">暂无</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function KanbanCard({ item, renderCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.id),
  })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderCard ? renderCard(item) : (
        <Card variant="outlined" className="cursor-grab shadow-none hover:shadow-sm transition-shadow">
          <Card.Content className="p-2.5">
            <div className="text-[12px] font-medium">{item.name || item.description || `#${item.id}`}</div>
          </Card.Content>
        </Card>
      )}
    </div>
  )
}
