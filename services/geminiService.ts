import { GoogleGenAI, Modality, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyseImageAndWriteStory = async (base64Image: string, tone: string, hint?: string) => {
  const ai = getAI();
  const imageData = base64Image.split(',')[1];
  
  const hintSection = hint ? `\nThe user has provided a narrative direction/hint: "${hint}". Incorporate this direction into the story naturally.` : "";
  
  const prompt = `Analyse this image in detail. Then:
  1. Generate a compelling, atmospheric title for the story (max 5 words).
  2. Ghostwrite a compelling, evocative opening paragraph (approx 60-80 words) for a story set in this world.
  3. Provide a "visualPrompt": This must be a detailed description for a graphic novel artist.
     CRITICAL CHARACTER CONSISTENCY: You MUST define the physical appearance of the main protagonist(s) found in the image with extreme precision (e.g., "A tall woman with sharp cheekbones, wearing a midnight-blue velvet cloak with gold embroidery, her silver-streaked hair tied in a loose bun"). 
     Describe the setting's mood, lighting, and key environmental features.
  
  IMPORTANT: The story MUST be written in a ${tone.toUpperCase()} tone. ${hintSection}
  
  All text MUST be written in British English (UK spelling).
  
  Return the response in a clear JSON format with keys: "story", "title", and "visualPrompt". 
  The "visualPrompt" will serve as the master visual reference for all subsequent chapters.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{
      parts: [
        { inlineData: { data: imageData, mimeType: 'image/png' } },
        { text: prompt }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          story: { type: Type.STRING },
          title: { type: Type.STRING },
          visualPrompt: { type: Type.STRING }
        },
        required: ["story", "title", "visualPrompt"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const extendStory = async (base64Image: string, fullStory: string, tone: string) => {
  const ai = getAI();
  const imageData = base64Image.split(',')[1];

  const prompt = `Continue the following story based on the attached reference image. Maintain the ${tone.toUpperCase()} tone. 
  Write a single, evocative paragraph (approx 50-70 words) that significantly advances the plot and moves the characters to a NEW specific action or location.
  
  All text MUST be written in British English (UK spelling).
  
  Provide a "visualPrompt": This is the artistic description for a COMPLETELY NEW frame in the graphic novel.
  CRITICAL NARRATIVE CHANGE: This prompt MUST describe a new pose, a new specific action, and any changes in the background or environment as the story progresses.
  STRICT CHARACTER CONSISTENCY: Carry over the exact visual traits (hair, face, clothing) of the protagonist from the reference image. 
  The character should be the same, but doing something different in a new part of the scene or a new location entirely.
  
  Current Story Context:
  "${fullStory}"
  
  Return the response in JSON format with "nextPart" and "visualPrompt" keys.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{
      parts: [
        { inlineData: { data: imageData, mimeType: 'image/png' } },
        { text: prompt }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nextPart: { type: Type.STRING },
          visualPrompt: { type: Type.STRING }
        },
        required: ["nextPart", "visualPrompt"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateStoryImage = async (referenceImageBase64: string, visualPrompt: string, styleInstruction: string) => {
  const ai = getAI();
  const imageData = referenceImageBase64.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{
        parts: [
          {
            inlineData: {
              data: imageData,
              mimeType: 'image/png',
            },
          },
          {
            text: `ARTISTIC STYLE: ${styleInstruction}

SUBJECT MATTER FOR NEW SCENE: ${visualPrompt}

INSTRUCTIONS FOR NARRATIVE CONTINUITY:
1. IDENTITY ANCHOR: The character from the attached REFERENCE IMAGE is your protagonist. You MUST reproduce their exact facial features, hair, and outfit in the NEW image.
2. NEW ACTION/SCENE: You are NOT just editing the previous image. You are creating a NEW frame in a graphic novel. The character must be performing the NEW action described in the SUBJECT MATTER in the NEW environment.
3. VISUAL STYLE ADHERENCE: Strictly maintain the "${styleInstruction}" aesthetic.
4. CONSISTENCY: While the scene is new, the visual "DNA" (lighting quality, colour palette, and character design) must be identical to the reference image.`,
          },
        ],
      }],
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (err) {
    console.error("Gemini Image Generation Error:", err);
  }
  return null;
};

export const generateNarration = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this story as a soothing, elderly British English gentleman. Speak with a deep, resonant, and cinematic tone. Capture the profound emotion and atmospheric gravity of the prose: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Charon' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};