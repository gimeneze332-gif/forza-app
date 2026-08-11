const SUCCESS = { items: [
  { name: "pechuga de pollo", preparation: "a la plancha", estimatedPortion: "normal", estimatedGrams: 150, foodConfidence: .91, quantityConfidence: .66, notes: "cantidad aproximada" },
  { name: "arroz cocido", preparation: null, estimatedPortion: "normal", estimatedGrams: 180, foodConfidence: .9, quantityConfidence: .61, notes: "cantidad aproximada" }
], uncertainties: [] };

export async function analyzeMock(scenario = "success") {
  if (scenario === "error") throw new Error("mock_error");
  if (scenario === "timeout") await new Promise(resolve => setTimeout(resolve, 15000));
  if (scenario === "invalid-response") return { foods: "invalid" };
  if (scenario === "low-confidence") return { items: [{ name: "posible guiso", preparation: null, estimatedPortion: "normal", estimatedGrams: null, foodConfidence: .34, quantityConfidence: .2, notes: "identificación poco segura" }], uncertainties: ["Preparación poco clara."] };
  if (scenario === "unknown") return { items: [{ name: "componente sin identificar", preparation: null, estimatedPortion: null, estimatedGrams: null, foodConfidence: .2, quantityConfidence: null, notes: "requiere identificación" }], uncertainties: ["Componente desconocido."] };
  return structuredClone(SUCCESS);
}
