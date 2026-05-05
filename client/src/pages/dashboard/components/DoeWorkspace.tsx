import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Check,
  Cpu,
  Database,
  Gauge,
  Grid3X3,
  Layers,
  Play,
  Settings,
  Sparkles,
  Terminal,
  Thermometer,
  Timer,
  TrendingUp,
  Upload,
  Zap,
  ChevronUp,
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
  type HydratedExperimentRow,
  type TaguchiActiveFactor,
  type TaguchiArrayName,
  type TaguchiFactorKey,
  type TaguchiFactorLevels,
  type TaguchiFactorToggles,
} from './doe/taguchiEngine';

const initialFactorValues: TaguchiFactorLevels = {
  frontTemp: ['75', '80', '85'],
  backTemp: ['70', '75', '80'],
  sliderTemp: ['65', '70', '75'],
  p1: ['55', '60', '65'],
  t1: ['2.0', '2.5', '3.0'],
  p2: ['45', '50', '55'],
  t2: ['2.5', '3.0', '3.5'],
  p3: ['35', '40', '45'],
  t3: ['1.5', '2.0', '2.5'],
};

const CHART_COLORS = ['#00E5FF', '#6366f1', '#10b981', '#f59e0b', '#fb7185', '#a855f7', '#14b8a6', '#f97316', '#84cc16'];

