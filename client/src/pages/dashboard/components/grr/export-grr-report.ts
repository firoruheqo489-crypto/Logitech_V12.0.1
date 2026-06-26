'use client'

const PREVIEW_WINDOW_FEATURES = 'width=1400,height=960'
const PDF_PAGE_WIDTH_MM = 210
const PDF_PAGE_HEIGHT_MM = 297
const PDF_PAGE_BACKGROUND_RGB = [11, 16, 32] as const
const MAX_CANVAS_EDGE_PX = 16384
const MAX_CANVAS_AREA = 268_000_000
const UNSUPPORTED_COLOR_FUNCTION_RE = /\b(?:oklch|oklab|color)\(/i
const PURE_COLOR_PROPERTIES = new Set([
  'background-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'caret-color',
  'color',
  'column-rule-color',
  'fill',
  'flood-color',
  'lighting-color',
  'outline-color',
  'stop-color',
  'stroke',
  'text-decoration-color',
  'text-emphasis-color',
])

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function srgbEncode(value: number) {
  const clamped = clamp(value, 0, 1)
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function parseCssNumber(token: string) {
  const trimmed = token.trim()
  if (!trimmed) return null
  if (trimmed.endsWith('%')) {
    const value = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(value) ? value / 100 : null
  }
  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : null
}

function parseHue(token: string) {
  const trimmed = token.trim().toLowerCase()
  if (!trimmed) return null

  if (trimmed.endsWith('deg')) {
    const value = Number.parseFloat(trimmed.slice(0, -3))
    return Number.isFinite(value) ? value : null
  }
  if (trimmed.endsWith('grad')) {
    const value = Number.parseFloat(trimmed.slice(0, -4))
    return Number.isFinite(value) ? value * 0.9 : null
  }
  if (trimmed.endsWith('rad')) {
    const value = Number.parseFloat(trimmed.slice(0, -3))
    return Number.isFinite(value) ? (value * 180) / Math.PI : null
  }
  if (trimmed.endsWith('turn')) {
    const value = Number.parseFloat(trimmed.slice(0, -4))
    return Number.isFinite(value) ? value * 360 : null
  }

  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : null
}

function formatRgba(red: number, green: number, blue: number, alpha: number) {
  const r = Math.round(clamp(red, 0, 1) * 255)
  const g = Math.round(clamp(green, 0, 1) * 255)
  const b = Math.round(clamp(blue, 0, 1) * 255)
  const a = Math.round(clamp(alpha, 0, 1) * 1000) / 1000
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function convertOklchToRgba(oklchValue: string) {
  const inner = oklchValue.slice(oklchValue.indexOf('(') + 1, -1).trim()
  const [valuePart, alphaPart] = inner.split('/')
  const tokens = valuePart.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return null

  const lightness = parseCssNumber(tokens[0])
  const chroma = parseCssNumber(tokens[1])
  const hue = parseHue(tokens[2])
  const alpha = alphaPart ? parseCssNumber(alphaPart) : 1
  if (lightness === null || chroma === null || hue === null || alpha === null) return null

  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b

  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3

  const red = srgbEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = srgbEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = srgbEncode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)

  return formatRgba(red, green, blue, alpha)
}

function replaceUnsupportedColorFunctions(value: string) {
  let result = ''
  let cursor = 0
  const lowerValue = value.toLowerCase()

  while (cursor < value.length) {
    const start = lowerValue.indexOf('oklch(', cursor)
    if (start === -1) {
      result += value.slice(cursor)
      break
    }

    result += value.slice(cursor, start)
    let depth = 0
    let end = start

    while (end < value.length) {
      const char = value[end]
      if (char === '(') depth += 1
      if (char === ')') {
        depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }
      end += 1
    }

    const fnText = value.slice(start, end)
    const converted = convertOklchToRgba(fnText)
    result += converted ?? 'rgba(0, 0, 0, 0)'
    cursor = end
  }

  return result
}

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
  const elements = [root, ...Array.from(root.querySelectorAll('*'))]
  elements.forEach((element) => {
    const nextClasses = Array.from(element.classList).filter((className) => !className.startsWith('print:'))
    if (element instanceof SVGElement) {
      element.setAttribute('class', nextClasses.join(' '))
      return
    }
    if (element instanceof HTMLElement) {
      element.className = nextClasses.join(' ')
    }
  })
}

function syncFormValues(source: HTMLElement, clone: HTMLElement) {
  const sourceInputs = Array.from(
    source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'),
  )
  const cloneInputs = Array.from(
    clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'),
  )

  sourceInputs.forEach((sourceInput, index) => {
    const cloneInput = cloneInputs[index]
    if (!cloneInput) return

    if (sourceInput instanceof HTMLInputElement && cloneInput instanceof HTMLInputElement) {
      cloneInput.value = sourceInput.value
      cloneInput.checked = sourceInput.checked
      cloneInput.setAttribute('value', sourceInput.value)
      if (sourceInput.checked) cloneInput.setAttribute('checked', 'checked')
      else cloneInput.removeAttribute('checked')
      return
    }

    if (sourceInput instanceof HTMLTextAreaElement && cloneInput instanceof HTMLTextAreaElement) {
      cloneInput.value = sourceInput.value
      cloneInput.textContent = sourceInput.value
      return
    }

    if (sourceInput instanceof HTMLSelectElement && cloneInput instanceof HTMLSelectElement) {
      cloneInput.value = sourceInput.value
      Array.from(cloneInput.options).forEach((option) => {
        option.selected = option.value === sourceInput.value
      })
    }
  })
}

function buildStaticClone(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-grr-report-toolbar], .no-print').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.dataset.grrExportHidden = 'true'
    }
  })
  syncFormValues(source, clone)
  stripPrintVariantClasses(clone)
  return clone
}

