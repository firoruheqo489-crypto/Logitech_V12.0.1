import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Check,
  ChevronUp,
  Gauge,
  Grid3X3,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import './doe/doe-workspace.css';
import {
  analyzeTaguchiMatrix,
  validateDeviationInputs,
  type TaguchiAnalyticsResult,
} from './doe/utils/analyticsEngine';
import {
  buildActiveFactors,
  generateTaguchiMatrix,
  selectTaguchiArrayName,
  TAGUCHI_FACTOR_KEYS,
  type HydratedExperimentRow,
  type TaguchiActiveFactor,
  type TaguchiArrayName,
  type TaguchiFactorDefinition,
  type TaguchiFactorDefinitions,
  type TaguchiFactorKey,
} from './doe/taguchiEngine';

type DoeTrialHeaderFields = {
  experimentName: string;
  batchId: string;
  experimentDate: string;
  owner: string;
  equipment: string;
  notes: string;
};

const TRIAL_HEADER_ITEMS: Array<{
  key: keyof DoeTrialHeaderFields;
  label: string;
  type?: 'text' | 'date';
  placeholder?: string;
}> = [
  { key: 'experimentName', label: '\u5b9e\u9a8c\u540d\u79f0', placeholder: '\u8f93\u5165\u5b9e\u9a8c\u540d\u79f0' },
  { key: 'batchId', label: '\u6279\u6b21 / \u6837\u672c', placeholder: '\u8f93\u5165\u6279\u6b21\u53f7\u6216\u6837\u672c\u7f16\u53f7' },
  { key: 'experimentDate', label: '\u5b9e\u9a8c\u65e5\u671f', type: 'date' },
  { key: 'owner', label: '\u8d1f\u8d23\u4eba', placeholder: '\u8f93\u5165\u8d1f\u8d23\u4eba' },
  { key: 'equipment', label: '\u8bbe\u5907 / \u5de5\u4f4d', placeholder: '\u8f93\u5165\u8bbe\u5907\u540d\u79f0\u6216\u5de5\u4f4d' },
  { key: 'notes', label: '\u5907\u6ce8', placeholder: '\u8f93\u5165\u53ef\u9009\u8bf4\u660e' },
];

const initialTrialHeaderFields: DoeTrialHeaderFields = {
  experimentName: '',
  batchId: '',
  experimentDate: '',
  owner: '',
  equipment: '',
  notes: '',
};

const FACTOR_DEFAULTS: Array<{
  key: TaguchiFactorKey;
  enabled: boolean;
  unit: string;
  levels: [string, string, string];
}> = [
  { key: 'factor1', enabled: true, unit: '', levels: ['1', '2', '3'] },
  { key: 'factor2', enabled: true, unit: '', levels: ['10', '20', '30'] },
  { key: 'factor3', enabled: true, unit: '', levels: ['100', '200', '300'] },
  { key: 'factor4', enabled: true, unit: '', levels: ['0.5', '1.0', '1.5'] },
  { key: 'factor5', enabled: false, unit: '', levels: ['5', '10', '15'] },
  { key: 'factor6', enabled: false, unit: '', levels: ['50', '60', '70'] },
  { key: 'factor7', enabled: false, unit: '', levels: ['0.1', '0.2', '0.3'] },
  { key: 'factor8', enabled: false, unit: '', levels: ['400', '500', '600'] },
  { key: 'factor9', enabled: false, unit: '', levels: ['1000', '1200', '1400'] },
];

const DISPLAY_FACTOR_KEYS = TAGUCHI_FACTOR_KEYS.slice(0, 6);

const CHART_COLORS = ['#00E5FF', '#6366f1', '#10b981', '#f59e0b', '#fb7185', '#a855f7', '#14b8a6', '#f97316', '#84cc16'];

function createInitialFactorDefinitions(): TaguchiFactorDefinitions {
  return FACTOR_DEFAULTS.reduce((next, item, index) => {
    next[item.key] = {
      enabled: item.enabled,
      label: `\u56e0\u5b50 ${index + 1}`,
      shortLabel: `F${index + 1}`,
      unit: item.unit,
      levels: [...item.levels] as [string, string, string],
    };

    return next;
  }, {} as TaguchiFactorDefinitions);
}

function cloneFactorDefinitions(source: TaguchiFactorDefinitions): TaguchiFactorDefinitions {
  return TAGUCHI_FACTOR_KEYS.reduce((next, key) => {
    next[key] = {
      ...source[key],
      levels: [...source[key].levels] as [string, string, string],
    };
    return next;
  }, {} as TaguchiFactorDefinitions);
}

