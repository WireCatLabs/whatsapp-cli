import { defineConfig } from "vitest/config"

export default defineConfig({
  tsconfig: "./node_modules/@wirecat/cli-base/config/tsconfig.base.json",
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globals: false,
    // Agents run suites side by side on 24 cores; one worker per core ran the machine out of memory (max-cli, 2026-10-11).
    maxWorkers: 4,
    // Every test file runs with config, state and cache pointed at a temporary directory. See the file.
    setupFiles: ["src/testing/sandbox.ts"],
    globalSetup: ["src/testing/argv-log.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**", "src/bin/**"],
      reporter: ["text-summary", "json-summary", "html"],
      // A little under what the suite reaches (2026-10-16: 96/95/90/81), so coverage can rise and not fall.
      thresholds: { lines: 94, statements: 93, functions: 88, branches: 79, perFile: { lines: 50 } },
    },
  },
})
