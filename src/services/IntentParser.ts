import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

const ActionPlanSchema = z.object({
  id: z.string(),
  intent: z.string(),
  target: z.string(),
  actions: z.array(z.any()).min(1),
  summary: z.string()
});

export async function parseIntent(userPrompt: string, platformContext: any): Promise<any> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `
      You are an expert platform builder for a trading platform.
      Translate the user's natural language command into a structured action plan.
      
      Return a JSON object:
      {
        "id": "plan_unique_id",
        "intent": "action_type",
        "target": "identifier",
        "actions": [{ "type": "action_type", "components": [...] }],
        "summary": "human readable summary"
      }
      
      User Prompt: "${userPrompt}"
      Platform Context: ${JSON.stringify(platformContext)}
    `,
    config: { responseMimeType: "application/json" }
  });

  if (!response.text) {
    throw new Error("No response received from AI");
  }
  const parsed = JSON.parse(response.text);
  return ActionPlanSchema.parse(parsed);
}
