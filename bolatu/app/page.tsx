import { ParetoChart } from "@/components/pareto-chart"
import { ParetoTable } from "@/components/pareto-table"

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-950 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-cyan-600/20 text-cyan-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M3 3v18h18" />
                <rect x="7" y="10" width="3" height="8" rx="0.5" />
                <rect x="14" y="6" width="3" height="12" rx="0.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">质量控制仪表板</h1>
              <p className="text-sm text-gray-500">Quality Control Dashboard</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-sm bg-gray-900 px-3 py-1.5 text-gray-300">
              <span className="text-gray-500">生产线:</span>
              <span className="font-mono">LINE-A03</span>
            </div>
            <div className="flex items-center gap-2 rounded-sm bg-gray-900 px-3 py-1.5 text-gray-300">
              <span className="text-gray-500">日期:</span>
              <span className="font-mono">2024-01-15</span>
            </div>
            <div className="flex items-center gap-2 rounded-sm bg-gray-900 px-3 py-1.5 text-gray-300">
              <span className="text-gray-500">班次:</span>
              <span className="font-mono">DAY SHIFT</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-cyan-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              <span className="text-xs uppercase tracking-wider">实时监控 Live</span>
            </div>
          </div>
        </div>

        {/* Pareto Chart */}
        <ParetoChart />

        {/* Data Table */}
        <ParetoTable />

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 pt-4 text-xs text-gray-600">
          <span>© 2024 Quality Analytics System</span>
          <span className="font-mono">v2.1.0</span>
        </div>
      </div>
    </main>
  )
}
