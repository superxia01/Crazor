// Copyright (c) 2026 MeeJoy

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Build a zod schema from field definitions
function buildSchema(fields) {
  const shape = {}
  for (const f of fields) {
    let s
    switch (f.type) {
      case "number":
        s = f.required ? z.coerce.number({ message: f.label + "必填" }) : z.coerce.number().optional().nullable()
        break
      case "select":
        s = f.required ? z.string().min(1, f.label + "必填") : z.string().optional().nullable()
        break
      case "textarea":
        s = f.required ? z.string().min(1, f.label + "必填") : z.string().optional().nullable()
        break
      case "date":
        s = f.required ? z.string().min(1, f.label + "必填") : z.string().optional().nullable()
        break
      default:
        s = f.required ? z.string().min(1, f.label + "必填") : z.string().optional().nullable()
    }
    shape[f.key] = s
  }
  return z.object(shape)
}

export default function DataForm({ fields, initial, onSubmit, onCancel, submitLabel = "保存" }) {
  const schema = buildSchema(fields)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial || fields.reduce((acc, f) => {
      acc[f.key] = f.defaultValue ?? ""
      return acc
    }, {}),
  })

  // Group fields into rows of 2
  const rows = []
  let currentRow = []
  for (const f of fields) {
    if (f.fullWidth && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = []
    }
    currentRow.push(f)
    if (f.fullWidth) {
      rows.push(currentRow)
      currentRow = []
    } else if (currentRow.length === 2) {
      rows.push(currentRow)
      currentRow = []
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className={cn("grid gap-3", row.length === 1 || row[0]?.fullWidth ? "grid-cols-1" : "grid-cols-2")}>
          {row.map((f) => (
            <FieldRenderer key={f.key} field={f} register={register} control={control} error={errors[f.key]} />
          ))}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>取消</Button>
        )}
        <Button type="submit" size="sm" disabled={isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  )
}

function FieldRenderer({ field, register, control, error }) {
  const errorMsg = error?.message
  const cls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"

  if (field.type === "asyncSelect") {
    const [options, setOptions] = useState([])
    useEffect(() => {
      field.asyncOptions().then(setOptions).catch(() => {})
    }, [field])
    return (
      <div>
        <select
          className={cn(cls, errorMsg && "border-rose-400")}
          {...register(field.key)}
        >
          <option value="">{field.placeholder || field.label}</option>
          {options.map((opt) => (
            <option key={typeof opt === "string" ? opt : opt.value} value={typeof opt === "string" ? opt : opt.value}>
              {typeof opt === "string" ? opt : opt.label}
            </option>
          ))}
        </select>
        {errorMsg && <p className="mt-0.5 text-[11px] text-rose-500">{errorMsg}</p>}
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <div>
        <select
          className={cn(cls, errorMsg && "border-rose-400")}
          {...register(field.key)}
        >
          <option value="">{field.placeholder || field.label}</option>
          {(field.options || []).map((opt) => (
            <option key={typeof opt === "string" ? opt : opt.value} value={typeof opt === "string" ? opt : opt.value}>
              {typeof opt === "string" ? opt : opt.label}
            </option>
          ))}
        </select>
        {errorMsg && <p className="mt-0.5 text-[11px] text-rose-500">{errorMsg}</p>}
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <div>
        <textarea
          className={cn(cls.replace("h-9", "min-h-[60px]"), errorMsg && "border-rose-400")}
          placeholder={field.placeholder || field.label}
          {...register(field.key)}
        />
        {errorMsg && <p className="mt-0.5 text-[11px] text-rose-500">{errorMsg}</p>}
      </div>
    )
  }

  if (field.type === "toggle") {
    return (
      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
        <input type="checkbox" {...register(field.key)} className="rounded" />
        {field.label}
      </label>
    )
  }

  return (
    <div>
      <Input
        type={field.type || "text"}
        placeholder={field.placeholder || field.label}
        className={cn(errorMsg && "border-rose-400")}
        step={field.step}
        {...register(field.key)}
      />
      {errorMsg && <p className="mt-0.5 text-[11px] text-rose-500">{errorMsg}</p>}
    </div>
  )
}
