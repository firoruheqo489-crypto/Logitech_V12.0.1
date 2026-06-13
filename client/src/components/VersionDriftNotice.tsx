import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CLIENT_RELEASE_META } from "@/generated/releaseMeta";

type ReleaseInfo = {
  commit?: string | null;
  builtAt?: string | null;
};

function hasRemoteReleaseDrift(remote: ReleaseInfo | null): boolean {
  if (!remote) {
    return false;
  }

  if (CLIENT_RELEASE_META.commit && remote.commit && CLIENT_RELEASE_META.commit !== remote.commit) {
    return true;
  }

  if (CLIENT_RELEASE_META.builtAt && remote.builtAt && CLIENT_RELEASE_META.builtAt !== remote.builtAt) {
    return true;
  }

  return false;
}

function hardReloadWithCacheBust() {
  const url = new URL(window.location.href);
  url.searchParams.set("_reload", Date.now().toString());
  window.location.replace(url.toString());
}

export default function VersionDriftNotice() {
  const [hasDrift, setHasDrift] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!CLIENT_RELEASE_META.commit && !CLIENT_RELEASE_META.builtAt) {
      return;
    }

    const checkRelease = async () => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const response = await fetch("/api/release", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ReleaseInfo;
        if (hasRemoteReleaseDrift(payload)) {
          setHasDrift(true);
        }
      } catch {
        // Keep the current UI if the release check fails.
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkRelease();
      }
    };

    void checkRelease();
    window.addEventListener("focus", checkRelease);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      void checkRelease();
    }, 60_000);

    return () => {
      window.removeEventListener("focus", checkRelease);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!hasDrift) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[120] flex justify-center px-4 pt-4">
      <div className="flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-cyan-400/30 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-[0_14px_50px_rgba(8,145,178,0.28)] backdrop-blur">
        <div>
          <div className="font-semibold">New version available</div>
          <div className="text-slate-300">
            The page is still using an older bundle. Refresh before switching modules to avoid stale chunk errors.
          </div>
        </div>
        <button
          type="button"
          onClick={hardReloadWithCacheBust}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 font-medium text-slate-950 transition hover:bg-cyan-300"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    </div>
  );
}