function cloneInitialTrialHeaderFields(): DoeTrialHeaderFields {
  return { ...initialTrialHeaderFields };
}

function formatEngineeringValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function formatInvalidReason(reason: 'empty' | 'non_numeric' | 'negative'): string {
  const labels = {
    empty: '\u4e3a\u7a7a',
    non_numeric: '\u975e\u6570\u5b57',
    negative: '\u8d1f\u6570',
  };

  return labels[reason];
}

function formatOptimalValue(value: unknown, unit: string): string {
  if (value === undefined || value === null || value === '') return '-';
  return unit ? `${String(value)} ${unit}` : String(value);
}

function DoeHeader() {
  return (
    <header className="hidden">
      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        <div className="flex min-h-16 flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div
                className="absolute -inset-2 rounded-2xl bg-[#00E5FF]/20 blur-xl"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#00B8D4] shadow-[0_0_25px_rgba(0,229,255,0.4)]">
                <Activity className="h-5 w-5 text-black" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">{'\u901a\u7528 DOE \u5de5\u4f5c\u53f0'}</h2>
              <p className="text-[10px] tracking-wider text-white/40">{'\u901a\u7528 Taguchi DOE \u5de5\u4f5c\u53f0 v3.0'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function TrialHeaderPanel({
  fields,
  onChange,
}: {
  fields: DoeTrialHeaderFields;
  onChange: (field: keyof DoeTrialHeaderFields, value: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="section-label mb-2">{'\u8868\u5934'}</div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{'\u5b9e\u9a8c\u4fe1\u606f'}</h2>
        <p className="mt-1 text-sm text-white/40">{'\u8bb0\u5f55\u672c\u6b21 DOE \u7684\u901a\u7528\u4e0a\u4e0b\u6587\u4fe1\u606f'}</p>
      </div>

      <div className="glass-card-elevated rounded-2xl p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TRIAL_HEADER_ITEMS.map((item) => (
            <label key={item.key} className="space-y-2">
              <span className="block text-sm font-medium text-white/85">{item.label}</span>
              <input
                type={item.type || 'text'}
                value={fields[item.key]}
                onChange={(event) => onChange(item.key, event.target.value)}
                placeholder={item.placeholder}
                className="premium-input h-11 w-full rounded-xl px-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function LevelChip({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`relative space-y-2 ${disabled ? 'factor-disabled' : ''}`}>
      <span className={`absolute -top-2 left-3 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
        label === 'L1'
          ? 'bg-emerald-500/20 text-emerald-400'
          : label === 'L2'
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-rose-500/20 text-rose-400'
      }`}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'\u8f93\u5165\u6c34\u5e73\u503c'}
        className="premium-input h-12 w-full rounded-xl px-3 pt-1 text-center font-mono text-sm text-white/90 placeholder:text-white/20 focus:outline-none disabled:cursor-not-allowed"
      />
    </label>
  );
}

function FactorCard({
  factorKey,
  factor,
  onToggle,
  onFieldChange,
  onLevelChange,
}: {
  factorKey: TaguchiFactorKey;
  factor: TaguchiFactorDefinition;
  onToggle: (factor: TaguchiFactorKey) => void;
  onFieldChange: (factor: TaguchiFactorKey, field: 'label' | 'unit', value: string) => void;
  onLevelChange: (factor: TaguchiFactorKey, level: number, value: string) => void;
}) {
  const index = TAGUCHI_FACTOR_KEYS.indexOf(factorKey) + 1;

  return (
    <div
      className={`glass-card-elevated radial-glow space-y-6 overflow-hidden rounded-2xl p-6 ${
        factor.enabled ? '' : 'opacity-75'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
        <div className="rounded-xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 p-2.5">
          <Gauge className="h-5 w-5 text-[#00E5FF]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">{factor.label || `\u56e0\u5b50 ${index}`}</h3>
            <span className="rounded-md border border-[#00E5FF]/20 bg-[#00E5FF]/10 px-2 py-0.5 font-mono text-[10px] text-[#00E5FF]/80">
              {factor.shortLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/40">{'\u4e09\u6c34\u5e73\u56e0\u5b50\u914d\u7f6e'}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(factorKey)}
          className={`group flex w-[180px] items-center gap-4 rounded-xl p-4 transition-all duration-300 ${
            factor.enabled
              ? 'glass-card'
              : 'glass-inner hover:bg-white/[0.03]'
          }`}
          aria-pressed={factor.enabled}
        >
          <div
            className={`relative h-8 w-16 rounded-full transition-all duration-300 ${
              factor.enabled
                ? 'bg-gradient-to-r from-[#6fd0ea] to-[#54b8d4] shadow-[0_0_14px_rgba(0,229,255,0.22)]'
                : 'border border-white/[0.10] bg-white/[0.06]'
            }`}
          >
            {!factor.enabled && (
              <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />
            )}
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`${factor.enabled ? 'bg-slate-100' : 'bg-white/80'} absolute top-1 h-6 w-6 rounded-full shadow-lg`}
              animate={{ x: factor.enabled ? 32 : 4 }}
              style={{
                boxShadow: factor.enabled
                  ? '0 2px 8px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.08)'
                  : '0 2px 4px rgba(0,0,0,0.4)',
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${factor.enabled ? 'text-[#8ed8ea]/75' : 'text-white/30'}`}>
              {factor.enabled ? 'Active' : 'Inactive'}
            </span>
            <div className={`relative h-2.5 w-2.5 rounded-full ${factor.enabled ? 'bg-[#8ed8ea]' : 'bg-white/20'}`} />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
        <label className="space-y-2">
          <span className="block text-sm font-medium text-white/85">{'\u56e0\u5b50\u540d\u79f0'}</span>
          <input
            type="text"
            value={factor.label}
            onChange={(event) => onFieldChange(factorKey, 'label', event.target.value)}
            placeholder={`\u56e0\u5b50 ${index}`}
            className="premium-input h-11 w-full rounded-xl px-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-medium text-white/85">{'\u5355\u4f4d'}</span>
          <input
            type="text"
            value={factor.unit}
            onChange={(event) => onFieldChange(factorKey, 'unit', event.target.value)}
            placeholder={'\u53ef\u9009'}
            className="premium-input h-11 w-full rounded-xl px-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {factor.levels.map((levelValue, levelIndex) => (
          <LevelChip
            key={`${factorKey}-level-${levelIndex + 1}`}
            label={`L${levelIndex + 1}`}
            value={levelValue}
            disabled={!factor.enabled}
            onChange={(value) => onLevelChange(factorKey, levelIndex, value)}
          />
        ))}
      </div>
    </div>
  );
}

