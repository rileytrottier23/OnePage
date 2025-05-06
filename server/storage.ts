import { 
  tasks, 
  categories, 
  users, 
  repeatingTasks,
  type Task, 
  type InsertTask, 
  type Category, 
  type InsertCategory, 
  type User, 
  type InsertUser,
  type RepeatingTask,
  type InsertRepeatingTask
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Interface for storage operations
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Category methods
  getAllCategories(userId?: number): Promise<Category[]>;
  getCategory(id: number, userId?: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<Category>, userId?: number): Promise<Category | undefined>;
  
  // Task methods
  getAllTasks(userId?: number): Promise<Task[]>;
  getTask(id: number, userId?: number): Promise<Task | undefined>;
  createTask(task: InsertTask & { originalCategory?: string | null }): Promise<Task>;
  updateTask(id: number, updates: Partial<Task>, userId?: number): Promise<Task | undefined>;
  deleteTask(id: number, userId?: number): Promise<boolean>;
  archiveCompletedTasks(userId?: number): Promise<void>;
  
  // Default categories
  initializeDefaultCategories(userId?: number): Promise<void>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

const PostgresSessionStore = connectPg(session);

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async initializeDefaultCategories(userId?: number) {
    if (!userId) return;
    
    try {
      // Check if user already has categories
      const userCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId));
      
      if (userCategories.length === 0) {
        // Create default categories for this user
        const defaultCategories = [
          { name: "Work", userId },
          { name: "Personal", userId },
          { name: "Shopping", userId }
        ];
        
        for (const cat of defaultCategories) {
          await this.createCategory(cat);
        }
      }
    } catch (error) {
      console.error("Error creating default categories:", error);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Category methods
  async getAllCategories(userId?: number): Promise<Category[]> {
    if (!userId) {
      return []; // If no userId provided, return empty array for security
    }
    
    return await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));
  }
  
  async getCategory(id: number, userId?: number): Promise<Category | undefined> {
    if (!userId) {
      return undefined; // No userId provided, return undefined for security
    }
    
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return category;
  }
  
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    // Ensure userId is provided for security
    if (!insertCategory.userId) {
      throw new Error("User ID is required to create a category");
    }
    
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }
  
  async updateCategory(id: number, updates: Partial<Category>, userId?: number): Promise<Category | undefined> {
    if (!userId) {
      return undefined; // If no userId provided, return undefined for security
    }
    
    // Find the category that belongs to this user
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    
    if (!category) return undefined;
    
    // Update the category ensuring user ownership
    const [updatedCategory] = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    
    // If the category name was updated, also update originalCategory in all tasks
    // but only for this user's tasks
    if (updates.name && updates.name !== category.name) {
      await db
        .update(tasks)
        .set({ originalCategory: updates.name })
        .where(and(
          eq(tasks.originalCategory, category.name),
          eq(tasks.userId, userId)
        ));
    }
    
    return updatedCategory;
  }
  
  // Task methods
  async getAllTasks(userId?: number): Promise<Task[]> {
    if (!userId) {
      return []; // If no userId provided, return empty array for security
    }
    
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId));
  }
  
  async getTask(id: number, userId?: number): Promise<Task | undefined> {
    if (!userId) {
      return undefined; // If no userId provided, return undefined for security
    }
    
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return task;
  }
  
  async createTask(insertTask: InsertTask & { originalCategory?: string | null }): Promise<Task> {
    // Ensure userId is provided for security
    if (!insertTask.userId) {
      throw new Error("User ID is required to create a task");
    }
    
    const now = new Date();
    
    const taskData = {
      text: insertTask.text,
      completed: false,
      categoryId: insertTask.categoryId || null,
      inTodaySection: insertTask.inTodaySection || false,
      archived: false,
      createdAt: now,
      completedAt: null,
      originalCategory: insertTask.originalCategory || null,
      parentTaskId: insertTask.parentTaskId || null,
      indentLevel: insertTask.indentLevel || 0,
      userId: insertTask.userId,
    };
    
    const [task] = await db
      .insert(tasks)
      .values(taskData)
      .returning();
    return task;
  }
  
  async updateTask(id: number, updates: Partial<Task>, userId?: number): Promise<Task | undefined> {
    if (!userId) {
      return undefined; // If no userId provided, return undefined for security
    }
    
    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return updated;
  }
  
  async deleteTask(id: number, userId?: number): Promise<boolean> {
    if (!userId) {
      return false; // If no userId provided, return false for security
    }
    
    await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    
    return true; // PostgreSQL doesn't return count, but operation succeeded if no error
  }
  
  async archiveCompletedTasks(userId?: number): Promise<void> {
    if (!userId) {
      return; // If no userId provided, do nothing for security
    }
    
    const conditions = [
      eq(tasks.completed, true),
      eq(tasks.archived, false),
      eq(tasks.userId, userId)
    ];
    
    await db
      .update(tasks)
      .set({ archived: true })
      .where(and(...conditions));
  }
}

export const storage = new DatabaseStorage();
