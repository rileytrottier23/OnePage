import type { Express } from "express";
import { storage } from "./storage";
import { requireAuth as ensureAuth } from "./middlewares/requireAuth";

// Delete a task for good, along with any subtasks under it.
export function registerDeleteTaskRoute(app: Express) {
  app.delete("/api/tasks/:id", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid task id" });
      }

      // First check that this task belongs to the user
      const task = await storage.getTask(id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Collect every subtask below it, deepest first, then the task itself
      const allTasks = await storage.getAllTasks(userId);
      const collect = (parentId: number): number[] =>
        allTasks
          .filter((t) => t.parentTaskId === parentId)
          .flatMap((child) => [...collect(child.id), child.id]);
      for (const taskId of [...collect(id), id]) {
        await storage.deleteTask(taskId, userId);
      }

      res.json({ message: "Task deleted" });
    } catch (err: any) {
      console.error("API Error:", err);
      res.status(500).json({ message: err.message || "Internal server error" });
    }
  });
}
