import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Create an OpenAI client
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate productivity insights based on task data
 */
export async function generateInsights(
  completedTasks: any[],
  pendingTasks: any[],
  month: number,
  year: number
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI_KEY_MISSING: No OpenAI API key is configured. Please add your OPENAI_API_KEY to the environment.");
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI productivity assistant. You analyze completed and pending tasks to provide productivity insights.
            Your response should be formatted as HTML that can be safely inserted into a React component with dangerouslySetInnerHTML.
            Structure your analysis with clear headings (<h3>), paragraphs (<p>), and bulleted lists (<ul><li>) when appropriate.
            Use <strong> tags for emphasis. Include the following sections:
            1. Summary of Activity
            2. Productivity Patterns
            3. Recommendations for Improvement
            Offer actionable advice and positive encouragement. Keep your response friendly and motivational.`
        },
        {
          role: "user",
          content: `Please analyze my task data for ${monthName} ${year} and provide productivity insights and recommendations. Here's my task data: ${JSON.stringify(taskSummary)}`
        }
      ],
      max_tokens: 1000,
    });

    // Return the insight text from the AI response
    return response.choices[0].message.content || "No insights generated. Please try again.";
  } catch (error: any) {
    console.error("Error generating insights with OpenAI:", error);

    const status = error?.status ?? error?.response?.status;
    const code = error?.code ?? error?.error?.code;

    if (status === 401 || code === "invalid_api_key") {
      throw new Error("AI_KEY_INVALID: The OpenAI API key is invalid or has been revoked. Please update your OPENAI_API_KEY.");
    }
    if (status === 429) {
      if (code === "insufficient_quota") {
        throw new Error("AI_QUOTA_EXCEEDED: Your OpenAI account has exceeded its usage quota. Please check your billing details.");
      }
      throw new Error("AI_RATE_LIMITED: OpenAI is receiving too many requests right now. Please wait a moment and try again.");
    }
    if (status === 503 || status === 502 || status === 500) {
      throw new Error("AI_SERVICE_DOWN: The OpenAI service is temporarily unavailable. Please try again in a few minutes.");
    }

    throw new Error("AI_ERROR: Failed to generate insights. Please try again later.");
  }
}
