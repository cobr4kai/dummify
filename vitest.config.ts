import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: [
      {
        find: /^@repo-types\/(.*)$/,
        replacement: `${path.resolve(__dirname, "packages/types/src")}/$1`,
      },
      {
        find: /^@\/config\/(.*)$/,
        replacement: `${path.resolve(__dirname, "config")}/$1`,
      },
      {
        find: /^@\/data\/(.*)$/,
        replacement: `${path.resolve(__dirname, "data")}/$1`,
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "src")}/`,
      },
    ],
  },
});
