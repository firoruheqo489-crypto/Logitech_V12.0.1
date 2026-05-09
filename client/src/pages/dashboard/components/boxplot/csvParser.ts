/**
 * CSV Parser for Boxplot Data Ingestion
 * Expected format: Station/Dimension, Measurement_Value
 * Each row maps a measurement to a station/dimension group.
 */

export interface CsvParseResult {
  success: boolean;
  data: Record<string, number[]>;
  error?: string;
  rowCount: number;
}

export function parseBoxplotCsv(csvText: string): CsvParseResult {
  const lines = csvText.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return { success: false, data: {}, error: "CSV 文件至少需要包含表头和一行数据", rowCount: 0 };
  }

  // Detect delimiter (comma or semicolon or tab)
  const headerLine = lines[0];
  const delimiter = headerLine.includes('\t') ? '\t' : headerLine.includes(';') ? ';' : ',';

  const header = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

  if (header.length < 2) {
    return { success: false, data: {}, error: "CSV 表头需要至少两列（分组, 测量值）", rowCount: 0 };
  }

  const grouped: Record<string, number[]> = {};
  let validRows = 0;
  let errorRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cells.length < 2) {
      errorRows++;
      continue;
    }

    const station = cells[0].trim();
    const valueStr = cells[1].trim();
    const value = parseFloat(valueStr);

    if (!station || isNaN(value)) {
      errorRows++;
      continue;
    }

    if (!grouped[station]) {
      grouped[station] = [];
    }
    grouped[station].push(value);
    validRows++;
  }

  if (validRows === 0) {
    return { success: false, data: {}, error: `未解析到有效数据行（${errorRows} 行格式错误）`, rowCount: 0 };
  }

  if (errorRows > validRows * 0.5) {
    return { success: false, data: {}, error: `格式错误行过多（${errorRows}/${errorRows + validRows}），请检查 CSV 格式`, rowCount: validRows };
  }

  return { success: true, data: grouped, rowCount: validRows };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, 'utf-8');
  });
}