function DoeHeader() {
  return (
    <header className="doe-header">
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
              <h2 className="text-base font-bold tracking-tight text-white">精密注塑田口 DOE 系统</h2>
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Precision Injection Molding · Taguchi DOE Module v3.0
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="glass-card flex flex-wrap items-center gap-4 rounded-xl px-4 py-2 md:gap-6">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-[#00E5FF]/70" />
                <span className="text-[10px] uppercase tracking-wider text-white/50">Session</span>
                <span className="font-mono text-xs text-[#00E5FF]">DOE-2024-0512</span>
              </div>
              <div className="hidden h-4 w-px bg-white/10 md:block" />
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-white/60">Online</span>
                <motion.div
                  className="h-2 w-2 rounded-full bg-emerald-400"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="DOE settings"
              className="glass-card rounded-xl p-2.5 text-white/40 transition-all hover:bg-white/[0.06] hover:text-white/70"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function LevelInputs({
  label,
  labelCn,
  icon: Icon,
  unit,
  values,
  onChange,
  accentColor = 'teal',
  disabled = false,
}: {
  label: string;
  labelCn: string;
  icon: ElementType;
  unit: string;
  values: readonly [string, string, string];
  onChange: (level: number, value: string) => void;
  accentColor?: 'teal' | 'indigo';
  disabled?: boolean;
}) {
  const iconBg =
    accentColor === 'teal'
      ? 'bg-[#00E5FF]/10 border-[#00E5FF]/25'
      : 'bg-indigo-500/10 border-indigo-500/25';
  const iconColor = accentColor === 'teal' ? 'text-[#00E5FF]' : 'text-indigo-400';

  return (
    <motion.div
      className={`space-y-3 transition-all duration-300 ${disabled ? 'factor-disabled' : ''}`}
      animate={{ opacity: disabled ? 0.3 : 1 }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`rounded-lg border p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div>
          <span className="text-sm font-medium text-white/90">{label}</span>
          <span className="ml-2 text-xs text-white/40">{labelCn}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((level, index) => (
          <div key={level} className="group relative">
            <span
              className={`absolute -top-2 left-3 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                level === 1
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : level === 2
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              L{level}
            </span>
            <input
              type="text"
              value={values[index]}
              onChange={(event) => onChange(index, event.target.value)}
              placeholder="-"
              disabled={disabled}
              className="premium-input h-12 w-full rounded-xl px-3 pt-1 text-center font-mono text-sm text-white/90 placeholder:text-white/20 focus:outline-none disabled:cursor-not-allowed"
            />
            <span className="absolute bottom-3 right-3 font-mono text-[10px] text-white/30">{unit}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PremiumToggle({
  enabled,
  onToggle,
  label,
  labelCn,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  labelCn: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full items-center gap-4 rounded-xl p-4 transition-all duration-300 ${
        enabled ? 'glass-card glow-teal' : 'glass-inner hover:bg-white/[0.03]'
      }`}
    >
      <div
        className={`relative h-8 w-16 rounded-full transition-all duration-300 ${
          enabled
            ? 'toggle-glow bg-gradient-to-r from-[#00E5FF] to-[#00B8D4]'
            : 'border border-white/[0.10] bg-white/[0.06]'
        }`}
      >
        {!enabled && <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />}
        <motion.div
          className={`absolute top-1 h-6 w-6 rounded-full shadow-lg ${enabled ? 'bg-white' : 'bg-white/80'}`}
          style={{
            boxShadow: enabled
              ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)'
              : '0 2px 4px rgba(0,0,0,0.4)',
          }}
          animate={{ x: enabled ? 32 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>

      <div className="flex min-w-0 flex-col items-start text-left">
        <span className={`text-sm font-medium transition-colors duration-300 ${enabled ? 'text-[#00E5FF]' : 'text-white/60'}`}>
          {label}
        </span>
        <span className={`text-xs transition-colors duration-300 ${enabled ? 'text-white/50' : 'text-white/30'}`}>
          {labelCn}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider transition-colors ${enabled ? 'text-[#00E5FF]/80' : 'text-white/30'}`}>
          {enabled ? 'Active' : 'Inactive'}
        </span>
        <div className={`relative h-2.5 w-2.5 rounded-full transition-all duration-300 ${enabled ? 'status-dot bg-[#00E5FF]' : 'bg-white/20'}`} />
      </div>
    </button>
  );
}

function FactorBuilder({
  factors,
  activeFactorCount,
  arrayType,
  onFactorToggle,
  factorValues,
  onValueChange,
}: {
  factors: TaguchiFactorToggles;
  activeFactorCount: number;
  arrayType: TaguchiArrayName;
  onFactorToggle: (factor: keyof TaguchiFactorToggles) => void;
  factorValues: TaguchiFactorLevels;
  onValueChange: (factor: TaguchiFactorKey, level: number, value: string) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2">Section A</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">因子配置构建器</h2>
          <p className="mt-1 text-sm text-white/40">Factor Configuration Builder - 按需配置乐高模式</p>
        </div>
        <div className="glass-card-elevated flex w-full items-center justify-around gap-4 rounded-2xl px-5 py-3 md:w-auto md:justify-start">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wider text-white/40">激活因子</span>
            <span className="font-mono text-2xl font-bold text-[#00E5FF]">{activeFactorCount}</span>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wider text-white/40">正交阵列</span>
            <span className="font-mono text-2xl font-bold text-[#00E5FF]">{arrayType}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-elevated radial-glow space-y-6 overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="rounded-xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 p-2.5">
              <Thermometer className="h-5 w-5 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">模温系统</h3>
              <p className="text-xs text-white/40">Mold Temperature System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Layers className="h-4 w-4 text-white/30" />
              <span className="font-mono text-xs text-white/40">{factors.sliderTemp ? 3 : 2} vars</span>
            </div>
          </div>

          <LevelInputs
            label="前模温度"
            labelCn="Front Mold Temp"
            icon={Thermometer}
            unit="degC"
            values={factorValues.frontTemp}
            onChange={(level, value) => onValueChange('frontTemp', level, value)}
          />
          <LevelInputs
            label="后模温度"
            labelCn="Back Mold Temp"
            icon={Thermometer}
            unit="degC"
            values={factorValues.backTemp}
            onChange={(level, value) => onValueChange('backTemp', level, value)}
          />

          <PremiumToggle
            enabled={factors.sliderTemp}
            onToggle={() => onFactorToggle('sliderTemp')}
            label="启用滑块模温机"
            labelCn="Enable Slider Temperature"
          />

          <AnimatePresence>
            {factors.sliderTemp && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <LevelInputs
                  label="滑块模温"
                  labelCn="Slider Mold Temp"
                  icon={Thermometer}
                  unit="degC"
                  values={factorValues.sliderTemp}
                  onChange={(level, value) => onValueChange('sliderTemp', level, value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-card-elevated radial-glow-indigo space-y-6 overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5">
              <Gauge className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">保压系统</h3>
              <p className="text-xs text-white/40">Holding Pressure System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Layers className="h-4 w-4 text-white/30" />
              <span className="font-mono text-xs text-white/40">
                {2 + (factors.stage2Hold ? 2 : 0) + (factors.stage3Hold ? 2 : 0)} vars
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-indigo-500/50" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400/90">
                第一段保压 / Stage 1
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LevelInputs
                label="压力"
                labelCn="Pressure"
                icon={Gauge}
                unit="MPa"
                values={factorValues.p1}
                onChange={(level, value) => onValueChange('p1', level, value)}
                accentColor="indigo"
              />
              <LevelInputs
                label="时间"
                labelCn="Time"
                icon={Timer}
                unit="s"
                values={factorValues.t1}
                onChange={(level, value) => onValueChange('t1', level, value)}
                accentColor="indigo"
              />
            </div>
          </div>

          <PremiumToggle
            enabled={factors.stage2Hold}
            onToggle={() => onFactorToggle('stage2Hold')}
            label="启用第二段保压"
            labelCn="Enable Stage 2 Hold"
          />

          <AnimatePresence>
            {factors.stage2Hold && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-1.5 rounded-full bg-indigo-500/40" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400/70">
                      第二段保压 / Stage 2
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <LevelInputs
                      label="压力"
                      labelCn="Pressure"
                      icon={Gauge}
                      unit="MPa"
                      values={factorValues.p2}
                      onChange={(level, value) => onValueChange('p2', level, value)}
                      accentColor="indigo"
                    />
                    <LevelInputs
                      label="时间"
                      labelCn="Time"
                      icon={Timer}
                      unit="s"
                      values={factorValues.t2}
                      onChange={(level, value) => onValueChange('t2', level, value)}
                      accentColor="indigo"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <PremiumToggle
            enabled={factors.stage3Hold}
            onToggle={() => onFactorToggle('stage3Hold')}
            label="启用第三段保压"
            labelCn="Enable Stage 3 Hold"
          />

          <AnimatePresence>
            {factors.stage3Hold && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-1.5 rounded-full bg-indigo-500/30" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400/50">
                      第三段保压 / Stage 3
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <LevelInputs
                      label="压力"
                      labelCn="Pressure"
                      icon={Gauge}
                      unit="MPa"
                      values={factorValues.p3}
                      onChange={(level, value) => onValueChange('p3', level, value)}
                      accentColor="indigo"
                    />
                    <LevelInputs
                      label="时间"
                      labelCn="Time"
                      icon={Timer}
                      unit="s"
                      values={factorValues.t3}
                      onChange={(level, value) => onValueChange('t3', level, value)}
                      accentColor="indigo"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
  arrayType: TaguchiArrayName;
  activeFactors: TaguchiActiveFactor[];
  generated: boolean;
  onGenerate: () => void;
  matrixData: HydratedExperimentRow[];
  onDeviationChange: (run: number, value: string) => void;
  onScanUpload: (run: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const rowCount = Number.parseInt(arrayType.slice(1), 10);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    onGenerate();
    setIsGenerating(false);
    setExpanded(true);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="section-label mb-2">Section B</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">田口正交阵列矩阵</h2>
          <p className="mt-1 text-sm text-white/40">Taguchi Orthogonal Array Matrix & 3D Scan Upload</p>
        </div>
        <div className="glass-card flex w-fit items-center gap-3 rounded-xl px-4 py-2.5">
          <Grid3X3 className="h-4 w-4 text-[#00E5FF]/70" />
          <span className="font-mono text-lg font-bold text-[#00E5FF]">{arrayType}</span>
          <div className="h-5 w-px bg-white/10" />
          <span className="text-xs text-white/50">{rowCount} 组实验</span>
        </div>
      </div>

      {!generated && (
        <motion.button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`flex w-full items-center justify-center gap-4 rounded-2xl py-5 text-base font-semibold transition-all ${
            isGenerating ? 'glass-card-elevated' : 'btn-premium-solid btn-pulse'
          }`}
          whileHover={!isGenerating ? { scale: 1.01, y: -2 } : {}}
          whileTap={!isGenerating ? { scale: 0.99 } : {}}
        >
          {isGenerating ? (
            <>
              <motion.div
                className="h-5 w-5 rounded-full border-2 border-[#00E5FF]/30 border-t-[#00E5FF]"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-white/70">正在生成矩阵...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>生成正交矩阵</span>
              <span className="font-normal text-black/50">Generate Matrix</span>
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
                  <div className="rounded-lg border border-[#00E5FF]/20 bg-[#00E5FF]/10 p-2">
                    <Grid3X3 className="h-4 w-4 text-[#00E5FF]" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-white">实验运行数据</span>
                    <span className="ml-3 hidden text-xs text-white/40 md:inline">Experimental Runs</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#00E5FF]/70">{rowCount} runs</span>
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
                        <thead className="sticky-header">
                          <tr className="border-b border-white/[0.08]">
                            <th className="w-16 px-4 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-white/50">
                              Run
                            </th>
                            {activeFactors.map((factor) => (
                              <th
                                key={factor.key}
                                className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-white/50"
                              >
                                <span className="block">{factor.shortLabel}</span>
                                <span className="mt-1 block font-normal normal-case tracking-normal text-white/25">
                                  {factor.unit}
                                </span>
                              </th>
                            ))}
                            <th className="w-32 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]/80">
                              最大偏差
                            </th>
                            <th className="w-44 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]/80">
                              3D扫描热力图
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
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00E5FF]/20 bg-[#00E5FF]/10">
                                  <span className="font-mono text-sm font-bold text-[#00E5FF]">
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
                                  className="premium-input h-9 w-full rounded-lg px-3 text-center font-mono text-xs text-white/90 placeholder:text-white/20 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => onScanUpload(row.run)}
                                  className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[11px] font-medium transition-all ${
                                    row.scanImage
                                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                      : 'dropzone'
                                  }`}
                                >
                                  {row.scanImage ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      <span>已上传</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-3.5 w-3.5 text-white/40" />
                                      <span className="text-white/40">上传3D扫描</span>
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

              <div className="border-t border-white/[0.06] bg-black/20 px-4 py-4 md:px-6">
                <div className="flex flex-col gap-4 text-xs md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">已完成:</span>
                      <span className="font-mono text-[#00E5FF]">
                        {matrixData.filter((row) => row.maxDeviation !== null).length}/{rowCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">扫描上传:</span>
                      <span className="font-mono text-emerald-400">
                        {matrixData.filter((row) => row.scanImage !== null).length}/{rowCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="level-1 flex h-3 w-3 items-center justify-center rounded text-[8px]">1</span>
                    <span className="text-white/30">Low</span>
                    <span className="level-2 flex h-3 w-3 items-center justify-center rounded text-[8px]">2</span>
                    <span className="text-white/30">Mid</span>
                    <span className="level-3 flex h-3 w-3 items-center justify-center rounded text-[8px]">3</span>
                    <span className="text-white/30">High</span>
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

function formatEngineeringValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function formatInvalidReason(reason: 'empty' | 'non_numeric' | 'negative'): string {
  const labels = {
    empty: '空值',
    non_numeric: '非数字',
    negative: '负数',
  };
  return labels[reason];
}

function formatOptimalValue(value: unknown, unit: string): string {
  if (value === undefined || value === null || value === '') return '-';
  return `${String(value)} ${unit}`;
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
    <div className="glass-card-elevated rounded-xl border border-white/15 px-4 py-3">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{label}</p>
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
      toast.error('请先生成正交矩阵，再录入最大偏差。');
      return;
    }

    const invalidRows = validateDeviationInputs(matrixData);

    if (invalidRows.length > 0) {
      const previewRuns = invalidRows
        .slice(0, 8)
        .map((row) => `Run ${row.run}(${formatInvalidReason(row.reason)})`)
        .join('、');
      const suffix = invalidRows.length > 8 ? ` 等 ${invalidRows.length} 行` : '';
      toast.error(`最大偏差录入无效：${previewRuns}${suffix}`);
      return;
    }

    setIsAnalyzing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
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
          <h2 className="text-xl font-semibold tracking-tight text-white">分析与优化看板</h2>
          <p className="mt-1 text-sm text-white/40">Smaller-the-better S/N Ratio Analytics</p>
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
              <span className="text-white/70">分析中...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>{hasAnalysis ? '重新运行信噪比分析' : '运行田口信噪比分析'}</span>
              <span className="text-xs font-normal text-black/50">Execute S/N Analytics</span>
            </>
          )}
        </motion.button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-elevated radial-glow overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">主效应分析图</h3>
              <p className="text-xs text-white/40">Main Effects Plot</p>
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
                  <div className="glass-inner mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl">
                    <TrendingUp className="h-10 w-10 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">运行分析以查看图表</p>
                  <p className="mt-1 text-xs text-white/20">Run analysis to view chart</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card-elevated radial-glow-indigo overflow-hidden rounded-2xl p-5 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5">
              <Zap className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">关键因子 Delta 排序</h3>
              <p className="text-xs text-white/40">Factor influence ranking</p>
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
                  <div className="glass-inner mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl">
                    <Zap className="h-10 w-10 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">分析后显示关键因子排序</p>
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
              <div className="rounded-xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 p-2.5">
                <Zap className="h-5 w-5 text-[#00E5FF]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">最优参数推荐</h3>
                <p className="text-xs text-white/40">Optimal Parameter Recommendation</p>
              </div>
              <div className="flex items-center gap-2 md:ml-auto">
                <div className="status-dot h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-400">Analysis Complete</span>
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
                  <p className="mb-2 text-xs uppercase tracking-wider text-white/50">建议最优工艺参数组合</p>
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
                  <span className="text-white/30">关键因子:</span>{' '}
                  <span className="font-bold text-emerald-400">
                    {analysisResult.deltaChartData[0]?.factor || '-'}
                  </span>{' '}
                  <span className="text-white/30">
                    Delta={analysisResult.deltaChartData[0]?.delta.toFixed(3) || '-'} dB
                  </span>
                </p>
                <p>
                  <span className="text-white/30">分析样本:</span>{' '}
                  <span className="font-bold text-[#00E5FF]">{analysisResult.rowSnRatios.length} runs</span>
                </p>
                <p>
                  <span className="text-white/30">目标函数:</span>{' '}
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
  const [factors, setFactors] = useState<TaguchiFactorToggles>({
    sliderTemp: false,
    stage2Hold: false,
    stage3Hold: false,
  });
  const [factorValues, setFactorValues] = useState<TaguchiFactorLevels>(initialFactorValues);
  const [matrixData, setMatrixData] = useState<HydratedExperimentRow[]>([]);
  const [matrixGenerated, setMatrixGenerated] = useState(false);

  const activeFactors = useMemo(
    () => buildActiveFactors(factors, factorValues),
    [factorValues, factors],
  );
  const arrayType = useMemo(
    () => selectTaguchiArrayName(activeFactors.length),
    [activeFactors.length],
  );

  const handleFactorToggle = useCallback((factor: keyof TaguchiFactorToggles) => {
    setFactors((current) => ({ ...current, [factor]: !current[factor] }));
    setMatrixGenerated(false);
    setMatrixData([]);
  }, []);

  const handleValueChange = useCallback((factor: TaguchiFactorKey, level: number, value: string) => {
    setFactorValues((current) => {
      const updated = [...current[factor]] as [string, string, string];
      updated[level] = value;
      return { ...current, [factor]: updated };
    });
    setMatrixGenerated(false);
    setMatrixData([]);
  }, []);

  const handleGenerateMatrix = useCallback(() => {
    setMatrixData(generateTaguchiMatrix(activeFactors));
    setMatrixGenerated(true);
  }, [activeFactors]);

  const handleDeviationChange = useCallback((run: number, value: string) => {
    setMatrixData((current) =>
      current.map((row) => (row.run === run ? { ...row, maxDeviation: value.trim() ? value : null } : row)),
    );
  }, []);

  const handleScanUpload = useCallback((run: number) => {
    setMatrixData((current) =>
      current.map((row) => (row.run === run ? { ...row, scanImage: `scan-run-${run}` } : row)),
    );
  }, []);

  const hasData = matrixGenerated || matrixData.some((row) => row.maxDeviation !== null || row.scanImage !== null);

  return (
    <div className="doe-workspace min-h-[70vh] overflow-hidden rounded-2xl bg-black text-white">
      <DoeHeader />
      <main className="relative mx-auto max-w-[1400px] space-y-12 px-4 py-8 md:px-8 md:py-10 lg:space-y-14">
        <FactorBuilder
          factors={factors}
          activeFactorCount={activeFactors.length}
          arrayType={arrayType}
          onFactorToggle={handleFactorToggle}
          factorValues={factorValues}
          onValueChange={handleValueChange}
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
        <AnalyticsPanel
          hasData={hasData}
          matrixData={matrixData}
          activeFactors={activeFactors}
        />
      </main>
      <footer className="relative mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-[10px] uppercase tracking-wider text-white/20 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <span>Precision Injection Molding Systems</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Logitech Engineering</span>
          </div>
          <div className="font-mono text-white/30">
            Taguchi DOE Module <span className="text-[#00E5FF]/50">v3.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
