import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileJson,
  Files,
  FlaskConical,
  FolderKanban,
  Lightbulb,
  Loader2,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  demoTestProjectRecords,
  exportTestProjectCsv,
  exportTestProjectJson,
  parseTestProjectExcelFiles,
  type RequirementStatus,
  type ParseTestProjectExcelResult,
  type TestProjectRecord,
} from "../lib/testProjectCsvParser";

type IndexedRecord = TestProjectRecord & {
  recordIndex: number;
};

function isFail(result: string) {
  return result.includes("不合格");
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function ResultBadge({ result }: { result: string }) {
  const baseClass =
    "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wider";

  if (!result.trim()) {
    return <span className={cn(baseClass, "border-white/10 bg-white/5 text-slate-500")}>未录入</span>;
  }

  if (isFail(result)) {
    return <span className={cn(baseClass, "border-rose-500/40 bg-rose-500/10 text-rose-300")}>不合格</span>;
  }

  return <span className={cn(baseClass, "border-emerald-400/40 bg-emerald-400/10 text-emerald-300")}>合格</span>;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accentClass,
  ringClass,
  progress,
  progressClass,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof ClipboardList;
  accentClass: string;
  ringClass: string;
  progress?: number;
  progressClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-950/70 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">{label}</span>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full border", ringClass)}>
          <Icon className={cn("h-5 w-5", accentClass)} />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <span className={cn("text-3xl font-bold tabular-nums", accentClass)}>{value}</span>
        <span className="pb-1 text-xs text-slate-500">{hint}</span>
      </div>
      {typeof progress === "number" ? (
        <Progress value={progress} className={cn("mt-4 h-1.5 bg-white/8", progressClass)} />
      ) : null}
    </div>
  );
}

const inputClass =
  "h-9 border-white/10 bg-black/40 text-slate-100 placeholder:text-slate-600 focus-visible:border-cyan-500/50 focus-visible:ring-1 focus-visible:ring-cyan-500/30";