function pruneNonExportNodes(root: HTMLElement) {
  root.querySelectorAll('[data-grr-export-hidden="true"]').forEach((node) => node.remove())
}

function activateExportOnlyNodes(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-grr-export-only="pdf"]').forEach((node) => {
    node.hidden = false
    node.style.display = 'block'
    node.style.visibility = 'visible'
    node.style.opacity = '1'
    node.classList.remove('hidden')
  })
}

function replaceFormControlsForExport(root: HTMLElement) {
  const controls = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'),
  )

  controls.forEach((control) => {
    const value =
      control instanceof HTMLSelectElement
        ? control.selectedOptions[0]?.textContent?.trim() || control.value || ''
        : control.value || control.getAttribute('value') || control.getAttribute('placeholder') || ''

    const staticField = document.createElement('div')
    staticField.textContent = value || ' '
    staticField.style.cssText = control.getAttribute('style') || ''
    staticField.style.display = 'flex'
    staticField.style.alignItems = control instanceof HTMLTextAreaElement ? 'flex-start' : 'center'
    staticField.style.width = '100%'
    staticField.style.minHeight = control instanceof HTMLTextAreaElement ? '3.25rem' : '2.25rem'
    staticField.style.padding = control instanceof HTMLTextAreaElement ? '0.5rem 0.75rem' : '0.375rem 0.75rem'
    staticField.style.border = '1px solid rgba(255, 255, 255, 0.72)'
    staticField.style.borderRadius = '0.75rem'
    staticField.style.background = 'rgba(255, 255, 255, 0.04)'
    staticField.style.color = '#f8fafc'
    staticField.style.boxSizing = 'border-box'
    staticField.style.whiteSpace = control instanceof HTMLTextAreaElement ? 'pre-wrap' : 'nowrap'
    staticField.style.overflow = 'hidden'
    staticField.style.textOverflow = 'ellipsis'
    staticField.style.outline = 'none'
    staticField.style.appearance = 'none'

    control.replaceWith(staticField)
  })
}

