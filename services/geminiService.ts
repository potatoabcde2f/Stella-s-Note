import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize Gemini
// Note: In a real production app, ensure this is handled securely.
// For this demo, we assume the env var is injected.
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateTextEnhancement = async (prompt: string, currentText: string): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key missing");
    return "错误：API 密钥缺失。";
  }

  try {
    const model = 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model: model,
      contents: `You are a helpful writing assistant inside a productivity tool. 
      User request: ${prompt}
      Current text: "${currentText}"
      
      Return ONLY the improved/generated text. Do not add markdown code blocks unless requested.`,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "生成内容时出错。";
  }
};

export const suggestIdeas = async (topic: string): Promise<string[]> => {
    if (!ai) return ["API密钥缺失"];
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 5 short, punchy ideas related to: ${topic}. Return them as a simple JSON array of strings.`,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error(e);
        return [];
    }
}
