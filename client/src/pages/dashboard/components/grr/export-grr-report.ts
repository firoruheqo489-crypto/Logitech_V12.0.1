'use client'

const PREVIEW_WINDOW_FEATURES = 'width=1400,height=960'

function buildFileBaseName(meta: { partName?: string; characteristic?: string; date?: string }) {
  const parts = ['GRR', meta.partName?.trim(), meta.characteristic?.trim(), meta.date?.trim()].filter(Boolean)
  return parts.join('-').replace(/[\\/:*?"<>|]+/g, '-')
}

function collectHeadMarkup() {
  const nodes = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
  return nodes.map((node) => node.outerHTML).join('\n')
}

function buildPreviewCss() {
  return `
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      height: auto !important;
      overflow: auto !important;
      overscroll-behavior: auto !important;
      background: #0b1020;
      color: #e6edf3;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    #root {
      position: static !important;
      inset: auto !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    .grr-preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      background: rgba(8, 12, 24, 0.96);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
    }

    .grr-preview-title {
      font-size: 18px;
      font-weight: 800;
      color: #f8fafc;
    }

    .grr-preview-meta {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(226, 232, 240, 0.78);
    }

    .grr-preview-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .grr-preview-button {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 10px 18px;
      background: rgba(255, 255, 255, 0.06);
      color: #f8fafc;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .grr-preview-button.primary {
      border-color: rgba(110, 231, 183, 0.28);
      background: rgba(16, 185, 129, 0.16);
      color: #d1fae5;
    }

    .grr-preview-shell {
      padding: 20px 24px 40px;
      overflow: visible !important;
    }

    .grr-preview-stage {
      width: min(100%, 1880px);
      margin: 0 auto;
      overflow: visible !important;
    }

    .grr-preview-stage [data-grr-report-toolbar],
    .grr-preview-stage .no-print {
      display: none !important;
    }

    @media print {
      @page {
        size: auto;
        margin: 12mm;
      }

      html, body {
        background: #ffffff !important;
      }

      .grr-preview-toolbar {
        display: none !important;
      }

      .grr-preview-shell {
        padding: 0 !important;
      }

      .grr-preview-stage {
        width: auto !important;
        margin: 0 !important;
      }

      .grr-preview-stage [data-grr-report-toolbar],
      .grr-preview-stage .no-print {
        display: none !important;
      }
    }
  `
}

function stripPrintVariantClasses(root: HTMLElement) {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  elements.forEach((element) => {
    const nextClasses = Array.from(element.classList).filter((className) => !className.startsWith('print:'))
    if (element instanceof SVGElement) {
      element.setAttribute('class', nextClasses.join(' '))
      return
    }
    element.className = nextClasses.join(' ')
  })
}

function syncFormValues(source: HTMLElement, clone: HTMLElement) {
  const sourceInputs = Array.from(source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))
  const cloneInputs = Array.from(clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))

  sourceInputs.forEach((sourceInput, index) => {
    const cloneInput = cloneInputs[index]
    if (!cloneInput) return

    if (sourceInput instanceof HTMLInputElement) {
      cloneInput.value = sourceInput.value
      cloneInput.setAttribute('value', sourceInput.value)
      if (sourceInput.checked) cloneInput.setAttribute('checked', 'checked')
      else cloneInput.removeAttribute('checked')
    } else if (sourceInput instanceof HTMLTextAreaElement) {
      cloneInput.value = sourceInput.value
      cloneInput.textContent = sourceInput.value
    } else if (sourceInput instanceof HTMLSelectElement) {
      cloneInput.value = sourceInput.value
      const cloneSelect = cloneInput as HTMLSelectElement
      Array.from(cloneSelect.options).forEach((option: HTMLOptionElement) => {
        option.selected = option.value === sourceInput.value
      })
    }
  })
}

function buildStaticCloneMarkup(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-grr-report-toolbar], .no-print').forEach((node) => node.remove())
  syncFormValues(source, clone)
  stripPrintVariantClasses(clone)
  return clone.outerHTML
}

function openPreviewWindow(options: {
  source: HTMLElement
  fileBaseName: string
  mode: 'print' | 'pdf'
}) {
  const { source, fileBaseName, mode } = options
  const headMarkup = collectHeadMarkup()
  const bodyMarkup = buildStaticCloneMarkup(source)
  const actionLabel = mode === 'pdf' ? '保存为 PDF' : '打印'
  const metaCopy =
    mode === 'pdf'
      ? '当前为 1:1 页面复刻的 PDF 导出预览，确认版式后点击右侧按钮，使用浏览器打印面板另存为 PDF。'
      : '当前为 1:1 页面复刻的打印预览，确认版式后点击右侧按钮执行打印。'

  const previewHtml = `<!doctype html>
<html lang="zh-CN" class="${document.documentElement.className}">
  <head>
    <meta charset="utf-8" />
    <title>${fileBaseName} ${mode === 'pdf' ? 'PDF导出预览' : '打印预览'}</title>
    ${headMarkup}
    <style>${buildPreviewCss()}</style>
  </head>
  <body class="${document.body.className}">
    <div class="grr-preview-toolbar">
      <div>
        <div class="grr-preview-title">${fileBaseName} ${mode === 'pdf' ? 'PDF导出预览' : '打印预览'}</div>
        <div class="grr-preview-meta">${metaCopy}</div>
      </div>
      <div class="grr-preview-actions">
        <button class="grr-preview-button" type="button" onclick="window.close()">关闭预览</button>
        <button class="grr-preview-button primary" type="button" onclick="window.print()">${actionLabel}</button>
      </div>
    </div>
    <main class="grr-preview-shell">
      <div class="grr-preview-stage">
        ${bodyMarkup}
      </div>
    </main>
  </body>
</html>`

  const previewBlob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' })
  const previewUrl = URL.createObjectURL(previewBlob)
  const previewWindow = window.open(previewUrl, '_blank', PREVIEW_WINDOW_FEATURES)

  if (!previewWindow) {
    URL.revokeObjectURL(previewUrl)
    throw new Error(mode === 'pdf' ? 'PDF 导出预览窗口被浏览器拦截，请允许弹窗后重试' : '打印预览窗口被浏览器拦截，请允许弹窗后重试')
  }

  previewWindow.addEventListener(
    'beforeunload',
    () => {
      URL.revokeObjectURL(previewUrl)
    },
    { once: true },
  )
  previewWindow.focus()
}

export async function exportGrrPdf(options: {
  source: HTMLElement
  fileBaseName: string
}) {
  openPreviewWindow({
    source: options.source,
    fileBaseName: options.fileBaseName,
    mode: 'pdf',
  })
}

export async function printGrrReport(options: {
  source: HTMLElement
  fileBaseName: string
}) {
  openPreviewWindow({
    source: options.source,
    fileBaseName: options.fileBaseName,
    mode: 'print',
  })
}

export function buildGrrReportFileBaseName(meta: {
  partName?: string
  characteristic?: string
  date?: string
}) {
  return buildFileBaseName(meta)
}
