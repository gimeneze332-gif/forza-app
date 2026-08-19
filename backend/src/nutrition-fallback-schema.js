const ROOT_KEYS = ["schemaVersion", "foods"];
const REQUEST_KEYS = ["clientRef", "label", "grams"];
const RESPONSE_KEYS = ["clientRef", "normalizedName", "category", "preparation", "basis", "calories", "protein", "carbs", "fat", "unitWeightGrams", "confidenceBand"];
export const SIMPLE_CATEGORIES = Object.freeze(["fish", "meat", "egg", "dairy", "legume", "grain", "vegetable", "fruit", "nut_seed", "other_simple", "prepared_food", "commercial_product", "recipe"]);

function exact(value, keys) { const actual = Object.keys(value || {}).sort(); const expected = [...keys].sort(); return actual.length === expected.length && actual.every((key, index) => key === expected[index]); }
function finite(value, max) { return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max; }
function nullableFinite(value, max) { return value === null || finite(value, max); }
export function validateFallbackRequest(value) {
  return Boolean(value && exact(value, ROOT_KEYS) && value.schemaVersion === 1 && Array.isArray(value.foods) && value.foods.length > 0 && value.foods.length <= 4 && value.foods.every(food =>
    exact(food, REQUEST_KEYS) && /^[a-z0-9-]{1,32}$/.test(food.clientRef) && typeof food.label === "string" && food.label.trim().length >= 2 && food.label.trim().length <= 80 && finite(food.grams, 3000) && Number(food.grams) > 0));
}
export function validateFallbackProposal(value) {
  return Boolean(value && exact(value, ROOT_KEYS) && value.schemaVersion === 1 && Array.isArray(value.foods) && value.foods.length <= 4 && value.foods.every(food =>
    exact(food, RESPONSE_KEYS) && /^[a-z0-9-]{1,32}$/.test(food.clientRef) && typeof food.normalizedName === "string" && food.normalizedName.trim().length >= 2 && food.normalizedName.trim().length <= 80 &&
    SIMPLE_CATEGORIES.includes(food.category) && (food.preparation === null || typeof food.preparation === "string" && food.preparation.length <= 60) && food.basis === "per_100g" &&
    nullableFinite(food.calories, 1000) && nullableFinite(food.protein, 100) && nullableFinite(food.carbs, 100) && nullableFinite(food.fat, 100) &&
    (food.unitWeightGrams === null || finite(food.unitWeightGrams, 1000) && Number(food.unitWeightGrams) > 0) && ["low", "medium", "high"].includes(food.confidenceBand)));
}
export function normalizeFallbackProposal(value, requested) {
  if (!validateFallbackProposal(value)) throw new Error("provider_schema_invalid");
  const refs = new Set(requested.foods.map(food => food.clientRef));
  if (value.foods.length !== requested.foods.length || value.foods.some(food => !refs.has(food.clientRef))) throw new Error("provider_schema_invalid");
  return { schemaVersion: 1, foods: value.foods.map(food => ({ ...food, normalizedName: food.normalizedName.trim(), preparation: food.preparation?.trim() || null,
    calories: food.calories == null ? null : Number(food.calories), protein: food.protein == null ? null : Number(food.protein), carbs: food.carbs == null ? null : Number(food.carbs), fat: food.fat == null ? null : Number(food.fat), unitWeightGrams: food.unitWeightGrams == null ? null : Number(food.unitWeightGrams) })) };
}

export const GEMINI_FALLBACK_SCHEMA = Object.freeze({
  type: "object", additionalProperties: false, required: ROOT_KEYS,
  properties: { schemaVersion: { type: "integer", enum: [1] }, foods: { type: "array", maxItems: 4, items: {
    type: "object", additionalProperties: false, required: RESPONSE_KEYS, properties: {
      clientRef: { type: "string", maxLength: 32 }, normalizedName: { type: "string", maxLength: 80 }, category: { type: "string", enum: SIMPLE_CATEGORIES },
      preparation: { anyOf: [{ type: "string", maxLength: 60 }, { type: "null" }] }, basis: { type: "string", enum: ["per_100g"] },
      calories: { anyOf: [{ type: "number", minimum: 0, maximum: 1000 }, { type: "null" }] }, protein: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] }, carbs: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] }, fat: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
      unitWeightGrams: { anyOf: [{ type: "number", exclusiveMinimum: 0, maximum: 1000 }, { type: "null" }] }, confidenceBand: { type: "string", enum: ["low", "medium", "high"] }
    }
  } } }
});
