import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('project progress module scaffold', () => {
  it('registers a standalone dashboard progress route', async () => {
    const source = await loadSource('./App.tsx');

    expect(source).toContain('const ProjectProgress = lazy(() => import("./pages/dashboard/ProjectProgress"));');
    expect(source).toContain('<Route path={"/dashboard/progress"} component={ProjectProgress} />');
  });

  it('adds the project progress tab immediately after dimension analysis', async () => {
    const source = await loadSource('./pages/dashboard/DashboardHome.tsx');

    expect(source).toMatch(/'dimension-analysis',\s*'project-progress',\s*'mold-reliability'/s);
    expect(source).toContain("'project-progress': '项目进度看板'");
    expect(source).toContain("if (tab === 'project-progress')");
    expect(source).toContain("setLocation(nextUrl);");
  });

  it('keeps a dedicated progress host page with forced static chart rendering', async () => {
    const source = await loadSource('./pages/dashboard/ProjectProgress.tsx');

    expect(source).toContain('buildProjectProgressSeed');
    expect(source).toContain('taskItems={seed.taskItems}');
    expect(source).toContain('disableRemoteFetch');
    expect(source).toContain('data={seed.ganttData}');
    expect(source).toContain('S曲线概览');
    expect(source).toContain('甘特图明细');
    expect(source).toContain("const [activeTab, setActiveTab] = useState<ProgressTab>('s-curve');");
    expect(source).toContain("className=\"flex h-screen w-full flex-col overflow-hidden bg-slate-950\"");
    expect(source).toContain("className=\"min-h-0 flex-1 overflow-hidden\"");
    expect(source).toContain("setLocation('/dashboard');");
  });

  it('adds shared project progress seed interfaces for static chart injection', async () => {
    const source = await loadSource('./lib/projectProgress.ts');

    expect(source).toContain('export interface TaskItem');
    expect(source).toContain('export interface SCurvePoint');
    expect(source).toContain('export function buildProjectProgressSeed');
    expect(source).toContain('buildDemoData()');
  });

  it('allows the s-curve renderer to consume injected task items without remote fetch', async () => {
    const source = await loadSource('./components/logitech-s-curve.tsx');

    expect(source).toContain('taskItems?: TaskItem[]');
    expect(source).toContain('disableRemoteFetch?: boolean');
    expect(source).toContain('fillHeight?: boolean');
    expect(source).toContain('if (disableRemoteFetch || hasInjectedTasks)');
  });
});
