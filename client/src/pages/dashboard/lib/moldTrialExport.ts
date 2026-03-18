export interface MoldTrialExportRow {
  label: string;
  value: string;
}

export interface MoldTrialExportEvidenceRow {
  slot: string;
  label: string;
  imageUrl: string;
}

export interface MoldTrialExportStage {
  stage: string;
  summaryCards: MoldTrialExportRow[];
  thermalSettings: MoldTrialExportRow[];
  injectionProfile: MoldTrialExportRow[];
  actuals: MoldTrialExportRow[];
  evidence: MoldTrialExportEvidenceRow[];
}

export interface MoldTrialExportPayload {
  moldId: string;
  moldNo?: string;
  exportedAt: string;
  stages: MoldTrialExportStage[];
}

export type MoldTrialTemplateExporter = (payload: MoldTrialExportPayload) => Promise<void>;

let registeredTemplateExporter: MoldTrialTemplateExporter | null = null;

function sanitizeSheetName(name: string): string {
  const sanitized = name.replace(/[\\/?*\[\]:]/g, ' ').trim();
  return sanitized.slice(0, 31) || 'Sheet1';
}

function sanitizeExportFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function buildSectionRows(title: string, rows: MoldTrialExportRow[]): string[][] {
  return [
    [title],
    ['Label', 'Value'],
    ...rows.map((row) => [row.label, row.value]),
    [],
  ];
}

export function registerMoldTrialTemplateExporter(exporter: MoldTrialTemplateExporter): void {
  registeredTemplateExporter = exporter;
}

export async function defaultMoldTrialWorkbookExporter(
  payload: MoldTrialExportPayload,
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const overviewRows: string[][] = [
    ['Mold Trial Database'],
    ['Mold ID', payload.moldId],
    ['Mold No', payload.moldNo || '--'],
    ['Exported At', payload.exportedAt],
    ['Trial Stages', payload.stages.map((stage) => stage.stage).join(', ') || '--'],
  ];
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewRows);
  overviewSheet['!cols'] = [{ wch: 18 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

  payload.stages.forEach((stage) => {
    const rows: string[][] = [
      ['Mold Trial Database'],
      ['Mold ID', payload.moldId],
      ['Mold No', payload.moldNo || '--'],
      ['Trial Stage', stage.stage],
      [],
      ...buildSectionRows('Summary', stage.summaryCards),
      ...buildSectionRows('Thermal Settings', stage.thermalSettings),
      ...buildSectionRows('Injection Profile', stage.injectionProfile),
      ...buildSectionRows('Actuals & Metrology', stage.actuals),
      ['Evidence'],
      ['Slot', 'Label', 'Image URL'],
      ...stage.evidence.map((item) => [item.slot, item.label, item.imageUrl]),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(stage.stage));
  });

  const fileName = sanitizeExportFilename(
    `${payload.moldId}_${payload.moldNo || 'default'}_mold_trial_database.xlsx`,
  );
  XLSX.writeFile(workbook, fileName);
}

export async function exportMoldTrialWorkbook(
  payload: MoldTrialExportPayload,
): Promise<void> {
  if (registeredTemplateExporter) {
    await registeredTemplateExporter(payload);
    return;
  }

  await defaultMoldTrialWorkbookExporter(payload);
}
