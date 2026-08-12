const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
global.crypto = webcrypto;
global.btoa ||= value => Buffer.from(value, "binary").toString("base64");

(async () => {
  const { analyzeFoodImage, PHOTO_FOOD_PROMPT, PHOTO_FOOD_RESPONSE_SCHEMA } = await import("../backend/src/gemini-adapter.js");
  const { validateProviderProposal, normalizeVisualProposal } = await import("../backend/src/schema.js");
  const { safeLog } = await import("../backend/src/logging.js");
  const { runProvider } = await import("../backend/src/index.js");

  const valid = { schemaVersion: 1, items: [{ name: "pechuga de pollo", preparation: null, estimatedPortion: "normal", estimatedGrams: null, identityConfidence: .82, quantityConfidence: .35, notes: ["cantidad incierta"] }], unknownComponents: [], uncertainties: [] };
  const response = (body, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const envelope = proposal => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 80, thoughtsTokenCount: 0, totalTokenCount: 380 } });
  let captured;
  const result = await analyzeFoodImage(new Uint8Array([0xff, 0xd8, 0xff]), { apiKey: "test-key", fetchImpl: async (url, options) => { captured = { url, options }; return response(envelope(valid)); } });
  assert.deepEqual(result.proposal, valid, "respuesta Gemini válida");
  assert.deepEqual(result.usage, { inputTokens: 300, outputTokens: 80, thinkingTokens: 0, totalTokens: 380 });
  assert.match(captured.url, /gemini-2\.5-flash:generateContent$/);
  assert.equal(captured.options.headers["x-goog-api-key"], "test-key");
  const sent = JSON.parse(captured.options.body);
  assert.equal(sent.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(sent.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(sent.generationConfig.responseJsonSchema, PHOTO_FOOD_RESPONSE_SCHEMA);
  assert.equal(/calorías|proteína|carbohidratos|grasas/.test(PHOTO_FOOD_PROMPT), true);
  assert.equal(/nombre del usuario|email|entrenamiento del usuario/i.test(captured.options.body), false);

  assert.equal(validateProviderProposal(valid), true);
  assert.equal(validateProviderProposal({ ...valid, extra: true }), false, "campo inesperado");
  assert.equal(validateProviderProposal({ ...valid, items: undefined }), false, "ausencia de items");
  assert.equal(validateProviderProposal({ ...valid, items: [{ ...valid.items[0], preparation: null, estimatedGrams: null }] }), true);
  assert.equal(validateProviderProposal({ ...valid, items: [], unknownComponents: ["componente no identificado"] }), true, "alimentos desconocidos");
  assert.equal(validateProviderProposal({ ...valid, items: [{ ...valid.items[0], identityConfidence: .2 }] }), true, "baja confianza");
  assert.equal(validateProviderProposal({ schemaVersion: 1, items: [], unknownComponents: [], uncertainties: [] }), true, "foto sin comida");
  assert.throws(() => normalizeVisualProposal({ ...valid, unexpected: true }), /invalid_provider_response/, "schema inválido");

  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", fetchImpl: async () => response({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }) }), /provider_invalid_json/);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", fetchImpl: async () => response("not-json-envelope") }), /provider_empty_response/);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", fetchImpl: async () => response({ candidates: [] }) }), /provider_empty_response/);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", fetchImpl: async () => response({}, 429) }), /provider_rate_limit/);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", fetchImpl: async () => response({}, 500) }), /provider_unavailable/);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), {}), /gemini_disabled/);
  await assert.rejects(runProvider("gemini", new Uint8Array([1]), {}, new Request("https://test"), "success"), /gemini_disabled/);
  await assert.rejects(runProvider("unknown", new Uint8Array([1]), {}, new Request("https://test"), "success"), /invalid_provider/, "proveedor inválido");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", signal: controller.signal, fetchImpl: async (_, options) => { if (options.signal.aborted) throw new DOMException("Aborted", "AbortError"); } }), /Aborted/, "cancelación");

  const logs = []; const safe = safeLog({ requestId: "id", provider: "gemini", inputTokens: 300, outputTokens: 80, totalTokens: 380, prompt: PHOTO_FOOD_PROMPT, response: valid, image: "base64", apiKey: "secret", foods: ["pollo"] }, { log: line => logs.push(line) });
  assert.deepEqual(Object.keys(safe).sort(), ["inputTokens", "outputTokens", "provider", "requestId", "totalTokens"]);
  assert.equal(/secret|pollo|base64|observador visual/.test(logs[0]), false, "logs sin contenido sensible");
  console.log("FORZA Gemini adapter tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
