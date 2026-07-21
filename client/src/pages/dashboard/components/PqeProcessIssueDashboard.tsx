import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Factory,
  Plus,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { createIssue, fetchIssues, updateIssue, type IssueRecord } from '@/lib/issueService';

type Props = { projectName?: string };
type IssueStatus = IssueRecord['status'];

type StatItem = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  highlighted?: boolean;
};

const EMPTY_MODULES: IssueRecord['modules'] = {
  evidence: { text: '', images: [] },
  description: { text: '', images: [] },
  rootCause: { text: '', images: [] },
  solution: { text: '', images: [] },
  verification: { text: '', images: [] },
};

const glassPanelClass =
  'border border-white/[0.06] bg-white/[0.03] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]';
const controlClass =
  'h-9 rounded-md border border-white/[0.08] bg-black/20 px-3 text-[12px] text-slate-100 outline-none transition focus:border-cyan-400/35 focus:bg-black/30';
const DUE_DATE_PATTERN = /(?:^|\n)计划完成[：:]\s*(\d{4}-\d{2}-\d{2})\s*$/;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function issueLine(issue: IssueRecord) {
  return issue.machine || '未指定产线';
}

function issueText(issue: IssueRecord) {
  return issue.modules.description.text || issue.modules.evidence.text || '未填写问题描述';
}

function issueDueDate(issue: IssueRecord) {
  return issue.modules.solution.text.match(DUE_DATE_PATTERN)?.[1] || '';
}

function issueAction(issue: IssueRecord) {
  return issue.modules.solution.text.replace(DUE_DATE_PATTERN, '').trim();
}

function buildSolutionText(action: string, dueDate: string) {
  const normalizedAction = action.trim();
  if (!dueDate) return normalizedAction;
  return `${normalizedAction}${normalizedAction ? '\n' : ''}计划完成：${dueDate}`;
}

function priorityClass(priority?: string) {
  if (priority === '紧急') return 'border-rose-400/20 bg-rose-400/10 text-rose-200';
  if (priority === '重要') return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
  return 'border-white/[0.08] bg-white/[0.03] text-slate-300';
}

