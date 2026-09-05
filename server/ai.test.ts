import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateInsights } from "./ai.js";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mockCreate };
  },
}));

describe("generateInsights", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("returns insight text on success", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "<h3>Great job!</h3>" }],
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
    expect(call.model).toBe("claude-sonnet-5");
    expect(call.messages[0].content).toContain("May 2025");
  });

  it("falls back to placeholder when the model returns no text", async () => {
    mockCreate.mockResolvedValueOnce({ content: [] });

    const result = await generateInsights([], [], 0, 2025);
    expect(result).toBe("No insights generated. Please try again.");
  });

  it("throws AI_KEY_MISSING when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

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

  it("throws AI_RATE_LIMITED on 429 status", async () => {
    const err = Object.assign(new Error("Rate limited"), { status: 429 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_RATE_LIMITED:"
    );
  });

  it("throws AI_SERVICE_DOWN on 500 status", async () => {
    const err = Object.assign(new Error("Internal error"), { status: 500 });
    mockCreate.mockRejectedValueOnce(err);

    await expect(generateInsights([], [], 0, 2025)).rejects.toThrow(
      "AI_SERVICE_DOWN:"
    );
  });

  it("throws AI_SERVICE_DOWN on 529 overloaded status", async () => {
    const err = Object.assign(new Error("Overloaded"), { status: 529 });
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
