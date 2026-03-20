import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseVerticalWBS } from '../shared/importGanttAction';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, '../Kanban/新版后台上传Excel的模板.xlsx');
const wb = XLSX.readFile(templatePath);
let sheetName = wb.SheetNames.find(
  (n: string) => n.includes('项目') || n.includes('甘特') || n.includes('Gantt'),
);
if (!sheetName) sheetName = wb.SheetNames[wb.SheetNames.length - 1];
console.log('Using sheet:', sheetName);

const ws = wb.Sheets[sheetName];
const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const result = parseVerticalWBS(rawRows, 'TEST');
if (!result) {
  console.log('PARSE_FAIL');
  process.exit(1);
}

const PROJECT_PREP_IDS = new Set(['project_launch', 'drawing_2d', 'drawing_3d', 'mtd']);
const KAIMO_FLAT_IDS = new Set(['mold_dev_pioneer', 'open_mold', 'close_mold']);
const MERGE_POINT_ID = 'mold_fai_cpk';
const T0_TRIAL_IDS = new Set([
  't0_trial',
  't0_fai_report',
  't0_appearance',
  't0_3d_report',
  't0_summary',
  'blackbox_a_converge',
  't0_first_trial',
  't0_appearance_eval',
  'issue_review_repair_flow',
  't0_issue_summary',
  'repair_plan',
  'moldbao_repair',
  't0_sample_send',
  'white_mold_buffer_pool',
  'tn_trial_repair_loop',
  'etching_gate',
  'dimension_ready',
  'structure_interference_clear',
]);
const T1_CLOSURE_IDS = new Set([
  't1_trial',
  'gl',
  't1_dimension',
  'trial_count',
  't0_closure_report',
  'blackbox_b_converge',
  'etching_process',
  'post_etch_trial_validation',
  't0_trial_post_etch',
  'gloss_roughness_test',
  'post_etch_fai_recheck',
  'post_etch_3d_recheck',
  'issue_closure_confirm',
  'post_etch_sample_send',
  'texture_appearance_tuning_loop',
]);
const PRODUCTION_IDS = new Set([
  'vmp',
  'sip',
  'sop',
  'machine_params',
  'spc_inspection',
  'prr_trial_gate',
  'system_data_localize',
  'moldbao_upload_new_mold_data',
  'ms_upload_new_mold_data',
  'notify_trial_by_email',
  'formal_trial_run',
  'sample_signoff',
  'customer_sample_confirmation',
  'cpk_32_measurement',
  'trial_3d_scan',
  'customer_other_tests',
  'transfer_to_mp',
  'customer_pilot_run',
  'customer_pilot_passed',
  'internal_mail_mold_to_mp',
]);

console.log('TOTAL_TASKS=' + result.tasks.length);
for (const t of result.tasks) {
  const sid = t.stage || '';
  let grp = '???ORPHAN???';
  if (PROJECT_PREP_IDS.has(sid)) grp = 'PREP';
  else if (KAIMO_FLAT_IDS.has(sid)) grp = 'KAIMO';
  else if (sid === MERGE_POINT_ID) grp = 'MERGE';
  else if (T0_TRIAL_IDS.has(sid)) grp = 'T0';
  else if (T1_CLOSURE_IDS.has(sid)) grp = 'T1';
  else if (PRODUCTION_IDS.has(sid)) grp = 'PROD';
  else if (t.track) grp = 'TRACK';
  console.log(grp.padEnd(14) + sid.padEnd(45) + t.nameCn);
}
