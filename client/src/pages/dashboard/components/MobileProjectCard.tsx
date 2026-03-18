/**
 * MobileProjectCard — Compact mobile card with expandable detail
 * Touch-optimized: min 44px targets, clear visual hierarchy
 */
import React, { useState } from 'react';
import type { ProjectData } from '../types/project';
import {
  formatDate,
  getDisplayValue,
  parseFAIValue,
  getFAIColorClass,
} from '../lib/projectUtils';
import { ChevronDown, Clock, Calendar, Wrench } from 'lucide-react';
import {
  getProjectStatusLabel,
  normalizeProjectStatus,
} from '@/lib/dashboardProjectState';

interface Props { project: ProjectData; }

export default function MobileProjectCard({ project }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { no, identity, milestones, details } = project;
  const node = normalizeProjectStatus(milestones?.currentNode);
  const nodeLabel = getProjectStatusLabel(node);

  let dotCls = 'bg-[#6E7681]';
  let nodeCls = 'text-[#8B949E]';
  let borderAccent = 'border-l-[#6E7681]';
  if (node === 'overdue' || node === 'delayed') { dotCls = 'bg-[#FF3B3B]'; nodeCls = 'text-[#FF3B3B]'; borderAccent = 'border-l-[#FF3B3B]'; }
  else if (node === 'completed') { dotCls = 'bg-[#00FFA3]'; nodeCls = 'text-[#00FFA3]'; borderAccent = 'border-l-[#00FFA3]'; }
  else if (node === 'ongoing') { dotCls = 'bg-[#FACC15]'; nodeCls = 'text-[#FACC15]'; borderAccent = 'border-l-[#FACC15]'; }

  const est = milestones.estimatedCompletion ? formatDate(milestones.estimatedCompletion) : '-';
  const faiT = parseFAIValue(milestones.toolingFAI);
  const faiP = parseFAIValue(milestones.partFAI);
  const faiTCls = getFAIColorClass(milestones.toolingFAI);
  const faiPCls = getFAIColorClass(milestones.partFAI);
  const detailText = details.detailProgress?.trim() || '暂无推进细节';
  const hasDetail = detailText !== '暂无推进细节';

  return (
    <div className={`rounded-xl overflow-hidden border border-white/[0.06] bg-[#121821] border-l-[3px] ${borderAccent}`}>
      {/* ── Summary row (always visible, tappable) ── */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] touch-manipulation text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: project info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-bold text-[#E6EDF3] truncate">{getDisplayValue(identity.moldNumber, '-')}</span>
            <span className={`flex-none inline-flex items-center gap-1 text-[11px] font-bold ${nodeCls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
              {nodeLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#6E7681]">
            <span className="truncate">{getDisplayValue(identity.projectName, '-')}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5 shrink-0"><Calendar size={10} />{est}</span>
          </div>
        </div>
        {/* Right: chevron */}
        <ChevronDown
          size={18}
          className={`shrink-0 text-[#6E7681] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Expandable detail ── */}
      {expanded && (
        <div className="border-t border-white/[0.04] animate-fade-in">
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
            <MiniStat label="试模次数" value={getDisplayValue(milestones.trialCount, '-')} />
            <MiniStat label="Tooling FAI" value={faiT} cls={faiTCls} />
            <MiniStat label="Part FAI" value={faiP} cls={faiPCls} />
          </div>

          {/* Timeline */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <TNode label="KICK OFF" date={formatDate(milestones.projectStart)} />
              <Line />
              <TNode label="G/L" date={formatDate(milestones.glTime)} />
              <Line />
              <TNode label="VMP" date={formatDate(milestones.vmp)} />
              <Line />
              <TNode label="MP" date={formatDate(milestones.mp)} />
              <Line />
              <TNode label="T1" date={formatDate(milestones.t1)} />
            </div>
          </div>

          {/* Detail info */}
          <div className="px-4 pb-3 space-y-2">
            <InfoRow label="客户" value={`${getDisplayValue(identity.customerName, '-')} · ${getDisplayValue(identity.customerBase, '-')}`} />
            <InfoRow label="工厂" value={getDisplayValue(identity.factory, '-')} />
            <InfoRow label="项目经理" value={getDisplayValue(identity.projectManager, '-')} />
            <InfoRow label="当前阶段" value={getDisplayValue(milestones.currentStage, '-')} />
            {hasDetail && (
              <div className="pt-2 border-t border-white/[0.04]">
                <span className="text-[10px] font-bold text-[#6E7681] uppercase tracking-wider">推进细节</span>
                <p className="mt-1 text-[12px] leading-[1.6] text-[#C9D1D9] break-words">{detailText}</p>
                {details.detailDate && (
                  <span className="text-[10px] text-[#6E7681] mt-1 inline-flex items-center gap-1">
                    <Clock size={10} />{formatDate(details.detailDate)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-[#0F141B] px-3 py-2.5 text-center">
      <div className="text-[9px] font-bold text-[#6E7681] uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-[14px] font-bold tabular-nums ${cls || 'text-[#E6EDF3]'}`}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#6E7681] font-medium shrink-0 w-[56px]">{label}</span>
      <span className="text-[12px] text-[#C9D1D9] truncate">{value}</span>
    </div>
  );
}

function TNode({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="w-6 h-6 rounded-full bg-[#1B222C] border border-white/[0.08] flex items-center justify-center mb-0.5">
        <div className="w-2 h-2 rounded-full bg-[#FACC15]" />
      </div>
      <span className="text-[8px] font-bold text-[#8B949E] whitespace-nowrap">{label}</span>
      <span className="text-[7px] text-[#6E7681] whitespace-nowrap">{date}</span>
    </div>
  );
}

function Line() {
  return <div className="flex-1 h-[1px] bg-white/[0.06] min-w-[8px]" />;
}
