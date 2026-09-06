import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCategorySchema, insertTaskSchema, insertRepeatingTaskSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { requireAuth as ensureAuth } from "./middlewares/requireAuth";
import { generateInsights } from "./ai";
import fs from "fs";
import path from "path";

// Function to schedule daily tasks like archiving completed tasks and processing repeating tasks
function setupScheduledTasks() {
  const checkAndRunScheduledTasks = async () => {
    try {
      console.log("Running scheduled tasks check...");
      const now = new Date();
      
      // Get all users - we'll process tasks for each user
      const allUsers = await storage.getAllUsers();
      
      // Run at 6am for task archiving and 7am for repeating task processing
      const hour = now.getHours();
      
      if (hour === 6) { 
        console.log("It's 6am - archiving completed tasks");
        for (const user of allUsers) {
          await storage.archiveCompletedTasks(user.id);
        }
      }
      
      if (hour === 7) {
        console.log("It's 7am - processing repeating tasks");
        for (const user of allUsers) {
          await storage.processRepeatingTasks(user.id);
        }
      }

      if (hour === 3) {
        console.log("It's 3am - pruning stale AI insights cache");
        const deletedCount = await storage.pruneOldInsightsCache();
        console.log(`Pruned ${deletedCount} stale insights cache row(s)`);
      }
    } catch (error) {
      console.error("Error in scheduled tasks:", error);
    }
  };
  
  // Check every hour if it's time to run scheduled tasks
  setInterval(checkAndRunScheduledTasks, 60 * 60 * 1000); // Every hour
  
  // Also run once on startup to handle any missed tasks
  checkAndRunScheduledTasks();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up scheduled tasks
  setupScheduledTasks();

  // Error handling middleware
  const handleError = (err: any, res: any) => {
    console.error("API Error:", err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.errors });
    }
    return res.status(500).json({ message: err.message || "Internal server error" });
  };

  app.get("/api/user", ensureAuth, (req: any, res: any) => {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Categories
  app.get("/api/categories", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const categories = await storage.getAllCategories(userId);
      res.json(categories);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/categories", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const data = insertCategorySchema.parse({
        ...req.body,
        userId
      });
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Update a category
  app.patch("/api/categories/:id", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      const { name } = z.object({
        name: z.string().min(1)
      }).parse(req.body);
      
      // First check if this category belongs to the user
      const category = await storage.getCategory(id, userId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const updated = await storage.updateCategory(id, { name }, userId);
      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Tasks
  app.get("/api/tasks", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const tasks = await storage.getAllTasks(userId);
      // Filter out archived tasks
      const activeTasks = tasks.filter(task => !task.archived);
      res.json(activeTasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.get("/api/tasks/archived", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const tasks = await storage.getAllTasks(userId);
      // Return only archived tasks
      const archivedTasks = tasks.filter(task => task.archived);
      res.json(archivedTasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/tasks", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const taskData = insertTaskSchema.parse({
        ...req.body,
        userId
      });
      
      // If task is added to Today but has a categoryId,
      // we need to get the category name for reference
      let originalCategory = null;
      if (taskData.inTodaySection && taskData.categoryId) {
        const category = await storage.getCategory(taskData.categoryId, userId);
        if (category) {
          originalCategory = category.name;
        }
      }
      
      // Handle indentation level for subtasks
      if (taskData.parentTaskId && taskData.indentLevel === undefined) {
        const parentTask = await storage.getTask(taskData.parentTaskId, userId);
        if (parentTask) {
          taskData.indentLevel = (parentTask.indentLevel || 0) + 1;
        } else {
          taskData.indentLevel = 0;
          taskData.parentTaskId = null;
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

  app.patch("/api/tasks/:id", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      const taskSchema = z.object({
        text: z.string().optional(),
        completed: z.boolean().optional(),
        archived: z.boolean().optional(),
        parentTaskId: z.number().optional(),
        indentLevel: z.number().optional(),
      });
      
      // First check if this task belongs to the user
      const task = await storage.getTask(id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const updates = taskSchema.parse(req.body);
      
      // Let the storage method handle the completedAt timestamp logic
      const updated = await storage.updateTask(id, updates, userId);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Route to update task indentation
  app.patch("/api/tasks/:id/indent", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      
      const { increase } = z.object({
        increase: z.boolean(),
      }).parse(req.body);
      
      const task = await storage.getTask(id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Calculate new indent level
      let newIndentLevel = task.indentLevel || 0;
      if (increase) {
        newIndentLevel += 1;
      } else {
        // Don't go below 0
        newIndentLevel = Math.max(0, newIndentLevel - 1);
      }
      
      const updated = await storage.updateTask(id, {
        indentLevel: newIndentLevel,
      }, userId);
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/tasks/:id/move", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      const { moveToToday } = z.object({
        moveToToday: z.boolean(),
      }).parse(req.body);
      
      const task = await storage.getTask(id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      if (moveToToday) {
        // Moving to Today section
        let originalCategory = null;
        
        // Only set originalCategory if the task already has a category
        if (task.categoryId) {
          const category = await storage.getCategory(task.categoryId, userId);
          if (category) {
            originalCategory = category.name;
          }
        }
        
        const updated = await storage.updateTask(id, {
          inTodaySection: true,
          originalCategory,
        }, userId);
        
        res.json(updated);
      } else {
        // Moving back to original category
        const updated = await storage.updateTask(id, {
          inTodaySection: false,
          originalCategory: null,
        }, userId);
        
        res.json(updated);
      }
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Reorder tasks endpoint
  app.patch("/api/tasks/:id/reorder", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      
      const { targetTaskId, position } = z.object({
        targetTaskId: z.number(),
        position: z.enum(['before', 'after'])
      }).parse(req.body);
      
      // Ensure both tasks exist and belong to the user
      const sourceTask = await storage.getTask(id, userId);
      const targetTask = await storage.getTask(targetTaskId, userId);
      
      if (!sourceTask || !targetTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Ensure tasks are in the same section
      const sameSection = 
        (sourceTask.inTodaySection && targetTask.inTodaySection) ||
        (!sourceTask.inTodaySection && !targetTask.inTodaySection && 
         sourceTask.categoryId === targetTask.categoryId);
      
      if (!sameSection) {
        return res.status(400).json({ 
          message: "Cannot reorder tasks between different sections" 
        });
      }
      
      // For now, just update the task to preserve the same properties
      // In a full implementation, we would need to add and use an 'order' field
      // to the Task schema to properly maintain custom ordering
      const updated = await storage.updateTask(id, {
        // Ensure we keep the same key properties
        categoryId: sourceTask.categoryId,
        inTodaySection: sourceTask.inTodaySection,
      }, userId);
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Archive tasks endpoint
  app.post("/api/tasks/archive", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      // This will archive all completed tasks for this user
      await storage.archiveCompletedTasks(userId);
      res.json({ message: "Completed tasks archived successfully" });
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Create subtask endpoint
  app.post("/api/tasks/:id/subtask", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const parentId = parseInt(req.params.id);
      const parentTask = await storage.getTask(parentId, userId);
      
      if (!parentTask) {
        return res.status(404).json({ message: "Parent task not found" });
      }
      
      const { text } = z.object({
        text: z.string().min(1)
      }).parse(req.body);
      
      const indentLevel = (parentTask.indentLevel || 0) + 1;
      
      const subtask = await storage.createTask({
        text,
        categoryId: parentTask.categoryId,
        inTodaySection: parentTask.inTodaySection,
        parentTaskId: parentId,
        indentLevel,
        userId
      });
      
      res.status(201).json(subtask);
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Move task to another category endpoint
  app.patch("/api/tasks/:id/category", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      const { categoryId } = z.object({
        categoryId: z.number()
      }).parse(req.body);
      
      const task = await storage.getTask(id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const category = await storage.getCategory(categoryId, userId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Update the task with the new category
      const updated = await storage.updateTask(id, {
        categoryId,
        inTodaySection: false, // If moved to a category, it's no longer in Today
        originalCategory: null // Reset original category
      }, userId);
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Repeating Tasks endpoints
  app.get("/api/repeating-tasks", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const repeatingTasks = await storage.getAllRepeatingTasks(userId);
      res.json(repeatingTasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/repeating-tasks", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const data = insertRepeatingTaskSchema.parse({
        ...req.body,
        userId
      });
      
      const repeatingTask = await storage.createRepeatingTask(data);
      res.status(201).json(repeatingTask);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/repeating-tasks/:id", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      
      const repeatingTaskSchema = z.object({
        taskText: z.string().optional(),
        repeatType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
        targetCategoryId: z.number().optional(),
        active: z.boolean().optional(),
      });
      
      // First check if this repeating task belongs to the user
      const repeatingTask = await storage.getRepeatingTask(id, userId);
      if (!repeatingTask) {
        return res.status(404).json({ message: "Repeating task not found" });
      }
      
      const updates = repeatingTaskSchema.parse(req.body);
      const updated = await storage.updateRepeatingTask(id, updates, userId);
      
      if (!updated) {
        return res.status(404).json({ message: "Repeating task not found" });
      }
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/repeating-tasks/:id", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const id = parseInt(req.params.id);
      
      // Check if task exists and belongs to user
      const repeatingTask = await storage.getRepeatingTask(id, userId);
      if (!repeatingTask) {
        return res.status(404).json({ message: "Repeating task not found" });
      }
      
      const success = await storage.deleteRepeatingTask(id, userId);
      if (success) {
        res.json({ message: "Repeating task deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete repeating task" });
      }
    } catch (err) {
      handleError(err, res);
    }
  });

  // Process repeating tasks - typically called on login or at regular intervals
  app.post("/api/repeating-tasks/process", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      await storage.processRepeatingTasks(userId);
      res.json({ message: "Repeating tasks processed successfully" });
    } catch (err) {
      handleError(err, res);
    }
  });

  // AI Insights cache endpoint
  app.get("/api/insights/cached", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const { month, year } = z.object({
        month: z.coerce.number().min(0).max(11),
        year: z.coerce.number().min(2000).max(2100)
      }).parse(req.query);

      const cached = await storage.getInsightsCache(userId, month, year);
      if (cached) {
        res.json({ insights: cached.insights, generatedAt: cached.generatedAt });
      } else {
        res.json({ insights: null, generatedAt: null });
      }
    } catch (err) {
      handleError(err, res);
    }
  });

  // Delete AI Insights cache endpoint
  app.delete("/api/insights/cached", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      const { month, year } = z.object({
        month: z.coerce.number().min(0).max(11),
        year: z.coerce.number().min(2000).max(2100)
      }).parse(req.query);

      await storage.deleteInsightsCache(userId, month, year);
      res.json({ message: "Cache cleared successfully" });
    } catch (err) {
      handleError(err, res);
    }
  });

  // AI Insights API endpoint
  app.post("/api/insights/generate", ensureAuth, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      
      // Validate the request data
      const { month, year } = z.object({
        month: z.number().min(0).max(11),
        year: z.number().min(2000).max(2100)
      }).parse(req.body);
      
      // Get all tasks for the user
      const allTasks = await storage.getAllTasks(userId);
      
      // Get category names for each task
      const tasksWithCategoryNames = await Promise.all(
        allTasks.map(async (task) => {
          let categoryName = null;
          if (task.categoryId) {
            const category = await storage.getCategory(task.categoryId, userId);
            categoryName = category?.name || null;
          }
          return {
            ...task,
            categoryName
          };
        })
      );
      
      // Filter tasks for the specified month and year
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0); // Last day of month
      
      // Filter completed tasks in the specified time range
      const completedTasks = tasksWithCategoryNames.filter(task => {
        if (!task.completed || !task.completedAt) return false;
        
        const completedAt = new Date(task.completedAt);
        return (
          completedAt >= startDate && 
          completedAt <= endDate
        );
      });
      
      // Filter pending tasks (not completed and created before the end of the month)
      const pendingTasks = tasksWithCategoryNames.filter(task => {
        if (task.completed || task.archived) return false;
        
        const createdAt = new Date(task.createdAt);
        return createdAt <= endDate;
      });
      
      // Generate insights using OpenAI
      const insights = await generateInsights(
        completedTasks,
        pendingTasks,
        month,
        year
      );
      
      // Save to cache for this user/month/year
      await storage.setInsightsCache(userId, month, year, insights);
      const cached = await storage.getInsightsCache(userId, month, year);
      
      res.json({ insights, generatedAt: cached?.generatedAt ?? new Date() });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: err.errors });
      }
      const msg: string = err?.message ?? "Internal server error";
      if (msg.startsWith("AI_KEY_MISSING:") || msg.startsWith("AI_SERVICE_DOWN:")) {
        return res.status(503).json({ message: msg });
      }
      if (msg.startsWith("AI_KEY_INVALID:")) {
        return res.status(401).json({ message: msg });
      }
      if (msg.startsWith("AI_RATE_LIMITED:") || msg.startsWith("AI_QUOTA_EXCEEDED:")) {
        return res.status(429).json({ message: msg });
      }
      console.error("API Error:", err);
      return res.status(500).json({ message: msg });
    }
  });

  // Deploy status endpoint — reads the JSON file written by sync-to-github.sh
  app.get("/api/deploy-status", ensureAuth, (req: any, res: any) => {
    const statusFile = path.resolve(process.cwd(), ".sync-status.json");
    try {
      if (!fs.existsSync(statusFile)) {
        return res.json({
          status: "unknown",
          timestamp: null,
          sha: null,
          error: null,
          actionsUrl: null,
        });
      }
      const raw = fs.readFileSync(statusFile, "utf8");
      const parsed = JSON.parse(raw);
      return res.json({
        status: parsed.status ?? "unknown",
        timestamp: parsed.timestamp ?? null,
        sha: parsed.sha ?? null,
        error: parsed.error ?? null,
        actionsUrl: parsed.actionsUrl ?? null,
      });
    } catch (err) {
      console.error("Failed to read deploy status file:", err);
      return res.status(500).json({ message: "Could not read deploy status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
