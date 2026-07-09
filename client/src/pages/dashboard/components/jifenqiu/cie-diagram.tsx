"use client";

import type { ChromaticityModel } from "./report-data";
import { glassPanel } from "./ui";

const LOCUS: [number, number][] = [
  [0.1741, 0.005], [0.1566, 0.0177], [0.144, 0.0297], [0.1241, 0.0578],
  [0.0913, 0.1327], [0.0454, 0.295], [0.0082, 0.5384], [0.0139, 0.7502],
  [0.0743, 0.8338], [0.1547, 0.8059], [0.2296, 0.7543], [0.3016, 0.6923],
  [0.3731, 0.6245], [0.4441, 0.5547], [0.5125, 0.4866], [0.5752, 0.4242],
  [0.627, 0.3725], [0.6658, 0.334], [0.6915, 0.3083], [0.7079, 0.292],
  [0.719, 0.2809], [0.7347, 0.2653],
];

const W = 300;
const H = 300;
const MAX_X = 0.8;
const MAX_Y = 0.9;

const px = (x: number) => (x / MAX_X) * W;
const py = (y: number) => H - (y / MAX_Y) * H;

function locusPath() {
  const pts = LOCUS.map(([x, y], index) => `${index === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`);
  return pts.join(" ") + " Z";
}

function Gauge({ label, a, b }: { label: string; a: [string, string]; b: [string, string] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded border border-white/[0.03] bg-black/40 px-2.5 py-1.5 font-mono text-xs">
      <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-slate-500">
        {a[0]}: <span className="text-cyan-300">{a[1]}</span>
      </span>
      <span className="text-slate-500">
        {b[0]}: <span className="text-cyan-300">{b[1]}</span>
      </span>
    </div>
  );
}

export function CieDiagram({ chromaticity }: { chromaticity: ChromaticityModel }) {
  const safeX = Number(chromaticity.x) || 0;
  const safeY = Number(chromaticity.y) || 0;
  const pointX = px(safeX);
  const pointY = py(safeY);
  const sdcmPass = chromaticity.sdcm > 0 && chromaticity.sdcm <= chromaticity.sdcmTarget;

  return (
    <div className={`flex flex-col ${glassPanel} p-5`}>
      <div className="mb-4 flex items-start border-b border-white/[0.05] pb-3">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-cyan-300/80" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-bold text-cyan-100">色品图</h3>
            <span className="text-[10px] font-semibold tracking-wide text-slate-500">颜色空间</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <svg viewBox={`-10 -10 ${W + 20} ${H + 20}`} className="h-56 w-auto" role="img" aria-label="色品坐标图">
          <defs>
            <radialGradient id="gamut" cx="38%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.55} />
              <stop offset="40%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="70%" stopColor="#eab308" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.22} />
            </radialGradient>
          </defs>

          {[0.2, 0.4, 0.6, 0.8].map((grid) => (
            <g key={grid}>
              <line x1={px(grid)} y1={0} x2={px(grid)} y2={H} stroke="rgba(255,255,255,0.04)" />
              <line x1={0} y1={py(grid)} x2={W} y2={py(grid)} stroke="rgba(255,255,255,0.04)" />
            </g>
          ))}

          <path d={locusPath()} fill="url(#gamut)" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} />
          <path
            d={`M${px(0.45)},${py(0.41)} Q${px(0.33)},${py(0.36)} ${px(0.26)},${py(0.27)}`}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />

          <circle cx={pointX} cy={pointY} r={9} fill="none" stroke="#06b6d4" strokeWidth={1} opacity={0.5} />
          <circle cx={pointX} cy={pointY} r={3.5} fill="#06b6d4" />
          <line x1={pointX} y1={pointY - 14} x2={pointX} y2={pointY + 14} stroke="#06b6d4" strokeWidth={0.6} opacity={0.6} />
          <line x1={pointX - 14} y1={pointY} x2={pointX + 14} y2={pointY} stroke="#06b6d4" strokeWidth={0.6} opacity={0.6} />
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-4">
        <Gauge label="CIE 1931 (x, y)" a={["X", chromaticity.x]} b={["Y", chromaticity.y]} />
        <Gauge label="CIE 1976 (u', v')" a={["u'", chromaticity.uPrime]} b={["v'", chromaticity.vPrime]} />
        <div className="col-span-2 grid grid-cols-2 gap-1.5 rounded border border-white/[0.03] bg-black/40 px-2.5 py-1.5 font-mono text-xs">
          <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">CCT / Duv</span>
          <span className="text-slate-500">
            CCT: <span className="text-cyan-300">{chromaticity.cct} K</span>
          </span>
          <span className="text-slate-500">
            Duv: <span className="text-cyan-300">{chromaticity.duv}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.03] bg-black/40 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SDCM / 色品容差</span>
          <span className="font-mono text-sm font-semibold text-gray-100 tabular-nums">
            {chromaticity.sdcm > 0 ? chromaticity.sdcm.toFixed(1) : "--"} step
          </span>
        </div>
        <span
          className={`font-mono text-xs font-semibold tracking-wider ${sdcmPass ? "text-emerald-300" : "text-red-300"}`}
        >
          {sdcmPass ? `<=${chromaticity.sdcmTarget} / WITHIN TOL` : "OUT OF TOL"}
        </span>
      </div>
    </div>
  );
}
