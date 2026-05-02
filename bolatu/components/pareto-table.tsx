"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const data = [
  { defectName: "缺胶 (Short Shot)", count: 120, cumulative: 34.3 },
  { defectName: "披锋 (Flash)", count: 85, cumulative: 58.6 },
  { defectName: "刮花 (Scratch)", count: 60, cumulative: 75.7 },
  { defectName: "变形 (Warp)", count: 40, cumulative: 87.1 },
  { defectName: "缩水 (Sink Mark)", count: 25, cumulative: 94.3 },
  { defectName: "色差 (Color Diff)", count: 15, cumulative: 98.6 },
  { defectName: "其他 (Others)", count: 5, cumulative: 100.0 },
]

export function ParetoTable() {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="w-full rounded-sm border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-100">缺陷数据明细 Defect Data Details</h3>
        <p className="mt-1 text-sm text-gray-400">总缺陷数 Total Defects: {total}</p>
      </div>

      <div className="overflow-hidden rounded-sm border border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 bg-gray-800/50 hover:bg-gray-800/50">
              <TableHead className="text-gray-300 font-semibold">排名 Rank</TableHead>
              <TableHead className="text-gray-300 font-semibold">缺陷类型 Defect Type</TableHead>
              <TableHead className="text-gray-300 font-semibold text-right">数量 Count</TableHead>
              <TableHead className="text-gray-300 font-semibold text-right">占比 Percentage</TableHead>
              <TableHead className="text-gray-300 font-semibold text-right">累计 % Cumulative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={item.defectName} className="border-gray-800 hover:bg-gray-800/30">
                <TableCell className="text-gray-400 font-mono">{String(index + 1).padStart(2, "0")}</TableCell>
                <TableCell className="text-gray-100 font-medium">{item.defectName}</TableCell>
                <TableCell className="text-right font-mono text-cyan-400">{item.count}</TableCell>
                <TableCell className="text-right font-mono text-gray-300">
                  {((item.count / total) * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-mono text-red-400">{item.cumulative.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-cyan-600" />
          <span className="text-gray-400">缺陷数量 Defect Count</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6 bg-red-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #ef4444 0, #ef4444 4px, transparent 4px, transparent 8px)" }} />
          <span className="text-gray-400">累计百分比 Cumulative %</span>
        </div>
      </div>
    </div>
  )
}
