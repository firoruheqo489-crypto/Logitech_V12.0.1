"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Lock, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MaintenanceEvent, WeibullParameters } from "./toolingLifecycleModel";
import { formatHazardValue } from "./toolingLifecycleMath";

interface ToolingLifecycleWeibullPanelProps {
  activeShotLine: "simulated" | "realtime";
  currentShots: number;
  currentReliability: number;
  currentHazardRate: number;
  activeEta: number;
  isCalibrated: boolean;
  parameters: WeibullParameters;
  events: MaintenanceEvent[];
  onCalibrate: () => void;
  onRollback: () => void;
}

const BAYESIAN_PASSWORD = "476281307";
const BAYESIAN_AUTH_KEY = "tooling-bayesian-auth";

export function ToolingLifecycleWeibullPanel({
  activeShotLine,
  currentShots,
  currentReliability,
  currentHazardRate,
  activeEta,
  isCalibrated,
  parameters,
  events,
  onCalibrate,
  onRollback,
}: ToolingLifecycleWeibullPanelProps) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [hasPasswordAccess, setHasPasswordAccess] = useState(false);

  const cmEvents = events.filter(eventItem => eventItem.type === "CM").length;
  const pmEvents = events.filter(eventItem => eventItem.type === "PM").length;
  const isCritical = currentShots > activeEta * 0.85;

  useEffect(() => {
    try {
      setHasPasswordAccess(window.localStorage.getItem(BAYESIAN_AUTH_KEY) === "1");
    } catch {
      setHasPasswordAccess(false);
    }
  }, []);

  const actionLabel = isCalibrated
    ? "重新执行贝叶斯更新 (BAYESIAN UPDATE)"
    : "运行贝叶斯降级校准 (BAYESIAN UPDATE)";

  const rememberAccess = () => {
    setHasPasswordAccess(true);
    try {
      window.localStorage.setItem(BAYESIAN_AUTH_KEY, "1");
    } catch {
      // ignore persistence failures
    }
  };

  const runBayesianUpdate = () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    window.setTimeout(() => {
      setIsCalibrating(false);
      onCalibrate();
    }, 2500);
  };

  const handlePasswordSubmit = () => {
    const normalized = password.trim();
    if (normalized !== BAYESIAN_PASSWORD) {
      setPasswordError("密码错误，请重新输入。");
      toast.error("密码错误，贝叶斯更新未执行。");
      return;
    }

    rememberAccess();
    setPasswordError("");
    setPassword("");
    setIsPasswordDialogOpen(false);
    toast.success("密码验证通过，之后将不再重复询问。");
    runBayesianUpdate();
  };

  const handleActionClick = () => {
    if (hasPasswordAccess) {
      runBayesianUpdate();
      return;
    }
    setIsPasswordDialogOpen(true);
  };

  const handleRollback = () => {
    if (isCalibrating) return;
    if (!isCalibrated) {
      toast.info("当前没有可撤回的贝叶斯更新。");
      return;
    }
    onRollback();
    toast.success("已撤回本次贝叶斯更新，系统恢复到未校准状态。");
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-[#0a0f1c] p-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-cyan-500">{">_"}</span>
        <p className="text-xs font-mono tracking-wide text-cyan-500">
          WEIBULL ENGINE
        </p>
        {isCalibrated && (
          <span className="ml-auto rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-bold text-rose-400">
            DEGRADED
          </span>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Survival Function
        </p>
        <div className="rounded border border-slate-800/50 bg-slate-900 p-2.5 font-mono text-sm text-slate-300">
          {"R(t) = exp[-(t/η)^β]"}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Hazard Function
        </p>
        <div className="rounded border border-slate-800/50 bg-slate-900 p-2.5 font-mono text-sm text-slate-300">
          {"h(t) = (β/η)(t/η)^(β-1)"}
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-3">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Parameters
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded border border-slate-800/30 bg-slate-900/60 px-3 py-2">
            <span className="text-[11px] text-slate-500">
              <span className="text-cyan-400">β</span> Living Shape Parameter
            </span>
            <span className="text-sm font-bold tabular-nums text-slate-200">
              {parameters.beta.toFixed(2)}
            </span>
          </div>

          <div
            className={`flex items-center justify-between rounded border px-3 py-2 transition-colors duration-700 ${
              isCalibrated
                ? "border-rose-500/40 bg-rose-950/30"
                : "border-slate-800/30 bg-slate-900/60"
            }`}
          >
            <span className="text-[11px] text-slate-500">
              <span className="text-cyan-400">η</span> Scale Parameter
            </span>
            {isCalibrated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums text-slate-600 line-through">
                  {parameters.etaNormal.toLocaleString()}
                </span>
                <span className="animate-pulse text-sm font-bold tabular-nums text-rose-400">
                  {parameters.etaDegraded.toLocaleString()}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold tabular-nums text-slate-200">
                {parameters.etaNormal.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between rounded border border-slate-800/30 bg-slate-900/60 px-3 py-2">
            <span className="text-[11px] text-slate-500">
              <span className={activeShotLine === "realtime" ? "text-cyan-300" : "text-amber-400"}>t</span>{" "}
              {activeShotLine === "realtime" ? "Real-Time" : "Simulated"}
            </span>
            <span className={`text-sm font-bold tabular-nums ${activeShotLine === "realtime" ? "text-cyan-300" : "text-amber-400"}`}>
              {currentShots.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-1">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Instantaneous Hazard h(t)
        </p>
        <p className="text-xl font-bold tabular-nums text-cyan-400">
          {formatHazardValue(currentHazardRate)}
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-slate-800/50 bg-slate-900/40 p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          {activeShotLine === "realtime" ? "Real-Time Reliability R(t)" : "Simulated Reliability R(t)"}
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            isCritical ? "animate-pulse text-rose-500" : "text-emerald-400"
          }`}
        >
          {currentReliability.toFixed(4)}%
        </p>
        <p className="text-[9px] tabular-nums text-slate-600">
          Raw: {(currentReliability / 100).toFixed(8)}
        </p>
      </div>

      <hr className="my-1 border-slate-800" />

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-orange-400">{">_"}</span>
          <p className="text-xs font-mono tracking-wide text-orange-400">
            经验数据校准 / EMPIRICAL CALIBRATION
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              已记录异常停机 (CM EVENTS)
            </span>
            <span className="text-sm font-bold tabular-nums text-rose-400">
              {cmEvents}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              预防性维护 (PM EVENTS)
            </span>
            <span className="text-sm font-bold tabular-nums text-amber-400">
              {pmEvents}
            </span>
          </div>

          <div className="my-1 h-px bg-slate-800" />

          {!isCalibrated ? (
            <>
              <p className="text-[10px] font-bold leading-relaxed text-rose-400">
                检测到偶然失效期异常峰值。理论模型存在高估风险。
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Anomalous CM events detected in useful-life zone.
                <br />
                Theoretical model may overestimate reliability.
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold leading-relaxed text-rose-400">
                降级校准已执行。资产最大寿命惩罚 -200,000 shots。
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Bayesian penalty applied. Asset maximum lifespan reduced from
                1,000,000 to 800,000. This action is irreversible.
              </p>
            </>
          )}

          {isCalibrated && (
            <div className="flex items-center gap-2 rounded border border-rose-900/30 bg-rose-950/30 px-2 py-1.5">
              <CheckCircle className="h-3 w-3 shrink-0 text-rose-400" />
              <span className="text-[10px] font-mono text-rose-400">
                PENALTY EXECUTED | η 1M &gt; 800K | IRREVERSIBLE
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleActionClick}
            disabled={isCalibrating}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 border border-orange-700/50 bg-orange-950/30 px-3 py-2 text-[10px] font-mono tracking-widest text-orange-500 transition-all active:scale-[0.98] hover:bg-orange-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCalibrating ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {isCalibrating ? "正在执行贝叶斯更新..." : actionLabel}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isCalibrating || !isCalibrated}
                className="h-9 w-9 shrink-0 border-rose-500/25 bg-rose-950/10 p-0 text-rose-300 transition-all hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                title="撤回本次贝叶斯"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="sr-only">撤回本次贝叶斯</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-slate-800 bg-[linear-gradient(180deg,rgba(10,15,28,0.98),rgba(3,7,18,0.98))] text-slate-100">
              <AlertDialogHeader>
                <AlertDialogTitle>确认取消贝叶斯更新</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  是否确认取消，该操作不可返回
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900">
                  取消
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 text-white hover:bg-rose-500"
                  onClick={handleRollback}
                >
                  确认取消
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            setPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="border-slate-800 bg-[linear-gradient(180deg,rgba(10,15,28,0.98),rgba(3,7,18,0.98))] text-slate-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_36px_rgba(8,145,178,0.18)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Lock className="h-4 w-4 text-orange-400" />
              贝叶斯更新密码验证
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              输入授权密码后，之后的贝叶斯更新将不再重复询问。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePasswordSubmit();
                }
              }}
              placeholder="请输入密码"
              autoComplete="off"
              className="h-11 rounded-xl border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
            />
            {passwordError && (
              <p className="text-xs text-rose-400">{passwordError}</p>
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(false)}
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handlePasswordSubmit}
              disabled={isCalibrating}
              className="bg-orange-600 text-white hover:bg-orange-500"
            >
              确认执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
