import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateInsights } from "./openai.js";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

describe("generateInsights", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it("returns insight text on success", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "<h3>Great job!</h3>" } }],
    });

    const result = await generateInsights(
      [{ text: "Task A", categoryName: "Work", completedAt: null, createdAt: null }],
      [],
      4,
      2025
    );

    expect(result).toBe("<h3>Great job!</h3>");
    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("gpt-4o");
    expect(call.messages[1].content).toContain("May 2025");
  });

  it("falls back to placeholder when OpenAI returns null content", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const result = await generateInsights([], [], 0, 2025);
    expect(result).toBe("No insights generated. Please try again.");
  });

  it("throws AI_KEY_MISSING when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_KEY_MISSING:"
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws AI_KEY_INVALID on 401 status", async () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_KEY_INVALID:"
    );
  });

  it("throws AI_KEY_INVALID when error code is invalid_api_key", async () => {
    const err = Object.assign(new Error("Invalid key"), { code: "invalid_api_key" });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_KEY_INVALID:"
    );
  });

  it("throws AI_RATE_LIMITED on 429 without quota code", async () => {
    const err = Object.assign(new Error("Rate limited"), { status: 429 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_RATE_LIMITED:"
    );
  });

  it("throws AI_QUOTA_EXCEEDED on 429 with insufficient_quota code", async () => {
    const err = Object.assign(new Error("Quota exceeded"), {
      status: 429,
      code: "insufficient_quota",
    });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_QUOTA_EXCEEDED:"
    );
  });

  it("throws AI_SERVICE_DOWN on 500 status", async () => {
    const err = Object.assign(new Error("Internal error"), { status: 500 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_SERVICE_DOWN:"
    );
  });

  it("throws AI_SERVICE_DOWN on 502 status", async () => {
    const err = Object.assign(new Error("Bad gateway"), { status: 502 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_SERVICE_DOWN:"
    );
  });

  it("throws AI_SERVICE_DOWN on 503 status", async () => {
    const err = Object.assign(new Error("Service unavailable"), { status: 503 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_SERVICE_DOWN:"
    );
  });

  it("throws AI_ERROR for unrecognised errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Some unknown error"));

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_ERROR:"
    );
  });
});
