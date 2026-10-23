import { describe, it, expect, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const { mockGenerateInsights, mockStorage } = vi.hoisted(() => ({
  mockGenerateInsights: vi.fn(),
  mockStorage: {
    getAllTasks: vi.fn(),
    getCategory: vi.fn(),
    setInsightsCache: vi.fn(),
    getInsightsCache: vi.fn(),
    pruneOldInsightsCache: vi.fn(),
    archiveCompletedTasks: vi.fn(),
    processRepeatingTasks: vi.fn(),
    getAllUsers: vi.fn(),
  },
}));

vi.mock("./ai.js", () => ({ generateInsights: mockGenerateInsights }));
vi.mock("./storage.js", () => ({ storage: mockStorage }));
vi.mock("./middlewares/requireAuth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 1, username: "testuser" };
    next();
  },
}));

import { registerRoutes } from "./routes.js";

describe("POST /api/insights/generate – daily cap", () => {
  it("returns 429 after 10 generations in a day for the same user", async () => {
    mockStorage.getAllUsers.mockResolvedValue([]);
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockResolvedValue("<p>ok</p>");
    mockStorage.setInsightsCache.mockResolvedValue(undefined);
    mockStorage.getInsightsCache.mockResolvedValue({ insights: "<p>ok</p>", generatedAt: new Date() });

    const app = express();
    app.use(express.json());
    await registerRoutes(app);

    for (let i = 0; i < 10; i++) {
      const ok = await supertest(app).post("/api/insights/generate").send({ month: 4, year: 2025 });
      expect(ok.status).toBe(200);
    }
    const capped = await supertest(app).post("/api/insights/generate").send({ month: 4, year: 2025 });
    expect(capped.status).toBe(429);
    expect(capped.body.message).toMatch(/^AI_RATE_LIMITED:/);
    expect(mockGenerateInsights).toHaveBeenCalledTimes(10);
  });
});
