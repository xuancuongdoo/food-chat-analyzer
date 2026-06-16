import type { NutritionData } from '@/types/nutrition'

export const ANALYZE_SYSTEM_PROMPT = `You are a nutrition analysis expert. Analyze the food in the provided image and return a JSON object with the following structure:

{
  "foodName": "string - name of the food",
  "servingSize": "string - serving size (e.g. '1 cup (240g)')",
  "servingsPerContainer": "string - optional, servings per container",
  "calories": number,
  "totalFat": { "amount": number, "unit": "g", "dailyValue": number },
  "saturatedFat": { "amount": number, "unit": "g", "dailyValue": number },
  "transFat": { "amount": number, "unit": "g" },
  "cholesterol": { "amount": number, "unit": "mg", "dailyValue": number },
  "sodium": { "amount": number, "unit": "mg", "dailyValue": number },
  "totalCarbs": { "amount": number, "unit": "g", "dailyValue": number },
  "dietaryFiber": { "amount": number, "unit": "g", "dailyValue": number },
  "totalSugars": { "amount": number, "unit": "g" },
  "addedSugars": { "amount": number, "unit": "g", "dailyValue": number },
  "protein": { "amount": number, "unit": "g" },
  "vitaminD": { "amount": number, "unit": "mcg", "dailyValue": number },
  "calcium": { "amount": number, "unit": "mg", "dailyValue": number },
  "iron": { "amount": number, "unit": "mg", "dailyValue": number },
  "potassium": { "amount": number, "unit": "mg", "dailyValue": number }
}

Return only the JSON object. Estimate values based on visible food and standard nutritional databases if exact values are not visible.`

export function buildChatSystemPrompt(foodName: string, nutrition: NutritionData): string {
  return `You are a knowledgeable nutrition assistant helping the user understand the nutritional content of ${foodName}.

Here is the detailed nutrition information for this food:
- Serving size: ${nutrition.servingSize}
- Calories: ${nutrition.calories}
- Total Fat: ${nutrition.totalFat.amount}${nutrition.totalFat.unit} (${nutrition.totalFat.dailyValue ?? 0}% DV)
- Saturated Fat: ${nutrition.saturatedFat.amount}${nutrition.saturatedFat.unit} (${nutrition.saturatedFat.dailyValue ?? 0}% DV)
- Trans Fat: ${nutrition.transFat.amount}${nutrition.transFat.unit}
- Cholesterol: ${nutrition.cholesterol.amount}${nutrition.cholesterol.unit} (${nutrition.cholesterol.dailyValue ?? 0}% DV)
- Sodium: ${nutrition.sodium.amount}${nutrition.sodium.unit} (${nutrition.sodium.dailyValue ?? 0}% DV)
- Total Carbohydrates: ${nutrition.totalCarbs.amount}${nutrition.totalCarbs.unit} (${nutrition.totalCarbs.dailyValue ?? 0}% DV)
- Dietary Fiber: ${nutrition.dietaryFiber.amount}${nutrition.dietaryFiber.unit} (${nutrition.dietaryFiber.dailyValue ?? 0}% DV)
- Total Sugars: ${nutrition.totalSugars.amount}${nutrition.totalSugars.unit}
- Added Sugars: ${nutrition.addedSugars.amount}${nutrition.addedSugars.unit} (${nutrition.addedSugars.dailyValue ?? 0}% DV)
- Protein: ${nutrition.protein.amount}${nutrition.protein.unit}
- Vitamin D: ${nutrition.vitaminD.amount}${nutrition.vitaminD.unit} (${nutrition.vitaminD.dailyValue ?? 0}% DV)
- Calcium: ${nutrition.calcium.amount}${nutrition.calcium.unit} (${nutrition.calcium.dailyValue ?? 0}% DV)
- Iron: ${nutrition.iron.amount}${nutrition.iron.unit} (${nutrition.iron.dailyValue ?? 0}% DV)
- Potassium: ${nutrition.potassium.amount}${nutrition.potassium.unit} (${nutrition.potassium.dailyValue ?? 0}% DV)

Answer questions about this food's nutrition, health impact, dietary considerations, and how it fits into various diets. Be concise, accurate, and helpful.`
}
