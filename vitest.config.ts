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
      // Just under what the suite reaches (2026-10-18: 96.1/95.3/92.2/85.2), so coverage can rise and not fall.
      // Functions move by one between runs (92.3 to 92.7), hence the extra room there.
      thresholds: { lines: 95.8, statements: 95, functions: 91.8, branches: 85, perFile: { lines: 50 } },
    },
  },
})
