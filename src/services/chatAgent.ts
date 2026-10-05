import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

// Tool declaration for Historical Pattern Analyzer
const analyzeHistoricalPatternTool = {
  name: "analyze_historical_pattern",
  description: "Analyze an indicator's historical patterns (e.g. R3 to S1 touches). Use this tool when the user asks to analyze historical data, occurrences, success rates, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceCondition: {
        type: Type.STRING,
        description: "The starting condition (e.g., 'close > r3' or 'touch R3')"
      },
      targetCondition: {
        type: Type.STRING,
        description: "The target condition for success (e.g., 'close <= s1' or 'touch S1')"
      },
      maxDurationBars: {
        type: Type.INTEGER,
        description: "Maximum number of bars allowed to reach the target condition. E.g., for 1 hour on 5min chart, it is 12 bars."
      }
    },
    required: ["sourceCondition", "targetCondition", "maxDurationBars"]
  }
};

export async function processChat(messages: any[], context: any): Promise<any> {
  const systemInstruction = `
You are the "Market Compass AI Strategy Analyst", an expert financial AI assistant.
Your job is to help users analyze trading strategies and indicators in natural language (Arabic or English).

Core Rules:
1. NEVER fabricate or estimate statistics, accuracy percentages, or historical occurrences.
2. If the user asks for historical analysis (e.g., "count R3 to S1 touches", "success rate"), you MUST use the "analyze_historical_pattern" tool.
3. If the user provides Pine Script code, read it and understand the parameters.
4. If you used the tool, present the exact metrics returned by the tool in a professional, clear manner.
5. If the user asks to forecast the next candle, explain that they can click the "Analyze Historical Pattern → Forecast Next Candle" button in the UI.

Context Information:
${JSON.stringify(context, null, 2)}
  `.trim();

  // Format messages for GoogleGenAI SDK
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [analyzeHistoricalPatternTool] }]
      }
    });
    
    // Simulate chat history by sending all but the last message, then send the last message
    // Actually, the SDK supports passing history directly in create(), but it requires a specific format.
    // Let's just use generateContent with the full history if needed, or build the chat session.
    
    // Instead of chat, let's use generateContent for stateless operation
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: formattedMessages,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [analyzeHistoricalPatternTool] }]
      }
    });

    const functionCalls = response.functionCalls || [];
    
    if (functionCalls.length > 0) {
      const call = functionCalls[0];
      return {
        actionRequired: true,
        toolCall: {
          name: call.name,
          args: call.args
        }
      };
    }

    return {
      actionRequired: false,
      text: response.text
    };

  } catch (error: any) {
    console.error("[ChatAgent] Error:", error);
    throw new Error(error.message || "Failed to process chat");
  }
}