function normalizeCssValue(
  property: string,
  value: string,
  sandbox: HTMLElement,
  colorContext: CanvasRenderingContext2D | null,
) {
  const trimmed = replaceUnsupportedColorFunctions(value.trim())
  if (!trimmed || !UNSUPPORTED_COLOR_FUNCTION_RE.test(trimmed)) {
    return trimmed
  }

  if (PURE_COLOR_PROPERTIES.has(property) && colorContext) {
    try {
      colorContext.fillStyle = '#000000'
      colorContext.fillStyle = trimmed
      const normalizedColor = colorContext.fillStyle
      if (normalizedColor && !UNSUPPORTED_COLOR_FUNCTION_RE.test(normalizedColor)) {
        return normalizedColor
      }
    } catch {
      // Fall through to the generic browser serialization path.
    }
  }

  try {
    sandbox.style.removeProperty(property)
    sandbox.style.setProperty(property, trimmed)
    const normalized = getComputedStyle(sandbox).getPropertyValue(property).trim()
    sandbox.style.removeProperty(property)
    if (normalized && !UNSUPPORTED_COLOR_FUNCTION_RE.test(normalized)) {
      return normalized
    }
  } catch {
    return PURE_COLOR_PROPERTIES.has(property) ? 'rgba(0, 0, 0, 0)' : ''
  }

  return PURE_COLOR_PROPERTIES.has(property) ? 'rgba(0, 0, 0, 0)' : ''
}

function inlineResolvedStyles(source: HTMLElement, clone: HTMLElement) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))]
  const sandbox = document.createElement('div')
  sandbox.setAttribute('aria-hidden', 'true')
  sandbox.style.position = 'fixed'
  sandbox.style.left = '-100000px'
  sandbox.style.top = '0'
  sandbox.style.visibility = 'hidden'
  sandbox.style.pointerEvents = 'none'
  sandbox.style.all = 'initial'
  document.body.appendChild(sandbox)

  const colorCanvas = document.createElement('canvas')
  const colorContext = colorCanvas.getContext('2d')

  try {
    const length = Math.min(sourceNodes.length, cloneNodes.length)
    for (let index = 0; index < length; index += 1) {
      const sourceNode = sourceNodes[index]
      const cloneNode = cloneNodes[index]
      if (!(cloneNode instanceof HTMLElement || cloneNode instanceof SVGElement)) continue

      const computed = getComputedStyle(sourceNode)
      for (let propIndex = 0; propIndex < computed.length; propIndex += 1) {
        const property = computed[propIndex]
        if (!property || property.startsWith('--')) continue

        const value = computed.getPropertyValue(property)
        if (!value) continue

        const normalized = normalizeCssValue(property, value, sandbox, colorContext)
        if (!normalized) continue

        cloneNode.style.setProperty(property, normalized)
      }

      cloneNode.style.setProperty('animation', 'none')
      cloneNode.style.setProperty('transition', 'none')
      cloneNode.removeAttribute('class')
    }
  } finally {
    sandbox.remove()
  }
}

