import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Category Schema
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  userId: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Task Schema
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  categoryId: integer("category_id").references(() => categories.id),
  inTodaySection: boolean("in_today_section").notNull().default(false),
  originalCategory: text("original_category"),
  archived: boolean("archived").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  parentTaskId: integer("parent_task_id"),
  indentLevel: integer("indent_level").notNull().default(0),
  userId: integer("user_id").references(() => users.id),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  text: true,
  categoryId: true,
  inTodaySection: true,
  parentTaskId: true,
  indentLevel: true,
  userId: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
