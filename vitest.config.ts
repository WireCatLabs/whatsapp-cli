import { defineConfig } from "vitest/config"

export default defineConfig({
  tsconfig: "./node_modules/@wirecat/cli-base/config/tsconfig.base.json",
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globals: false,
    // Agents run suites side by side on 24 cores; one worker per core ran the machine out of memory (max-cli, 2026-10-11).
    maxWorkers: 4,
    setupFiles: ["@wirecat/cli-base/testing/setup", "src/testing/sandbox.ts"],
    globalSetup: ["src/testing/argv-log.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        // The fake engine, the stub and the sandbox: test equipment, measured by the tests that use it.
        "src/testing/**",
        // The entry point: one line handing argv to run(), which the suite drives directly.
        "src/bin/**",
      ],
      reporter: ["text-summary", "json-summary", "html"],
      // Half a point under the lowest of three local runs and main's CI (2026-10-18: 96.4/95.59/93.21/88.05), so
      // open feature PRs, which PR CI does not measure, can land without tripping it. Statements stay at 95.
      thresholds: { lines: 95.9, statements: 95, functions: 92.7, branches: 87.5, perFile: { lines: 50 } },
    },
  },
})
