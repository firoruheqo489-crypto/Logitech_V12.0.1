export interface ModuleTheme {
  key: string;
  hex: string;
  rgb: string;
  bg: string;
  ambientGlow: string;
  gradient: string;
  textGradient: string;
  borderFocus: string;
  glassBorder: string;
  shadowGlow: string;
  iconBg: string;
  buttonBg: string;
  progressBg: string;
  surfaceGlow: string;
  text: string;
  fill: string;
}

type ModuleThemeConfig = Omit<ModuleTheme, 'key'>;

const THEME_MAP: Record<string, ModuleThemeConfig> = {
  ziti: {
    bg: 'bg-cyan-400',
    ambientGlow: 'bg-cyan-500',
    gradient: 'bg-gradient-to-r from-cyan-600 to-blue-600',
    textGradient: 'from-white to-cyan-300',
    borderFocus: 'border-cyan-500/50 hover:border-cyan-500',
    glassBorder: 'border-cyan-500/20 hover:border-cyan-500/50',
    shadowGlow: 'shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]',
    iconBg: 'bg-cyan-500/10',
    buttonBg: 'bg-gradient-to-r from-cyan-600 to-blue-600',
    progressBg: 'bg-cyan-500',
    surfaceGlow: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    fill: 'fill-cyan-500',
    hex: '#22d3ee',
    rgb: '34,211,238',
  },
  logitech: {
    bg: 'bg-cyan-400',
    ambientGlow: 'bg-cyan-500',
    gradient: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
    textGradient: 'from-white to-cyan-300',
    borderFocus: 'border-cyan-500/50 hover:border-cyan-500',
    glassBorder: 'border-cyan-500/20 hover:border-cyan-500/50',
    shadowGlow: 'shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]',
    iconBg: 'bg-cyan-500/10',
    buttonBg: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
    progressBg: 'bg-cyan-400',
    surfaceGlow: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    fill: 'fill-cyan-500',
    hex: '#22d3ee',
    rgb: '34,211,238',
  },
  'bioko-m': {
    bg: 'bg-purple-500',
    ambientGlow: 'bg-purple-500',
    gradient: 'bg-gradient-to-r from-purple-600 to-pink-600',
    textGradient: 'from-white to-purple-300',
    borderFocus: 'border-purple-500/50 hover:border-purple-500',
    glassBorder: 'border-purple-500/20 hover:border-purple-500/50',
    shadowGlow: 'shadow-purple-500/20 hover:shadow-purple-500/40 hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]',
    iconBg: 'bg-purple-500/10',
    buttonBg: 'bg-gradient-to-r from-purple-600 to-pink-600',
    progressBg: 'bg-purple-500',
    surfaceGlow: 'bg-purple-500/10',
    text: 'text-purple-400',
    fill: 'fill-purple-500',
    hex: '#a855f7',
    rgb: '168,85,247',
  },
  'malabo-x': {
    bg: 'bg-rose-400',
    ambientGlow: 'bg-rose-500',
    gradient: 'bg-gradient-to-r from-rose-600 to-rose-400',
    textGradient: 'from-white to-rose-300',
    borderFocus: 'border-rose-500/50 hover:border-rose-500',
    glassBorder: 'border-rose-500/20 hover:border-rose-500/50',
    shadowGlow: 'shadow-rose-500/20 hover:shadow-rose-500/40 hover:shadow-[0_0_25px_rgba(244,63,94,0.3)]',
    iconBg: 'bg-rose-500/10',
    buttonBg: 'bg-gradient-to-r from-rose-600 to-rose-400',
    progressBg: 'bg-rose-400',
    surfaceGlow: 'bg-rose-500/10',
    text: 'text-rose-400',
    fill: 'fill-rose-500',
    hex: '#fb7185',
    rgb: '251,113,133',
  },
  annobon: {
    bg: 'bg-amber-400',
    ambientGlow: 'bg-amber-500',
    gradient: 'bg-gradient-to-r from-amber-600 to-amber-400',
    textGradient: 'from-white to-amber-300',
    borderFocus: 'border-amber-500/50 hover:border-amber-500',
    glassBorder: 'border-amber-500/20 hover:border-amber-500/50',
    shadowGlow: 'shadow-amber-500/20 hover:shadow-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.3)]',
    iconBg: 'bg-amber-500/10',
    buttonBg: 'bg-gradient-to-r from-amber-600 to-amber-400',
    progressBg: 'bg-amber-400',
    surfaceGlow: 'bg-amber-500/10',
    text: 'text-amber-400',
    fill: 'fill-amber-500',
    hex: '#fbbf24',
    rgb: '251,191,36',
  },
  'corisco-s': {
    bg: 'bg-emerald-400',
    ambientGlow: 'bg-emerald-500',
    gradient: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
    textGradient: 'from-white to-emerald-300',
    borderFocus: 'border-emerald-500/50 hover:border-emerald-500',
    glassBorder: 'border-emerald-500/20 hover:border-emerald-500/50',
    shadowGlow: 'shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]',
    iconBg: 'bg-emerald-500/10',
    buttonBg: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
    progressBg: 'bg-emerald-400',
    surfaceGlow: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    fill: 'fill-emerald-500',
    hex: '#34d399',
    rgb: '52,211,153',
  },
  'elobey-r': {
    bg: 'bg-indigo-400',
    ambientGlow: 'bg-indigo-500',
    gradient: 'bg-gradient-to-r from-indigo-600 to-indigo-400',
    textGradient: 'from-white to-indigo-300',
    borderFocus: 'border-indigo-500/50 hover:border-indigo-500',
    glassBorder: 'border-indigo-500/20 hover:border-indigo-500/50',
    shadowGlow: 'shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.3)]',
    iconBg: 'bg-indigo-500/10',
    buttonBg: 'bg-gradient-to-r from-indigo-600 to-indigo-400',
    progressBg: 'bg-indigo-400',
    surfaceGlow: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    fill: 'fill-indigo-500',
    hex: '#818cf8',
    rgb: '129,140,248',
  },
  default: {
    bg: 'bg-slate-400',
    ambientGlow: 'bg-slate-500',
    gradient: 'bg-gradient-to-r from-slate-600 to-slate-400',
    textGradient: 'from-white to-slate-300',
    borderFocus: 'border-slate-500/50 hover:border-slate-500',
    glassBorder: 'border-slate-500/20 hover:border-slate-500/50',
    shadowGlow: 'shadow-slate-500/20 hover:shadow-slate-500/40 hover:shadow-[0_0_25px_rgba(100,116,139,0.3)]',
    iconBg: 'bg-slate-500/10',
    buttonBg: 'bg-gradient-to-r from-slate-600 to-slate-400',
    progressBg: 'bg-slate-400',
    surfaceGlow: 'bg-slate-500/10',
    text: 'text-slate-400',
    fill: 'fill-slate-500',
    hex: '#94a3b8',
    rgb: '148,163,184',
  },
};