export default function PqeProcessIssueDashboard({ projectName = '' }: Props) {
  const projectId = projectName.trim() || 'pqe-workshop';
  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [lineFilter, setLineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IssueStatus>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    line: '',
    problem: '',
    owner: '',
    action: '',
    dueDate: today(),
    severity: '一般',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchIssues(projectId);
      setRecords(next);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo(
    () => Array.from(new Set(records.map(issueLine))).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [records],
  );

  const selectedDateRecords = useMemo(
    () => records.filter((record) => record.date === selectedDate),
    [records, selectedDate],
  );

  const dayRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return selectedDateRecords
      .filter((record) => {
        const searchableText = `${issueText(record)} ${record.technician || ''} ${issueLine(record)}`.toLowerCase();
        return (lineFilter === 'ALL' || issueLine(record) === lineFilter)
          && (statusFilter === 'ALL' || record.status === statusFilter)
          && (!normalizedQuery || searchableText.includes(normalizedQuery));
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [selectedDateRecords, lineFilter, statusFilter, query]);

  const stats = useMemo(() => ({
    total: selectedDateRecords.length,
    open: selectedDateRecords.filter((record) => record.status !== 'submitted').length,
    closed: selectedDateRecords.filter((record) => record.status === 'submitted').length,
    lines: new Set(selectedDateRecords.map(issueLine)).size,
  }), [selectedDateRecords]);

  const statItems: StatItem[] = [
    { label: '当日问题', value: stats.total, detail: selectedDate, icon: ClipboardList },
    { label: '待闭环', value: stats.open, detail: '需要持续跟进', icon: AlertTriangle, highlighted: true },
    { label: '已闭环', value: stats.closed, detail: '已完成改善验证', icon: CheckCircle2 },
    { label: '涉及产线', value: stats.lines, detail: '当日覆盖范围', icon: Factory },
  ];

  const hasActiveFilters = lineFilter !== 'ALL' || statusFilter !== 'ALL' || Boolean(query.trim());

  async function saveIssue() {
    if (!draft.line.trim() || !draft.problem.trim()) {
      toast.error('请至少填写产线和问题点');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const record: IssueRecord = {
      id: `pqe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      projectName,
      types: [],
      date: selectedDate,
      process: '',
      quantity: draft.severity,
      technician: draft.owner.trim(),
      machine: draft.line.trim(),
      modules: {
        ...EMPTY_MODULES,
        description: { text: draft.problem.trim(), images: [] },
        solution: { text: buildSolutionText(draft.action, draft.dueDate), images: [] },
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const ok = await createIssue(record);
      if (!ok) {
        toast.error('问题保存失败');
        return;
      }

      toast.success('问题点已记录');
      setRecords((current) => [record, ...current]);
      setDraft({ line: '', problem: '', owner: '', action: '', dueDate: selectedDate, severity: '一般' });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(record: IssueRecord) {
    if (updatingId) return;
    const nextStatus: IssueStatus = record.status === 'submitted' ? 'draft' : 'submitted';
    const next: IssueRecord = {
      ...record,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    setUpdatingId(record.id);
    try {
      if (!await updateIssue(next)) {
        toast.error('状态更新失败');
        return;
      }
      setRecords((current) => current.map((item) => item.id === record.id ? next : item));
      toast.success(nextStatus === 'submitted' ? '问题已标记闭环' : '问题已重新打开');
    } finally {
      setUpdatingId(null);
    }
  }

  function openCreateDialog() {
    setDraft((current) => ({ ...current, dueDate: selectedDate }));
    setFormOpen(true);
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#050505] text-[#E2E8F0] shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.06),transparent_22%),linear-gradient(180deg,#050505,#0a0a0a)]">
        <header className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#94A3B8]">Enterprise PQE Workspace</p>
              <h1 className="mt-1 text-base font-semibold tracking-[0.02em] text-[#E2E8F0]">车间制程问题台账</h1>
              <p className="mt-1.5 text-[12px] text-[#64748B]">记录现场问题，跟踪责任人与改善闭环。</p>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className={`inline-flex min-h-[56px] w-[148px] items-center gap-3 rounded-xl px-4 py-2 transition hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-60 ${glassPanelClass}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-400/10 text-slate-300">
                  <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-[#E2E8F0]">刷新台账</span>
              </button>

              <button
                type="button"
                onClick={openCreateDialog}
                className={`inline-flex min-h-[56px] w-[168px] items-center gap-3 rounded-xl px-4 py-2 transition hover:bg-white/[0.04] ${glassPanelClass}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <Plus className="h-4.5 w-4.5" />
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-[#E2E8F0]">记录问题</span>
              </button>
            </div>
          </div>
        </header>

        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <div className="flex min-h-[36px] items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3.5 text-[12px] text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(103,232,249,0.45)]" />
            <span>当前视图</span>
            <span className="font-medium text-slate-300">{projectName.trim() || 'PQE 车间'} · {selectedDate}</span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <section className={`rounded-[18px] p-3 ${glassPanelClass}`}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {statItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex min-h-[92px] items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      item.highlighted
                        ? 'border-cyan-400/30 bg-cyan-400/10'
                        : 'border-white/[0.05] bg-black/15'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      item.highlighted ? 'bg-cyan-400/15 text-cyan-200' : 'bg-white/[0.04] text-slate-500'
                    }`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm font-medium ${item.highlighted ? 'text-slate-100' : 'text-slate-300'}`}>{item.label}</p>
                        <span className="text-xl font-semibold tabular-nums text-slate-100">{item.value}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#64748B]">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-medium text-slate-100">现场问题台账</h2>
                <p className="mt-1 text-[11px] text-[#64748B]">按日期、产线和状态检索现场问题</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="whitespace-nowrap text-xs text-gray-500">共 {dayRecords.length} 条</span>
                <div className="relative sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索问题、责任人、产线"
                    className="h-9 w-full rounded-md border border-white/[0.08] bg-black/20 py-2 pl-9 pr-3 text-[12px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 focus:bg-black/30"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-white/[0.015] px-4 py-3 sm:flex-row sm:items-center">
              <div className="relative sm:w-[170px]">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className={`${controlClass} w-full pl-9 [color-scheme:dark]`}
                />
              </div>
              <select
                value={lineFilter}
                onChange={(event) => setLineFilter(event.target.value)}
                className={`${controlClass} sm:w-[150px]`}
              >
                <option value="ALL">全部产线</option>
                {lines.map((line) => <option key={line}>{line}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'ALL' | IssueStatus)}
                className={`${controlClass} sm:w-[150px]`}
              >
                <option value="ALL">全部状态</option>
                <option value="draft">待闭环</option>
                <option value="submitted">已闭环</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] table-fixed">
                <thead className="bg-white/[0.03]">
                  <tr className="border-b border-white/10">
                    <th className="w-[6%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">序号</th>
                    <th className="w-[11%] px-3 py-3 text-left text-[13px] font-medium text-gray-400">产线</th>
                    <th className="w-[27%] px-3 py-3 text-left text-[13px] font-medium text-gray-400">问题点</th>
                    <th className="w-[10%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">责任人</th>
                    <th className="w-[9%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">优先级</th>
                    <th className="w-[13%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">计划完成</th>
                    <th className="w-[10%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">状态</th>
                    <th className="w-[14%] px-3 py-3 text-center text-[13px] font-medium text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || dayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-slate-500">
                          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                        </div>
                        <p className="mt-3 text-sm text-gray-500">
                          {loading
                            ? '正在读取台账...'
                            : selectedDateRecords.length === 0
                              ? '当天暂无问题记录。'
                              : hasActiveFilters
                                ? '未找到符合当前筛选条件的问题。'
                                : '当天暂无问题记录。'}
                        </p>
                      </td>
                    </tr>
                  ) : dayRecords.map((record, index) => {
                    const action = issueAction(record);
                    const dueDate = issueDueDate(record);
                    const isSubmitted = record.status === 'submitted';
                    const isUpdating = updatingId === record.id;
                    return (
                      <tr key={record.id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                        <td className="px-3 py-3 text-center text-[13px] tabular-nums text-slate-400">{dayRecords.length - index}</td>
                        <td className="px-3 py-3 text-[13px] text-slate-200">
                          <div className="truncate font-medium" title={issueLine(record)}>{issueLine(record)}</div>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-slate-200">
                          <div className="truncate font-medium text-slate-100" title={issueText(record)}>{issueText(record)}</div>
                          <div className="mt-1 truncate text-[11px] text-slate-500" title={action || '未填写改善措施'}>
                            措施：{action || '未填写'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-[13px] text-slate-300">{record.technician || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityClass(record.quantity)}`}>
                            {record.quantity || '一般'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-[13px] tabular-nums text-slate-300">{dueDate || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            isSubmitted
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                              : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                          }`}>
                            {isSubmitted ? '已闭环' : '待闭环'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => void toggleStatus(record)}
                            disabled={Boolean(updatingId)}
                            className="mx-auto inline-flex h-9 min-w-[88px] items-center justify-center rounded-md border border-white/10 px-3 text-[12px] text-slate-300 transition hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-50"
                          >
                            {isUpdating ? '更新中...' : isSubmitted ? '重新打开' : '标记闭环'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pqe-create-title"
            className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080808] shadow-[0_28px_100px_rgba(0,0,0,0.72)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#64748B]">PQE Issue Registration</p>
                <h2 id="pqe-create-title" className="mt-1 text-base font-semibold text-slate-100">记录制程问题</h2>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                aria-label="关闭"
                className="rounded-full border border-white/[0.08] p-2 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <Field label="产线" required>
                <input
                  value={draft.line}
                  onChange={(event) => setDraft({ ...draft, line: event.target.value })}
                  placeholder="如：A01线"
                  className={`${controlClass} mt-1.5 w-full`}
                />
              </Field>
              <Field label="责任人">
                <input
                  value={draft.owner}
                  onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
                  placeholder="填写跟进责任人"
                  className={`${controlClass} mt-1.5 w-full`}
                />
              </Field>
              <Field label="优先级">
                <select
                  value={draft.severity}
                  onChange={(event) => setDraft({ ...draft, severity: event.target.value })}
                  className={`${controlClass} mt-1.5 w-full`}
                >
                  <option>一般</option>
                  <option>重要</option>
                  <option>紧急</option>
                </select>
              </Field>
              <Field label="计划完成">
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                  className={`${controlClass} mt-1.5 w-full [color-scheme:dark]`}
                />
              </Field>
              <Field label="问题点" required className="md:col-span-2">
                <textarea
                  value={draft.problem}
                  onChange={(event) => setDraft({ ...draft, problem: event.target.value })}
                  rows={4}
                  placeholder="描述现场问题、异常现象及影响"
                  className="mt-1.5 w-full resize-none rounded-md border border-white/[0.08] bg-black/20 px-3 py-2.5 text-[12px] leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/35 focus:bg-black/30"
                />
              </Field>
              <Field label="临时／改善措施" className="md:col-span-2">
                <textarea
                  value={draft.action}
                  onChange={(event) => setDraft({ ...draft, action: event.target.value })}
                  rows={4}
                  placeholder="填写临时处置、改善方案或后续行动"
                  className="mt-1.5 w-full resize-none rounded-md border border-white/[0.08] bg-black/20 px-3 py-2.5 text-[12px] leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/35 focus:bg-black/30"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] bg-white/[0.015] px-5 py-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="h-9 rounded-md border border-white/10 px-4 text-[12px] text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveIssue()}
                disabled={saving}
                className="inline-flex h-9 min-w-[96px] items-center justify-center gap-2 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-4 text-[12px] font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-50"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {saving ? '保存中...' : '保存问题'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`text-[12px] font-medium text-slate-300 ${className}`}>
      {label}
      {required ? <span className="ml-1 text-cyan-300">*</span> : null}
      {children}
    </label>
  );
}
