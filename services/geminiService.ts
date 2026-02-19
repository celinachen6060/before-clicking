
import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, SmartOutfitResponse } from "../types";

export const extractClothingMetadata = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `You are a clothing extraction assistant. Given an image that may contain clothing items (with or without a model wearing them), perform the following tasks:
1. Identify the main clothing item(s) in the image
2. Describe each item with: category (Top/Bottom/Outerwear/Footwear/Accessory), subcategory, color, and style.
3. Ignore any background, human body, furniture, or non-clothing elements.
4. For each item, provide a normalized bounding box [ymin, xmin, ymax, xmax] as values from 0 to 100 representing the percentage of the image height and width.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        {
          text: "Extract all clothing items from this image and return them in the specified JSON format.",
        },
      ],
    },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                subcategory: { type: Type.STRING },
                color: { type: Type.STRING },
                style: { type: Type.STRING },
                boundingBox: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
              required: ['category', 'subcategory', 'color', 'style', 'boundingBox'],
            },
          },
        },
        required: ['items'],
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text);
    return parsed.items || [];
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
};

export const generateTryOn = async (userImage: string, clothingItems: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [
    { text: "Generate a realistic full-body photo of this exact person wearing these exact clothing items. The result must show the complete look from head to toe, including legs and feet. Use the original photo's full-body framing as reference — match the same camera distance and angle. Keep the person's face, hair, skin tone, and body shape completely identical. Do not crop. Do not cut off any body parts." },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: userImage.split(',')[1] || userImage
      }
    }
  ];

  clothingItems.forEach((itemBase64) => {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: itemBase64.split(',')[1] || itemBase64
      }
    });
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts }
  });

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("No image was generated in the response.");
};

export const generateSmartOutfit = async (wardrobeItems: ClothingItem[], selectedStyle: string): Promise<SmartOutfitResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Convert wardrobe to text descriptions for text-only analysis
  const inventoryText = wardrobeItems.map(item => 
    `ID: ${item.id}, Category: ${item.category}, Description: ${item.description}`
  ).join('\n');

  const prompt = `You are a professional fashion stylist. Based on the following clothing inventory, create a complete outfit in the "${selectedStyle}" style. 

Inventory:
${inventoryText}

Rules:
1. Select one item from each category if available: Top, Outerwear, Bottom, Footwear.
2. Use the exact Item ID from the inventory list for your selections.
3. If a category has no items in the inventory, suggest a hypothetical piece that would complement the look but set its "id" to null.
4. Return ONLY a JSON response matching the schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          style: { type: Type.STRING },
          outfit: {
            type: Type.OBJECT,
            properties: {
              top: { 
                type: Type.OBJECT, 
                properties: { 
                  id: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING }, 
                  reason: { type: Type.STRING } 
                },
                required: ['description', 'reason']
              },
              outerwear: { 
                type: Type.OBJECT, 
                properties: { 
                  id: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING }, 
                  reason: { type: Type.STRING } 
                },
                required: ['description', 'reason']
              },
              bottom: { 
                type: Type.OBJECT, 
                properties: { 
                  id: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING }, 
                  reason: { type: Type.STRING } 
                },
                required: ['description', 'reason']
              },
              footwear: { 
                type: Type.OBJECT, 
                properties: { 
                  id: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING }, 
                  reason: { type: Type.STRING } 
                },
                required: ['description', 'reason']
              }
            }
          },
          overall_vibe: { type: Type.STRING }
        },
        required: ['style', 'outfit', 'overall_vibe']
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse smart outfit response", e);
    throw new Error("Could not parse stylist recommendations.");
  }
};
