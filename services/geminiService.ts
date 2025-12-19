
import { GoogleGenAI, Modality, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeImageAndWriteStory = async (base64Image: string) => {
  const ai = getAI();
  const imageData = base64Image.split(',')[1];
  
  const prompt = `Analyze this image in detail. Then, ghostwrite a compelling, evocative opening paragraph (approx 100-150 words) for a story set in this world. 
  Return the response in a clear JSON format with two keys: "analysis" and "story". 
  The analysis should focus on mood, lighting, and hidden details. The story should be immersive and literary.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: imageData, mimeType: 'image/png' } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING },
          story: { type: Type.STRING }
        },
        required: ["analysis", "story"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateNarration = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this story opening with deep emotion and atmosphere: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' }, // Deep, expressive voice
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const chatWithGemini = async (history: {role: string, parts: {text: string}[]}[], newMessage: string) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are a creative writing consultant. You help users develop worlds, characters, and plots based on their images and stories. Be inspiring and insightful."
    }
  });

  // Reconstruct history if needed, but for simplicity we'll just send the message
  // In a real app we would pass the whole thread.
  const response = await chat.sendMessage({ message: newMessage });
  return response.text;
};
