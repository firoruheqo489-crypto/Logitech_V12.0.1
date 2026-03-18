/**
 * MobileProgressItem — 移动端紧凑列表项（图1风格）
 * row1: LA编号(左) + 状态胶囊(右)
 * detail: 推进细节(最多2行)
 * row3: 更新日期(左) + 预计完成(右)
 */
import { Clock, Calendar } from 'lucide-react';
import { getProjectStatusLabel, normalizeProjectStatus } from '@/lib/dashboardProjectState';

interface MobileProgressItemProps {
  moldNo: string;
  updateDate: string;
  detail: string;
  estimated: string;
  currentNode: string;
}

export default function MobileProgressItem({
  moldNo, updateDate, detail, estimated, currentNode
}: MobileProgressItemProps) {
  const node = normalizeProjectStatus(currentNode);
  const nodeLabel = getProjectStatusLabel(node);
  let statusCls = 'is-default';
  if (node === 'overdue' || node === 'delayed') statusCls = 'is-overdue';
  else if (node === 'completed') statusCls = 'is-done';
  else if (node === 'ongoing') statusCls = 'is-doing';

  const detailText = detail?.trim() || '';
  const hasDetail = detailText.length > 0;
  const hasUpdate = updateDate?.trim() && updateDate !== '-';
  const hasEta = estimated?.trim() && estimated !== '-';
  const hasRow3 = hasUpdate || hasEta;

  return (
    <div className="m-item">
      <div className="m-row1">
        <div className="m-no">{moldNo}</div>
        <div className={`m-status ${statusCls}`}>
          <span className="m-dot" />
          <span className="m-statusText">{nodeLabel === '-' ? '未知' : nodeLabel}</span>
        </div>
      </div>

      {hasDetail && <div className="m-detail">{detailText}</div>}

      {hasRow3 && (
        <div className="m-row3">
          {hasUpdate ? (
            <div className="m-meta">
              <Clock className="m-ico" />
              <span>{updateDate}</span>
            </div>
          ) : <span />}
          {hasEta ? (
            <div className="m-meta">
              <Calendar className="m-ico" />
              <b>{estimated}</b>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
