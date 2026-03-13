/**
 * MobileProgressItem — 移动端紧凑列表项（图1风格）
 * row1: LA编号(左) + 状态胶囊(右)
 * detail: 推进细节(最多2行)
 * row3: 更新日期(左) + 预计完成(右)
 */
import { Clock, Calendar } from 'lucide-react';

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
  const node = currentNode.trim();
  let statusCls = 'is-default';
  if (node.includes('已超时')) statusCls = 'is-overdue';
  else if (node.includes('已完成')) statusCls = 'is-done';
  else if (node === '进行中') statusCls = 'is-doing';

  const hasDetail = detail?.trim() && detail !== '暂无推进细节';
  const hasUpdate = updateDate?.trim() && updateDate !== '-';
  const hasEta = estimated?.trim() && estimated !== '-';
  const hasRow3 = hasUpdate || hasEta;

  return (
    <div className="m-item">
      <div className="m-row1">
        <div className="m-no">{moldNo}</div>
        <div className={`m-status ${statusCls}`}>
          <span className="m-dot" />
          <span className="m-statusText">{node || '未知'}</span>
        </div>
      </div>

      {hasDetail && <div className="m-detail">{detail}</div>}

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
