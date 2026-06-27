import { defineConfig } from "vitest/config";
import reactSwc from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@shared": path.resolve(import.meta.dirname, "shared"),
          },
        },
        test: {
          name: "server",
          include: ["server/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [reactSwc()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "client", "src"),
            "@shared": path.resolve(import.meta.dirname, "shared"),
            "@assets": path.resolve(import.meta.dirname, "attached_assets"),
          },
        },
        test: {
          name: "client",
          include: ["client/src/**/*.test.tsx", "client/src/**/*.test.ts"],
          environment: "jsdom",
          setupFiles: ["./client/src/test-setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
