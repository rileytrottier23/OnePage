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
  try {
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
  } catch (error) {
    console.error("Error generating insights with OpenAI:", error);
    throw new Error("Failed to generate insights. Please try again later.");
  }
}