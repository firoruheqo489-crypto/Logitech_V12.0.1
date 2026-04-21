import viteConfig from "./vite.config.mjs";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    root: ".",
    test: {
      include: [
        "client/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
        "server/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      ],
      exclude: [
        ...configDefaults.exclude,
        ".codex-*/**",
        "**/.codex-*/**",
        ".rollback/**",
        "**/.rollback/**",
        ".release-worktrees/**",
        "**/.release-worktrees/**",
        "artifacts/**",
        "**/artifacts/**",
        "recovery/**",
        "**/recovery/**",
      ],
    },
  }),
);
