import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getTask: vi.fn(),
    getAllTasks: vi.fn(),
    deleteTask: vi.fn(),
    getAllUsers: vi.fn(),
    archiveCompletedTasks: vi.fn(),
    processRepeatingTasks: vi.fn(),
  },
}));

vi.mock("./storage.js", () => ({ storage: mockStorage }));

vi.mock("./middlewares/requireAuth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 1, username: "testuser" };
    next();
  },
}));

import { registerRoutes } from "./routes.js";

const task = (id: number, parentTaskId: number | null = null) => ({
  id,
  parentTaskId,
  userId: 1,
});

describe("DELETE /api/tasks/:id", () => {
  let app: express.Express;

  beforeEach(async () => {
    Object.values(mockStorage).forEach((fn) => fn.mockReset());
    mockStorage.getAllUsers.mockResolvedValue([]);
    mockStorage.deleteTask.mockResolvedValue(true);

    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it("deletes the task and every nested subtask, deepest first", async () => {
    mockStorage.getTask.mockResolvedValue(task(1));
    mockStorage.getAllTasks.mockResolvedValue([
      task(1),
      task(2, 1),
      task(3, 2),
      task(4, 1),
      task(5), // unrelated
      task(6, 5), // unrelated subtask
    ]);

    const res = await supertest(app).delete("/api/tasks/1");

    expect(res.status).toBe(200);
    const deleted = mockStorage.deleteTask.mock.calls.map((c) => c[0]);
    expect(deleted).toEqual([3, 2, 4, 1]);
    expect(mockStorage.deleteTask.mock.calls.every((c) => c[1] === 1)).toBe(true);
  });

  it("deletes a task with no subtasks", async () => {
    mockStorage.getTask.mockResolvedValue(task(7));
    mockStorage.getAllTasks.mockResolvedValue([task(7), task(8)]);

    const res = await supertest(app).delete("/api/tasks/7");

    expect(res.status).toBe(200);
    expect(mockStorage.deleteTask).toHaveBeenCalledTimes(1);
    expect(mockStorage.deleteTask).toHaveBeenCalledWith(7, 1);
  });

  it("returns 404 and deletes nothing when the task isn't the user's", async () => {
    mockStorage.getTask.mockResolvedValue(undefined);

    const res = await supertest(app).delete("/api/tasks/99");

    expect(res.status).toBe(404);
    expect(mockStorage.deleteTask).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await supertest(app).delete("/api/tasks/abc");

    expect(res.status).toBe(400);
    expect(mockStorage.getTask).not.toHaveBeenCalled();
    expect(mockStorage.deleteTask).not.toHaveBeenCalled();
  });

  it("returns 500 when storage fails", async () => {
    mockStorage.getTask.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await supertest(app).delete("/api/tasks/1");

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("db down");
  });
});
