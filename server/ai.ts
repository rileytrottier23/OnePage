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

  // Prepare the task summary for the AI
  const taskSummary = {
    completedTasks: completedTasks.map(task => ({
      text: task.text,
      categoryName: task.categoryName || "Uncategorized",
      completedAt: task.completedAt,
      createdAt: task.createdAt
    })),
    pendingTasks: pendingTasks.map(task => ({
      text: task.text,
      categoryName: task.categoryName || "Uncategorized",
      createdAt: task.createdAt
    })),
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
