import { describe, it, expect } from "vitest";
import { insertTaskSchema, insertRepeatingTaskSchema, MAX_TASK_TEXT_LENGTH } from "@shared/schema";

describe("task text length limit", () => {
  it("accepts text up to the limit", () => {
    expect(insertTaskSchema.safeParse({ text: "a".repeat(MAX_TASK_TEXT_LENGTH) }).success).toBe(true);
  });

  it("rejects text over the limit", () => {
    expect(insertTaskSchema.safeParse({ text: "a".repeat(MAX_TASK_TEXT_LENGTH + 1) }).success).toBe(false);
  });

  it("applies the same limit to repeating tasks", () => {
    const base = { repeatType: "daily" };
    expect(insertRepeatingTaskSchema.safeParse({ ...base, taskText: "a".repeat(MAX_TASK_TEXT_LENGTH) }).success).toBe(true);
    expect(insertRepeatingTaskSchema.safeParse({ ...base, taskText: "a".repeat(MAX_TASK_TEXT_LENGTH + 1) }).success).toBe(false);
  });
});
