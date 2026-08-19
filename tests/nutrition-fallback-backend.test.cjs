const assert = require("node:assert/strict");
const validRequest = { schemaVersion: 1, foods: [{ clientRef: "u1", label: "merluza", grams: 150 }] };
const validProposal = { schemaVersion: 1, foods: [{ clientRef: "u1", normalizedName: "Merluza", category: "fish", preparation: null, basis: "per_100g", calories: 90, protein: 18, carbs: 0, fat: 2, unitWeightGrams: null, confidenceBand: "medium" }] };
(async () => {
  const schema = await import("../backend/src/nutrition-fallback-schema.js"); const adapter = await import("../backend/src/nutrition-fallback-adapter.js");
  const limits = await import("../backend/src/limits.js");
  assert.equal(schema.validateFallbackRequest(validRequest), true); assert.equal(schema.validateFallbackRequest({ ...validRequest, foods: [] }), false);
  assert.equal(schema.validateFallbackProposal(validProposal), true); assert.equal(schema.validateFallbackProposal({ ...validProposal, foods: [{ ...validProposal.foods[0], basis: "per_portion" }] }), false);
  assert.equal(schema.validateFallbackProposal({ ...validProposal, foods: [{ ...validProposal.foods[0], carbs: null }] }), true, "desconocido se representa con null");
  const photoState = { daily: 10, monthly: 300, busy: true };
  assert.equal(limits.evaluateNutritionFallbackQuota(photoState).allowed, true, "cuota textual independiente de Photo Food");
  const fallbackLimited = { nutritionFallbackDay: new Date().toISOString().slice(0, 10), nutritionFallbackDaily: 10 };
  assert.equal(limits.evaluateNutritionFallbackQuota(fallbackLimited).error, "fallback_daily_limit");
  assert.equal(limits.evaluateNutritionFallbackQuota({ nutritionFallbackBusy: true }).error, "fallback_in_progress");
  let calls = 0; const logs = [];
  const result = await adapter.estimateUnknownFoods(validRequest, { apiKey: "test-secret", onDiagnostic: value => logs.push(value), fetchImpl: async (_url, options) => {
    calls += 1; const body = JSON.parse(options.body); assert.equal(body.contents[0].parts[0].text.includes("merluza"), true); assert.equal(options.headers["x-goog-api-key"], "test-secret");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(validProposal) }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 } }), { status: 200 });
  } });
  assert.equal(calls, 1); assert.equal(result.proposal.foods[0].basis, "per_100g");
  assert.deepEqual(logs.map(value => value.stage), ["nutrition_fallback_model_started", "nutrition_fallback_response_received", "nutrition_fallback_usage_received", "nutrition_fallback_completed"]);
  assert.equal(JSON.stringify(logs).includes("merluza"), false); assert.equal(JSON.stringify(logs).includes("test-secret"), false);
  await assert.rejects(adapter.estimateUnknownFoods(validRequest, { apiKey: "x", fetchImpl: async () => new Response("{}", { status: 429 }) }), /provider_rate_limit/);
  console.log("FORZA Nutrition fallback backend tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
