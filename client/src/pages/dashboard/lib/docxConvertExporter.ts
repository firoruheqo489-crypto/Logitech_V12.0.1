import { saveAs } from 'file-saver';
import type { Cell } from 'exceljs';
import type { ParseResult, ParsedImage } from './docxConvertParser';

const PX_PER_COL_UNIT = 7;
const PX_PER_POINT = 96 / 72;

const IMAGE_MAX_WIDTH_PX = 120;
const IMAGE_MAX_HEIGHT_PX = 120;
const IMAGE_PADDING_PX = 4;

const COLUMN_WIDTHS: Record<number, number> = {
  1: 8,
  2: 42,
  3: 20,
  4: 32,
  5: 32,
  6: 14,
  7: 18,
  8: 14,
  9: 30,
};

function normalizeDueDate(text: string): string {
  const value = (text || '').trim();
  if (!value) {
    return '';
  }
  const matches = value.match(/\d{4}-\d{1,2}-\d{1,2}/g);
  if (matches && matches.length > 0) {
    return matches.join('\n');
  }
  return value
    .split(/\r?\n+|\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeStatus(text: string): string {
  const value = (text || '').trim();
  if (!value) {
    return '';
  }
  const matches = value.match(/[A-Za-z0-9_-]+:(?:open|close)/gi);
  if (matches && matches.length > 0) {
    return matches.join('\n');
  }
  return value;
}

function getImageSize(base64: string, mimeType: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: IMAGE_MAX_WIDTH_PX, height: IMAGE_MAX_HEIGHT_PX });
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

function scaleToFit(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function normalizeImageExtension(ext: string): 'png' | 'jpeg' | 'gif' {
  const lower = ext.toLowerCase();
  if (lower === 'jpg' || lower === 'jpeg') {
    return 'jpeg';
  }
  if (lower === 'gif') {
    return 'gif';
  }
  return 'png';
}

function writeNormalCell(
  excelCell: Cell,
  cellText: string,
  columnIndex: number,
): void {
  if (columnIndex === 8) {
    const value = cellText.trim();
    const isUrl = /^https?:\/\//i.test(value);
    if (isUrl) {
      excelCell.value = { text: value, hyperlink: value };
      excelCell.font = { color: { argb: 'FF2563EB' }, underline: true };
    } else {
      excelCell.value = value;
    }
  } else if (columnIndex === 6) {
    excelCell.value = normalizeDueDate(cellText);
  } else if (columnIndex === 7) {
    excelCell.value = normalizeStatus(cellText);
  } else {
    excelCell.value = cellText;
  }
}

export async function exportDocxParseResultToXlsx(result: ParseResult, filename = 'qe-report.xlsx'): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DOCX Converter';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('QE Report', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = result.headers.map((header, index) => ({
    header,
    key: `col_${index}`,
    width: COLUMN_WIDTHS[index + 1] || 18,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex += 1) {
    const row = result.rows[rowIndex];
    const excelRowNumber = rowIndex + 2;
    const excelRow = worksheet.getRow(excelRowNumber);
    let maxRowHeightPx = 28;

    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const cell = row[columnIndex];
      const excelCell = excelRow.getCell(columnIndex + 1);

      if (columnIndex !== 2) {
        writeNormalCell(excelCell, cell.text || '', columnIndex);
      } else {
        excelCell.value = '';
      }

      excelCell.alignment = {
        vertical: 'middle',
        horizontal: columnIndex === 0 || columnIndex === 6 || columnIndex === 7 ? 'center' : 'left',
        wrapText: true,
      };

      excelCell.border = {
        top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };

      if (columnIndex === 7) {
        const normalized = normalizeStatus(cell.text || '').toLowerCase();
        if (normalized.includes('close')) {
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF059669' },
          };
          excelCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        } else if (normalized.includes('open')) {
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDC2626' },
          };
          excelCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      }

      const textValue = String(excelCell.value ?? '');
      if (textValue) {
        const lines = textValue.split('\n').reduce((acc, line) => {
          const colWidthUnits = COLUMN_WIDTHS[columnIndex + 1] || 18;
          return acc + Math.max(1, Math.ceil(line.length / Math.max(10, colWidthUnits)));
        }, 0);
        const textHeightPx = lines * 18 + 8;
        if (textHeightPx > maxRowHeightPx) {
          maxRowHeightPx = textHeightPx;
        }
      }
    }

    const pictureCell = row[2];
    if (pictureCell && pictureCell.images.length > 0) {
      const colIndex = 2;
      const colWidthPx = (COLUMN_WIDTHS[colIndex + 1] || 18) * PX_PER_COL_UNIT;
      const availableWidthPx = Math.max(40, colWidthPx - IMAGE_PADDING_PX * 2);

      let cumulativeHeightPx = IMAGE_PADDING_PX;
      for (let imageIndex = 0; imageIndex < pictureCell.images.length; imageIndex += 1) {
        const image: ParsedImage = pictureCell.images[imageIndex];
        const { width: naturalWidth, height: naturalHeight } = await getImageSize(image.base64, image.mimeType);
        const { width, height } = scaleToFit(
          naturalWidth,
          naturalHeight,
          Math.min(availableWidthPx, IMAGE_MAX_WIDTH_PX),
          IMAGE_MAX_HEIGHT_PX,
        );

        const imageId = workbook.addImage({
          base64: image.base64,
          extension: normalizeImageExtension(image.extension),
        });

        const tlCol = colIndex + IMAGE_PADDING_PX / colWidthPx;
        const tlRow = excelRowNumber - 1 + cumulativeHeightPx / Math.max(24, maxRowHeightPx);

        worksheet.addImage(imageId, {
          tl: { col: tlCol, row: tlRow },
          ext: { width, height },
          editAs: 'oneCell',
        });

        cumulativeHeightPx += height + IMAGE_PADDING_PX;
      }

      if (cumulativeHeightPx > maxRowHeightPx) {
        maxRowHeightPx = cumulativeHeightPx;
      }
    }

    excelRow.height = Math.min(800, Math.max(24, maxRowHeightPx / PX_PER_POINT));
    excelRow.commit();
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: result.headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, filename);
}