function FactorBuilder({
  factorDefinitions,
  activeFactorCount,
  arrayType,
  canReset,
  onFactorToggle,
  onFactorFieldChange,
  onLevelChange,
  onReset,
}: {
  factorDefinitions: TaguchiFactorDefinitions;
  activeFactorCount: number;
  arrayType: TaguchiArrayName | null;
  canReset: boolean;
  onFactorToggle: (factor: TaguchiFactorKey) => void;
  onFactorFieldChange: (factor: TaguchiFactorKey, field: 'label' | 'unit', value: string) => void;
  onLevelChange: (factor: TaguchiFactorKey, level: number, value: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2">Section A</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{'\u56e0\u5b50\u914d\u7f6e'}</h2>
          <p className="mt-1 text-sm text-white/40">{'\u914d\u7f6e\u6700\u591a 6 \u4e2a\u4e09\u6c34\u5e73 DOE \u56e0\u5b50'}</p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <button
            type="button"
            onClick={onReset}
            disabled={!canReset}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all md:w-auto ${
              canReset
                ? 'glass-card text-white/80 hover:bg-white/[0.06] hover:text-white'
                : 'glass-inner text-white/30'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{'\u91cd\u7f6e DOE \u6570\u636e'}</span>
          </button>
          <div className="glass-card-elevated flex w-full items-center justify-around gap-4 rounded-2xl px-5 py-3 md:w-auto md:justify-start">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-white/40">{'\u542f\u7528\u56e0\u5b50'}</span>
              <span className="font-mono text-2xl font-bold text-[#00E5FF]">{activeFactorCount}</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-white/40">{'\u6b63\u4ea4\u9635\u5217'}</span>
              <span className="font-mono text-2xl font-bold text-[#00E5FF]">{arrayType ?? '--'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-2">
        {DISPLAY_FACTOR_KEYS.map((factorKey) => (
          <FactorCard
            key={factorKey}
            factorKey={factorKey}
            factor={factorDefinitions[factorKey]}
            onToggle={onFactorToggle}
            onFieldChange={onFactorFieldChange}
            onLevelChange={onLevelChange}
          />
        ))}
      </div>
    </section>
  );
}

function TaguchiMatrix({
  arrayType,
  activeFactors,
  generated,
  onGenerate,
  matrixData,
  onDeviationChange,
  onScanUpload,
}: {
  arrayType: TaguchiArrayName | null;
  activeFactors: TaguchiActiveFactor[];
  generated: boolean;
  onGenerate: () => void;
  matrixData: HydratedExperimentRow[];
  onDeviationChange: (run: number, value: string) => void;
  onScanUpload: (run: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const rowCount = arrayType ? Number.parseInt(arrayType.slice(1), 10) : 0;
  const canGenerate = activeFactors.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    onGenerate();
    setIsGenerating(false);
    setExpanded(true);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2">Section B</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{'\u6b63\u4ea4\u8bd5\u9a8c\u77e9\u9635'}</h2>
          <p className="mt-1 text-sm text-white/40">{'\u751f\u6210\u8bd5\u9a8c\u8fd0\u884c\u8868\u5e76\u8bb0\u5f55\u54cd\u5e94\u503c'}</p>
        </div>
        <div className="glass-card flex w-fit items-center gap-3 rounded-xl px-4 py-2.5">
          <Grid3X3 className="h-4 w-4 text-[#00E5FF]/70" />
          <span className="font-mono text-lg font-bold text-[#00E5FF]">{arrayType ?? '--'}</span>
          <div className="h-5 w-px bg-white/10" />
          <span className="text-xs text-white/50">{rowCount || 0} {'\u7ec4\u5b9e\u9a8c'}</span>
        </div>
      </div>

      {!generated && (
        <motion.button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className={`flex w-full items-center justify-center gap-4 rounded-2xl py-5 text-base font-semibold transition-all ${
            isGenerating
              ? 'glass-card-elevated'
              : canGenerate
                ? 'btn-premium-solid btn-pulse'
                : 'glass-inner cursor-not-allowed text-white/30'
          }`}
          whileHover={!isGenerating && canGenerate ? { scale: 1.01, y: -2 } : {}}
          whileTap={!isGenerating && canGenerate ? { scale: 0.99 } : {}}
        >
          {isGenerating ? (
            <>
              <motion.div
                className="h-5 w-5 rounded-full border-2 border-[#00E5FF]/30 border-t-[#00E5FF]"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-white/70">{'\u6b63\u5728\u751f\u6210\u77e9\u9635...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>{canGenerate ? '\u751f\u6210\u6b63\u4ea4\u77e9\u9635' : '\u81f3\u5c11\u542f\u7528 1 \u4e2a\u56e0\u5b50\u540e\u518d\u751f\u6210\u77e9\u9635'}</span>
            </>
          )}
        </motion.button>
      )}

      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="glass-card-elevated glow-teal overflow-hidden rounded-2xl">
              <button
                type="button"
                className="flex w-full items-center justify-between border-b border-white/[0.08] px-4 py-4 transition-colors hover:bg-white/[0.02] md:px-6"
                onClick={() => setExpanded((current) => !current)}
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-2">
                    <Grid3X3 className="h-4 w-4 text-cyan-300" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-white">{'\u5b9e\u9a8c\u8fd0\u884c\u6570\u636e'}</span>
                    <span className="ml-3 hidden text-xs text-white/40 md:inline">{'\u8fd0\u884c\u660e\u7ec6'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-cyan-300/80">{rowCount} {'\u7ec4'}</span>
                  <motion.div animate={{ rotate: expanded ? 0 : 180 }} transition={{ duration: 0.2 }}>
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-[500px] overflow-auto scrollbar-soft">
                      <table className="w-full min-w-[760px]">
                        <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-xl">
                          <tr className="border-b border-cyan-500/10">
                            <th className="w-16 px-4 py-4 text-left text-[10px] font-bold tracking-wider text-white/50">
                              RUN
                            </th>
                            {activeFactors.map((factor) => (
                              <th
                                key={factor.key}
                                className="px-3 py-4 text-center text-[10px] font-bold tracking-wider text-slate-400"
                              >
                                <span className="block">{factor.shortLabel}</span>
                                <span className="mt-1 block font-normal tracking-normal text-slate-500">
                                  {factor.unit || '\u6570\u503c'}
                                </span>
                              </th>
                            ))}
                            <th className="w-32 px-4 py-4 text-center text-[10px] font-bold tracking-wider text-cyan-300/80">
                              {'\u54cd\u5e94\u503c'}
                            </th>
                            <th className="w-44 px-4 py-4 text-center text-[10px] font-bold tracking-wider text-cyan-300/80">
                              {'\u5b9e\u9a8c\u8bb0\u5f55'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrixData.slice(0, rowCount).map((row, rowIndex) => (
                            <motion.tr
                              key={row.run}
                              className="data-row border-b border-white/[0.04] last:border-b-0"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: rowIndex * 0.02 }}
                            >
                              <td className="px-4 py-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.12)]">
                                  <span className="font-mono text-sm font-bold text-cyan-300">
                                    {String(row.run).padStart(2, '0')}
                                  </span>
                                </div>
                              </td>
                              {activeFactors.map((factor) => {
                                const level = row.levelCodes[factor.key];

                                return (
                                  <td key={`${row.run}-${factor.key}`} className="px-3 py-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-mono text-sm font-semibold text-white/85">
                                        {formatEngineeringValue(row[factor.key])}
                                      </span>
                                      <span
                                        className={`level-${level} inline-flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-semibold`}
                                      >
                                        {level}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-4">
                                <input
                                  type="text"
                                  value={row.maxDeviation ?? ''}
                                  onChange={(event) => onDeviationChange(row.run, event.target.value)}
                                  placeholder="0.000"
                                  className="h-9 w-full rounded-lg border border-slate-800 bg-black/50 px-3 text-center font-mono text-xs text-gray-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => onScanUpload(row.run)}
                                  className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-[11px] font-medium transition-all ${
                                    row.scanImage
                                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                      : 'border-slate-800 bg-black/40 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-200'
                                  }`}
                                >
                                  {row.scanImage ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      <span>{'\u5df2\u6807\u8bb0'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3.5 w-3.5 text-white/40" />
                                      <span className="text-white/40">{'\u4e0a\u4f20\u9644\u4ef6'}</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="border-t border-cyan-500/10 bg-black/20 px-4 py-4 md:px-6">
                <div className="flex flex-col gap-4 text-xs md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">{'\u5df2\u5f55\u5165\u54cd\u5e94:'}</span>
                      <span className="font-mono text-[#00E5FF]">
                        {matrixData.filter((row) => row.maxDeviation !== null).length}/{rowCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">{'\u5df2\u6807\u8bb0\u8bb0\u5f55:'}</span>
                      <span className="font-mono text-emerald-400">
                        {matrixData.filter((row) => row.scanImage !== null).length}/{rowCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="level-1 flex h-3 w-3 items-center justify-center rounded text-[8px]">1</span>
                    <span className="text-white/30">{'\u4f4e'}</span>
                    <span className="level-2 flex h-3 w-3 items-center justify-center rounded text-[8px]">2</span>
                    <span className="text-white/30">{'\u4e2d'}</span>
                    <span className="level-3 flex h-3 w-3 items-center justify-center rounded text-[8px]">3</span>
                    <span className="text-white/30">{'\u9ad8'}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-cyan-500/10 bg-slate-900/80 px-4 py-3 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,12,27,0.45)]">
      <p className="mb-2 text-[10px] tracking-wider text-white/50">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={`${entry.name || 'metric'}-${index}`}
          className="flex items-center gap-2 font-mono text-xs"
          style={{ color: entry.color || '#00E5FF' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color || '#00E5FF' }} />
          {entry.name}: <span className="font-semibold">{Number(entry.value || 0).toFixed(4)}</span>
        </p>
      ))}
    </div>
  );
}

function AnalyticsPanel({
  hasData,
  matrixData,
  activeFactors,
}: {
  hasData: boolean;
  matrixData: HydratedExperimentRow[];
  activeFactors: TaguchiActiveFactor[];
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TaguchiAnalyticsResult | null>(null);

  useEffect(() => {
    setShowResults(false);
    setAnalysisResult(null);
  }, [activeFactors, matrixData]);

  const handleAnalyze = async () => {
    if (matrixData.length === 0) {
      toast.error('\u8bf7\u5148\u751f\u6210\u6b63\u4ea4\u77e9\u9635\u5e76\u5f55\u5165\u54cd\u5e94\u503c\u3002');
      return;
    }

    const invalidRows = validateDeviationInputs(matrixData);

    if (invalidRows.length > 0) {
      const previewRuns = invalidRows
        .slice(0, 8)
        .map((row) => `Run ${row.run}(${formatInvalidReason(row.reason)})`)
        .join('\u3001');
      const suffix = invalidRows.length > 8 ? ` \u7b49 ${invalidRows.length} \u884c` : '';
      toast.error(`\u54cd\u5e94\u503c\u5f55\u5165\u65e0\u6548: ${previewRuns}${suffix}`);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(analyzeTaguchiMatrix(matrixData, activeFactors));
    setIsAnalyzing(false);
    setShowResults(true);
  };

  const hasAnalysis = showResults && analysisResult !== null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2">Section C</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{'\u5206\u6790\u4e0e\u4f18\u5316'}</h2>
          <p className="mt-1 text-sm text-white/40">{'\u57fa\u4e8e Smaller-the-better \u7684 S/N \u6bd4\u5206\u6790'}</p>
        </div>
        <motion.button
          type="button"
          onClick={handleAnalyze}
          disabled={!hasData || isAnalyzing}
          className={`flex w-full items-center justify-center gap-3 rounded-xl px-6 py-3 text-sm font-semibold transition-all md:w-auto ${
            hasData
              ? isAnalyzing
                ? 'glass-card-elevated'
                : 'btn-premium-solid btn-pulse'
              : 'glass-inner cursor-not-allowed text-white/30'
          }`}
          whileHover={hasData && !isAnalyzing ? { scale: 1.02, y: -2 } : {}}
          whileTap={hasData && !isAnalyzing ? { scale: 0.98 } : {}}
        >
          {isAnalyzing ? (
            <>
              <motion.div
                className="h-5 w-5 rounded-full border-2 border-[#00E5FF]/30 border-t-[#00E5FF]"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-white/70">{'\u5206\u6790\u4e2d...'}</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>{hasAnalysis ? '\u91cd\u65b0\u8fd0\u884c\u5206\u6790' : '\u8fd0\u884c DOE \u5206\u6790'}</span>
            </>
          )}
        </motion.button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-elevated radial-glow overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{'\u4e3b\u6548\u5e94\u56fe'}</h3>
              <p className="text-xs text-white/40">{'\u4e0d\u540c\u6c34\u5e73\u5bf9 S/N \u7684\u53d8\u5316\u8d8b\u52bf'}</p>
            </div>
          </div>

          <div className="h-64">
            {hasAnalysis ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisResult.lineChartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="level"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {analysisResult.mainEffects.map((effect, index) => (
                    <Line
                      key={effect.factorKey}
                      type="monotone"
                      dataKey={effect.factorKey}
                      name={effect.shortLabel}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2.4}
                      dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS[index % CHART_COLORS.length] }}
                      activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-800 bg-black/40">
                    <TrendingUp className="h-10 w-10 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">{'\u8fd0\u884c\u5206\u6790\u540e\u67e5\u770b\u4e3b\u6548\u5e94\u53d8\u5316'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card-elevated radial-glow-indigo overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2.5">
              <Zap className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{'\u56e0\u5b50\u5f71\u54cd\u6392\u5e8f'}</h3>
              <p className="text-xs text-white/40">{'\u6309 Delta \u503c\u5bf9\u56e0\u5b50\u5f71\u54cd\u529b\u6392\u5e8f'}</p>
            </div>
          </div>

          <div className="h-64">
            {hasAnalysis ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResult.deltaChartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="delta" name="Delta" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-800 bg-black/40">
                    <Zap className="h-10 w-10 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">{'\u5206\u6790\u540e\u663e\u793a\u56e0\u5b50\u5f71\u54cd\u5f3a\u5f31'}</p>
                  <p className="mt-1 text-xs text-white/20">Delta = max(S/N mean) - min(S/N mean)</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hasAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="glass-card-elevated glow-teal-intense border-pulse rounded-2xl p-5 md:p-6"
          >
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-2.5">
                <Zap className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{'\u63a8\u8350\u53c2\u6570\u7ec4\u5408'}</h3>
                <p className="text-xs text-white/40">{'\u6839\u636e S/N \u5206\u6790\u7ed9\u51fa\u7406\u8bba\u6700\u4f18\u89e3'}</p>
              </div>
              <div className="flex items-center gap-2 md:ml-auto">
                <div className="status-dot h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-400">{'\u5206\u6790\u5b8c\u6210'}</span>
              </div>
            </div>

            <div className="terminal-box rounded-xl p-5 font-mono text-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-white/[0.06] pb-3">
                <Terminal className="h-4 w-4 text-[#00E5FF]/70" />
                <span className="text-[#00E5FF]/70">taguchi_optimizer</span>
                <span className="text-white/40">--mode optimal --confidence 0.95</span>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <p className="mb-2 text-xs tracking-wider text-white/50">{'\u5efa\u8bae\u53c2\u6570\u7ec4\u5408'}</p>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                    {analysisResult.optimalSet.map((item, index) => (
                      <p key={item.factorKey} className="text-white/60">
                        <span className="text-emerald-400">[{String(index + 1).padStart(2, '0')}]</span>{' '}
                        <span className="text-[#00E5FF]">{item.factor}</span>
                        <span className="text-white/35"> = </span>
                        <span className="font-semibold text-emerald-300">
                          {formatOptimalValue(item.value, item.unit)}
                        </span>{' '}
                        <span className="text-white/30">
                          (L{item.level}, S/N={item.snRatioMean.toFixed(3)} dB)
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1 border-t border-white/[0.06] pt-4 text-white/50">
                <p>
                  <span className="text-white/30">{'\u5173\u952e\u56e0\u5b50:'}</span>{' '}
                  <span className="font-bold text-emerald-400">{analysisResult.deltaChartData[0]?.factor || '-'}</span>{' '}
                  <span className="text-white/30">
                    Delta={analysisResult.deltaChartData[0]?.delta.toFixed(3) || '-'} dB
                  </span>
                </p>
                <p>
                  <span className="text-white/30">{'\u5206\u6790\u6837\u672c:'}</span>{' '}
                  <span className="font-bold text-[#00E5FF]">{analysisResult.rowSnRatios.length} {'\u7ec4'}</span>
                </p>
                <p>
                  <span className="text-white/30">{'\u76ee\u6807\u51fd\u6570:'}</span>{' '}
                  <span className="font-bold text-[#00E5FF]">Smaller-the-better S/N</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function DoeWorkspace() {
  const [factorDefinitions, setFactorDefinitions] = useState<TaguchiFactorDefinitions>(() =>
    createInitialFactorDefinitions(),
  );
  const [trialHeaderFields, setTrialHeaderFields] = useState<DoeTrialHeaderFields>(() => cloneInitialTrialHeaderFields());
  const [matrixData, setMatrixData] = useState<HydratedExperimentRow[]>([]);
  const [matrixGenerated, setMatrixGenerated] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const activeFactors = useMemo(() => buildActiveFactors(factorDefinitions), [factorDefinitions]);
  const arrayType = useMemo<TaguchiArrayName | null>(() => {
    if (activeFactors.length === 0) return null;
    return selectTaguchiArrayName(activeFactors.length);
  }, [activeFactors.length]);

  const canReset = useMemo(() => {
    const initialFactorDefinitions = createInitialFactorDefinitions();
    const factorsChanged = TAGUCHI_FACTOR_KEYS.some((key) => {
      const current = factorDefinitions[key];
      const initial = initialFactorDefinitions[key];

      return (
        current.enabled !== initial.enabled ||
        current.label !== initial.label ||
        current.shortLabel !== initial.shortLabel ||
        current.unit !== initial.unit ||
        current.levels.some((value, index) => value !== initial.levels[index])
      );
    });

    const headerChanged = TRIAL_HEADER_ITEMS.some((item) => trialHeaderFields[item.key] !== initialTrialHeaderFields[item.key]);

    return factorsChanged || headerChanged || matrixGenerated || matrixData.length > 0;
  }, [factorDefinitions, matrixData.length, matrixGenerated, trialHeaderFields]);

  const handleTrialHeaderChange = (field: keyof DoeTrialHeaderFields, value: string) => {
    setTrialHeaderFields((current) => ({ ...current, [field]: value }));
  };

  const handleFactorToggle = (factor: TaguchiFactorKey) => {
    setFactorDefinitions((current) => ({
      ...current,
      [factor]: {
        ...current[factor],
        enabled: !current[factor].enabled,
      },
    }));
    setMatrixGenerated(false);
    setMatrixData([]);
  };

  const handleFactorFieldChange = (factor: TaguchiFactorKey, field: 'label' | 'unit', value: string) => {
    setFactorDefinitions((current) => ({
      ...current,
      [factor]: {
        ...current[factor],
        [field]: value,
      },
    }));
    setMatrixGenerated(false);
    setMatrixData([]);
  };

  const handleLevelChange = (factor: TaguchiFactorKey, level: number, value: string) => {
    setFactorDefinitions((current) => {
      const updatedLevels = [...current[factor].levels] as [string, string, string];
      updatedLevels[level] = value;

      return {
        ...current,
        [factor]: {
          ...current[factor],
          levels: updatedLevels,
        },
      };
    });
    setMatrixGenerated(false);
    setMatrixData([]);
  };

  const handleGenerateMatrix = () => {
    if (activeFactors.length === 0) {
      toast.error('\u8bf7\u81f3\u5c11\u542f\u7528\u4e00\u4e2a DOE \u56e0\u5b50\u3002');
      return;
    }

    try {
      setMatrixData(generateTaguchiMatrix(activeFactors));
      setMatrixGenerated(true);
    } catch (error) {
      setMatrixData([]);
      setMatrixGenerated(false);
      toast.error(error instanceof Error ? error.message : '\u751f\u6210\u6b63\u4ea4\u77e9\u9635\u5931\u8d25\u3002');
    }
  };

  const handleDeviationChange = (run: number, value: string) => {
    setMatrixData((current) =>
      current.map((row) => (row.run === run ? { ...row, maxDeviation: value.trim() ? value : null } : row)),
    );
  };

  const handleScanUpload = (run: number) => {
    setMatrixData((current) =>
      current.map((row) => (row.run === run ? { ...row, scanImage: `attachment-run-${run}` } : row)),
    );
  };

  const handleResetWorkspace = () => {
    if (!canReset) {
      toast.message('DOE \u6570\u636e\u5df2\u7ecf\u662f\u521d\u59cb\u72b6\u6001\u3002');
      return;
    }

    setShowResetConfirm(true);
  };

  const handleConfirmResetWorkspace = () => {
    setFactorDefinitions(cloneFactorDefinitions(createInitialFactorDefinitions()));
    setTrialHeaderFields(cloneInitialTrialHeaderFields());
    setMatrixData([]);
    setMatrixGenerated(false);
    setShowResetConfirm(false);
    toast.success('DOE \u6570\u636e\u5df2\u91cd\u7f6e\u3002');
  };

  const hasData = matrixGenerated || matrixData.some((row) => row.maxDeviation !== null || row.scanImage !== null);

  return (
    <div className="doe-workspace min-h-[70vh] overflow-hidden rounded-2xl bg-black text-white">
      <DoeHeader />
      <main className="relative mx-auto max-w-[1400px] space-y-14 px-8 py-10">
        <TrialHeaderPanel fields={trialHeaderFields} onChange={handleTrialHeaderChange} />
        <FactorBuilder
          factorDefinitions={factorDefinitions}
          activeFactorCount={activeFactors.length}
          arrayType={arrayType}
          canReset={canReset}
          onFactorToggle={handleFactorToggle}
          onFactorFieldChange={handleFactorFieldChange}
          onLevelChange={handleLevelChange}
          onReset={handleResetWorkspace}
        />
        <TaguchiMatrix
          arrayType={arrayType}
          activeFactors={activeFactors}
          generated={matrixGenerated}
          onGenerate={handleGenerateMatrix}
          matrixData={matrixData}
          onDeviationChange={handleDeviationChange}
          onScanUpload={handleScanUpload}
        />
        <AnalyticsPanel hasData={hasData} matrixData={matrixData} activeFactors={activeFactors} />
      </main>
      <footer className="relative mx-auto max-w-[1400px] px-8 py-8">
        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-[10px] tracking-wider text-white/20 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <span>{'\u901a\u7528\u5b9e\u9a8c\u8bbe\u8ba1'}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{'Taguchi \u6b63\u4ea4\u9635\u5217'}</span>
          </div>
          <div className="font-mono text-white/30">
            {'DOE \u5de5\u4f5c\u53f0 '}<span className="text-[#00E5FF]/50">v3.0.0</span>
          </div>
        </div>
      </footer>
      <CyberConfirmDialog
        open={showResetConfirm}
        title={'\u786e\u8ba4\u91cd\u7f6e DOE \u6570\u636e'}
        message={'\u8fd9\u4f1a\u6062\u590d\u9ed8\u8ba4\u56e0\u5b50\u914d\u7f6e\uff0c\u5e76\u6e05\u7a7a\u5f53\u524d\u77e9\u9635\u3001\u54cd\u5e94\u503c\u548c\u5206\u6790\u7ed3\u679c\u3002\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\uff0c\u662f\u5426\u7ee7\u7eed\uff1f'}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleConfirmResetWorkspace}
        confirmText={'\u786e\u8ba4\u91cd\u7f6e'}
        cancelText={'\u53d6\u6d88'}
      />
    </div>
  );
}
