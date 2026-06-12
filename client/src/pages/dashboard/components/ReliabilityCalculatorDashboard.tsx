"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";
import ReactECharts from "echarts-for-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ARRHENIUS_BOLTZMANN_K, ARRHENIUS_KELVIN_OFFSET, HOURS_PER_YEAR, ROOM_TEMP, useArrheniusStore } from "./useArrheniusStore";

import "./reliability-calculator.css";

type MaterialPreset = {
  id: string;
  label: string;
  en: string;
  ea: number;
  tier: "system" | "component";
};

const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: "sys-composite", label: "成品灯控 - 综合失效", en: "System Composite", ea: 0.65, tier: "system" },
  { id: "sys-driver", label: "成品灯控 - 驱动瓶颈", en: "Driver Bottleneck", ea: 0.9, tier: "system" },
  { id: "sys-lumen", label: "成品灯控 - 键差/探板断", en: "Lumen Drop", ea: 0.45, tier: "system" },
  { id: "led", label: "LED 组件 - 纤芯/硅胶", en: "LED Chip / Silicone", ea: 0.6, tier: "component" },
  { id: "cap", label: "整机电容旋钮 - 模卡件", en: "Electrolytic Cap", ea: 0.9, tier: "component" },
  { id: "pcb", label: "PCB - 焊点疲劳插痕", en: "PCB Solder Fatigue", ea: 1.2, tier: "component" },
];

const CYAN = "oklch(0.82 0.15 200)";
const RED = "oklch(0.66 0.23 30)";
const MUTED = "oklch(0.62 0.02 235)";
const LIFE_CAP = 1_000_000;

function generateCurveData(input: { tUse: number; tOven: number; ea: number; duration: number }) {
  const { tUse, tOven, ea, duration } = input;
  const deltaT = tUse - ROOM_TEMP;
  const tCoreTest = tOven + deltaT;
  const tCoreTestK = tCoreTest + ARRHENIUS_KELVIN_OFFSET;
  const data: Array<[number, number]> = [];

  for (let coreTemp = 25; coreTemp <= 200; coreTemp += 5) {
    const tK = coreTemp + ARRHENIUS_KELVIN_OFFSET;
    const life = duration * Math.exp((ea / ARRHENIUS_BOLTZMANN_K) * (1 / tK - 1 / tCoreTestK));
    data.push([coreTemp, Math.min(life, LIFE_CAP)]);
  }

  return data;
}

function toKelvin(celsius: number) {
  return celsius + ARRHENIUS_KELVIN_OFFSET;
}

