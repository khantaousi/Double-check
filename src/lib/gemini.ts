import { GoogleGenAI, Type } from "@google/genai";
import { DataRow } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractPrices(descriptions: string[]): Promise<number[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the base price for each of these items. Return ONLY a JSON array of numbers. If no price is found, return 0.
      Items:
      ${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER }
        }
      }
    });

    const prices = JSON.parse(response.text);
    return prices;
  } catch (error) {
    console.error("Gemini extraction error:", error);
    // Fallback regex extraction if AI fails
    return descriptions.map(desc => {
      const match = desc.match(/(\d+)\s*\/?-?/);
      return match ? parseInt(match[1], 10) : 0;
    });
  }
}

export async function evaluateCustomAmountRules(rows: any[], customRule: string, combineBaseRules: boolean): Promise<{ calculatedTotal: number; isMismatch: boolean; notes: string[] }[]> {
  try {
    const prompt = `You are a strict data evaluator. 
Given the user's custom rule: "${customRule}"
${combineBaseRules ? 'The row also has a "calculatedTotal" (from base rules) that should be respected or combined with the custom rule if appropriate.' : ''}

Evaluate each row and apply the rule strictly. Provide the 'calculatedTotal', whether there 'isMismatch' (boolean) compared to what the intended total should be given the rule and 'AmountToCollect', and a brief 'notes' array explaining any adjustment or mismatch reason.

Rows:
${JSON.stringify(rows.map(r => {
  const obj: any = {
    ItemType: r.ItemType,
    StoreName: r.StoreName,
    RecipientCity: r.RecipientCity,
    RecipientZone: r.RecipientZone,
    AmountToCollect: Number(r['AmountToCollect(*)'] || r.AmountToCollect),
    ItemQuantity: r.ItemQuantity,
    ItemDesc: r.ItemDesc,
    SpecialInstruction: r.SpecialInstruction,
    extractedBasePrice: r.extractedBasePrice
  };
  if (combineBaseRules) obj.calculatedTotal = r.calculatedTotal;
  return obj;
}), null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              calculatedTotal: { type: Type.NUMBER },
              isMismatch: { type: Type.BOOLEAN },
              notes: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["calculatedTotal", "isMismatch", "notes"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini eval error:", error);
    throw error;
  }
}
