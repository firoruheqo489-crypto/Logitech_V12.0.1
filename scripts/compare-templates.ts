import XLSX from 'xlsx';
import { parseVerticalWBS } from '../shared/importGanttAction';

// Compare old template vs new template
const files = [
  { label: 'OLD', path: 'D:/V6.3/HT/V3/Kanban/后台上传Excel的模板.xlsx' },
  { label: 'NEW', path: 'D:/V6.3/HT/V3/Kanban/新版后台上传Excel的模板.xlsx' },
];

for (const f of files) {
  try {
    const wb = XLSX.readFile(f.path);
    let sheetName = wb.SheetNames.find((n: string) => n.includes('项目') || n.includes('甘特') || n.includes('Gantt'));
    if (!sheetName) sheetName = wb.SheetNames[wb.SheetNames.length - 1];
    const ws = wb.Sheets[sheetName];
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const result = parseVerticalWBS(rawRows, 'TEST');
    
    console.log(`\n========== ${f.label} (Sheet: ${sheetName}) ==========`);
    console.log(`Tasks: ${result?.tasks?.length ?? 0}`);
    if (result) {
      const phases: Record<string, number> = {};
      for (const t of result.tasks) { phases[t.phase] = (phases[t.phase] || 0) + 1; }
      console.log(`Phases: ${JSON.stringify(phases)}`);
      console.log(`Tracks: ${result.tasks.filter(t => t.track).length}`);
      // Show all task names
      for (const t of result.tasks) {
        console.log(`  ${t.wbsId.padEnd(8)} ${t.stage.padEnd(45)} ${t.nameCn}`);
      }
    }
  } catch (e: any) {
    console.log(`\n========== ${f.label} ==========`);
    console.log(`ERROR: ${e.message}`);
  }
}
