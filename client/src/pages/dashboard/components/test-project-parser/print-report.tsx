'use client'

import { Printer, X } from 'lucide-react'

import { SECTION_LABELS_PRINT, type SectionKey, type TestItem } from './test-data'

interface PrintReportProps {
  selectedItems: { section: SectionKey; item: TestItem }[]
  onClose: () => void
}

export function PrintReport({ selectedItems, onClose }: PrintReportProps) {
  const printableRows = selectedItems.map(({ section, item }, index, items) => {
    const previousSection = index > 0 ? items[index - 1]?.section : null
    const showSectionCell = section !== previousSection
    const rowSpan = showSectionCell
      ? items.slice(index).findIndex((entry) => entry.section !== section)
      : 0

    return {
      index,
      section,
      item,
      showSectionCell,
      rowSpan: rowSpan === -1 ? items.length - index : rowSpan,
    }
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 print:static print:overflow-visible print:bg-transparent">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-6 py-3 shadow-sm print:hidden">
        <p className="text-sm font-bold">打印预览 - A4 报告</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Printer className="size-4" aria-hidden="true" />
            打印
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm transition-colors hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
            返回编辑
          </button>
        </div>
      </div>

      <div className="mx-auto my-8 w-[210mm] min-h-[297mm] bg-white p-[15mm] text-black shadow-lg print:m-0 print:w-full print:min-h-0 print:p-0 print:shadow-none">
        <header className="mb-4 py-3">
          <h1 className="text-center text-lg font-bold text-black">产品测试清单</h1>
        </header>

        <table
          className="w-full text-sm text-black"
          style={{ borderCollapse: 'collapse', border: '1px solid black' }}
        >
          <caption className="sr-only">选定的测试项目清单</caption>
          <thead>
            <tr>
              {['测试类别', '序号', '测试项目', '标准与条件', '结果'].map((header, headerIndex) => (
                <th
                  key={header}
                  style={{ border: '1px solid black' }}
                  className={`bg-white px-2 py-1.5 font-bold text-black ${
                    headerIndex === 0
                      ? 'w-[28mm] whitespace-nowrap text-center'
                      : headerIndex === 1
                        ? 'w-[16mm] whitespace-nowrap text-center'
                        : 'text-left'
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printableRows.map(({ index, section, item, showSectionCell, rowSpan }) => (
              <tr key={item.id}>
                {showSectionCell ? (
                  <td
                    rowSpan={rowSpan}
                    style={{ border: '1px solid black', width: '28mm' }}
                    className="px-2 py-1.5 text-center align-middle whitespace-nowrap"
                  >
                    {SECTION_LABELS_PRINT[section]}
                  </td>
                ) : null}
                <td
                  style={{ border: '1px solid black', width: '16mm' }}
                  className="px-2 py-1.5 text-center whitespace-nowrap"
                >
                  {index + 1}
                </td>
                <td style={{ border: '1px solid black' }} className="px-2 py-1.5">
                  {item.name}
                </td>
                <td style={{ border: '1px solid black' }} className="px-2 py-1.5">
                  {item.standard}
                </td>
                <td style={{ border: '1px solid black' }} className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block size-3"
                        style={{ border: '1px solid black' }}
                        aria-hidden="true"
                      />
                      Pass
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block size-3"
                        style={{ border: '1px solid black' }}
                        aria-hidden="true"
                      />
                      Fail
                    </span>
                  </span>
                </td>
              </tr>
            ))}

            {selectedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ border: '1px solid black' }}
                  className="px-2 py-4 text-center"
                >
                  未选择任何测试项目
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <footer className="mt-8 text-sm text-black">
          <div className="border border-black px-6 py-5">
            <p className="font-medium">成员签字</p>
            <div className="h-28" />
          </div>
        </footer>
      </div>
    </div>
  )
}
