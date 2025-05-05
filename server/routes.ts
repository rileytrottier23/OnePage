import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCategorySchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);

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
  
  // Update a category
  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = z.object({
        name: z.string().min(1)
      }).parse(req.body);
      
      const updated = await storage.updateCategory(id, { name });
      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(updated);
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
      
      // Handle indentation level for subtasks
      if (taskData.parentTaskId && taskData.indentLevel === undefined) {
        const parentTask = await storage.getTask(taskData.parentTaskId);
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

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const taskSchema = z.object({
        text: z.string().optional(),
        completed: z.boolean().optional(),
        archived: z.boolean().optional(),
        parentTaskId: z.number().optional(),
        indentLevel: z.number().optional(),
      });
      
      const updates = taskSchema.parse(req.body);
      
      // If marking as completed, set completedAt timestamp
      if (updates.completed === true) {
        const completedDate = new Date();
        await storage.updateTask(id, { ...updates, completedAt: completedDate });
        return res.json(await storage.getTask(id));
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

  // Route to update task indentation
  app.patch("/api/tasks/:id/indent", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const { increase } = z.object({
        increase: z.boolean(),
      }).parse(req.body);
      
      const task = await storage.getTask(id);
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
      });
      
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
  
  // Create subtask endpoint
  app.post("/api/tasks/:id/subtask", async (req, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const parentTask = await storage.getTask(parentId);
      
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
        indentLevel
      });
      
      res.status(201).json(subtask);
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Move task to another category endpoint
  app.patch("/api/tasks/:id/category", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { categoryId } = z.object({
        categoryId: z.number()
      }).parse(req.body);
      
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const category = await storage.getCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Update the task with the new category
      const updated = await storage.updateTask(id, {
        categoryId,
        inTodaySection: false, // If moved to a category, it's no longer in Today
        originalCategory: null // Reset original category
      });
      
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
