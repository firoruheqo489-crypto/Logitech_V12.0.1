import './test-project-parser/test-project-parser.css'

import { useMemo, useState } from 'react'
import { Lightbulb, Printer } from 'lucide-react'

import { CategoryBar } from './test-project-parser/category-sidebar'
import { PrintReport } from './test-project-parser/print-report'
import { TestSection } from './test-project-parser/test-section'
import {
  CATEGORIES,
  SECTION_LABELS,
  type SectionKey,
  type TestItem,
} from './test-project-parser/test-data'

const SECTION_ORDER: SectionKey[] = ['routine', 'destructive', 'reliability']

const SECTION_BADGES: Record<SectionKey, string> = {
  routine: 'bg-primary',
  destructive: 'bg-destructive',
  reliability: 'bg-chart-2',
}

type CustomItems = Record<string, Record<SectionKey, TestItem[]>>

function defaultCheckedIds(): Set<string> {
  const ids = new Set<string>()
  for (const category of CATEGORIES) {
    for (const key of SECTION_ORDER) {
      for (const item of category.sections[key]) {
        ids.add(item.id)
      }
    }
  }
  return ids
}

export default function TestProjectParserDashboard() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(CATEGORIES[0]?.id ?? '')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(defaultCheckedIds)
  const [customItems, setCustomItems] = useState<CustomItems>({})
  const [showPrint, setShowPrint] = useState(false)

  const category = CATEGORIES.find((item) => item.id === selectedCategoryId) ?? CATEGORIES[0]

  const sectionsWithCustom = useMemo(() => {
    const custom = customItems[category.id]
    return SECTION_ORDER.map((key) => ({
      key,
      items: [...category.sections[key], ...(custom?.[key] ?? [])],
    }))
  }, [category, customItems])

  const selectedItems = useMemo(
    () =>
      sectionsWithCustom.flatMap(({ key, items }) =>
        items
          .filter((item) => checkedIds.has(item.id))
          .map((item) => ({ section: key, item })),
      ),
    [checkedIds, sectionsWithCustom],
  )

  function toggleItem(id: string) {
    setCheckedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function addCustom(section: SectionKey, name: string, standard: string) {
    const newItem: TestItem = {
      id: `custom-${category.id}-${section}-${Date.now()}`,
      name,
      standard,
    }

    setCustomItems((previous) => {
      const current = previous[category.id] ?? {
        routine: [],
        destructive: [],
        reliability: [],
      }

      return {
        ...previous,
        [category.id]: {
          ...current,
          [section]: [...current[section], newItem],
        },
      }
    })

    setCheckedIds((previous) => new Set(previous).add(newItem.id))
  }

  return (
    <div className="test-project-parser-scope">
      <>
        <div className="flex h-dvh flex-col overflow-hidden bg-background print:hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Lightbulb className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">配置测试矩阵：{category.name}</h1>
                <p className="text-sm text-muted-foreground">
                  共选择 {selectedItems.length} 项测试，将纳入最终报告
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Printer className="size-4" aria-hidden="true" />
              生成并打印报告
            </button>
          </header>

          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto flex max-w-5xl flex-col gap-5">
                <CategoryBar
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                />
                {sectionsWithCustom.map(({ key, items }) => (
                  <TestSection
                    key={`${category.id}-${key}`}
                    title={SECTION_LABELS[key]}
                    badgeClass={SECTION_BADGES[key]}
                    items={items}
                    checkedIds={checkedIds}
                    onToggle={toggleItem}
                    onAddCustom={(name, standard) => addCustom(key, name, standard)}
                  />
                ))}
              </div>
            </div>
          </main>
        </div>

        {showPrint && category ? (
          <PrintReport
            selectedItems={selectedItems}
            onClose={() => setShowPrint(false)}
          />
        ) : null}
      </>
    </div>
  )
}
