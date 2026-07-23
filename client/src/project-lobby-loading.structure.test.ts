import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('dashboard project lobby loading', () => {
  it('reuses the projects already loaded by DashboardHome and renders a lobby skeleton', async () => {
    const [homeSource, lobbySource] = await Promise.all([
      readFile(path.resolve(__dirname, 'pages/dashboard/DashboardHome.tsx'), 'utf8'),
      readFile(path.resolve(__dirname, 'components/ProjectLobby.tsx'), 'utf8'),
    ]);

    expect(homeSource).toContain('<ProjectLobby projects={allProjects} loading={loading}');
    expect(homeSource).toContain('if (loading && activeModule)');
    expect(lobbySource).toContain('projects?: readonly ProjectData[];');
    expect(lobbySource).toContain('const resolvedModules = controlledModules ?? modules;');
    expect(lobbySource).toContain('aria-busy="true"');
  });
});
