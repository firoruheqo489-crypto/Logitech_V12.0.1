'use client';

import { AlertTriangle, FileText, ShieldCheck, UploadCloud } from 'lucide-react';

type RowStatus = 'passed' | 'delay' | 'locked' | 'delayed-minor';

interface RowData {
  task: string;
  owner: string;
  plan: string;
  actual: string;
  status: RowStatus;
  statusLabel: string;
  deliverable: string | null;
  deliverableAction?: 'download' | 'upload';
}

interface PhaseSection {
  title: string;
  titleEn: string;
  subtitle: string;
  rows: RowData[];
}

const phaseData: Record<number, PhaseSection> = {
  1: {
    title: '产品可行性评审',
    titleEn: 'DFM REVIEW',
    subtitle: '设计阶段履约明细表',
    rows: [
      {
        task: '客户 3D/2D 图纸接收确认',
        owner: '项目部 / PM 张工',
        plan: '01-05',
        actual: '01-05',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'Drawing_Receipt.pdf',
        deliverableAction: 'download',
      },
      {
        task: 'DFM 可行性分析报告',
        owner: '工程部 / DFM 组',
        plan: '01-10',
        actual: '01-10',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'DFM_Analysis.pdf',
        deliverableAction: 'download',
      },
      {
        task: '模流分析 (Moldflow)',
        owner: '工程部 / CAE 刘工',
        plan: '01-15',
        actual: '01-14',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'Moldflow_Report.pdf',
        deliverableAction: 'download',
      },
      {
        task: '模具报价与合同签订',
        owner: '商务部 / 报价组',
        plan: '01-20',
        actual: '01-20',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'Contract_Signed.pdf',
        deliverableAction: 'download',
      },
    ],
  },
  2: {
    title: '模具制造与加工',
    titleEn: 'TOOLING BUILD',
    subtitle: '制造阶段履约明细表',
    rows: [
      {
        task: '钢材订购与入厂检验 (H13)',
        owner: '采购部',
        plan: '02-15',
        actual: '02-15',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'Material_Cert.pdf',
        deliverableAction: 'download',
      },
      {
        task: 'CNC 粗加工与热处理',
        owner: '模具部 / CNC组',
        plan: '02-20',
        actual: '02-22',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'Heat_Treat_Log.pdf',
        deliverableAction: 'download',
      },
      {
        task: 'EDM 放电与线割',
        owner: '模具部 / EDM组',
        plan: '02-28',
        actual: '03-01',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'EDM_Report.pdf',
        deliverableAction: 'download',
      },
      {
        task: '飞模与总装配合',
        owner: '模具部 / 钳工组',
        plan: '03-05',
        actual: '03-08',
        status: 'delayed-minor',
        statusLabel: 'DELAYED 3 DAYS',
        deliverable: 'Assembly_Checklist.pdf',
        deliverableAction: 'download',
      },
    ],
  },
  3: {
    title: '试模与战术纠偏',
    titleEn: 'TRIAL & DEBUGGING',
    subtitle: '履约明细表',
    rows: [
      {
        task: 'T0 试模申请单签核',
        owner: '模具部 / 王工',
        plan: '03-10',
        actual: '03-11',
        status: 'passed',
        statusLabel: 'PASSED',
        deliverable: 'T0_Signoff.pdf',
        deliverableAction: 'download',
      },
      {
        task: '模具 3D CMM 检测报告',
        owner: '品质部 / 测量室',
        plan: '03-12',
        actual: '--',
        status: 'delay',
        statusLabel: 'DELAY: 10 DAYS',
        deliverable: null,
        deliverableAction: 'upload',
      },
      {
        task: '尺寸 CPK > 1.33 验证报告',
        owner: '品质部 / QE 李工',
        plan: '03-18',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
    ],
  },
  4: {
    title: 'PPAP 文件提交',
    titleEn: 'PPAP SUBMIT',
    subtitle: '提交阶段履约明细表',
    rows: [
      {
        task: 'PSW 零件提交保证书',
        owner: '品质部 / QE 李工',
        plan: '04-01',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
      {
        task: '全尺寸检测报告',
        owner: '品质部 / 测量室',
        plan: '04-05',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
      {
        task: '材料 & 性能试验报告',
        owner: '品质部 / 实验室',
        plan: '04-08',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
    ],
  },
  5: {
    title: '量产移交',
    titleEn: 'SOP HANDOFF',
    subtitle: '量产阶段履约明细表',
    rows: [
      {
        task: 'SOP 作业指导书发布',
        owner: '工程部 / PE 组',
        plan: '04-15',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
      {
        task: '产线 OEE 达标验证',
        owner: '生产部 / IE 组',
        plan: '04-20',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
      {
        task: '模具资产移交签收',
        owner: '项目部 / PM 张工',
        plan: '04-25',
        actual: '--',
        status: 'locked',
        statusLabel: 'LOCKED',
        deliverable: null,
      },
    ],
  },
};

function StatusBadge({
  status,
  label,
}: {
  status: RowStatus;
  label: string;
}) {
  const styles = {
    passed: 'text-emerald-400 border-emerald-900 bg-emerald-950/30',
    delay: 'text-rose-500 border-rose-900 bg-rose-950/30 animate-pulse',
    locked: 'text-slate-500 border-slate-800 bg-slate-900/50',
    'delayed-minor': 'text-amber-500 border-amber-900 bg-amber-950/30',
  };

  return (
    <span
      className={`text-[10px] border px-2 py-0.5 rounded font-mono font-semibold ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function DeliverableCell({ row }: { row: RowData }) {
  if (row.deliverableAction === 'upload' && !row.deliverable) {
    return (
      <button className="text-slate-500 hover:text-cyan-400 border border-slate-700 border-dashed px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-mono transition-colors cursor-pointer" type="button">
        <UploadCloud className="w-3 h-3" />
        UPLOAD CMM
      </button>
    );
  }

  if (row.deliverable) {
    return (
      <button className="text-cyan-500 hover:text-cyan-400 flex items-center gap-1 text-[10px] font-mono transition-colors cursor-pointer" type="button">
        <FileText className="w-3 h-3" />
        {row.deliverable}
      </button>
    );
  }

  return <span className="text-slate-700 font-mono text-[10px]">--</span>;
}

export function AuditMatrix({ activePhase }: { activePhase: number }) {
  const data = phaseData[activePhase];

  if (!data) return null;

  const completedCount = data.rows.filter(
    (row) => row.status === 'passed' || row.status === 'delayed-minor',
  ).length;
  const totalCount = data.rows.length;
  const hasDelay = data.rows.some(
    (row) => row.status === 'delay' || row.status === 'delayed-minor',
  );

  return (
    <div className="bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden mt-4">
      <div className="bg-slate-900/80 p-4 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-200 font-mono tracking-wide">
            {'PHASE ' + activePhase + ': '}
            {data.title} ({data.titleEn}) - {data.subtitle}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasDelay && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              VARIANCE DETECTED
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-500">
            {completedCount}/{totalCount} TASKS COMPLETE
          </span>
          {completedCount === totalCount && (
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase font-mono bg-[#050812] border-b border-slate-800">
              <th className="px-4 py-3 font-semibold tracking-wider w-[28%]">
                工序 / TASK
              </th>
              <th className="px-4 py-3 font-semibold tracking-wider w-[18%]">
                责任矩阵 / OWNER
              </th>
              <th className="px-4 py-3 font-semibold tracking-wider w-[10%]">
                计划达成 / PLAN
              </th>
              <th className="px-4 py-3 font-semibold tracking-wider w-[10%]">
                实际达成 / ACTUAL
              </th>
              <th className="px-4 py-3 font-semibold tracking-wider w-[14%]">
                状态 / STATUS
              </th>
              <th className="px-4 py-3 font-semibold tracking-wider w-[20%]">
                交付件 / DELIVERABLE
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr
                key={`${row.task}-${index}`}
                className={`
                  border-b border-slate-800/50 transition-colors
                  ${row.status === 'delay' ? 'bg-rose-950/10' : 'hover:bg-slate-800/20'}
                  ${row.status === 'locked' ? 'opacity-50' : ''}
                `}
              >
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-300 font-medium">
                    {row.task}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-400 font-mono">
                    {row.owner}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-slate-300 tabular-nums">
                    {row.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      row.actual === '--' ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    {row.actual}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </td>
                <td className="px-4 py-3">
                  <DeliverableCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
