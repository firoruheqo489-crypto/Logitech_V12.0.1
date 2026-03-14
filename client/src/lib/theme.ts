/**
 * Module accent theme — single source of truth for lobby + detail page colors.
 *
 * Colors cycle in the same order as the lobby card grid.
 * Both lobby (ProjectLobby) and detail page (DashboardHome) derive the
 * accent from the ordered unique module names coming out of dashboard_projects.
 */

export const ACCENT_PALETTE = ['cyan', 'purple', 'rose', 'amber', 'emerald', 'sky'] as const;
export type AccentKey = (typeof ACCENT_PALETTE)[number];

export interface ModuleTheme {
  key: AccentKey;
  hex: string;
  rgb: string;
}

const COLOR_MAP: Record<AccentKey, { hex: string; rgb: string }> = {
  cyan:    { hex: '#06b6d4', rgb: '6,182,212' },
  purple:  { hex: '#a855f7', rgb: '168,85,247' },
  rose:    { hex: '#f43f5e', rgb: '244,63,94' },
  amber:   { hex: '#f59e0b', rgb: '245,158,11' },
  emerald: { hex: '#10b981', rgb: '16,185,129' },
  sky:     { hex: '#0ea5e9', rgb: '14,165,233' },
};

export function getModuleTheme(moduleName: string, orderedModuleNames: string[]): ModuleTheme {
  const idx = orderedModuleNames.indexOf(moduleName);
  const key = ACCENT_PALETTE[(idx >= 0 ? idx : 0) % ACCENT_PALETTE.length];
  return { key, ...COLOR_MAP[key] };
}
