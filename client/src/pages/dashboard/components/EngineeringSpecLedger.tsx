import { useEffect, useState, type ReactNode } from 'react';

import type { EngineeringSpecLedgerRecord } from '@/lib/engineering-spec-ledger-api';
import { formatLedgerDateTime } from '@/lib/engineering-spec-ledger-api';

type LedgerColumn = {
  key: string;
  title: string;
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (record: EngineeringSpecLedgerRecord, index: number) => ReactNode;
};

const LEDGER_PAGE_SIZE = 10;

const columns: LedgerColumn[] = [
  {
    key: 'sequence',
    title: '序号',
    width: '6%',
    headerClassName: 'text-center',
    cellClassName: 'text-center text-slate-300',
    render: (_record, index) => <span>{index + 1}</span>,
  },
  {
    key: 'sku',
    title: '产品编号',
    width: '29%',
    headerClassName: 'text-left',
    cellClassName: 'text-left',
    render: (record) => (
      <div className="block w-full min-w-0 whitespace-nowrap truncate font-medium text-slate-100" title={record.sku}>
        {record.sku}
      </div>
    ),
  },
  {
    key: 'category',
    title: '产品类别',
    width: '19%',
    headerClassName: 'text-left',
    cellClassName: 'text-left',
    render: (record) => (
      <div className="block w-full min-w-0 whitespace-nowrap truncate" title={record.category}>
        {record.category}
      </div>
    ),
  },
  {
    key: 'imageUrl',
    title: '实物图',
    width: '9%',
    headerClassName: 'text-center',
    cellClassName: 'text-center',
    render: (record) =>
      record.imageUrl ? (
        <div className="mx-auto h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          <img
            src={record.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <span className="text-gray-600">—</span>
      ),
  },
  {
    key: 'productGroup',
    title: '产品经理',
    width: '10%',
    headerClassName: 'text-center',
    cellClassName: 'text-center',
    render: (record) => (
      <div className="mx-auto w-full min-w-0 whitespace-nowrap truncate" title={record.productGroup}>
        {record.productGroup}
      </div>
    ),
  },
  {
    key: 'sampleQty',
    title: '样品数',
    width: '7%',
    headerClassName: 'text-center',
    cellClassName: 'text-center',
    render: (record) => <span className="font-semibold text-slate-100">{record.sampleQty}</span>,
  },
  {
    key: 'createdAt',
    title: '送样日期',
    width: '12%',
    headerClassName: 'text-center',
    cellClassName: 'text-center',
    render: (record) => <LedgerDateCell value={record.createdAt} />,
  },
  {
    key: 'action',
    title: '操作',
    width: '8%',
    headerClassName: 'text-center',
    cellClassName: 'text-center',
    render: () => null,
  },
];

export function EngineeringSpecLedger({
  records,
  onSelectRecord,
  onDeleteRecord,
  isLoading = false,
}: {
  records: EngineeringSpecLedgerRecord[];
  onSelectRecord?: (record: EngineeringSpecLedgerRecord) => void;
  onDeleteRecord?: (record: EngineeringSpecLedgerRecord) => void;
  isLoading?: boolean;
}) {
  const [page, setPage] = useState(1);
  const orderedRecords = [...records].sort((left, right) => left.sequence - right.sequence);
  const totalPages = Math.max(1, Math.ceil(orderedRecords.length / LEDGER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * LEDGER_PAGE_SIZE;
  const pageRecords = orderedRecords.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <section className="rounded-lg border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-slate-100">登记台账</h2>
        </div>
        <div className="text-xs text-gray-500">共 {orderedRecords.length} 条</div>
      </div>

      <div className="overflow-x-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-white/[0.03]">
            <tr className="border-b border-white/10">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-3 text-[13px] font-medium text-gray-400 whitespace-nowrap ${
                    column.headerClassName || 'text-left'
                  }`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {orderedRecords.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                  {isLoading ? '正在读取台账...' : '暂无归档记录，点击“归档入库”后会自动生成台账。'}
                </td>
              </tr>
            ) : (
              pageRecords.map((record, index) => (
                <tr
                  key={record.id}
                  className={`border-b border-white/5 transition hover:bg-white/[0.02] ${
                    onSelectRecord ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onSelectRecord?.(record)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-3 align-middle text-[13px] text-slate-200 ${
                        column.cellClassName || 'text-left'
                      }`}
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.key === 'action' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteRecord?.(record);
                          }}
                          className="mx-auto inline-flex whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1 text-[12px] text-slate-300 transition hover:bg-white/[0.05]"
                        >
                          删除
                        </button>
                      ) : (
                        <LedgerCellContent>{column.render(record, pageStart + index)}</LedgerCellContent>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {orderedRecords.length > LEDGER_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <div className="text-xs font-semibold text-gray-400">
            第 {currentPage} / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                currentPage <= 1
                  ? 'cursor-not-allowed border-white/[0.06] text-slate-600 opacity-60'
                  : 'border-white/10 text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                currentPage >= totalPages
                  ? 'cursor-not-allowed border-white/[0.06] text-slate-600 opacity-60'
                  : 'border-white/10 text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              下一页
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LedgerCellContent({ children }: { children: ReactNode }) {
  if (
    children == null ||
    children === '' ||
    (typeof children === 'string' && children.trim() === '')
  ) {
    return <span className="text-gray-600">—</span>;
  }

  return <>{children}</>;
}

function LedgerDateCell({ value }: { value: string }) {
  const [datePart, timePart] = splitLedgerCellDate(value);

  if (!datePart) {
    return <span className="text-gray-600">—</span>;
  }

  return (
    <div className="flex flex-col items-center leading-tight text-slate-100">
      <span className="whitespace-nowrap">{datePart}</span>
      {timePart ? <span className="mt-1 whitespace-nowrap text-[12px] text-slate-400">{timePart}</span> : null}
    </div>
  );
}

function formatLedgerCellDate(value: string): string {
  if (!value) return '';
  const normalized = formatLedgerDateTime(value);
  if (normalized) return normalized;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} 00:00`;
  }

  return trimmed;
}

function splitLedgerCellDate(value: string): [string, string] {
  const formatted = formatLedgerCellDate(value).trim();
  if (!formatted) return ['', ''];

  const [datePart, timePart = ''] = formatted.split(/\s+/, 2);
  return [datePart || '', timePart || ''];
}

export { columns as engineeringSpecLedgerColumns };