const MODULE_THEME_SEQUENCE = [
  'logitech',
  'bioko-m',
  'malabo-x',
  'annobon',
  'corisco-s',
  'elobey-r',
] as const;

const LOBBY_HEAD_MODULE_NAMES = ['ziti', 'bioko -m'] as const;
const LOBBY_TAIL_MODULE_NAMES = ['kiddy'] as const;

export function normalizeModuleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function orderModuleNamesForDisplay(moduleNames: string[]): string[] {
  const head: string[] = [];
  const middle: string[] = [];
  const tail: string[] = [];

  for (const moduleName of moduleNames) {
    const normalizedName = normalizeModuleName(moduleName);
    if (LOBBY_HEAD_MODULE_NAMES.includes(normalizedName as (typeof LOBBY_HEAD_MODULE_NAMES)[number])) {
      head.push(moduleName);
      continue;
    }
    if (LOBBY_TAIL_MODULE_NAMES.includes(normalizedName as (typeof LOBBY_TAIL_MODULE_NAMES)[number])) {
      tail.push(moduleName);
      continue;
    }
    middle.push(moduleName);
  }

  head.sort((left, right) => {
    const leftIndex = LOBBY_HEAD_MODULE_NAMES.indexOf(
      normalizeModuleName(left) as (typeof LOBBY_HEAD_MODULE_NAMES)[number],
    );
    const rightIndex = LOBBY_HEAD_MODULE_NAMES.indexOf(
      normalizeModuleName(right) as (typeof LOBBY_HEAD_MODULE_NAMES)[number],
    );
    return leftIndex - rightIndex;
  });

  return [...head, ...middle, ...tail];
}

export function getModuleThemeByIndex(moduleName: string, fallbackIndex = 0): ModuleTheme {
  if (normalizeModuleName(moduleName) === 'default') {
    return { key: 'default', ...THEME_MAP.default };
  }

  const fallbackKey =
    MODULE_THEME_SEQUENCE[Math.max(0, fallbackIndex) % MODULE_THEME_SEQUENCE.length] ?? 'default';
  return { key: fallbackKey, ...THEME_MAP[fallbackKey] };
}

export function getModuleTheme(moduleName: string, orderedModuleNames: string[] = []): ModuleTheme {
  const fallbackIndex = orderedModuleNames.indexOf(moduleName);
  return getModuleThemeByIndex(moduleName, fallbackIndex >= 0 ? fallbackIndex : 0);
}

export function getThemeBorderClass(borderFocus: string): string {
  return borderFocus.split(' ').find((token) => !token.startsWith('hover:')) ?? 'border-slate-500/50';
}

export function getThemeGlowClass(shadowGlow: string): string {
  return shadowGlow
    .split(' ')
    .map((token) => token.replace(/^hover:/, ''))
    .join(' ');
}

export { THEME_MAP };
