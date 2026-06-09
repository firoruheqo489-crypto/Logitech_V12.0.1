import { cn } from '@/lib/utils'

type Props = {
  zh: string
  en: string
  className?: string
  align?: 'left' | 'center' | 'right'
  /** size preset for the stacked label */
  size?: 'xs' | 'sm' | 'md'
  zhClassName?: string
  enClassName?: string
}

const sizeMap = {
  xs: { zh: 'text-[11px]', en: 'text-[8px]' },
  sm: { zh: 'text-xs', en: 'text-[9px]' },
  md: { zh: 'text-sm', en: 'text-[10px]' },
}

/**
 * Stacked dual-language label.
 * Chinese (bold, Noto Sans SC) on top, English (mono, muted) below.
 */
export function BiLabel({
  zh,
  en,
  className,
  align = 'left',
  size = 'sm',
  zhClassName,
  enClassName,
}: Props) {
  const s = sizeMap[size]
  return (
    <span
      className={cn(
        'flex flex-col',
        align === 'center' && 'items-center text-center',
        align === 'right' && 'items-end text-right',
        className,
      )}
    >
      <span className={cn('bi-zh', s.zh, zhClassName)}>{zh}</span>
      <span className={cn('bi-en', s.en, 'text-muted-foreground', enClassName)}>{en}</span>
    </span>
  )
}
