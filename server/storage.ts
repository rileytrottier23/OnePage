import { 
  tasks, 
  categories, 
  users, 
  type Task, 
  type InsertTask, 
  type Category, 
  type InsertCategory, 
  type User, 
  type InsertUser 
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
  getAllCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<Category>): Promise<Category | undefined>;
  
  // Task methods
  getAllTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask & { originalCategory?: string | null }): Promise<Task>;
  updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  archiveCompletedTasks(): Promise<void>;
  
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
    
    // Initialize with default categories if there are none
    this.initializeDefaultCategories();
  }

  private async initializeDefaultCategories() {
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length === 0) {
      const defaultCategories = ["Work", "Personal", "Errands"];
      for (const name of defaultCategories) {
        await this.createCategory({ name });
      }
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
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }
  
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category;
  }
  
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }
  
  async updateCategory(id: number, updates: Partial<Category>): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    
    if (!category) return undefined;
    
    const [updatedCategory] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    
    // If the category name was updated, also update originalCategory in all tasks
    if (updates.name && updates.name !== category.name) {
      await db
        .update(tasks)
        .set({ originalCategory: updates.name })
        .where(eq(tasks.originalCategory, category.name));
    }
    
    return updatedCategory;
  }
  
  // Task methods
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }
  
  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id));
    return task;
  }
  
  async createTask(insertTask: InsertTask & { originalCategory?: string | null }): Promise<Task> {
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
    };
    
    const [task] = await db
      .insert(tasks)
      .values(taskData)
      .returning();
    return task;
  }
  
  async updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined> {
    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }
  
  async deleteTask(id: number): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(eq(tasks.id, id));
    return true; // PostgreSQL doesn't return count, but operation succeeded if no error
  }
  
  async archiveCompletedTasks(): Promise<void> {
    await db
      .update(tasks)
      .set({ archived: true })
      .where(
        and(
          eq(tasks.completed, true),
          eq(tasks.archived, false)
        )
      );
  }
}

export const storage = new DatabaseStorage();
