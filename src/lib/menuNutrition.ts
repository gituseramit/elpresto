import type { MenuItem } from "@/store/useCartStore";

type NutritionProfileInput = Pick<MenuItem, "name" | "description"> &
  Partial<Pick<MenuItem, "ingredients" | "ingredientsConfirmed" | "allergens" | "allergensConfirmed" | "nutritionFacts" | "nutritionFactsConfirmed">>;

const ingredientMentions = [
  { label: "Whole-wheat flour", pattern: /whole[ -]wheat|stone[ -]ground|\batta\b/i },
  { label: "Paneer", pattern: /\bpaneer\b/i },
  { label: "Mozzarella / cheese", pattern: /\bmozzarella\b|\bcheese\b/i },
  { label: "Soya", pattern: /\bsoya\b|\bsoy\b/i },
  { label: "Sattu / roasted gram", pattern: /\bsattu\b|roasted gram/i },
  { label: "Corn", pattern: /\bcorn\b/i },
  { label: "Rice", pattern: /\brice\b/i },
  { label: "Beans / chickpeas", pattern: /\bbeans?\b|\bchickpeas?\b|\bchana\b/i },
  { label: "Bread / bun", pattern: /\bbread\b|\bbun\b|\bsub\b/i },
  { label: "Potato", pattern: /\bpotato(?:es)?\b|\bfries\b/i },
  { label: "Onion", pattern: /\bonions?\b/i },
  { label: "Capsicum / bell peppers", pattern: /\bcapsicum\b|\bbell peppers?\b|\bsweet peppers?\b/i },
  { label: "Tomato", pattern: /\btomatoes?\b/i },
  { label: "Mushroom", pattern: /\bmushrooms?\b/i },
  { label: "Lettuce", pattern: /\blettuce\b/i },
  { label: "Vegetables", pattern: /\bvegetables?\b|\bveggies\b/i },
  { label: "Herbs", pattern: /\bherbs?\b|\bbasil\b|\boregano\b/i },
];

function toIngredientList(value?: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

export function getMenuNutritionProfile(item: NutritionProfileInput) {
  const declaredIngredients = toIngredientList(item.ingredients);
  const evidence = declaredIngredients.length
    ? declaredIngredients.join(" ")
    : `${item.name} ${item.description || ""}`;
  const ingredients = declaredIngredients.length
    ? declaredIngredients
    : ingredientMentions.filter(({ pattern }) => pattern.test(evidence)).map(({ label }) => label);

  const has = (pattern: RegExp) => pattern.test(evidence);
  const carbohydrates = [
    has(/whole[ -]wheat|stone[ -]ground|\batta\b/i) ? "Whole-wheat base" : "",
    has(/\bcorn\b/i) ? "Corn" : "",
    has(/\brice\b/i) ? "Rice" : "",
    has(/\bbread\b|\bbun\b|\bsub\b/i) ? "Bread or bun" : "",
    has(/\bpotato(?:es)?\b|\bfries\b/i) ? "Potato" : "",
    has(/\bsattu\b|roasted gram|\bchickpeas?\b|\bchana\b/i) ? "Sattu or chickpeas" : "",
  ].filter(Boolean);
  const protein = [
    has(/whole[ -]wheat|stone[ -]ground|\batta\b/i) ? "Whole-wheat flour" : "",
    has(/\bpaneer\b/i) ? "Paneer" : "",
    has(/\bmozzarella\b|\bcheese\b/i) ? "Cheese" : "",
    has(/\bsoya\b|\bsoy\b/i) ? "Soya" : "",
    has(/\bsattu\b|roasted gram|\bbeans?\b|\bchickpeas?\b|\bchana\b/i) ? "Sattu or pulses" : "",
  ].filter(Boolean);
  const fiber = [
    has(/whole[ -]wheat|stone[ -]ground|\batta\b/i) ? "Whole-wheat flour" : "",
    has(/\bcorn\b/i) ? "Corn" : "",
    has(/\bonions?\b|\bcapsicum\b|\bbell peppers?\b|\bsweet peppers?\b|\btomatoes?\b|\bmushrooms?\b|\blettuce\b|\bvegetables?\b|\bveggies\b/i)
      ? "Vegetable toppings" : "",
    has(/\bsattu\b|roasted gram|\bbeans?\b|\bchickpeas?\b|\bchana\b/i) ? "Sattu or pulses" : "",
  ].filter(Boolean);

  const hasServingSize = Boolean(item.nutritionFacts?.servingSize?.trim());
  const hasNutritionValues = Boolean(item.nutritionFacts && [
    item.nutritionFacts.calories,
    item.nutritionFacts.carbsG,
    item.nutritionFacts.proteinG,
    item.nutritionFacts.fatG,
    item.nutritionFacts.fiberG,
    item.nutritionFacts.sodiumMg,
  ].some((value) => typeof value === "number" && Number.isFinite(value) && value >= 0));
  const facts = item.nutritionFactsConfirmed && hasServingSize && hasNutritionValues
    ? item.nutritionFacts
    : undefined;
  const allergens = toIngredientList(item.allergens);

  return {
    ingredients,
    hasDeclaredIngredients: declaredIngredients.length > 0,
    ingredientsConfirmed: declaredIngredients.length > 0 && item.ingredientsConfirmed === true,
    allergens,
    allergensConfirmed: allergens.length > 0 && item.allergensConfirmed === true,
    carbohydrates,
    protein,
    fiber,
    facts,
  };
}
