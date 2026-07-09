import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isDynamicImportFetchError(error: Error | null): boolean {
  if (!error) return false;
  const text = `${error.message || ""}\n${error.stack || ""}`.toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("chunkloaderror")
  );
}

function hardReloadWithCacheBust() {
  const url = new URL(window.location.href);
  url.searchParams.set("_reload", Date.now().toString());
  window.location.replace(url.toString());
}

function releaseBootOverlay() {
  document.documentElement.style.opacity = "1";
  document.documentElement.style.transition = "";
  document.getElementById("app-boot-splash")?.remove();
}

function autoReloadChunkFailureOnce() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("_chunkReload") === "1") {
    return;
  }
  url.searchParams.set("_chunkReload", "1");
  url.searchParams.set("_reload", Date.now().toString());
  window.setTimeout(() => {
    window.location.replace(url.toString());
  }, 250);
}

class ErrorBoundary extends Component<Props, State> {
  private reloadTimer: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidMount(): void {
    releaseBootOverlay();
  }

  componentDidCatch(error: Error): void {
    releaseBootOverlay();
    if (!isDynamicImportFetchError(error)) return;
    this.reloadTimer = window.setTimeout(autoReloadChunkFailureOnce, 0);
  }

  componentWillUnmount(): void {
    if (this.reloadTimer !== null) {
      window.clearTimeout(this.reloadTimer);
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const chunkLoadFailure = isDynamicImportFetchError(this.state.error);
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
          <div className="flex w-full max-w-2xl flex-col items-center rounded-xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <AlertTriangle
              size={48}
              className="mb-6 flex-shrink-0 text-amber-300"
            />

            <h2 className="mb-4 text-xl font-semibold text-white">
              {chunkLoadFailure ? "页面正在切换到最新版本" : "页面出现异常"}
            </h2>

            {chunkLoadFailure ? (
              <p className="mb-6 text-center text-sm text-slate-300">
                当前标签页还缓存着发布前的模块，系统会自动刷新一次并重新加载最新文件。
              </p>
            ) : null}

            <div className="mb-6 max-h-72 w-full overflow-auto rounded-lg border border-white/10 bg-black/35 p-4">
              <pre className="whitespace-break-spaces text-xs text-slate-300">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={hardReloadWithCacheBust}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-cyan-400 text-slate-950",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              {chunkLoadFailure ? "立即刷新" : "重新加载页面"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
