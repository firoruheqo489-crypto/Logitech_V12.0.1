import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard import and 8D persistence guardrails', () => {
  it('keeps 8D storage independent from the imported project name', async () => {
    const componentSource = await loadSource('./pages/dashboard/components/Report8DWorkspace.tsx');
    const apiSource = await loadSource('./lib/report-8d-remote-state-api.ts');

    expect(apiSource).toContain('DEFAULT_REPORT_8D_WORKSPACE_KEY = "dashboard-report-8d"');
    expect(componentSource).toContain('const workspaceKey = DEFAULT_REPORT_8D_WORKSPACE_KEY;');
    expect(componentSource).not.toContain('normalizeWorkspaceKey(projectName)');
  });

  it('requires an explicit second action for destructive workbook replacement', async () => {
    const source = await loadSource('./pages/dashboard/DashboardHome.tsx');

    expect(source).toContain("'x-dashboard-replace-confirmation': 'allow-destructive'");
    expect(source).toContain("error.code === 'DASHBOARD_REPLACE_CONFIRMATION_REQUIRED'");
    expect(source).toContain('title="检测到高风险覆盖"');
    expect(source).toContain('confirmText="确认全量覆盖"');
  });

  it('backs up the current dashboard rows before replacement', async () => {
    const source = await loadSource('../../server/routes/dashboard.ts');
    const backupIndex = source.indexOf('backupDashboardProjectsBeforeReplace(currentRows, normalizedItems.length)');
    const replaceIndex = source.indexOf("dashboardDb.transaction(async (tx) => {");

    expect(backupIndex).toBeGreaterThan(-1);
    expect(replaceIndex).toBeGreaterThan(backupIndex);
    expect(source).toContain("const DASHBOARD_PROJECT_IMPORT_BACKUP_KEEP_LIMIT = 20;");
  });
});
