import { ProjectData } from "../types/project";
import { calculateCompleteness, getMissingFields } from "../lib/projectUtils";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectAuditPanelProps {
  project: ProjectData;
  onClose: () => void;
}

export default function ProjectAuditPanel({ project, onClose }: ProjectAuditPanelProps) {
  const completeness = calculateCompleteness(project);
  const missingFields = getMissingFields(project);
  const missingCount = missingFields.length;
  const totalFields = 10;
  const filledCount = totalFields - missingCount;

  // Progress bar color based on completeness
  const getProgressColor = () => {
    if (completeness >= 100) return "bg-emerald-500";
    if (completeness >= 50) return "bg-blue-500";
    return "bg-red-500";
  };

  const getProgressBgColor = () => {
    if (completeness >= 100) return "bg-emerald-100";
    if (completeness >= 50) return "bg-blue-100";
    return "bg-red-100";
  };

  // Pie chart using conic gradient
  const pieChartStyle = {
    background: `conic-gradient(
      #10b981 0deg ${(completeness / 100) * 360}deg,
      #e2e8f0 ${(completeness / 100) * 360}deg 360deg
    )`,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">项目审计面板</h2>
            <p className="text-sm text-slate-600 mt-1">
              {project.identity.projectName} • {project.identity.moldNumber}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Completeness Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Progress Bar Section */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-700">项目完成度</h3>
                <span className="text-3xl font-bold text-slate-800">{completeness}%</span>
              </div>

              {/* Progress Bar */}
              <div className={`h-6 rounded-full ${getProgressBgColor()} overflow-hidden`}>
                <div
                  className={`h-full ${getProgressColor()} transition-all duration-500 ease-out flex items-center justify-end pr-2`}
                  style={{ width: `${completeness}%` }}
                >
                  {completeness > 10 && (
                    <span className="text-xs font-semibold text-white">
                      {filledCount}/{totalFields}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Message */}
              <div className="mt-4 flex items-start gap-2">
                {completeness >= 100 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-emerald-600">数据完整!</span> 所有必填字段已填写。
                    </p>
                  </>
                ) : completeness >= 50 ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-blue-600">进行中</span> 还有 {missingCount} 个字段待完善。
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-red-600">严重数据缺口!</span> 缺失 {missingCount} 个关键字段。
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Pie Chart Section */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-700 mb-4">项目工序</h3>
              
              <div className="flex items-center justify-center gap-8">
                {/* Pie Chart */}
                <div className="relative">
                  <div
                    className="w-32 h-32 rounded-full"
                    style={pieChartStyle}
                  />
                  {/* Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      <span className="text-2xl font-bold text-slate-800">{missingCount}</span>
                      <span className="text-xs text-slate-600">剩余</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-700">
                      已完成: <span className="font-semibold">{filledCount}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-300" />
                    <span className="text-sm text-slate-700">
                      待完成: <span className="font-semibold">{missingCount}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Missing Fields Table */}
          {missingFields.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                缺失字段清单
              </h3>
              
              <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">
                        序号
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">
                        字段名称
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {missingFields.map((field, index) => (
                      <tr key={index} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                          {field}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-sm text-red-700">
                <span className="font-semibold">提示:</span> 请尽快补充以上缺失字段,以确保项目数据完整性。
              </p>
            </div>
          )}

          {/* Success Message */}
          {missingFields.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-emerald-800 mb-2">
                数据完整度100%
              </h3>
              <p className="text-sm text-emerald-700">
                项目所有工序已全部完成!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
