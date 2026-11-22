import Anthropic from "@anthropic-ai/sdk";

// Model used for productivity insights. Sonnet handles this summarization task
// well and is the cheapest current-generation model; switch to "claude-opus-5"
// for higher quality at higher cost.
const MODEL = "claude-sonnet-5";

// Create an Anthropic client (reads ANTHROPIC_API_KEY from the environment)
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI productivity assistant. You analyze completed and pending tasks to provide productivity insights.
Your response should be formatted as HTML that can be safely inserted into a React component with dangerouslySetInnerHTML.
Structure your analysis with clear headings (<h3>), paragraphs (<p>), and bulleted lists (<ul><li>) when appropriate.
Use <strong> tags for emphasis. Include the following sections:
1. Summary of Activity
2. Productivity Patterns
3. Recommendations for Improvement
Offer actionable advice and positive encouragement. Keep your response friendly and motivational.`;

// Limits on what goes into one insights prompt. Task text is already capped
// at MAX_TASK_TEXT_LENGTH on save; these also cover older rows and very busy
// months. Beyond the limits, the newest tasks are kept.
export const MAX_TASK_TEXT_IN_PROMPT = 500;
export const MAX_COMPLETED_TASKS_IN_PROMPT = 300;
export const MAX_PENDING_TASKS_IN_PROMPT = 200;

function clipText(text: unknown): string {
  const value = typeof text === "string" ? text : "";
  return value.length > MAX_TASK_TEXT_IN_PROMPT
    ? value.slice(0, MAX_TASK_TEXT_IN_PROMPT) + "…"
    : value;
}

function newestFirst<T extends Record<string, any>>(items: T[], dateField: string): T[] {
  const time = (item: T) => {
    const t = item[dateField] ? new Date(item[dateField]).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };
  return [...items].sort((a, b) => time(b) - time(a));
}

/**
 * Generate productivity insights based on task data
 */
export async function generateInsights(
  completedTasks: any[],
  pendingTasks: any[],
  month: number,
  year: number
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI_KEY_MISSING: No Anthropic API key is configured. Please add your ANTHROPIC_API_KEY to the environment.");
  }

  // Format month name
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[month];

  // Prepare the task summary for the AI. Text and task counts are capped so
  // one report can't grow to the model's full context window (cost).
  const taskSummary = {
    completedTasks: newestFirst(completedTasks, "completedAt").slice(0, MAX_COMPLETED_TASKS_IN_PROMPT).map(task => ({
      text: clipText(task.text),
      categoryName: task.categoryName || "Uncategorized",
      completedAt: task.completedAt,
      createdAt: task.createdAt
    })),
    pendingTasks: newestFirst(pendingTasks, "createdAt").slice(0, MAX_PENDING_TASKS_IN_PROMPT).map(task => ({
      text: clipText(task.text),
      categoryName: task.categoryName || "Uncategorized",
      createdAt: task.createdAt
    })),
    // Real totals, in case the lists above were cut to the newest tasks.
    completedTaskCount: completedTasks.length,
    pendingTaskCount: pendingTasks.length,
    timeframe: {
      month: monthName,
      year: year
    }
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please analyze my task data for ${monthName} ${year} and provide productivity insights and recommendations. Here's my task data: ${JSON.stringify(taskSummary)}`
        }
      ],
    });

    // Concatenate the text blocks from the AI response
    const text = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");

    return text || "No insights generated. Please try again.";
  } catch (error: any) {
    console.error("Error generating insights with Anthropic:", error);

    const status = error?.status ?? error?.response?.status;

    if (status === 401 || status === 403) {
      throw new Error("AI_KEY_INVALID: The Anthropic API key is invalid or has been revoked. Please update your ANTHROPIC_API_KEY.");
    }
    if (status === 429) {
      throw new Error("AI_RATE_LIMITED: The AI service is receiving too many requests right now. Please wait a moment and try again.");
    }
    if (status === 500 || status === 502 || status === 503 || status === 529) {
      throw new Error("AI_SERVICE_DOWN: The AI service is temporarily unavailable. Please try again in a few minutes.");
    }

    throw new Error("AI_ERROR: Failed to generate insights. Please try again later.");
  }
}
