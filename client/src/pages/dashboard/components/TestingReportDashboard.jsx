import React, { useState, useMemo } from 'react';
import {
  FileText,
  Activity,
  AlertTriangle,
  Calendar,
  FlaskConical,
  Hash,
  Layers,
  UploadCloud,
  Cpu,
  FileCheck,
  CheckCircle,
  ShieldAlert,
  Check,
  HelpCircle,
  User,
} from 'lucide-react';

// ==========================================
// 核心解析引擎 (Administrative Parser Engine)
// 保持外置，用于强制提取和风险定级
// ==========================================
export const parseCSVText = (text) => {
  let p = '';
  let row = [''];
  const ret = [row];
  let i = 0;
  let r = 0;
  let s = true;

  for (const l of text) {
    if (l === '"') {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (l === ',' && s) {
      row[++i] = '';
    } else if (l === '\n' && s) {
      if (p === '\r') row[i] = row[i].slice(0, -1);
      row = ret[++r] = [''];
      i = 0;
    } else {
      row[i] += l;
    }
    p = l;
  }

  return ret;
};

export const processReportData = (csvMatrix) => {
  const metaData = {
    oa: '等待解析',
    applicant: '等待解析',
    model: '等待解析',
    date: '等待解析',
    sampleCount: '等待解析',
  };
  const testData = [];

  csvMatrix.forEach((row) => {
    if (!row || row.length === 0) return;
    const firstCol = (row[0] || '').trim();

    if (firstCol.includes('OA流程编号')) {
      metaData.oa = row.find((val, idx) => idx > 0 && val.trim() !== '') || '缺失';
    } else if (firstCol.includes('申请人') || firstCol.includes('部门')) {
      metaData.applicant = row.find((val, idx) => idx > 0 && val.trim() !== '') || '缺失';
    } else if (firstCol.includes('产品型号')) {
      metaData.model = row.find((val, idx) => idx > 0 && val.trim() !== '') || '缺失';
    } else if (firstCol.includes('检测日期') || firstCol.includes('测试日期')) {
      metaData.date = row.find((val, idx) => idx > 0 && val.trim() !== '') || '缺失';
    } else if (firstCol.includes('样品数量')) {
      metaData.sampleCount = row.find((val, idx) => idx > 0 && val.trim() !== '') || '缺失';
    }

    if (/^[SEPR]\d+$/.test(firstCol)) {
      const id = firstCol;
      const categoryMap = {
        S: '安全测试 (Safety)',
        E: '电磁兼容 (EMC)',
        P: '性能测试 (Performance)',
        R: '可靠性 (Reliability)',
      };
      const category = categoryMap[id.charAt(0)] || '未知';
      const item = (row[1] || '').trim();
      const standard = (row[2] || '').trim();

      const validCols = row.filter((val) => val && val.trim() !== '');
      let judge = 'N';
      let result = '';

      const lastVal = validCols[validCols.length - 1]?.trim().toUpperCase();
      const secondLastVal = validCols[validCols.length - 2]?.trim();

      if (['P', 'F', 'N'].includes(lastVal)) {
        judge = lastVal;
        if (validCols.length >= 4 && secondLastVal !== standard) result = secondLastVal;
      } else {
        result = lastVal || '';
      }

      let risk = 'High';
      if (judge === 'F') risk = 'Critical';
      if (judge === 'P') risk = 'Low';
      if (judge === 'N') risk = 'High';

      testData.push({ id, category, item, standard, result, judge, risk });
    }
  });

  return { metaData, testData };
};

export default function TestingReportDashboard() {
  const [dataState, setDataState] = useState({
    isLoaded: false,
    metaData: { oa: '--', applicant: '--', model: '--', date: '--', sampleCount: '--' },
    testData: [],
    fileName: '',
    parseDurationMs: 0,
    parsedAt: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const executeParse = () => {
    if (!selectedFile) return;
    setIsParsing(true);
    const parseStartedAt = performance.now();

    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = String(evt.target?.result || '');
        const matrix = parseCSVText(text);
        const parsed = processReportData(matrix);
        const parseDurationMs = Math.round(performance.now() - parseStartedAt);

        setDataState({
          isLoaded: true,
          metaData: parsed.metaData,
          testData: parsed.testData,
          fileName: selectedFile.name,
          parseDurationMs,
          parsedAt: new Date().toLocaleTimeString(),
        });
        setIsParsing(false);
      };
      reader.onerror = () => setIsParsing(false);
      reader.readAsText(selectedFile);
    }, 800);
  };

  const stats = useMemo(() => {
    const s = { total: dataState.testData.length, P: 0, F: 0, N: 0 };
    dataState.testData.forEach((item) => {
      if (s[item.judge] !== undefined) s[item.judge] += 1;
    });
    return s;
  }, [dataState.testData]);

  const getRiskStyles = (risk, judge) => {
    if (judge === 'F' || risk === 'Critical') {
      return 'bg-rose-900/20 border-rose-500/50 text-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)]';
    }
    if (judge === 'N' || risk === 'High') {
      return 'bg-amber-900/20 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
    }
    if (judge === 'P' || risk === 'Low') {
      return 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400';
    }
    return 'bg-slate-800 border-slate-600 text-slate-300';
  };

  const getJudgeIcon = (judge) => {
    if (judge === 'F') return <ShieldAlert className="w-4 h-4" />;
    if (judge === 'P') return <Check className="w-4 h-4" />;
    return <HelpCircle className="w-4 h-4" />;
  };

  const operatorName = dataState.metaData.applicant.split(' ')[1] || '刘星宇';
  const topRibbonFields = [
    {
      key: 'oa',
      icon: Hash,
      label: 'OA追责锁定',
      value: dataState.metaData.oa,
      accent: true,
      pulse: true,
    },
    {
      key: 'applicant',
      icon: User,
      label: '责任主体',
      value: dataState.metaData.applicant,
    },
    {
      key: 'model',
      icon: Layers,
      label: '系统定型型号',
      value: dataState.metaData.model,
    },
    {
      key: 'date',
      icon: Calendar,
      label: '数据冻结日',
      value: dataState.metaData.date,
    },
    {
      key: 'sampleCount',
      icon: FlaskConical,
      label: '样品数量锁定',
      value: dataState.metaData.sampleCount,
      accent: true,
      pulse: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-4 md:p-6 overflow-x-hidden selection:bg-cyan-900 selection:text-cyan-100 flex flex-col">
      <div className="relative mb-6">
        <div className="pointer-events-none absolute -inset-1 rounded-[1.6rem] bg-gradient-to-r from-cyan-500/20 via-transparent to-cyan-500/10 blur-2xl" />
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-1 divide-y divide-slate-800/60 md:grid-cols-5 md:divide-x md:divide-y-0">
            {topRibbonFields.map(({ key, icon: Icon, label, value, accent, pulse }) => (
              <div key={key} className="min-w-0 px-5 py-4">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-slate-500">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{label}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {pulse ? (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/50 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                    </span>
                  ) : null}
                  <div
                    className={`min-w-0 font-mono font-semibold ${
                      accent ? 'text-cyan-400' : 'text-slate-100'
                    } ${key === 'applicant' || key === 'model' ? 'text-sm lg:text-base' : 'text-lg lg:text-[1.35rem]'}`}
                    title={value}
                  >
                    <span className="block truncate">{value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl h-full flex flex-col">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">
              系统级防线风险矩阵
            </h2>

            <div className="space-y-6 flex-1">
              {['S', 'E', 'P', 'R'].map((moduleChar) => {
                const moduleData = dataState.testData.filter((d) => d.id.startsWith(moduleChar));
                const fCount = moduleData.filter((d) => d.judge === 'F').length;
                const nCount = moduleData.filter((d) => d.judge === 'N').length;
                const pCount = moduleData.filter((d) => d.judge === 'P').length;

                let riskStatus = '等待注入';
                let riskColor = 'text-slate-600 border-slate-800';
                if (dataState.isLoaded) {
                  if (fCount > 0) {
                    riskStatus = 'Critical Risk';
                    riskColor =
                      'text-rose-500 border-rose-500/50 bg-rose-900/10 shadow-[0_0_10px_rgba(225,29,72,0.2)]';
                  } else if (nCount > 0) {
                    riskStatus = 'High Risk (N)';
                    riskColor = 'text-amber-500 border-amber-500/50 bg-amber-900/10';
                  } else if (pCount > 0) {
                    riskStatus = 'Passed';
                    riskColor = 'text-cyan-400 border-cyan-500/50 bg-cyan-900/10';
                  } else {
                    riskStatus = 'No Data';
                    riskColor = 'text-slate-500 border-slate-700';
                  }
                }

                return (
                  <div key={moduleChar} className="flex items-center justify-between group">
                    <div className="w-12 h-12 rounded-lg border border-slate-700 flex items-center justify-center font-bold text-xl text-slate-400 bg-slate-950 shadow-inner">
                      {moduleChar}
                    </div>
                    <div className="flex-1 px-4 flex justify-between text-xs font-mono">
                      <span className="text-cyan-400 opacity-50 flex flex-col items-center">
                        <span>P</span>
                        <span>{pCount}</span>
                      </span>
                      <span className="text-rose-500 opacity-50 flex flex-col items-center">
                        <span>F</span>
                        <span>{fCount}</span>
                      </span>
                      <span className="text-amber-500 opacity-50 flex flex-col items-center">
                        <span>N</span>
                        <span>{nCount}</span>
                      </span>
                    </div>
                    <div className={`px-2 py-1 text-[10px] font-mono border rounded uppercase tracking-wider ${riskColor} transition-all`}>
                      {riskStatus}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <div className="text-xs text-slate-500 mb-1">测试覆盖率</div>
              <div className="text-2xl font-mono text-white">
                {stats.total > 0 ? Math.round(((stats.P + stats.F) / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              底层拦截明细 (Telemetry Log)
            </h2>
            <div className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
              Total: {stats.total}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 max-h-[700px]">
            {!dataState.isLoaded ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <Activity className="w-12 h-12 opacity-20" />
                <p className="font-mono text-sm uppercase tracking-widest">
                  等待右侧网关注入数据序列
                </p>
              </div>
            ) : (
              dataState.testData.map((row, idx) => (
                <div
                  key={`${row.id}-${idx}`}
                  className="grid grid-cols-12 gap-3 p-3 bg-slate-950/50 border border-slate-800/50 rounded-lg items-center hover:bg-slate-800/40 transition-all group"
                >
                  <div className="col-span-2 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${row.judge === 'F' ? 'bg-rose-500 animate-pulse' : row.judge === 'N' ? 'bg-amber-500' : 'bg-cyan-500'}`} />
                    <span className="font-mono text-xs font-bold text-slate-300">{row.id}</span>
                  </div>
                  <div className="col-span-4 text-xs text-slate-300 truncate pr-2" title={row.item}>
                    {row.item}
                  </div>
                  <div className="col-span-3 text-[10px] font-mono text-slate-500 truncate" title={row.standard}>
                    {row.standard}
                  </div>
                  <div className="col-span-2 text-[10px] font-mono text-slate-400 truncate" title={row.result}>
                    {row.result || '-'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <div className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold font-mono ${getRiskStyles(row.risk, row.judge)}`}>
                      {row.judge}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-xl flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Cpu className="w-24 h-24 text-cyan-400" />
            </div>

            <div className="flex items-center justify-between mb-6 z-10 border-b border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-white tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> INGESTION GATEWAY
              </h2>
              <span className="text-[10px] font-mono bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-900">
                NODE 01
              </span>
            </div>

            {!dataState.isLoaded ? (
              <div className="flex-1 flex flex-col justify-center space-y-6 z-10">
                <label
                  className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                    selectedFile
                      ? 'border-cyan-500/50 bg-cyan-900/10'
                      : 'border-slate-700 bg-slate-950/50 hover:border-slate-500 hover:bg-slate-800/50'
                  }`}
                >
                  {selectedFile ? (
                    <div className="text-center">
                      <FileCheck className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                      <p className="text-xs font-mono text-cyan-300 break-all">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Ready for parsing</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs font-mono text-slate-400">点击注入 CSV 源文件</p>
                    </div>
                  )}
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                </label>

                <button
                  onClick={executeParse}
                  disabled={!selectedFile || isParsing}
                  className={`w-full py-3 rounded-lg font-mono text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
                    !selectedFile
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]'
                  }`}
                >
                  {isParsing ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" /> 解析执行中...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" /> 强制解析执行
                    </>
                  )}
                  {selectedFile && !isParsing && (
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent hover:animate-[shimmer_1.5s_infinite]" />
                  )}
                </button>

                <div className="text-[10px] text-slate-500 font-mono text-center leading-relaxed">
                  * 执行解析将覆盖当前内存矩阵
                  <br />
                  并生成不可逆的责任追溯快照
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col z-10 animate-[fadeIn_0.5s_ease-in-out]">
                <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-bold tracking-widest">解析成功锁定</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>OA Lock:</span>
                      <span className="text-white">{dataState.metaData.oa}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Parse Time:</span>
                      <span className="text-white">{dataState.parseDurationMs} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Rows:</span>
                      <span className="text-white">{stats.total} lines</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Source File:</span>
                      <span className="truncate w-32 text-right">{dataState.fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Timestamp:</span>
                      <span>{dataState.parsedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    行政责任追踪 (Signatures)
                  </h3>
                  <div className="bg-slate-950/50 border border-slate-800 p-3 rounded">
                    <div className="text-[10px] text-slate-500 mb-1">执行测试员</div>
                    <div className="font-mono text-sm text-slate-300 flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        {operatorName}
                      </span>
                      <span className="text-[10px] text-slate-600">{dataState.metaData.date}</span>
                    </div>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 p-3 rounded">
                    <div className="text-[10px] text-slate-500 mb-1">审计复核员 (Review)</div>
                    <div className="font-mono text-sm text-slate-300 flex justify-between items-center">
                      <span className="text-rose-500/70 italic">Pending... (蔡雷)</span>
                      <span className="text-[10px] text-slate-600">--</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden">
        {getJudgeIcon('P')}
        {getJudgeIcon('F')}
        {getJudgeIcon('N')}
      </div>
    </div>
  );
}