export default function TestProjectParserDashboard() {
  const [records, setRecords] = useState<TestProjectRecord[]>(demoTestProjectRecords);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(demoTestProjectRecords[0]?.category ?? "");
  const [lastImport, setLastImport] = useState<ParseTestProjectExcelResult | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(records.map((record) => record.category))),
    [records],
  );

  useEffect(() => {
    if (!categories.length) {
      if (activeCategory !== "") {
        setActiveCategory("");
      }
      return;
    }

    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  const visibleRows = useMemo<IndexedRecord[]>(
    () =>
      records
        .map((record, recordIndex) => ({ ...record, recordIndex }))
        .filter((record) => !activeCategory || record.category === activeCategory),
    [records, activeCategory],
  );

  const stats = useMemo(() => {
    const total = visibleRows.length;
    const required = visibleRows.filter((row) => row.status === "√").length;
    const resulted = visibleRows.filter((row) => row.result.trim() !== "").length;
    const failed = visibleRows.filter((row) => isFail(row.result)).length;
    return { total, required, resulted, failed };
  }, [visibleRows]);

  const importSummary = useMemo(() => {
    const parsedFileCount = lastImport?.parsedFiles.length ?? 0;
    const skippedCount = lastImport?.skippedFiles.length ?? 0;
    return {
      parsedFileCount,
      skippedCount,
      totalRows: records.length,
    };
  }, [lastImport, records.length]);

  const handleUpdate = (recordIndex: number, patch: Partial<TestProjectRecord>) => {
    setRecords((previous) =>
      previous.map((record, index) => (index === recordIndex ? { ...record, ...patch } : record)),
    );
  };

  const handleParseFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("请先选择 Excel 文件");
      return;
    }

    setIsParsing(true);
    try {
      const parsed = await parseTestProjectExcelFiles(selectedFiles);
      if (parsed.records.length === 0) {
        toast.error("没有解析到有效测试项目，请确认工作表结构和表头格式");
        setLastImport(parsed);
        return;
      }

      setRecords(parsed.records);
      setLastImport(parsed);
      setActiveCategory(parsed.records[0]?.category ?? "");

      if (parsed.skippedFiles.length > 0) {
        toast.warning(`已解析 ${parsed.parsedFiles.length} 个工作表，跳过 ${parsed.skippedFiles.length} 个无效工作簿`);
      } else {
        toast.success(`解析完成，共导入 ${parsed.records.length} 条测试项目`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel 解析失败");
    } finally {
      setIsParsing(false);
    }
  };

  const handleRestoreDemo = () => {
    setRecords(demoTestProjectRecords);
    setActiveCategory(demoTestProjectRecords[0]?.category ?? "");
    setLastImport(null);
    setSelectedFiles([]);
    toast.success("已恢复示例数据");
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,0.98))] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">测试项目解析台</h2>
              <p className="mt-1 text-sm text-slate-400">Test Project Parsing Console</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                上传 <span className="text-slate-300">测试项目.xls / 测试项目.xlsx</span> 工作簿，
                系统会按工作表拆分类目，自动定位表头、剔除尾部签字行，并合并成可编辑的测试项目总表。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportTestProjectJson(records)}
              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-cyan-300"
            >
              <FileJson className="h-4 w-4" />
              导出 JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportTestProjectCsv(records)}
              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-cyan-300"
            >
              <Download className="h-4 w-4" />
              导出 master_test_projects.csv
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/[0.08] bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-cyan-300" />
            <div>
              <h3 className="text-lg font-semibold text-white">Excel 导入区</h3>
              <p className="text-sm text-slate-500">支持直接读取 `.xls / .xlsx` 工作簿中的多个类目工作表。</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <Input
              type="file"
              multiple
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="border-white/10 bg-black/40 text-slate-100 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-cyan-200"
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleParseFiles}
                disabled={isParsing}
                className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Files className="h-4 w-4" />}
                {isParsing ? "解析中..." : "解析选中 Excel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRestoreDemo}
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" />
                恢复示例
              </Button>
            </div>

            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-500">
              <div>文件格式：`测试项目.xls` 或 `测试项目.xlsx`</div>
              <div className="mt-1">类目来源：工作表名称，自动清洗 `测试项目 / 试项目` 后缀</div>
              <div className="mt-1">目标表头：`序号,项目,测试结果及不合格点,需求测试项目（√×）,备注`</div>
              <div className="mt-1">当前已选文件：{selectedFiles.length} 个</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-cyan-300" />
            <div>
              <h3 className="text-lg font-semibold text-white">导入摘要</h3>
              <p className="text-sm text-slate-500">最近一次解析结果与结构化总量。</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">已解析工作表</div>
              <div className="mt-2 text-3xl font-bold text-cyan-300">{importSummary.parsedFileCount}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">跳过工作簿</div>
              <div className="mt-2 text-3xl font-bold text-amber-300">{importSummary.skippedCount}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">当前总记录</div>
              <div className="mt-2 text-3xl font-bold text-white">{importSummary.totalRows}</div>
            </div>
          </div>

          <div className="mt-5 max-h-52 overflow-y-auto rounded-2xl border border-white/8 bg-black/20 p-4">
            {lastImport?.parsedFiles.length ? (
              <div className="space-y-3">
                {lastImport.parsedFiles.map((file) => (
                  <div key={`${file.fileName}-${file.sheetName}`} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-200">{file.fileName}</div>
                      <div className="mt-1 text-xs text-slate-500">工作表：{file.sheetName} · 类目：{file.category}</div>
                    </div>
                    <div className="text-right text-xs text-cyan-300">{file.rowCount} 行</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">还没有上传解析记录，当前显示的是示例数据。</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-slate-950/70 p-5 backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="test-project-category" className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              产品类目
            </label>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger
                id="test-project-category"
                className="w-full border-white/10 bg-black/40 text-slate-100 sm:w-72"
              >
                <SelectValue placeholder="选择类目" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-slate-500">
            共 <span className="font-semibold text-cyan-300">{categories.length}</span> 个类目，
            当前类目 <span className="font-semibold text-cyan-300">{stats.total}</span> 个测试项
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="项目总数"
          value={stats.total}
          hint="当前类目全部测试项"
          icon={ClipboardList}
          accentClass="text-white"
          ringClass="border-cyan-400/25 bg-cyan-400/10"
        />
        <StatCard
          label="已确认需求"
          value={stats.required}
          hint={`占比 ${percentage(stats.required, stats.total)}%`}
          icon={CheckCircle2}
          accentClass="text-emerald-300"
          ringClass="border-emerald-400/25 bg-emerald-400/10"
          progress={percentage(stats.required, stats.total)}
          progressClass="[&>div]:bg-emerald-400"
        />
        <StatCard
          label="已录入结果"
          value={stats.resulted}
          hint={`占比 ${percentage(stats.resulted, stats.total)}%`}
          icon={FlaskConical}
          accentClass="text-cyan-300"
          ringClass="border-cyan-400/25 bg-cyan-400/10"
          progress={percentage(stats.resulted, stats.total)}
          progressClass="[&>div]:bg-cyan-400"
        />
        <StatCard
          label="不合格项"
          value={stats.failed}
          hint={stats.failed > 0 ? "存在不合格点" : "暂无不合格"}
          icon={XCircle}
          accentClass={stats.failed > 0 ? "text-rose-300" : "text-slate-400"}
          ringClass={stats.failed > 0 ? "border-rose-400/25 bg-rose-400/10" : "border-white/10 bg-white/5"}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/70 backdrop-blur-sm">
        <div className="border-b border-white/8 px-6 py-5">
          <h3 className="text-lg font-semibold text-white">测试项目总表</h3>
          <p className="mt-1 text-sm text-slate-500">支持在解析后直接补录测试结果、需求状态和备注。</p>
        </div>

        {visibleRows.length === 0 ? (
          <div className="flex h-48 items-center justify-center px-6 text-sm text-slate-500">
            当前类目暂无测试项目，请先导入目标 Excel。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 bg-slate-900/70 hover:bg-slate-900/70">
                  <TableHead className="w-20 text-center text-xs uppercase tracking-[0.2em] text-slate-500">序号</TableHead>
                  <TableHead className="min-w-[220px] text-xs uppercase tracking-[0.2em] text-slate-500">测试项目</TableHead>
                  <TableHead className="w-44 text-center text-xs uppercase tracking-[0.2em] text-slate-500">是否需求</TableHead>
                  <TableHead className="min-w-[280px] text-xs uppercase tracking-[0.2em] text-slate-500">测试结果</TableHead>
                  <TableHead className="min-w-[220px] text-xs uppercase tracking-[0.2em] text-slate-500">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {visibleRows.map((row) => {
                  const required = row.status === "√";
                  const failed = isFail(row.result);
                  return (
                    <TableRow
                      key={`${row.category}-${row.recordIndex}-${row.id}`}
                      className={cn("border-0 hover:bg-slate-900/60", failed && "bg-rose-500/5")}
                    >
                      <TableCell className="text-center font-medium tabular-nums text-slate-400">{row.id}</TableCell>
                      <TableCell className="font-medium text-slate-100">{row.item}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={required}
                            onCheckedChange={(checked) =>
                              handleUpdate(row.recordIndex, { status: (checked ? "√" : "×") as RequirementStatus })
                            }
                            aria-label={`${row.item} 是否需求`}
                            className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-700"
                          />
                          <Select
                            value={row.status || "×"}
                            onValueChange={(value) =>
                              handleUpdate(row.recordIndex, { status: value as RequirementStatus })
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className={cn(
                                "w-16 border-white/10 bg-black/40",
                                required ? "text-emerald-300" : "text-slate-400",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                              <SelectItem value="√">√</SelectItem>
                              <SelectItem value="×">×</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <ResultBadge result={row.result} />
                          <Input
                            value={row.result}
                            onChange={(event) => handleUpdate(row.recordIndex, { result: event.target.value })}
                            placeholder="录入测试结果或不合格点..."
                            className={cn(inputClass, failed && "border-rose-500/40 text-rose-200")}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.comment}
                          onChange={(event) => handleUpdate(row.recordIndex, { comment: event.target.value })}
                          placeholder="备注..."
                          className={inputClass}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
