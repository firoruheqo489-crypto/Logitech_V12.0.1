import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, '../Kanban/新版后台上传Excel的模板.xlsx');
const wb = XLSX.readFile(templatePath);

console.log('Sheet names:', wb.SheetNames);

for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=== Sheet: "${sn}" - ${rawRows.length} rows ===`);
  for (let i = 0; i < Math.min(rawRows.length, 15); i += 1) {
    const row = rawRows[i] as unknown[];
    if (!row) {
      console.log(`ROW ${i}: (null)`);
      continue;
    }
    const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
    console.log(`ROW ${i}: ${cells}`);
  }
  if (rawRows.length > 15) {
    console.log(`... total ${rawRows.length} rows`);
    for (let i = Math.max(15, rawRows.length - 5); i < rawRows.length; i += 1) {
      const row = rawRows[i] as unknown[];
      if (!row) continue;
      const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
      console.log(`ROW ${i}: ${cells}`);
    }
  }
}
