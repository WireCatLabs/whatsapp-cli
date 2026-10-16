import { defineConfig } from "vitest/config"

export default defineConfig({
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
      // Floors rise with the code; max-cli holds 92/90/88/79.
      thresholds: { lines: 80, statements: 80, functions: 75, branches: 70, perFile: { lines: 50 } },
    },
  },
})
