import JSZip from "jszip"

export type ParsedImage = {
  base64: string
  mimeType: string
  extension: string
  width?: number
  height?: number
}

export type ParsedCell = {
  text: string
  images: ParsedImage[]
}

export type ParsedRow = ParsedCell[]

export type ParseProgress = {
  stage: "unzipping" | "parsing-xml" | "extracting-images" | "rendering" | "done"
  message: string
  progress: number
}

export type ParseResult = {
  headers: string[]
  rows: ParsedRow[]
  columnCount: number
}

const EXPECTED_HEADERS = [
  "No.",
  "Issue Description",
  "Pictures",
  "Root Cause",
  "Solution",
  "Owner",
  "Due-Date",
  "Status",
  "Reference Link",
]

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

function getMimeType(ext: string): string {
  const e = ext.toLowerCase().replace(".", "")
  switch (e) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "bmp":
      return "image/bmp"
    case "webp":
      return "image/webp"
    default:
      return "image/png"
  }
}

/**
 * Parse the relationships file to get a map of rId -> image path.
 */
function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>()
  const parser = new DOMParser()
  const doc = parser.parseFromString(relsXml, "application/xml")
  const rels = doc.getElementsByTagName("Relationship")
  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i]
    const id = rel.getAttribute("Id")
    const target = rel.getAttribute("Target")
    const type = rel.getAttribute("Type") || ""
    if (id && target && type.includes("image")) {
      // Target is usually "media/image1.png" (relative to word/)
      const normalized = target.startsWith("/") ? target.slice(1) : `word/${target}`
      map.set(id, normalized)
    }
  }
  return map
}

/**
 * Recursively walk a node and collect text from <w:t> in document order.
 * Uses a manual recursion (not TreeWalker) to work safely across XMLDocument.
 */
function collectText(node: Element): string {
  const parts: string[] = []
  const walk = (el: Element) => {
    const local = el.localName
    if (local === "t") {
      parts.push(el.textContent || "")
      return
    }
    if (local === "tab") {
      parts.push("\t")
      return
    }
    if (local === "br") {
      parts.push("\n")
      return
    }
    // Recurse into children
    const children = el.children
    for (let i = 0; i < children.length; i++) {
      walk(children[i])
    }
  }
  walk(node)
  return parts.join("")
}

/**
 * Collect text preserving paragraph breaks for a given element.
 */
function collectTextWithParagraphs(node: Element): string {
  const paragraphs: string[] = []
  const pNodes = node.getElementsByTagNameNS("*", "p")
  if (pNodes.length === 0) {
    return collectText(node).trim()
  }
  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i]
    // Ensure we only pick paragraphs that are descendants of this cell directly,
    // not nested tables. But for our QE report shape, this is fine.
    const text = collectText(p).trim()
    if (text) paragraphs.push(text)
  }
  return paragraphs.join("\n")
}

/**
 * Extract image relationship IDs from a cell element.
 * Supports <a:blip r:embed="..."/> (DrawingML) and <v:imagedata r:id="..."/> (VML).
 */
function collectImageRelIds(cell: Element): string[] {
  const ids: string[] = []
  // DrawingML: a:blip r:embed
  const blips = cell.getElementsByTagNameNS("*", "blip")
  for (let i = 0; i < blips.length; i++) {
    const blip = blips[i]
    // r:embed attribute; use getAttributeNS if available, fallback to getAttribute
    const embed =
      blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") ||
      blip.getAttribute("r:embed")
    if (embed) ids.push(embed)
  }
  // VML: v:imagedata r:id
  const imagedata = cell.getElementsByTagNameNS("*", "imagedata")
  for (let i = 0; i < imagedata.length; i++) {
    const el = imagedata[i]
    const rid =
      el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
      el.getAttribute("r:id")
    if (rid) ids.push(rid)
  }
  return ids
}

/**
 * Expand merged cells: if a <w:tc> has a w:gridSpan val="N", expand to N cells.
 * Secondary cells are filled with empty cells.
 */
