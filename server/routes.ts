import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCategorySchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Error handling middleware
  const handleError = (err: any, res: any) => {
    console.error("API Error:", err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.errors });
    }
    return res.status(500).json({ message: err.message || "Internal server error" });
  };

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      // Filter out archived tasks
      const activeTasks = tasks.filter(task => !task.archived);
      res.json(activeTasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.get("/api/tasks/archived", async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      // Return only archived tasks
      const archivedTasks = tasks.filter(task => task.archived);
      res.json(archivedTasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      
      // If task is added to Today but has a categoryId,
      // we need to get the category name for reference
      let originalCategory = null;
      if (taskData.inTodaySection && taskData.categoryId) {
        const category = await storage.getCategory(taskData.categoryId);
        if (category) {
          originalCategory = category.name;
        }
      }
      
      const task = await storage.createTask({
        ...taskData,
        originalCategory
      });
      
      res.status(201).json(task);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const taskSchema = z.object({
        text: z.string().optional(),
        completed: z.boolean().optional(),
        archived: z.boolean().optional(),
      });
      
      const updates = taskSchema.parse(req.body);
      
      // If marking as completed, set completedAt timestamp
      if (updates.completed === true) {
        updates.completedAt = new Date();
      }
      
      const updated = await storage.updateTask(id, updates);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/tasks/:id/move", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { moveToToday } = z.object({
        moveToToday: z.boolean(),
      }).parse(req.body);
      
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (moveToToday) {
        // Moving to Today section
        let originalCategory = null;
        
        // Only set originalCategory if the task already has a category
        if (task.categoryId) {
          const category = await storage.getCategory(task.categoryId);
          if (category) {
            originalCategory = category.name;
          }
        }
        
        const updated = await storage.updateTask(id, {
          inTodaySection: true,
          originalCategory,
        });
        
        res.json(updated);
      } else {
        // Moving back to original category
        const updated = await storage.updateTask(id, {
          inTodaySection: false,
          originalCategory: null,
        });
        
        res.json(updated);
      }
    } catch (err) {
      handleError(err, res);
    }
  });

  // Archive tasks endpoint
  app.post("/api/tasks/archive", async (req, res) => {
    try {
      // This will archive all completed tasks
      await storage.archiveCompletedTasks();
      res.json({ message: "Completed tasks archived successfully" });
    } catch (err) {
      handleError(err, res);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
