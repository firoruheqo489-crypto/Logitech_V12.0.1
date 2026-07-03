'use client'

import { cn } from '@/lib/utils'

import { CATEGORIES } from './test-data'

interface CategoryBarProps {
  selectedId: string
  onSelect: (id: string) => void
}

export function CategoryBar({ selectedId, onSelect }: CategoryBarProps) {
  return (
    <nav
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
      aria-label="产品类别"
    >
      <span className="px-2 text-xs font-medium text-muted-foreground">产品类别</span>
      {CATEGORIES.map((category) => {
        const active = category.id === selectedId

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-primary font-bold text-primary-foreground'
                : 'text-foreground hover:bg-muted',
            )}
          >
            {category.name}
          </button>
        )
      })}
    </nav>
  )
}
