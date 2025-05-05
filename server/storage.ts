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

// Interface for storage operations
export interface IStorage {
  // User methods (kept from original)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Category methods
  getAllCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Task methods
  getAllTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask & { originalCategory?: string | null }): Promise<Task>;
  updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  archiveCompletedTasks(): Promise<void>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private tasks: Map<number, Task>;
  userCurrentId: number;
  categoryCurrentId: number;
  taskCurrentId: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.tasks = new Map();
    this.userCurrentId = 1;
    this.categoryCurrentId = 1;
    this.taskCurrentId = 1;
    
    // Initialize with default categories
    const defaultCategories = ["Work", "Personal", "Errands"];
    defaultCategories.forEach(name => {
      this.createCategory({ name });
    });
  }

  // User methods (kept from original)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Category methods
  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }
  
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }
  
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryCurrentId++;
    const category: Category = { ...insertCategory, id };
    this.categories.set(id, category);
    return category;
  }
  
  // Task methods
  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
  
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }
  
  async createTask(insertTask: InsertTask & { originalCategory?: string | null }): Promise<Task> {
    const id = this.taskCurrentId++;
    const now = new Date();
    
    const task: Task = {
      id,
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
    
    this.tasks.set(id, task);
    return task;
  }
  
  async updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
  
  async deleteTask(id: number): Promise<boolean> {
    return this.tasks.delete(id);
  }
  
  async archiveCompletedTasks(): Promise<void> {
    // Get all completed tasks and mark them as archived
    const tasks = Array.from(this.tasks.values());
    for (const task of tasks) {
      if (task.completed && !task.archived) {
        await this.updateTask(task.id, { archived: true });
      }
    }
  }
}

export const storage = new MemStorage();
