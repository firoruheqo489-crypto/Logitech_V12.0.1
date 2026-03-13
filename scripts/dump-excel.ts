import XLSX from 'xlsx';

const wb = XLSX.readFile('D:/V6.3/HT/V3/Kanban/新版后台上传Excel的模板.xlsx');
console.log('Sheet names:', wb.SheetNames);

for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=== Sheet: "${sn}" — ${rawRows.length} rows ===`);
  // dump first 15 rows
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i] as unknown[];
    if (!row) { console.log(`ROW ${i}: (null)`); continue; }
    const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
    console.log(`ROW ${i}: ${cells}`);
  }
  // If more than 15 rows, show count
  if (rawRows.length > 15) {
    console.log(`... total ${rawRows.length} rows`);
    // Also dump last 5 rows
    for (let i = Math.max(15, rawRows.length - 5); i < rawRows.length; i++) {
      const row = rawRows[i] as unknown[];
      if (!row) continue;
      const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
      console.log(`ROW ${i}: ${cells}`);
    }
  }
}
