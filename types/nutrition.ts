export interface NutrientValue {
  amount: number
  unit: string
  dailyValue?: number
}

export interface NutritionData {
  foodName: string
  servingSize: string
  servingsPerContainer?: string
  calories: number
  totalFat: NutrientValue
  saturatedFat: NutrientValue
  transFat: { amount: number; unit: string }
  cholesterol: NutrientValue
  sodium: NutrientValue
  totalCarbs: NutrientValue
  dietaryFiber: NutrientValue
  totalSugars: { amount: number; unit: string }
  addedSugars: NutrientValue
  protein: { amount: number; unit: string }
  vitaminD: NutrientValue
  calcium: NutrientValue
  iron: NutrientValue
  potassium: NutrientValue
}