function buildStaticCloneMarkup(source: HTMLElement) {
  const clone = buildStaticClone(source)
  pruneNonExportNodes(clone)
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
      ? '当前为 1:1 页面复刻的 PDF 导出预览，确认版式后点击右侧按钮并使用浏览器另存为 PDF。'
      : '当前为 1:1 页面复刻的打印预览，确认版式后点击右侧按钮执行打印。'

  const previewHtml = `<!doctype html>
<html lang="zh-CN" class="${document.documentElement.className}">
  <head>
    <meta charset="utf-8" />
    <title>${fileBaseName} ${mode === 'pdf' ? 'PDF 导出预览' : '打印预览'}</title>
    ${headMarkup}
    <style>${buildPreviewCss()}</style>
  </head>
  <body class="${document.body.className}">
    <div class="grr-preview-toolbar">
      <div>
        <div class="grr-preview-title">${fileBaseName} ${mode === 'pdf' ? 'PDF 导出预览' : '打印预览'}</div>
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

function createPdfRenderHost(source: HTMLElement) {
  const width = Math.max(Math.ceil(source.scrollWidth), Math.ceil(source.getBoundingClientRect().width), 1)
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.style.overflow = 'visible'
  host.style.background = 'transparent'

  const clone = buildStaticClone(source)
  inlineResolvedStyles(source, clone)
  pruneNonExportNodes(clone)
  activateExportOnlyNodes(clone)
  replaceFormControlsForExport(clone)
  clone.style.width = `${width}px`
  clone.style.maxWidth = 'none'
  clone.style.margin = '0'
  clone.style.height = 'auto'
  clone.style.minHeight = '0'
  clone.style.overflow = 'visible'
  host.appendChild(clone)

  return { host, clone, width }
}

async function createIsolatedRenderFrame(source: HTMLElement) {
  const { clone, width } = createPdfRenderHost(source)
  const height = Math.max(Math.ceil(source.scrollHeight), Math.ceil(source.getBoundingClientRect().height), 1)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-100000px'
  iframe.style.top = '0'
  iframe.style.width = `${width}px`
  iframe.style.height = `${height}px`
  iframe.style.pointerEvents = 'none'
  iframe.style.border = '0'

  document.body.appendChild(iframe)

  const frameDocument = iframe.contentDocument
  const frameWindow = iframe.contentWindow
  if (!frameDocument || !frameWindow) {
    iframe.remove()
    throw new Error('PDF 导出失败：无法创建隔离渲染文档')
  }

  frameDocument.open()
  frameDocument.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>GRR PDF Export</title></head><body></body></html>`)
  frameDocument.close()

  const body = frameDocument.body
  body.style.margin = '0'
  body.style.padding = '0'
  body.style.background = '#0b1020'
  body.style.overflow = 'visible'

  const importedClone = frameDocument.importNode(clone, true) as HTMLElement
  body.appendChild(importedClone)

  return { iframe, clone: importedClone, width, window: frameWindow }
}

async function waitForRenderAssets(root: HTMLElement) {
  const ownerDocument = root.ownerDocument
  const ownerWindow = ownerDocument.defaultView ?? window

  if ('fonts' in ownerDocument) {
    await ownerDocument.fonts.ready
  }

  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) return

      if (typeof image.decode === 'function') {
        try {
          await image.decode()
          return
        } catch {
          return
        }
      }

      await new Promise<void>((resolve) => {
        const done = () => resolve()
        image.addEventListener('load', done, { once: true })
        image.addEventListener('error', done, { once: true })
      })
    }),
  )

  await new Promise<void>((resolve) => ownerWindow.requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => ownerWindow.requestAnimationFrame(() => resolve()))
}

function resolveCanvasScale(width: number, height: number) {
  const baseScale = Math.min(3, Math.max(window.devicePixelRatio || 1, 2))
  const edgeLimitedScale = Math.min(baseScale, MAX_CANVAS_EDGE_PX / Math.max(width, height, 1))
  const areaLimitedScale = Math.min(edgeLimitedScale, Math.sqrt(MAX_CANVAS_AREA / Math.max(width * height, 1)))
  return Math.max(1, Number.isFinite(areaLimitedScale) ? areaLimitedScale : 1)
}

function findLastVisibleCanvasRow(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return canvas.height - 1
  }

  const blockHeight = 24
  const alphaThreshold = 8

  const blockHasVisiblePixels = (startY: number, height: number) => {
    const data = context.getImageData(0, startY, canvas.width, height).data
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > alphaThreshold) {
        return true
      }
    }
    return false
  }

  for (let endY = canvas.height; endY > 0; endY -= blockHeight) {
    const startY = Math.max(0, endY - blockHeight)
    const height = endY - startY
    if (!blockHasVisiblePixels(startY, height)) {
      continue
    }

    for (let row = endY - 1; row >= startY; row -= 1) {
      if (blockHasVisiblePixels(row, 1)) {
        return row
      }
    }
  }

  return canvas.height - 1
}

