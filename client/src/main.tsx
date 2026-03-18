import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { APP_TITLE } from "./config/appMeta";

declare global {
  interface Window {
    __BOOT_START_TS__?: number;
  }
}

// 可选：配置了 VITE_ANALYTICS_* 时才加载 Umami，避免未定义变量导致错误请求
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (typeof analyticsEndpoint === "string" && analyticsEndpoint && typeof analyticsWebsiteId === "string" && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint.replace(/\/$/, "")}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.body.appendChild(script);
}

document.title = APP_TITLE;

createRoot(document.getElementById("root")!).render(<App />);

const bootSplash = document.getElementById("app-boot-splash");
if (bootSplash) {
  const bootStart = Number(window.__BOOT_START_TS__ || Date.now());
  const elapsed = Date.now() - bootStart;
  const holdMs = Math.max(0, 300 - elapsed);
  window.setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bootSplash.classList.add("hidden");
        window.setTimeout(() => {
          bootSplash.remove();
        }, 220);
      });
    });
  }, holdMs);
}
