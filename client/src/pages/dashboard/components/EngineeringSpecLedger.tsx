import type { ReactNode } from 'react';

import type { EngineeringSpecLedgerRecord } from '@/lib/engineering-spec-ledger-api';
import { formatLedgerDateTime } from '@/lib/engineering-spec-ledger-api';

type LedgerColumn = {
  key: string;
  title: string;
  width?: string;
  render: (record: EngineeringSpecLedgerRecord, index: number) => ReactNode;
};

const columns: LedgerColumn[] = [
  {
    key: 'index',
    title: '序号',
    width: '72px',
    render: (_record, index) => <span>{index + 1}</span>,
  },
  {
    key: 'sku',
    title: '产品编号',
    width: '220px',
    render: (record) => <span>{record.sku}</span>,
  },
  {
    key: 'description',
    title: '规格描述',
    width: '360px',
    render: (record) => (
      <div className="max-w-[360px] truncate" title={record.description}>
        {record.description}
      </div>
    ),
  },
  {
    key: 'department',
    title: '事业部',
    width: '150px',
    render: (record) => <span>{record.department}</span>,
  },
  {
    key: 'productGroup',
    title: '产品组',
    width: '150px',
    render: (record) => <span>{record.productGroup}</span>,
  },
  {
    key: 'sampleQty',
    title: '样品数',
    width: '100px',
    render: (record) => <span>{record.sampleQty}</span>,
  },
  {
    key: 'testDate',
    title: '测试日期',
    width: '140px',
    render: (record) => <span>{formatLedgerCellDate(record.testDate)}</span>,
  },
  {
    key: 'createDate',
    title: '入库时间',
    width: '160px',
    render: (record) => <span>{formatLedgerCellDate(record.createdAt)}</span>,
  },
];

export function EngineeringSpecLedger({
  records,
  onSelectRecord,
  isLoading = false,
}: {
  records: EngineeringSpecLedgerRecord[];
  onSelectRecord?: (record: EngineeringSpecLedgerRecord) => void;
  isLoading?: boolean;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-slate-100">登记台账</h2>
          <p className="mt-0.5 text-xs text-gray-500">已归档的规格书会按配置列自动入账</p>
        </div>
        <div className="text-xs text-gray-500">共 {records.length} 条</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead className="bg-white/[0.03]">
            <tr className="border-b border-white/10">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-sm font-medium text-gray-400"
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                  {isLoading ? '正在读取台账...' : '暂无归档记录，点击“归档入库”后会自动生成台账。'}
                </td>
              </tr>
            ) : (
              records.map((record, index) => (
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
                      className="px-4 py-2.5 align-middle text-sm text-slate-200"
                      style={column.width ? { width: column.width } : undefined}
                    >
                      <LedgerCellContent>
                        {column.render(record, index)}
                      </LedgerCellContent>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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

export { columns as engineeringSpecLedgerColumns };
