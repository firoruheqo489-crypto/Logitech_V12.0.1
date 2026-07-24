import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { APP_DISPLAY_NAME } from "@/config/appMeta";
import {
  DASHBOARD_ACCESS_REQUIRED_EVENT,
  getDashboardAccessStatus,
  loginDashboardAccess,
  logoutDashboardAccess,
  type DashboardAccessStatus,
} from "@/lib/dashboardAccess";

const STATUS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function getLoginErrorMessage(
  code: string,
  retryAfterSeconds?: number
): string {
  switch (code) {
    case "DASHBOARD_ACCESS_INVALID":
      return "访问密码不正确，请重新输入。";
    case "DASHBOARD_ACCESS_RATE_LIMITED":
      return `尝试次数过多，请在 ${retryAfterSeconds || 60} 秒后重试。`;
    case "DASHBOARD_ACCESS_NOT_CONFIGURED":
      return "服务器尚未配置看板访问密码，请联系管理员。";
    case "NETWORK_ERROR":
      return "无法连接服务器，请检查网络后重试。";
    default:
      return "登录失败，请稍后重试。";
  }
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070a] text-slate-400">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        正在验证访问权限…
      </div>
    </div>
  );
}

function LoginScreen({
  status,
  onAuthenticated,
  onRetryStatus,
}: {
  status: DashboardAccessStatus;
  onAuthenticated: () => Promise<void>;
  onRetryStatus: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPassword = password.trim();
    if (!nextPassword || submitting || !status.configured) return;

    setSubmitting(true);
    setErrorMessage("");
    try {
      const result = await loginDashboardAccess(nextPassword);
      if (!result.ok) {
        setErrorMessage(
          getLoginErrorMessage(result.code, result.retryAfterSeconds)
        );
        return;
      }
      setPassword("");
      await onAuthenticated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_80%_75%,rgba(99,102,241,0.12),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0a0e14]/90 shadow-[0_32px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
          <div className="p-7 sm:p-9">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SECURE ACCESS
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                  项目看板登录
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  请输入访问密码后查看 {APP_DISPLAY_NAME}。
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-cyan-200">
                <LockKeyhole className="h-5 w-5" />
              </div>
            </div>

            {!status.reachable ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <p className="text-sm text-amber-100">
                  无法连接权限服务，请检查服务器或网络状态。
                </p>
                <button
                  type="button"
                  onClick={() => void onRetryStatus()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200/20 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-200/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新连接
                </button>
              </div>
            ) : !status.configured ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
                服务器尚未配置访问密码。请管理员设置
                <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5 text-xs text-amber-50">
                  DASHBOARD_ACCESS_PASSWORD
                </code>
                后重启服务。
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label
                  htmlFor="dashboard-access-password"
                  className="mb-2 block text-xs font-medium text-slate-300"
                >
                  访问密码
                </label>
                <div className="relative">
                  <input
                    id="dashboard-access-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={event => {
                      setPassword(event.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    autoComplete="current-password"
                    autoFocus
                    maxLength={128}
                    placeholder="请输入看板访问密码"
                    className="h-12 w-full rounded-xl border border-white/[0.1] bg-black/25 px-4 pr-12 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-200"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {errorMessage ? (
                  <p className="mt-3 text-sm text-rose-300" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={!password.trim() || submitting}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {submitting ? "正在登录…" : "登录看板"}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">
              登录会话有效 12 小时 · 请勿在公共设备上保存密码
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<DashboardAccessStatus | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await getDashboardAccessStatus();
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    void refreshStatus();

    const handleAccessRequired = () => void refreshStatus();
    const handleFocus = () => void refreshStatus();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    const intervalId = window.setInterval(
      () => void refreshStatus(),
      STATUS_REFRESH_INTERVAL_MS
    );

    window.addEventListener(
      DASHBOARD_ACCESS_REQUIRED_EVENT,
      handleAccessRequired
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(
        DASHBOARD_ACCESS_REQUIRED_EVENT,
        handleAccessRequired
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshStatus]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutDashboardAccess();
      setStatus(current => ({
        authenticated: false,
        configured: current?.configured ?? true,
        reachable: true,
      }));
    } finally {
      setLoggingOut(false);
    }
  };

  if (!status) return <LoadingScreen />;
  if (!status.authenticated) {
    return (
      <LoginScreen
        status={status}
        onAuthenticated={refreshStatus}
        onRetryStatus={refreshStatus}
      />
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        className="fixed right-4 top-4 z-[90] inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#080b10]/85 px-3 text-xs font-medium text-slate-400 shadow-lg backdrop-blur-xl transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
        title="退出项目看板"
      >
        {loggingOut ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        安全退出
      </button>
    </>
  );
}
