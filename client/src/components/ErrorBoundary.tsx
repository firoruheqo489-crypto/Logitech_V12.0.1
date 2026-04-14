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

const CHUNK_RELOAD_KEY = "__chunk_reload_once__";

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

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidMount(): void {
    // Clear the one-shot flag after any successful mount.
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }

  componentDidCatch(error: Error): void {
    if (!isDynamicImportFetchError(error)) return;

    const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
    if (alreadyRetried) return;

    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    hardReloadWithCacheBust();
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={hardReloadWithCacheBust}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
