/**
 * MilestoneMarker — 里程碑与导向线强耦合 (Single Component)
 *
 * 单一组件包含：顶部菱形、从菱形中心垂直落下的 1px 虚线、底部对称菱形。
 * 坐标唯一来源：dateToPixel，菱形 translateX(-50%) 与虚线 left 100% 绑定。
 */

import type { MilestoneView } from '@shared/ganttEngine';

// ─── 唯一坐标源 (Single Source of Truth) ─────────────────────────────────────

/**
 * 日期 → 时间轴 X 坐标（像素）。
 * 公式：X_pos = (T_target - T_start) / T_total_days * TotalWidth，取日列中心。
 * 菱形 center (translateX(-50%)) 与虚线的 left 必须都使用此值绑定。
 */
export function dateToPixel(
  targetDate: Date,
  startDate: Date,
  totalDays: number,
  totalWidth: number,
): number {
  const daysDiff = (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const dayWidth = totalDays > 0 ? totalWidth / totalDays : 0;
  return (daysDiff + 0.5) * dayWidth;
}

// ─── 组件 ────────────────────────────────────────────────────────────────────

export const MILESTONE_TOP_ROW_HEIGHT = 50;
export const MILESTONE_BOTTOM_ROW_HEIGHT = 20;

/**
 * 碰撞检测：计算每个里程碑标签应该放在哪一行（row），避免重叠。
 * 返回 Map<milestoneId, row>，row 从 0 开始。
 */
export function computeMilestoneLabelRows(
  milestones: { id: string; date: string; nameCn: string }[],
  startDate: Date,
  totalDays: number,
  totalWidth: number,
): Map<string, number> {
  const LABEL_CHAR_WIDTH = 12; // 每个中文字符约 12px
  const LABEL_PADDING = 32;   // 菱形 + 间距
  const MIN_GAP = 8;          // 标签之间最小间距

  // 计算每个里程碑的 x 坐标和标签宽度
  const items = milestones.map(ms => {
    const x = dateToPixel(new Date(ms.date), startDate, totalDays, totalWidth);
    const labelWidth = ms.nameCn.length * LABEL_CHAR_WIDTH + LABEL_PADDING;
    return { id: ms.id, x, left: x - labelWidth / 2, right: x + labelWidth / 2 };
  }).sort((a, b) => a.x - b.x);

  const rows = new Map<string, number>();
  // 每行已占用的区间
  const rowOccupied: { left: number; right: number }[][] = [];

  for (const item of items) {
    let placed = false;
    for (let r = 0; r < rowOccupied.length; r++) {
      const overlaps = rowOccupied[r].some(
        occ => !(item.left > occ.right + MIN_GAP || item.right < occ.left - MIN_GAP)
      );
      if (!overlaps) {
        rows.set(item.id, r);
        rowOccupied[r].push({ left: item.left, right: item.right });
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.set(item.id, rowOccupied.length);
      rowOccupied.push([{ left: item.left, right: item.right }]);
    }
  }

  return rows;
}

// Top padding for the sticky header (24px for breathing room)
const HEADER_TOP_PADDING = 24;

interface MilestoneMarkerProps {
  /** 里程碑数据 */
  milestone: MilestoneView;
  /** X 坐标（来自 dateToPixel），菱形与虚线共用 */
  leftPx: number;
  /** 甘特任务区高度（虚线贯穿此高度） */
  gridHeight: number;
  /** 是否显示底部菱形 */
  showBottomDiamond?: boolean;
  /** 是否显示顶部菱形 */
  showTopDiamond?: boolean;
  /** 是否显示垂直导向线 */
  showLine?: boolean;
  /** 标签行号（碰撞避让），0 = 默认位置，1 = 下移一行 */
  labelRow?: number;
}

export default function MilestoneMarker({
  milestone,
  leftPx,
  gridHeight,
  showBottomDiamond = true,
  showTopDiamond = true,
  showLine = true,
  labelRow = 0,
}: MilestoneMarkerProps) {
  const isCompleted = milestone.status === 'completed';
  const isActive = milestone.status === 'active';
  const isPending = milestone.status === 'pending';

  // 每行标签高度偏移（菱形 + 标签文字 ≈ 28px）
  const ROW_OFFSET = 28;
  // 顶部菱形垂直位置：顶部 padding + 行偏移
  const topDiamondY = HEADER_TOP_PADDING + (12 / 2) + labelRow * ROW_OFFSET;
  
  // 线条起始位置：必须从菱形中心开始向下
  const lineTop = topDiamondY;
  
  // 线条结束位置：贯穿整个甘特区域 + 顶部区域高度
  const lineBottom = MILESTONE_TOP_ROW_HEIGHT + gridHeight;
  const bottomDiamondY = lineBottom + (showBottomDiamond ? MILESTONE_BOTTOM_ROW_HEIGHT / 2 : 0);

  // Calculate container height based on visibility
  let containerHeight = 0;
  if (showLine) {
    containerHeight = lineBottom + (showBottomDiamond ? MILESTONE_BOTTOM_ROW_HEIGHT : 0);
  } else if (showTopDiamond) {
    containerHeight = MILESTONE_TOP_ROW_HEIGHT + HEADER_TOP_PADDING;
  }

  // ── Holographic Crystal — Pure CSS approach ──
  // All milestones glow the same regardless of pending/active/completed.
  // Only `dimmed` (bottom echo) is visually reduced.
  const HoloCrystal = ({ size, dimmed }: { size: number; dimmed?: boolean }) => {
    const diamondSize = dimmed ? size - 2 : size;
    const innerSize = Math.round(diamondSize * 0.55);
    const bracketLen = 4;
    const bracketBorder = dimmed ? '1px solid rgba(0,255,255,0.2)' : '1px solid rgba(0,255,255,0.6)';

    return (
      <div style={{ position: 'relative', width: diamondSize + 16, height: diamondSize + 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer diamond — rotated square with bright cyan border + glow */}
        <div
          className={!dimmed ? 'milestone-crystal-glow' : undefined}
          style={{
            width: diamondSize,
            height: diamondSize,
            transform: 'rotate(45deg)',
            border: '1.5px solid #00ffff',
            background: 'linear-gradient(135deg, rgba(0,255,255,0.15), rgba(0,255,255,0.4))',
            boxShadow: dimmed ? '0 0 3px rgba(0,255,255,0.3)' : undefined,
            position: 'relative',
            opacity: dimmed ? 0.4 : 1,
          }}
        >
          {/* Inner diamond — smaller, brighter */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: innerSize,
              height: innerSize,
              transform: 'translate(-50%, -50%)',
              border: '0.5px solid rgba(0,255,255,0.7)',
              background: 'radial-gradient(circle, #ffffff 15%, rgba(0,255,255,0.6) 70%, transparent 100%)',
            }}
          />
          {/* White center spark */}
          {!dimmed && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 3,
                height: 3,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#ffffff',
                boxShadow: '0 0 3px #ffffff, 0 0 6px #00ffff',
              }}
            />
          )}
        </div>

        {/* HUD L-brackets — positioned outside the diamond, NOT rotated */}
        {!dimmed && (
          <>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: bracketLen * 2, height: bracketLen, borderTop: bracketBorder, borderLeft: bracketBorder, borderRight: bracketBorder }} />
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: bracketLen * 2, height: bracketLen, borderBottom: bracketBorder, borderLeft: bracketBorder, borderRight: bracketBorder }} />
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: bracketLen, height: bracketLen * 2, borderLeft: bracketBorder, borderTop: bracketBorder, borderBottom: bracketBorder }} />
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: bracketLen, height: bracketLen * 2, borderRight: bracketBorder, borderTop: bracketBorder, borderBottom: bracketBorder }} />
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className="absolute top-0 left-0 w-0 pointer-events-none z-10"
      style={{ left: leftPx, height: containerHeight }}
    >
      {/* Top Holographic Crystal */}
      {showTopDiamond && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: 0, top: topDiamondY }}
        >
          <HoloCrystal size={10} />
          {/* Label */}
          <span
            className="text-[11px] font-semibold whitespace-nowrap mt-0.5"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#00ffff',
              textShadow: '0 0 8px rgba(0,255,255,0.5)',
            }}
          >
            {milestone.nameCn}
          </span>
        </div>
      )}

      {/* Vertical Line — neon-tinted dashed line */}
      {showLine && (
        <div
          className="absolute bg-transparent"
          style={{
            left: 0,
            top: lineTop,
            width: 1,
            height: gridHeight + (MILESTONE_TOP_ROW_HEIGHT - lineTop),
            transform: 'translateX(-50%)',
            borderLeft: '1px dashed rgba(0,255,255,0.18)',
          }}
        />
      )}

      {/* Bottom Holographic Crystal — dimmed echo */}
      {showBottomDiamond && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: 0, top: bottomDiamondY }}
        >
          <HoloCrystal size={8} dimmed />
        </div>
      )}
    </div>
  );
}
