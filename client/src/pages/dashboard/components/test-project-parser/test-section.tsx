'use client'

import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { TestItem } from './test-data'

interface TestSectionProps {
  title: string
  badgeClass: string
  items: TestItem[]
  checkedIds: Set<string>
  onToggle: (id: string) => void
  onAddCustom: (name: string, standard: string) => void
}

export function TestSection({
  title,
  badgeClass,
  items,
  checkedIds,
  onToggle,
  onAddCustom,
}: TestSectionProps) {
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [standard, setStandard] = useState('')

  const checkedCount = items.filter((item) => checkedIds.has(item.id)).length

  function submitCustom() {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }

    onAddCustom(trimmed, standard.trim() || '按客户/内部标准执行')
    setName('')
    setStandard('')
    setAdding(false)
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <span className={cn('size-2.5 rounded-full', badgeClass)} aria-hidden="true" />
          <h2 className="text-sm font-bold">{title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            已选 {checkedCount} / {items.length}
          </span>
        </div>
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="border-t border-border p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const checked = checkedIds.has(item.id)

              return (
                <label
                  key={item.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors',
                    checked
                      ? 'border-primary/40 bg-accent'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card',
                    )}
                  >
                    {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs leading-relaxed text-muted-foreground">
                      {item.standard}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="mt-3">
            {adding ? (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-accent/50 p-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      submitCustom()
                    }
                  }}
                  placeholder="测试项目名称"
                  className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <input
                  type="text"
                  value={standard}
                  onChange={(event) => setStandard(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      submitCustom()
                    }
                  }}
                  placeholder="标准/条件（可选）"
                  className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitCustom}
                    className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="h-9 rounded-md border border-border bg-card px-4 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Plus className="size-4" aria-hidden="true" />
                添加自定义测试
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