function getGridSpan(cell: Element): number {
  const gridSpans = cell.getElementsByTagNameNS("*", "gridSpan")
  if (gridSpans.length > 0) {
    const val =
      gridSpans[0].getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "val") ||
      gridSpans[0].getAttribute("w:val")
    const n = Number.parseInt(val || "1", 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  return 1
}

export async function parseDocx(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ stage: "unzipping", message: "Unzipping DOCX archive…", progress: 10 })

  const zip = await JSZip.loadAsync(file)

  const documentFile = zip.file("word/document.xml")
  if (!documentFile) {
    throw new Error("Invalid DOCX: missing word/document.xml")
  }
  const documentXml = await documentFile.async("string")

  const relsFile = zip.file("word/_rels/document.xml.rels")
  const relsXml = relsFile ? await relsFile.async("string") : ""

  onProgress?.({ stage: "parsing-xml", message: "Parsing document.xml…", progress: 30 })

  const relMap = relsXml ? parseRelationships(relsXml) : new Map<string, string>()

  const parser = new DOMParser()
  const doc = parser.parseFromString(documentXml, "application/xml")

  const parseError = doc.getElementsByTagName("parsererror")
  if (parseError.length > 0) {
    throw new Error("Failed to parse document.xml")
  }

  // Find all tables
  const tables = doc.getElementsByTagNameNS("*", "tbl")
  if (tables.length === 0) {
    throw new Error("No tables found in the DOCX file.")
  }

  // Try to find the target 9-column table matching our expected headers.
  let targetTable: Element | null = null
  let headers: string[] = []

  for (let i = 0; i < tables.length; i++) {
    const tbl = tables[i]
    const trs = Array.from(tbl.children).filter(
      (c) => c.localName === "tr" && c.namespaceURI?.includes("wordprocessingml"),
    )
    if (trs.length === 0) continue
    // First row candidate header
    const firstRow = trs[0]
    const tcs = Array.from(firstRow.children).filter(
      (c) => c.localName === "tc" && c.namespaceURI?.includes("wordprocessingml"),
    )
    // Expand via gridSpan
    const firstRowTexts: string[] = []
    for (const tc of tcs) {
      const span = getGridSpan(tc)
      const text = collectTextWithParagraphs(tc)
      firstRowTexts.push(text)
      for (let s = 1; s < span; s++) firstRowTexts.push("")
    }

    const normalized = firstRowTexts.map((t) => t.trim().toLowerCase())
    const expectedNorm = EXPECTED_HEADERS.map((h) => h.toLowerCase())
    // Check if first row matches expected headers (allow partial)
    const matchCount = expectedNorm.filter((h, idx) => normalized[idx] && normalized[idx].includes(h.split(" ")[0]))
      .length

    if (firstRowTexts.length >= 9 && matchCount >= 5) {
      targetTable = tbl
      headers = firstRowTexts.slice(0, 9)
      break
    }
  }

  // Fallback: pick the first table with >= 9 columns
  if (!targetTable) {
    for (let i = 0; i < tables.length; i++) {
      const tbl = tables[i]
      const trs = Array.from(tbl.children).filter(
        (c) => c.localName === "tr" && c.namespaceURI?.includes("wordprocessingml"),
      )
      if (trs.length === 0) continue
      const firstRow = trs[0]
      const tcs = Array.from(firstRow.children).filter(
        (c) => c.localName === "tc" && c.namespaceURI?.includes("wordprocessingml"),
      )
      let colCount = 0
      for (const tc of tcs) colCount += getGridSpan(tc)
      if (colCount >= 9) {
        targetTable = tbl
        const firstRowTexts: string[] = []
        for (const tc of tcs) {
          const span = getGridSpan(tc)
          const text = collectTextWithParagraphs(tc)
          firstRowTexts.push(text)
          for (let s = 1; s < span; s++) firstRowTexts.push("")
        }
        headers = firstRowTexts.slice(0, 9)
        break
      }
    }
  }

  if (!targetTable) {
    throw new Error("Could not locate a 9-column QE report table in this DOCX.")
  }

  // If headers don't look like our schema, override with canonical headers.
  const looksLikeHeaders =
    headers.filter((h) => h.trim().length > 0).length >= 5 &&
    headers.some((h) => /issue|pictures|root|solution|owner|due|status|reference|no\./i.test(h))
  if (!looksLikeHeaders) {
    headers = [...EXPECTED_HEADERS]
  } else {
    // Pad to 9
    while (headers.length < 9) headers.push(EXPECTED_HEADERS[headers.length] || "")
    headers = headers.slice(0, 9)
  }

  onProgress?.({ stage: "extracting-images", message: "Extracting images from cells…", progress: 60 })

  // Extract rows (skip header row)
  const trs = Array.from(targetTable.children).filter(
    (c) => c.localName === "tr" && c.namespaceURI?.includes("wordprocessingml"),
  )

  const rows: ParsedRow[] = []
  // Cache: path -> ParsedImage
  const imageCache = new Map<string, ParsedImage>()

  for (let rIdx = 1; rIdx < trs.length; rIdx++) {
    const tr = trs[rIdx]
    const tcs = Array.from(tr.children).filter(
      (c) => c.localName === "tc" && c.namespaceURI?.includes("wordprocessingml"),
    )

    const rowCells: ParsedCell[] = []
    for (const tc of tcs) {
      const span = getGridSpan(tc)
      const text = collectTextWithParagraphs(tc)
      const relIds = collectImageRelIds(tc)

      const images: ParsedImage[] = []
      for (const rid of relIds) {
        const path = relMap.get(rid)
        if (!path) continue
        const cached = imageCache.get(path)
        if (cached) {
          images.push(cached)
          continue
        }
        const imgFile = zip.file(path)
        if (!imgFile) continue
        const buf = await imgFile.async("arraybuffer")
        const extMatch = path.match(/\.([a-zA-Z0-9]+)$/)
        const ext = extMatch ? extMatch[1].toLowerCase() : "png"
        const mimeType = getMimeType(ext)
        const base64 = arrayBufferToBase64(buf)
        const parsed: ParsedImage = { base64, mimeType, extension: ext }
        imageCache.set(path, parsed)
        images.push(parsed)
      }

      rowCells.push({ text, images })
      for (let s = 1; s < span; s++) {
        rowCells.push({ text: "", images: [] })
      }
    }

    // Skip fully empty rows
    const hasContent = rowCells.some((c) => c.text.trim() !== "" || c.images.length > 0)
    if (!hasContent) continue

    // Pad or slice to 9 columns
    while (rowCells.length < 9) rowCells.push({ text: "", images: [] })
    rows.push(rowCells.slice(0, 9))
  }

  onProgress?.({ stage: "rendering", message: "Building preview…", progress: 90 })

  return {
    headers,
    rows,
    columnCount: 9,
  }
}
