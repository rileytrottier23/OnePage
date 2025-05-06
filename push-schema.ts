import { sql } from "drizzle-orm";
import { db } from "./server/db";

// Create the repeating_tasks table
async function createRepeatingTasksTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS repeating_tasks (
        id SERIAL PRIMARY KEY,
        task_text TEXT NOT NULL,
        repeat_type TEXT NOT NULL,
        target_category_id INTEGER REFERENCES categories(id),
        creation_time TIME NOT NULL DEFAULT '07:00:00',
        last_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        user_id INTEGER REFERENCES users(id)
      );
    `);
    console.log("RepeatingTasks table created successfully");
  } catch (error) {
    console.error("Error creating RepeatingTasks table:", error);
  }
}

(async () => {
  try {
    await createRepeatingTasksTable();
    process.exit(0);
  } catch (error) {
    console.error("Database migration failed:", error);
    process.exit(1);
  }
})();