function formatNumber(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SectionHeader({ zh, en }: { zh: string; en: string }) {
  return (
    <div className="metal-edge brushed-metal flex items-center justify-between rounded-lg px-3 py-2">
      <span className="text-xs font-semibold tracking-wide text-[var(--color-rose-gold-bright)]">{zh}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{en}</span>
    </div>
  );
}

function ReadoutBox(props: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const { value, min, max, step = 1, unit, onChange } = props;

  return (
    <div className="metal-edge flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-5 w-14 border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold tabular-nums text-[var(--color-rose-gold-bright)] shadow-none focus-visible:ring-0"
      />
      <span className="font-mono text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}

function ParamSlider(props: {
  label: string;
  labelEn: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  warning?: boolean;
  warningText?: string;
  onChange: (v: number) => void;
}) {
  const { label, labelEn, symbol, value, min, max, step = 1, unit, warning, warningText, onChange } = props;

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
            {label}
            <span className="font-mono text-xs text-[var(--color-rose-gold)]">{symbol}</span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{labelEn}</span>
        </Label>
        <ReadoutBox value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
      </div>

      <div className="mt-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0])}
          className={cn(
            "[&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-black/40 [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]",
            "[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-[var(--color-copper)] [&_[data-slot=slider-range]]:to-[var(--color-rose-gold-bright)]",
            "[&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border [&_[data-slot=slider-thumb]]:border-[var(--color-rose-gold-bright)]/70 [&_[data-slot=slider-thumb]]:bg-gradient-to-b [&_[data-slot=slider-thumb]]:from-[var(--color-platinum)] [&_[data-slot=slider-thumb]]:to-[var(--color-rose-gold)] [&_[data-slot=slider-thumb]]:shadow-[0_0_10px_rgba(80,160,235,0.6),inset_0_1px_1px_rgba(255,255,255,0.6)] [&_[data-slot=slider-thumb]]:ring-0",
          )}
        />
      </div>

      {warning && warningText ? (
        <div className="mt-2.5 flex items-start gap-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{warningText}</span>
        </div>
      ) : null}
    </div>
  );
}

function ControlPanel() {
  const tUse = useArrheniusStore((state) => state.tUse);
  const tOven = useArrheniusStore((state) => state.tOven);
  const ea = useArrheniusStore((state) => state.ea);
  const duration = useArrheniusStore((state) => state.duration);
  const targetYears = useArrheniusStore((state) => state.targetYears);
  const dailyHours = useArrheniusStore((state) => state.dailyHours);
  const hoursPerYear = useArrheniusStore((state) => state.hoursPerYear);
  const requiredTestHours = useArrheniusStore((state) => state.requiredTestHours);
  const deltaT = useArrheniusStore((state) => state.deltaT);
  const tCoreTest = useArrheniusStore((state) => state.tCoreTest);
  const setTUse = useArrheniusStore((state) => state.setTUse);
  const setTOven = useArrheniusStore((state) => state.setTOven);
  const setEa = useArrheniusStore((state) => state.setEa);
  const setDuration = useArrheniusStore((state) => state.setDuration);
  const setTargetYears = useArrheniusStore((state) => state.setTargetYears);
  const setDailyHours = useArrheniusStore((state) => state.setDailyHours);
  const tempWarning = tCoreTest <= tUse;

  return (
    <div className="glass-panel metal-edge flex flex-col rounded-2xl">
      <div className="metal-edge brushed-metal flex items-center justify-between rounded-t-2xl px-5 py-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">参数控制台</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Parameter Console / Deck
          </p>
        </div>
        <span className="metal-edge rounded-full bg-black/30 px-2.5 py-1 font-mono text-[9px] tracking-wider text-[var(--color-sapphire)]">
          CALIBRATED
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <SectionHeader zh="信号处理" en="SIGNAL PROCESSING" />

        <ParamSlider label="实际工作温度" labelEn="Operating Temp" symbol="T_use" value={tUse} min={25} max={150} unit="°C" onChange={setTUse} />
        <ParamSlider
          label="烤箱环境温度"
          labelEn="Oven Ambient Temp"
          symbol="T_oven"
          value={tOven}
          min={25}
          max={150}
          unit="°C"
          warning={tempWarning}
          warningText="补偿后的实际测试结温需高于工作结温，方可产生加速效应。"
          onChange={setTOven}
        />
        <ParamSlider label="任务工时" labelEn="Test Duration" symbol="Duration" value={duration} min={10} max={5000} step={10} unit="h" onChange={setDuration} />
        <ParamSlider label="产品设计寿命" labelEn="Target Life" symbol="TARGET LIFE" value={targetYears} min={1} max={10} step={1} unit="年" onChange={setTargetYears} />
        <ParamSlider label="设计日均工时" labelEn="Daily Duty Cycle" symbol="DAILY DUTY CYCLE" value={dailyHours} min={1} max={24} step={1} unit="h/day" onChange={setDailyHours} />
        <div className="metal-edge mt-1 rounded-lg bg-[rgba(0,243,255,0.08)] px-3 py-3 ring-1 ring-[rgba(0,243,255,0.2)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Required Test Hours</p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-platinum)]">等效年限: 1年 = {hoursPerYear.toFixed(0)} h</p>
          <p className="mt-1 font-mono text-base font-semibold text-glow-cyan">达标所需测试工时: {requiredTestHours.toFixed(0)} h</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <SectionHeader zh="计算引擎" en="COMPUTE ENGINE" />
        <ParamSlider label="激活能" labelEn="Activation Energy" symbol="E_a" value={ea} min={0.3} max={1.5} step={0.1} unit="eV" onChange={setEa} />

        <div className="mt-4">
          <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>材料激活能指纹库</span>
            <span>MATERIAL LIBRARY</span>
          </p>
          <div className="flex flex-col gap-3">
            {(["system", "component"] as const).map((tier) => {
              const items = MATERIAL_PRESETS.filter((item) => item.tier === tier);
              return (
                <div key={tier} className="flex flex-col gap-1.5 rounded-xl bg-black/15 p-2.5 ring-1 ring-[var(--color-sapphire)]/25">
                  <p className="px-0.5 pb-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {tier === "system" ? "SYSTEM-LEVEL" : "COMPONENT-LEVEL"}
                  </p>
                  {items.map((preset) => {
                    const active = Math.abs(ea - preset.ea) < 0.001;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEa(preset.ea)}
                        className={cn(
                          "metal-edge flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-all",
                          active
                            ? "brushed-metal glow-rose text-[var(--color-rose-gold-bright)]"
                            : "bg-black/20 text-muted-foreground hover:bg-black/30 hover:text-foreground",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-medium">{preset.label}</span>
                          <span className="block truncate font-mono text-[9px] uppercase tracking-wider opacity-70">{preset.en}</span>
                        </span>
                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums", active ? "bg-[var(--color-rose-gold)]/15" : "bg-black/30")}>
                          {preset.ea.toFixed(2)} eV
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="metal-edge brushed-metal mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-lg">
          {[
            { zh: "工作结温 (K)", v: `${toKelvin(tUse).toFixed(2)}` },
            { zh: "测试结温 (K)", v: `${toKelvin(tCoreTest).toFixed(2)}` },
            { zh: "玻尔兹曼常数", v: ARRHENIUS_BOLTZMANN_K.toExponential(4) },
            { zh: "自身温升 ΔT", v: `${deltaT.toFixed(0)} °C` },
          ].map((item) => (
            <div key={item.zh} className="bg-black/20 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{item.zh}</p>
              <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--color-platinum)]">{item.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard(props: {
  tag: string;
  titleZh: string;
  titleEn: string;
  trend?: { dir: "up" | "down"; value: string; tone: "cyan" | "red" };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { tag, titleZh, titleEn, trend, children, footer } = props;
  return (
    <div className="glass-panel metal-edge lux-grid relative flex flex-col overflow-hidden rounded-2xl px-5 py-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-rose-gold)]/60 to-transparent" />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{titleZh}</h3>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{titleEn}</p>
        </div>
        <span className="metal-edge brushed-metal rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-rose-gold)]">{tag}</span>
      </div>
      <div className="mt-5 flex flex-1 items-end justify-between gap-2">
        <div>{children}</div>
        {trend ? (
          <div className={cn("mb-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", trend.tone === "cyan" ? "text-glow-cyan bg-[var(--color-sapphire)]/10" : "text-glow-red bg-red-500/10")}>
            {trend.dir === "up" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {trend.value}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4 border-t border-border/50 pt-3">{footer}</div> : null}
    </div>
  );
}

function ExecutiveMetrics() {
  const af = useArrheniusStore((state) => state.af);
  const projectedLife = useArrheniusStore((state) => state.projectedLife);
  const survivalYears = useArrheniusStore((state) => state.survivalYears);
  const hoursPerYear = useArrheniusStore((state) => state.hoursPerYear);
  const targetYears = useArrheniusStore((state) => state.targetYears);
  const targetLifeHours = useArrheniusStore((state) => state.targetLifeHours);
  const warrantyRisk = survivalYears < targetYears;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard tag="ACCEL" titleZh="物理加速倍率" titleEn="Acceleration Factor" trend={{ dir: "up", value: "ACTIVE", tone: "cyan" }} footer={<p className="font-mono text-[11px] text-muted-foreground">阿伦尼乌斯模型实时解算 / White-box</p>}>
        <div className="flex items-baseline gap-0.5">
          <span className="text-glow-rose font-mono text-5xl font-bold tabular-nums tracking-tight">{af.toFixed(2)}</span>
          <span className="font-mono text-2xl font-medium text-[var(--color-rose-gold)]/70">x</span>
        </div>
      </MetricCard>
      <MetricCard tag="HOURS" titleZh="任务测试寿命" titleEn="Projected / Hours" trend={{ dir: "up", value: "PEAK", tone: "cyan" }} footer={<p className="font-mono text-[11px] text-muted-foreground">等效现场运行小时数</p>}>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-glow-cyan font-mono text-5xl font-bold tabular-nums tracking-tight">{formatNumber(projectedLife)}</span>
            <span className="font-mono text-xl font-medium text-[var(--color-sapphire)]/70">h</span>
          </div>
          <p className="mt-2 font-mono text-sm font-semibold text-[var(--color-platinum)]/85">{formatNumber(projectedLife / hoursPerYear, 2)} 年</p>
        </div>
      </MetricCard>
      <MetricCard tag="YEARS" titleZh="产品设计寿命" titleEn="Design Target / Years" trend={warrantyRisk ? { dir: "down", value: "RISK", tone: "red" } : { dir: "up", value: "PASS", tone: "cyan" }} footer={warrantyRisk ? <p className="text-glow-red font-mono text-[11px]">当前推演未达 {targetYears} 年目标</p> : <p className="font-mono text-[11px] text-muted-foreground">当前推演满足 {targetYears} 年目标</p>}>
        <div>
          <div className="flex items-baseline gap-1">
            <span className={cn("font-mono text-5xl font-bold tabular-nums tracking-tight", warrantyRisk ? "text-glow-red" : "text-glow-rose")}>{formatNumber(targetYears, 0)}</span>
            <span className={cn("font-mono text-xl font-medium", warrantyRisk ? "text-red-400/70" : "text-[var(--color-rose-gold)]/70")}>年</span>
          </div>
          <p className="mt-2 font-mono text-sm font-semibold text-[var(--color-platinum)]/85">{formatNumber(targetLifeHours, 0)} h</p>
        </div>
      </MetricCard>
    </div>
  );
}

function RiskChart() {
  const tUse = useArrheniusStore((state) => state.tUse);
  const tOven = useArrheniusStore((state) => state.tOven);
  const ea = useArrheniusStore((state) => state.ea);
  const duration = useArrheniusStore((state) => state.duration);
  const af = useArrheniusStore((state) => state.af);
  const projectedLife = useArrheniusStore((state) => state.projectedLife);
  const targetYears = useArrheniusStore((state) => state.targetYears);
  const dailyHours = useArrheniusStore((state) => state.dailyHours);
  const hoursPerYear = useArrheniusStore((state) => state.hoursPerYear);
  const targetLifeHours = useArrheniusStore((state) => state.targetLifeHours);
  const requiredTestHours = useArrheniusStore((state) => state.requiredTestHours);
  const deltaT = tUse - ROOM_TEMP;
  const tCoreTest = tOven + deltaT;
  const testDurationGap = duration - requiredTestHours;

  const curveData = useMemo(
    () => generateCurveData({ tUse, tOven, ea, duration }),
    [tUse, tOven, ea, duration],
  );

  const chartOption = useMemo(() => {
    const maxLife = curveData.reduce((max, [, life]) => Math.max(max, life), 0);

    return {
      backgroundColor: "transparent",
      animation: false,
      grid: {
        top: 28,
        right: 28,
        bottom: 36,
        left: 64,
      },
      tooltip: {
        show: false,
        trigger: "axis",
        backgroundColor: "rgba(7, 10, 16, 0.96)",
        borderColor: "rgba(116, 193, 255, 0.28)",
        borderWidth: 1,
        textStyle: {
          color: "#d7e7f5",
          fontFamily: "monospace",
        },
        formatter: (params: Array<{ value: [number, number] }> | { value?: [number, number] }) => {
          const point = Array.isArray(params) ? params[0] : params;
          if (!point?.value) return "";
          const [tempC, life] = point.value;
          return [
            `<div style="min-width:180px">`,
            `<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,0.25);padding-bottom:6px;margin-bottom:8px">`,
            `<span style="font-size:10px;letter-spacing:0.18em;color:#93a4b6">SURFACE TEMP</span>`,
            `<span style="font-size:12px;font-weight:700;color:#8fe7ff">${tempC}掳C</span>`,
            `</div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px">`,
            `<span style="color:#93a4b6">EXPECTED LIFE</span>`,
            `<span style="font-weight:600;color:#8fe7ff">${formatNumber(life)} h</span>`,
            `</div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;margin-top:4px">`,
            `<span style="color:#93a4b6">SURVIVAL</span>`,
            `<span style="font-weight:600;color:#f0d39b">${(life / hoursPerYear).toFixed(2)} y</span>`,
            `</div>`,
            `</div>`,
          ].join("");
        },
        axisPointer: {
          type: "line",
          lineStyle: {
            color: CYAN,
            type: "dashed",
            width: 1,
          },
        },
      },
      xAxis: {
        type: "value",
        min: 25,
        max: 200,
        interval: 25,
        axisLabel: {
          color: MUTED,
          fontFamily: "monospace",
          fontSize: 10,
          formatter: (value: number) => `${value}°C`,
        },
        axisLine: {
          lineStyle: {
            color: "oklch(0.5 0.06 230 / 0.25)",
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        name: "等效寿命 (h)",
        nameTextStyle: {
          color: "#888",
          padding: [0, 0, 0, 20],
        },
        max: Math.max(Math.ceil(projectedLife * 3), Math.ceil(targetLifeHours * 1.1)),
        min: 0,
        axisLabel: {
          color: "#E5E4E2",
          fontFamily: "JetBrains Mono",
          formatter: (value: number) => {
            return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(255, 255, 255, 0.05)",
            type: "dashed",
          },
        },
      },
      series: [
        {
          name: "Life Decay Curve",
          type: "line",
          smooth: true,
          data: curveData,
          showSymbol: false,
          lineStyle: {
            color: "#00F3FF",
            width: 3,
            shadowColor: "#00F3FF",
            shadowBlur: 22,
          },
          areaStyle: {
            shadowBlur: 28,
            shadowColor: "rgba(79, 223, 255, 0.28)",
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(79, 223, 255, 0.52)" },
                { offset: 0.28, color: "rgba(79, 223, 255, 0.26)" },
                { offset: 0.6, color: "rgba(79, 223, 255, 0.10)" },
                { offset: 1, color: "rgba(5, 5, 5, 0)" },
              ],
            },
          },
          markLine: {
            symbol: ["none", "none"],
            animation: false,
            lineStyle: { type: "dashed", width: 1.2, color: "#B56E7A", opacity: 0.72 },
            label: { show: false },
            data: [
              { xAxis: tUse },
              { yAxis: projectedLife },
              [
                { coord: [tUse - 7, projectedLife] },
                {
                  coord: [tUse - 2.2, projectedLife],
                  lineStyle: { type: "solid", width: 1.4, color: "#B56E7A", opacity: 0.9 },
                },
              ],
              [
                { coord: [tUse + 2.2, projectedLife] },
                {
                  coord: [tUse + 7, projectedLife],
                  lineStyle: { type: "solid", width: 1.4, color: "#B56E7A", opacity: 0.9 },
                },
              ],
              [
                { coord: [tUse, projectedLife + 180] },
                {
                  coord: [tUse, projectedLife + 40],
                  lineStyle: { type: "solid", width: 1.4, color: "#B56E7A", opacity: 0.9 },
                },
              ],
              [
                { coord: [tUse, Math.max(0, projectedLife - 180)] },
                {
                  coord: [tUse, Math.max(0, projectedLife - 40)],
                  lineStyle: { type: "solid", width: 1.4, color: "#B56E7A", opacity: 0.9 },
                },
              ],
              [
                { coord: [25, targetLifeHours] },
                {
                  coord: [tUse, targetLifeHours],
                  lineStyle: { type: "dashed", width: 1.6, color: "#00F3FF", opacity: 0.95 },
                  label: { show: false },
                },
              ],
            ],
          },
          markPoint: {
            symbol: "circle",
            symbolSize: 10,
            animation: false,
            itemStyle: {
              color: "rgba(0,0,0,0)",
              borderColor: "#B56E7A",
              borderWidth: 2,
              shadowBlur: 18,
              shadowColor: "rgba(181, 110, 122, 0.58)",
            },
            data: [
              {
                coord: [tUse, projectedLife],
                label: {
                  show: true,
                  position: "top",
                  offset: [18, -2],
                  fontFamily: "Noto Sans SC",
                  fontSize: 12,
                  lineHeight: 20,
                  formatter: `任务测试寿命: ${formatNumber(duration, 0)}时\n设计寿命差值: ${testDurationGap > 0 ? "+" : ""}${formatNumber(testDurationGap, 0)}时`,
                  borderRadius: 6,
                  padding: [10, 14],
                  backgroundColor: "rgba(25, 12, 18, 0.86)",
                  borderColor: "#B56E7A",
                  borderWidth: 1.2,
                  shadowBlur: 14,
                  shadowColor: "rgba(181, 110, 122, 0.35)",
                  align: "left",
                  color: "#E5E4E2",
                },
                itemStyle: {
                  color: "rgba(0,0,0,0)",
                  borderColor: "#B56E7A",
                  borderWidth: 2,
                  shadowBlur: 18,
                  shadowColor: "rgba(181, 110, 122, 0.58)",
                },
              },
              {
                coord: [tUse, targetLifeHours],
                itemStyle: {
                  color: "#00F3FF",
                  borderColor: "#00F3FF",
                  borderWidth: 1.5,
                  shadowBlur: 16,
                  shadowColor: "#00F3FF",
                },
                label: {
                  show: true,
                  position: "left",
                  offset: [24, 6],
                  formatter: `设计寿命: ${targetYears}年
环境温度: ${tOven}°C
当前环境倍率: ${af.toFixed(2)}倍
目标寿命需测: ${requiredTestHours.toFixed(0)}小时`,
                  fontSize: 13,
                  fontFamily: "Noto Sans SC",
                  lineHeight: 22,
                  borderRadius: 6,
                  padding: [12, 16],
                  backgroundColor: "rgba(0, 15, 20, 0.85)",
                  borderColor: "#00F3FF",
                  borderWidth: 1.5,
                  shadowBlur: 15,
                  shadowColor: "rgba(0, 243, 255, 0.4)",
                  align: "left",
                  color: "#E5E4E2",
                },
              },
            ],
          },
        },
        {
          type: "custom",
          name: "Target Lift Arrow",
          coordinateSystem: "cartesian2d",
          silent: true,
          data: [[tUse, projectedLife, targetLifeHours]],
          renderItem: (
            params: unknown,
            api: {
              value: (dimension: number) => number;
              coord: (value: [number, number]) => [number, number];
            },
          ) => {
            const anchorTemp = api.value(0);
            const projected = api.value(1);
            const target = api.value(2);
            const gap = Math.max(target - projected, 120);
            const arrowTemp = anchorTemp - 2.6;
            const bottomLife = projected + gap * 0.14;
            const topLife = target - gap * 0.2;

            const bottom = api.coord([arrowTemp, bottomLife]);
            const top = api.coord([arrowTemp, topLife]);
            const arrowHeight = Math.max(72, bottom[1] - top[1]);
            const shaftHalfWidth = 0.9;
            const headHeight = Math.min(28, Math.max(18, arrowHeight * 0.15));
            const headHalfWidth = 4.6;
            const neckHalfWidth = 1.8;

            const bodyPoints: Array<[number, number]> = [
              [bottom[0] - shaftHalfWidth, bottom[1]],
              [bottom[0] + shaftHalfWidth, bottom[1]],
              [top[0] + shaftHalfWidth, top[1] + headHeight * 0.92],
              [top[0] + headHalfWidth, top[1] + headHeight * 0.72],
              [top[0] + neckHalfWidth, top[1] + headHeight * 0.3],
              [top[0], top[1]],
              [top[0] - neckHalfWidth, top[1] + headHeight * 0.3],
              [top[0] - headHalfWidth, top[1] + headHeight * 0.72],
              [top[0] - shaftHalfWidth, top[1] + headHeight * 0.92],
            ];

            const glowPoints = bodyPoints.map(([x, y]) => [x + (x > top[0] ? 3 : -3), y + (y > top[1] ? 3 : -3)] as [number, number]);

            return {
              type: "group",
              children: [
                {
                  type: "polygon",
                  shape: { points: glowPoints },
                  style: {
                    fill: "rgba(0, 243, 255, 0.16)",
                    shadowBlur: 14,
                    shadowColor: "rgba(0, 243, 255, 0.48)",
                    opacity: 0.9,
                  },
                },
                {
                  type: "polygon",
                  shape: { points: bodyPoints },
                  style: {
                    fill: {
                      type: "linear",
                      x: 0,
                      y: 1,
                      x2: 0,
                      y2: 0,
                      colorStops: [
                        { offset: 0, color: "#00cfe6" },
                        { offset: 0.55, color: "#00e8ff" },
                        { offset: 1, color: "#74f6ff" },
                      ],
                    },
                    stroke: "rgba(216, 252, 255, 0.62)",
                    lineWidth: 1,
                    shadowBlur: 12,
                    shadowColor: "rgba(0, 243, 255, 0.42)",
                  },
                },
                {
                  type: "polyline",
                  shape: {
                    points: [
                      [bottom[0], bottom[1] - 10],
                      [bottom[0], top[1] + headHeight * 0.98],
                      [top[0], top[1] + headHeight * 0.26],
                    ],
                    smooth: 0.18,
                  },
                  style: {
                    stroke: "rgba(234, 255, 255, 0.62)",
                    lineWidth: 1,
                    lineCap: "round",
                    shadowBlur: 8,
                    shadowColor: "rgba(186, 250, 255, 0.22)",
                    fill: null,
                  },
                },
              ],
            };
          },
        },
      ],
    };
  }, [af, curveData, dailyHours, duration, hoursPerYear, projectedLife, requiredTestHours, targetLifeHours, targetYears, testDurationGap, tOven, tUse]);


  return (
    <div className="glass-panel metal-edge flex flex-col rounded-2xl">
      <div className="metal-edge brushed-metal flex flex-wrap items-center justify-between gap-3 rounded-t-2xl px-5 py-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">指数寿命图谱</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Arrhenius Life-Decay / Dynamic Physics Curve
          </p>
        </div>
      </div>

      <div className="lux-grid px-3 py-4">
        <ReactECharts option={chartOption} notMerge lazyUpdate style={{ height: 360, width: "100%" }} />
      </div>

      <p className="border-t border-border/60 px-5 py-3 font-mono text-[10px] text-muted-foreground">
        动态锚点 T_use={tUse}°C / T_oven={tOven}°C / ΔT={deltaT.toFixed(0)}°C / T_core_test={tCoreTest.toFixed(0)}°C / duration={formatNumber(duration)}h
      </p>
    </div>
  );
}

function AuditTrail() {
  const tUse = useArrheniusStore((state) => state.tUse);
  const tOven = useArrheniusStore((state) => state.tOven);
  const ea = useArrheniusStore((state) => state.ea);
  const duration = useArrheniusStore((state) => state.duration);
  const af = useArrheniusStore((state) => state.af);
  const projectedLife = useArrheniusStore((state) => state.projectedLife);
  const survivalYears = useArrheniusStore((state) => state.survivalYears);
  const hoursPerYear = useArrheniusStore((state) => state.hoursPerYear);
  const valid = useArrheniusStore((state) => state.valid);
  const deltaT = useArrheniusStore((state) => state.deltaT);
  const tCoreTest = useArrheniusStore((state) => state.tCoreTest);
  const tUseK = useArrheniusStore((state) => state.tUseK);
  const tCoreTestK = useArrheniusStore((state) => state.tCoreTestK);
  const inverseTemperatureDelta = useArrheniusStore((state) => state.inverseTemperatureDelta);
  const exponent = useArrheniusStore((state) => state.exponent);
  const [open, setOpen] = useState(true);

  const steps = [
    {
      index: "01",
      title: "绝对温度换算 (Kelvin Conversion)",
      content: [
        `自身温升 ΔT = T_use - ${ROOM_TEMP}°C = ${tUse} - ${ROOM_TEMP} = ${deltaT.toFixed(0)}°C`,
        `测试结温 T_core_test = T_oven + ΔT = ${tOven} + ${deltaT.toFixed(0)} = ${tCoreTest.toFixed(0)}°C`,
        `T_use(K) = ${tUse} + ${ARRHENIUS_KELVIN_OFFSET} = ${tUseK.toFixed(2)} K`,
        `T_test(K) = ${tCoreTest.toFixed(0)} + ${ARRHENIUS_KELVIN_OFFSET} = ${tCoreTestK.toFixed(2)} K`,
      ],
    },
    {
      index: "02",
      title: "加速因子计算 (Acceleration Factor)",
      content: [
        "AF = exp[(E_a / k) × (1/T_use - 1/T_core_test)]",
        `= exp[(${ea} / ${ARRHENIUS_BOLTZMANN_K.toExponential(4)}) × (1/${tUseK.toFixed(2)} - 1/${tCoreTestK.toFixed(2)})]`,
        `= exp[${(ea / ARRHENIUS_BOLTZMANN_K).toFixed(1)} × ${inverseTemperatureDelta.toExponential(4)}] = exp[${exponent.toFixed(4)}]`,
        `故 AF = ${valid ? `${af.toFixed(2)} x` : "无效 (T_core_test <= T_use)"}`,
      ],
    },
    {
      index: "03",
      title: "寿命折算 (Life Projection)",
      content: [
        `Projected Life = ${duration} h × ${af.toFixed(2)} = ${formatNumber(projectedLife)} h`,
        `${formatNumber(projectedLife)} / ${formatNumber(hoursPerYear)} = ${formatNumber(survivalYears, 2)} 年`, 
      ],
    },
  ];

  return (
    <div className="glass-panel metal-edge rounded-2xl">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 rounded-t-2xl px-5 py-4 text-left" aria-expanded={open}>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">运算规则</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Formula Breakdown / White-box Derivation</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-[var(--color-rose-gold)] transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-border px-5 py-4">
          <div className="divide-y divide-border/60">
            {steps.map((step) => (
              <div key={step.index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{step.index}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{step.title}</p>
                  <div className="mt-1.5 space-y-1 font-mono text-[11px] leading-relaxed text-foreground/90 sm:text-xs">
                    {step.content.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-[var(--color-rose-gold)]/15 bg-black/15 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-foreground">激活能公式与注释</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">ACTIVATION ENERGY / ENGINEERING NOTE</p>
              </div>
              <span className="rounded bg-[var(--color-rose-gold)]/12 px-2 py-1 font-mono text-[12px] font-semibold text-glow-rose">
                E_a = {ea.toFixed(2)} eV
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-black/20 px-3 py-3 font-mono text-[12px] text-foreground/90">
                <p>AF = exp[(E_a / k) × (1/T_use - 1/T_core_test)]</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  其中 E_a 表示材料或失效机理跨越能垒所需的最小能量，单位为 eV。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-black/20 px-3 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">LOW E_a</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">约 0.45 - 0.60 eV，常见于光衰、扩散或缓慢材料退化。</p>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">MID E_a</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">约 0.60 - 0.85 eV，常见于封装复合退化、焊点与界面疲劳。</p>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">HIGH E_a</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">0.85 eV 以上，更接近驱动、电容、绝缘系统等高温敏感失效。</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                当前所选激活能越高，说明温度对应的加速效果越强；在相同烤箱环境下，验证目标寿命所需测试工时会更短。
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


export default function ReliabilityCalculatorDashboard() {

  return (
    <main className="reliability-calculator-dashboard overflow-hidden rounded-[28px] border border-cyan/15 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 lg:px-8 lg:py-8">
        <header className="glass-panel metal-edge mb-5 rounded-2xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="metal-edge brushed-metal glow-rose flex size-12 shrink-0 items-center justify-center rounded-xl">
                <span className="text-inlay-gold font-mono text-xl font-bold tracking-tight">ALT</span>
              </div>
              <div>
                <h1 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
                  <span className="text-inlay-gold">可靠性寿命测试</span>
                </h1>
                <p className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-inlay-platinum font-semibold tracking-[0.2em]">AXIOM</span>
                  <span className="text-[var(--color-rose-gold)]">v4.2.1</span>
                  <span className="text-muted-foreground">/ Reliability Life Test Engine</span>
                </p>
              </div>
            </div>

          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          <ControlPanel />
          <div className="flex flex-col gap-5">
            <ExecutiveMetrics />
            <RiskChart />
            <AuditTrail />
          </div>
        </div>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 font-mono text-[10px] text-muted-foreground">
          <span className="text-inlay-platinum">AXIOM Reliability Suite / Module 01 / ALT</span>
          <span>k = 8.6173e-5 eV/K / T_test = T_oven + 螖T / AF = exp((Ea/k)(1/T_use - 1/T_test))</span>
        </footer>
      </div>
    </main>
  );
}