function appendCanvasSlicesToPdf(pdf: InstanceType<(typeof import('jspdf'))['jsPDF']>, canvas: HTMLCanvasElement) {
  const pageSliceHeightPx = Math.max(1, Math.floor((canvas.width * PDF_PAGE_HEIGHT_MM) / PDF_PAGE_WIDTH_MM))
  const sliceCanvas = document.createElement('canvas')
  sliceCanvas.width = canvas.width
  const sliceContext = sliceCanvas.getContext('2d')

  if (!sliceContext) {
    throw new Error('PDF 导出失败：无法创建切片画布')
  }

  let top = 0
  let pageIndex = 0
  const contentHeightPx = Math.max(1, findLastVisibleCanvasRow(canvas) + 1)

  while (top < contentHeightPx) {
    const sliceHeightPx = Math.min(pageSliceHeightPx, contentHeightPx - top)
    sliceCanvas.height = sliceHeightPx
    sliceContext.clearRect(0, 0, sliceCanvas.width, sliceHeightPx)
    sliceContext.drawImage(canvas, 0, top, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

    if (pageIndex > 0) {
      pdf.addPage('a4', 'portrait')
    }

    pdf.setFillColor(PDF_PAGE_BACKGROUND_RGB[0], PDF_PAGE_BACKGROUND_RGB[1], PDF_PAGE_BACKGROUND_RGB[2])
    pdf.rect(0, 0, PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM, 'F')

    const renderedHeightMm = (sliceHeightPx * PDF_PAGE_WIDTH_MM) / canvas.width
    pdf.addImage(
      sliceCanvas.toDataURL('image/png', 1),
      'PNG',
      0,
      0,
      PDF_PAGE_WIDTH_MM,
      Math.min(PDF_PAGE_HEIGHT_MM, renderedHeightMm),
      `grr-page-${pageIndex + 1}`,
      'FAST',
    )

    pageIndex += 1
    top += sliceHeightPx
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'unknown error'
}

async function renderCanvasInIsolatedFrame(
  source: HTMLElement,
  html2canvas: typeof import('html2canvas').default,
) {
  const { iframe, clone, width, window: frameWindow } = await createIsolatedRenderFrame(source)

  try {
    await waitForRenderAssets(clone)

    const height = Math.max(Math.ceil(clone.scrollHeight), Math.ceil(clone.getBoundingClientRect().height), 1)
    const scale = resolveCanvasScale(width, height)
    return await html2canvas(clone, {
      scale,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: frameWindow.scrollX,
      scrollY: frameWindow.scrollY,
      imageTimeout: 0,
    })
  } finally {
    iframe.remove()
  }
}

async function renderCanvasInCurrentDocument(
  source: HTMLElement,
  html2canvas: typeof import('html2canvas').default,
) {
  const { host, clone, width } = createPdfRenderHost(source)
  document.body.appendChild(host)

  try {
    await waitForRenderAssets(clone)

    const height = Math.max(Math.ceil(clone.scrollHeight), Math.ceil(clone.getBoundingClientRect().height), 1)
    const scale = resolveCanvasScale(width, height)
    return await html2canvas(clone, {
      scale,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 0,
    })
  } finally {
    host.remove()
  }
}

export async function exportGrrPdf(options: {
  source: HTMLElement
  fileBaseName: string
}) {
  const [{ default: html2canvas }, jspdfModule] = await Promise.all([import('html2canvas'), import('jspdf')])
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default
  let canvas: HTMLCanvasElement | null = null
  const failures: string[] = []

  try {
    canvas = await renderCanvasInIsolatedFrame(options.source, html2canvas)
  } catch (error) {
    failures.push(`isolated-frame: ${getErrorMessage(error)}`)
  }

  if (!canvas) {
    try {
      canvas = await renderCanvasInCurrentDocument(options.source, html2canvas)
    } catch (error) {
      failures.push(`current-document: ${getErrorMessage(error)}`)
    }
  }

  if (!canvas) {
    throw new Error(`GRR PDF export failed (${failures.join('; ')})`)
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
  })

  appendCanvasSlicesToPdf(pdf, canvas)
  pdf.save(`${options.fileBaseName}.pdf`)
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
