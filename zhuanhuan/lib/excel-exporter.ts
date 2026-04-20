import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import type { ParseResult, ParsedImage } from "./docx-parser"

// Excel measurement helpers
// 1 column width unit ≈ 7 pixels (at default font)
// 1 row height unit (point) ≈ 1.333 pixels (96/72)
const PX_PER_COL_UNIT = 7
const PX_PER_POINT = 96 / 72

// Target thumbnail size inside Excel cells
const IMAGE_MAX_WIDTH_PX = 120
const IMAGE_MAX_HEIGHT_PX = 120
const IMAGE_PADDING_PX = 4

const COLUMN_WIDTHS: Record<number, number> = {
  // col index (1-based) -> width units
  1: 6, // No.
  2: 42, // Issue Description
  3: 20, // Pictures (enough for ~120px image + padding)
  4: 32, // Root Cause
  5: 32, // Solution
  6: 14, // Owner
  7: 14, // Due-Date
  8: 12, // Status
  9: 30, // Reference Link
}

function getImageSize(base64: string, mimeType: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: IMAGE_MAX_WIDTH_PX, height: IMAGE_MAX_HEIGHT_PX })
    img.src = `data:${mimeType};base64,${base64}`
  })
}

function scaleToFit(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: maxW, height: maxH }
  const ratio = Math.min(maxW / w, maxH / h, 1)
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

export async function exportToExcel(
  result: ParseResult,
  filename = "qe-report.xlsx",
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "DOCX to XLSX Converter"
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet("QE Report", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: 1 }],
  })

  // Configure columns
  worksheet.columns = result.headers.map((h, i) => ({
    header: h,
    key: `col_${i}`,
    width: COLUMN_WIDTHS[i + 1] || 18,
  }))

  // Style header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" }, // near-black
    }
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    }
  })

  // Write data rows
  for (let rIdx = 0; rIdx < result.rows.length; rIdx++) {
    const row = result.rows[rIdx]
    const excelRowNumber = rIdx + 2 // header is row 1
    const excelRow = worksheet.getRow(excelRowNumber)

    let maxRowHeightPx = 24 // minimum row height in pixels

    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const cell = row[cIdx]
      const excelCell = excelRow.getCell(cIdx + 1)

      if (cIdx === 2) {
        // Pictures column: do not write text; we'll embed images below
        excelCell.value = cell.images.length > 0 ? "" : ""
      } else if (cIdx === 8 && cell.text) {
        // Reference Link column -> hyperlink if looks like URL
        const isUrl = /^https?:\/\//i.test(cell.text.trim())
        if (isUrl) {
          excelCell.value = {
            text: cell.text.trim(),
            hyperlink: cell.text.trim(),
          }
          excelCell.font = { color: { argb: "FF2563EB" }, underline: true }
        } else {
          excelCell.value = cell.text
        }
      } else {
        excelCell.value = cell.text
      }

      excelCell.alignment = {
        vertical: "middle",
        horizontal: cIdx === 0 || cIdx === 6 || cIdx === 7 ? "center" : "left",
        wrapText: true,
      }
      excelCell.border = {
        top: { style: "hair", color: { argb: "FFE5E7EB" } },
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        left: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFE5E7EB" } },
      }

      // Status conditional formatting
      if (cIdx === 7 && typeof cell.text === "string" && cell.text.toLowerCase().includes("open")) {
        excelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDC2626" }, // red-600
        }
        excelCell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        excelCell.alignment = { vertical: "middle", horizontal: "center" }
      }

      // Compute needed row height from text (rough)
      if (cell.text) {
        const colWidthUnits = COLUMN_WIDTHS[cIdx + 1] || 18
        const colWidthChars = colWidthUnits // approx chars
        const lines = cell.text.split("\n").reduce((acc, line) => {
          return acc + Math.max(1, Math.ceil(line.length / Math.max(10, colWidthChars)))
        }, 0)
        const textHeightPx = lines * 18 + 8
        if (textHeightPx > maxRowHeightPx) maxRowHeightPx = textHeightPx
      }
    }

    // Embed images for Pictures column
    const pictureCell = row[2]
    if (pictureCell && pictureCell.images.length > 0) {
      const colIndex = 2 // 0-based for Pictures
      const colWidthPx = (COLUMN_WIDTHS[colIndex + 1] || 18) * PX_PER_COL_UNIT
      const availableWidthPx = Math.max(40, colWidthPx - IMAGE_PADDING_PX * 2)

      // Stack images vertically within cell
      let cumulativeHeightPx = IMAGE_PADDING_PX
      for (let iIdx = 0; iIdx < pictureCell.images.length; iIdx++) {
        const img: ParsedImage = pictureCell.images[iIdx]
        const { width: natW, height: natH } = await getImageSize(img.base64, img.mimeType)
        const { width: drawW, height: drawH } = scaleToFit(
          natW,
          natH,
          Math.min(availableWidthPx, IMAGE_MAX_WIDTH_PX),
          IMAGE_MAX_HEIGHT_PX,
        )

        const imageId = workbook.addImage({
          base64: img.base64,
          extension: (img.extension === "jpg" ? "jpeg" : img.extension) as "png" | "jpeg" | "gif",
        })

        // Convert px offset within cell to ExcelJS tl/br coordinates.
        // tl uses { col, row } with fractional positions (0-based col, 0-based row).
        const tlCol = colIndex + IMAGE_PADDING_PX / colWidthPx

        // Compute row offsets. We use pixel-based positioning relative to the start of the row.
        // ExcelJS supports ext (extent) in EMUs as alternative, but tl+ext is simplest.
        const tlRow = excelRowNumber - 1 + cumulativeHeightPx / (maxRowHeightPx || 24)

        worksheet.addImage(imageId, {
          tl: { col: tlCol, row: tlRow },
          ext: { width: drawW, height: drawH },
          editAs: "oneCell",
        })

        cumulativeHeightPx += drawH + IMAGE_PADDING_PX
      }

      if (cumulativeHeightPx > maxRowHeightPx) maxRowHeightPx = cumulativeHeightPx
    }

    // Set row height based on max content (convert px -> points)
    excelRow.height = Math.min(600, Math.max(24, maxRowHeightPx / PX_PER_POINT))

    // Alternating row background (subtle)
    if (rIdx % 2 === 1) {
      excelRow.eachCell((c, colNumber) => {
        // Preserve red fill for status cell
        if (colNumber === 8 && c.fill && (c.fill as ExcelJS.FillPattern).fgColor?.argb === "FFDC2626") return
        if (!c.fill || (c.fill as ExcelJS.FillPattern).pattern !== "solid") {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          }
        }
      })
    }

    excelRow.commit()
  }

  // Auto filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: result.headers.length },
  }

  // Write workbook buffer
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  saveAs(blob, filename)
}
