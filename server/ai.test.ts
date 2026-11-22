import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateInsights,
  MAX_TASK_TEXT_IN_PROMPT,
  MAX_COMPLETED_TASKS_IN_PROMPT,
  MAX_PENDING_TASKS_IN_PROMPT,
} from "./ai.js";

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

  describe("prompt size limits", () => {
    function sentTaskData() {
      const content: string = mockCreate.mock.calls[0][0].messages[0].content;
      return JSON.parse(content.slice(content.indexOf("{")));
    }

    beforeEach(() => {
      mockCreate.mockResolvedValue({ content: [{ type: "text", text: "<p>ok</p>" }] });
    });

    it("clips very long task text", async () => {
      const longText = "x".repeat(MAX_TASK_TEXT_IN_PROMPT + 200);
      await generateInsights([], [{ text: longText, createdAt: "2025-04-01" }], 3, 2025);

      const sent = sentTaskData().pendingTasks[0].text;
      expect(sent.length).toBe(MAX_TASK_TEXT_IN_PROMPT + 1); // plus the ellipsis
      expect(sent.endsWith("…")).toBe(true);
    });

    it("keeps only the newest completed and pending tasks, and reports real totals", async () => {
      const day = (i: number) => new Date(Date.UTC(2025, 3, 1, 0, i)).toISOString();
      const completed = Array.from({ length: MAX_COMPLETED_TASKS_IN_PROMPT + 50 }, (_, i) => ({
        text: `done ${i}`,
        completedAt: day(i),
        createdAt: day(i),
      }));
      const pending = Array.from({ length: MAX_PENDING_TASKS_IN_PROMPT + 50 }, (_, i) => ({
        text: `todo ${i}`,
        createdAt: day(i),
      }));

      await generateInsights(completed, pending, 3, 2025);
      const data = sentTaskData();

      expect(data.completedTasks).toHaveLength(MAX_COMPLETED_TASKS_IN_PROMPT);
      expect(data.pendingTasks).toHaveLength(MAX_PENDING_TASKS_IN_PROMPT);
      expect(data.completedTasks[0].text).toBe(`done ${completed.length - 1}`);
      expect(data.pendingTasks[0].text).toBe(`todo ${pending.length - 1}`);
      expect(data.completedTaskCount).toBe(completed.length);
      expect(data.pendingTaskCount).toBe(pending.length);
    });
  });
});
