import viteConfig from "./vite.config.mjs";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [
        ...configDefaults.exclude,
        ".codex-*/**",
        "**/.codex-*/**",
      ],
    },
  }),
);
