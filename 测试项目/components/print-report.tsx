'use client'

import { Printer, X } from 'lucide-react'
import { SECTION_LABELS_EN, type SectionKey, type TestItem } from '@/lib/test-data'

interface PrintReportProps {
  categoryName: string
  selectedItems: { section: SectionKey; item: TestItem }[]
  onClose: () => void
}

export function PrintReport({ categoryName, selectedItems, onClose }: PrintReportProps) {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`
  const docNo = `DQE-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate(),
  ).padStart(2, '0')}-001`

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 print:static print:overflow-visible print:bg-transparent">
      {/* 屏幕上的工具栏，打印时隐藏 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-6 py-3 shadow-sm print:hidden">
        <p className="text-sm font-bold">打印预览 — A4 报告</p>
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

      {/* A4 纸张 */}
      <div className="mx-auto my-8 w-[210mm] min-h-[297mm] bg-white p-[15mm] text-black shadow-lg print:m-0 print:w-full print:min-h-0 print:p-0 print:shadow-none">
        {/* 报告表头 */}
        <header
          className="mb-4 border-2 border-black"
          style={{ borderCollapse: 'collapse' }}
        >
          <div className="flex items-stretch border-b border-black">
            <div className="flex w-[35mm] shrink-0 items-center justify-center border-r border-black p-2 text-center text-xs text-black">
              [公司 LOGO]
            </div>
            <div className="flex flex-1 items-center justify-center p-3">
              <h1 className="text-center text-lg font-bold text-black">
                DQE Product Qualification Report
                <span className="block text-sm font-normal">DQE 产品认证测试报告</span>
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-2 text-sm text-black">
            <div className="border-b border-r border-black px-2 py-1.5">
              Document No / 文件编号：{docNo}
            </div>
            <div className="border-b border-black px-2 py-1.5">Date / 日期：{dateStr}</div>
            <div className="border-r border-black px-2 py-1.5">
              Product Category / 产品类别：{categoryName}
            </div>
            <div className="px-2 py-1.5">Prepared By / 编制人：____________</div>
          </div>
        </header>

        {/* 测试项目表格 */}
        <table
          className="w-full text-sm text-black"
          style={{ borderCollapse: 'collapse', border: '1px solid black' }}
        >
          <caption className="sr-only">选定的测试项目清单</caption>
          <thead>
            <tr>
              {['No.', 'Test Category', 'Test Item / 测试项目', 'Standard / Condition 标准与条件', 'Result (Pass/Fail)'].map(
                (h) => (
                  <th
                    key={h}
                    style={{ border: '1px solid black' }}
                    className="bg-white px-2 py-1.5 text-left font-bold text-black"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {selectedItems.map(({ section, item }, i) => (
              <tr key={item.id}>
                <td style={{ border: '1px solid black' }} className="px-2 py-1.5 text-center">
                  {i + 1}
                </td>
                <td style={{ border: '1px solid black' }} className="px-2 py-1.5">
                  {SECTION_LABELS_EN[section]}
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
            {selectedItems.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ border: '1px solid black' }}
                  className="px-2 py-4 text-center"
                >
                  未选择任何测试项目
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 签核区 */}
        <footer className="mt-8 grid grid-cols-3 gap-8 text-sm text-black">
          <div>
            <p className="mb-8">Tested By / 测试：</p>
            <p style={{ borderTop: '1px solid black' }} className="pt-1">
              签名 / 日期
            </p>
          </div>
          <div>
            <p className="mb-8">Reviewed By / 审核：</p>
            <p style={{ borderTop: '1px solid black' }} className="pt-1">
              签名 / 日期
            </p>
          </div>
          <div>
            <p className="mb-8">Approved By / 批准：</p>
            <p style={{ borderTop: '1px solid black' }} className="pt-1">
              签名 / 日期
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
