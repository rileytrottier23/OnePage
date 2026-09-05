import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import supertest from "supertest";
import { createServer } from "http";

const { mockGenerateInsights } = vi.hoisted(() => ({
  mockGenerateInsights: vi.fn(),
}));

vi.mock("./ai.js", () => ({
  generateInsights: mockGenerateInsights,
}));

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getAllTasks: vi.fn(),
    getCategory: vi.fn(),
    setInsightsCache: vi.fn(),
    getInsightsCache: vi.fn(),
    deleteInsightsCache: vi.fn(),
    pruneOldInsightsCache: vi.fn(),
    archiveCompletedTasks: vi.fn(),
    processRepeatingTasks: vi.fn(),
    getAllUsers: vi.fn(),
    sessionStore: { on: vi.fn() } as any,
  },
}));

vi.mock("./storage.js", () => ({
  storage: mockStorage,
}));

vi.mock("./auth.js", () => ({
  setupAuth: (app: express.Express) => {
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 1, username: "testuser" };
      req.isAuthenticated = () => true;
      next();
    });
  },
}));

import { registerRoutes } from "./routes.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  return app;
}

describe("POST /api/insights/generate – route-level", () => {
  let app: express.Express;

  beforeEach(async () => {
    mockGenerateInsights.mockReset();
    mockStorage.getAllTasks.mockReset();
    mockStorage.getCategory.mockReset();
    mockStorage.setInsightsCache.mockReset();
    mockStorage.getInsightsCache.mockReset();
    mockStorage.getAllUsers.mockResolvedValue([]);

    app = buildApp();
    await registerRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("200 – returns insights and generatedAt on success", async () => {
    const insightHtml = "<h3>Great job!</h3>";
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockResolvedValue(insightHtml);
    mockStorage.setInsightsCache.mockResolvedValue(undefined);
    mockStorage.getInsightsCache.mockResolvedValue({
      insights: insightHtml,
      generatedAt: new Date("2025-05-01T10:00:00Z"),
    });

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("insights", insightHtml);
    expect(res.body).toHaveProperty("generatedAt");
  });

  it("200 – falls back to new Date() when cache lookup returns null after save", async () => {
    const insightHtml = "<p>All good.</p>";
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockResolvedValue(insightHtml);
    mockStorage.setInsightsCache.mockResolvedValue(undefined);
    mockStorage.getInsightsCache.mockResolvedValue(null);

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 0, year: 2025 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("insights", insightHtml);
    expect(res.body).toHaveProperty("generatedAt");
  });

  it("503 – missing API key (AI_KEY_MISSING)", async () => {
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockRejectedValue(
      new Error(
        "AI_KEY_MISSING: No Anthropic API key is configured. Please add your ANTHROPIC_API_KEY to the environment."
      )
    );

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("AI_KEY_MISSING");
  });

  it("401 – invalid API key (AI_KEY_INVALID)", async () => {
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockRejectedValue(
      new Error(
        "AI_KEY_INVALID: The Anthropic API key is invalid or has been revoked. Please update your ANTHROPIC_API_KEY."
      )
    );

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("AI_KEY_INVALID");
  });

  it("429 – rate limited (AI_RATE_LIMITED)", async () => {
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockRejectedValue(
      new Error(
        "AI_RATE_LIMITED: The AI service is receiving too many requests right now. Please wait a moment and try again."
      )
    );

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("AI_RATE_LIMITED");
  });

  it("429 – quota exceeded (AI_QUOTA_EXCEEDED)", async () => {
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockRejectedValue(
      new Error(
        "AI_QUOTA_EXCEEDED: Your AI account has exceeded its usage quota. Please check your billing details."
      )
    );

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("AI_QUOTA_EXCEEDED");
  });

  it("503 – service down (AI_SERVICE_DOWN)", async () => {
    mockStorage.getAllTasks.mockResolvedValue([]);
    mockGenerateInsights.mockRejectedValue(
      new Error(
        "AI_SERVICE_DOWN: The OpenAI service is temporarily unavailable. Please try again in a few minutes."
      )
    );

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("AI_SERVICE_DOWN");
  });

  it("400 – rejects invalid month/year (Zod validation)", async () => {
    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 99, year: 2025 });

    expect(res.status).toBe(400);
  });

  it("response body shape matches what AIInsightsPage mutation expects", async () => {
    const insightHtml = "<h3>Summary</h3><p>You did well.</p>";
    const generatedAt = new Date("2025-06-01T09:00:00Z");

    mockStorage.getAllTasks.mockResolvedValue([
      {
        id: 1,
        text: "Finish report",
        completed: true,
        archived: false,
        categoryId: 10,
        completedAt: new Date("2025-05-15T12:00:00Z"),
        createdAt: new Date("2025-05-01T08:00:00Z"),
        inTodaySection: false,
        parentTaskId: null,
        indentLevel: 0,
        originalCategory: null,
        userId: 1,
      },
    ]);
    mockStorage.getCategory.mockResolvedValue({ id: 10, name: "Work", userId: 1 });
    mockGenerateInsights.mockResolvedValue(insightHtml);
    mockStorage.setInsightsCache.mockResolvedValue(undefined);
    mockStorage.getInsightsCache.mockResolvedValue({
      insights: insightHtml,
      generatedAt,
    });

    const res = await supertest(app)
      .post("/api/insights/generate")
      .send({ month: 4, year: 2025 });

    expect(res.status).toBe(200);

    const body: { insights: string; generatedAt: string } = res.body;
    expect(typeof body.insights).toBe("string");
    expect(typeof body.generatedAt).toBe("string");
    expect(new Date(body.generatedAt).toISOString()).toBe(generatedAt.toISOString());
  });
});

describe("scheduled stale insights cache pruning", () => {
  beforeEach(() => {
    mockStorage.pruneOldInsightsCache.mockReset();
    mockStorage.getAllUsers.mockReset();
    mockStorage.getAllUsers.mockResolvedValue([]);
    mockStorage.pruneOldInsightsCache.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("prunes old insights cache rows when the scheduled task runs at 3am", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T03:00:00"));

    const app = buildApp();
    await registerRoutes(app);

    await vi.waitFor(() => {
      expect(mockStorage.pruneOldInsightsCache).toHaveBeenCalled();
    });
  });

  it("does not prune insights cache outside the scheduled hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T10:00:00"));

    const app = buildApp();
    await registerRoutes(app);

    expect(mockStorage.pruneOldInsightsCache).not.toHaveBeenCalled();
  });
});
