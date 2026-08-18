const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
global.crypto = webcrypto;
global.btoa ||= value => Buffer.from(value, "binary").toString("base64");

(async () => {
  const { analyzeFoodImage, listAvailableGeminiModels, PHOTO_FOOD_PROMPT, PHOTO_FOOD_RESPONSE_SCHEMA } = await import("../backend/src/gemini-adapter.js");
  const { validateProviderProposal, normalizeVisualProposal } = await import("../backend/src/schema.js");
  const { safeLog, safeStageLog } = await import("../backend/src/logging.js");
  const { runProvider } = await import("../backend/src/index.js");

  const valid = { schemaVersion: 1, items: [{ name: "pechuga de pollo", preparation: null, estimatedPortion: "normal", estimatedGrams: null, identityConfidence: .82, quantityConfidence: .35, notes: ["cantidad incierta"] }], unknownComponents: [], uncertainties: [] };
  const response = (body, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const envelope = proposal => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 80, thoughtsTokenCount: 0, totalTokenCount: 380 } });
  const diagnostics = [];
  const onDiagnostic = details => diagnostics.push(details);
  let captured;
  const result = await analyzeFoodImage(new Uint8Array([0xff, 0xd8, 0xff]), { apiKey: "test-key", onDiagnostic, fetchImpl: async (url, options) => { captured = { url, options }; return response(envelope(valid)); } });
  assert.deepEqual(result.proposal, valid, "respuesta Gemini válida");
  assert.deepEqual(result.usage, { inputTokens: 300, outputTokens: 80, thinkingTokens: 0, totalTokens: 380 });
  assert.deepEqual(diagnostics.map(item => item.stage), ["gemini_request_started", "gemini_response_received", "gemini_usage_received", "gemini_completed"], "200 válido instrumentado");
  assert.equal(diagnostics[1].providerHttpStatus, 200);
  assert.equal(diagnostics[2].usageAvailable, true);
  assert.equal(diagnostics[2].totalTokens, 380);
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

  async function rejectionCase(status, body, expectedError, expectedStage, expectedProviderStatus = null) {
    const events = [];
    await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => events.push(item), fetchImpl: async () => response(body, status) }), new RegExp(expectedError));
    assert.equal(events.at(-1).stage, expectedStage, `${status} registra ${expectedStage}`);
    assert.equal(events.at(-1).providerHttpStatus, status);
    assert.equal(events.at(-1).errorCode, expectedError);
    assert.equal(events.at(-1).providerErrorStatus || null, expectedProviderStatus);
    assert.equal(JSON.stringify(events).includes("mensaje sensible"), false, "no registra body de error");
  }
  await rejectionCase(400, { error: { status: "INVALID_ARGUMENT", message: "mensaje sensible" } }, "provider_request_failed", "gemini_request_invalid", "INVALID_ARGUMENT");
  await rejectionCase(400, { error: { status: "FAILED_PRECONDITION", message: "mensaje sensible" } }, "provider_request_failed", "gemini_billing_failed", "FAILED_PRECONDITION");
  await rejectionCase(401, { error: { status: "UNAUTHENTICATED", message: "mensaje sensible" } }, "provider_auth_failed", "gemini_auth_failed", "UNAUTHENTICATED");
  await rejectionCase(403, { error: { status: "PERMISSION_DENIED", message: "mensaje sensible" } }, "provider_auth_failed", "gemini_auth_failed", "PERMISSION_DENIED");
  await rejectionCase(404, { error: { status: "NOT_FOUND", message: "mensaje sensible" } }, "provider_model_not_found", "gemini_model_not_found", "NOT_FOUND");
  await rejectionCase(429, { error: { status: "RESOURCE_EXHAUSTED", message: "mensaje sensible" } }, "provider_rate_limit", "gemini_rate_limited", "RESOURCE_EXHAUSTED");
  await rejectionCase(500, { error: { status: "INTERNAL", message: "mensaje sensible" } }, "provider_unavailable", "gemini_provider_unavailable", "INTERNAL");
  await rejectionCase(503, { error: { status: "UNAVAILABLE", message: "mensaje sensible" } }, "provider_unavailable", "gemini_provider_unavailable", "UNAVAILABLE");
  await assert.rejects(listAvailableGeminiModels({ apiKey: "x", fetchImpl: async () => response({}, 401) }), /provider_auth_failed/, "models.list auth");
  await assert.rejects(listAvailableGeminiModels({ apiKey: "x", fetchImpl: async () => response("not-json") }), /provider_invalid_json/, "models.list JSON inválido");
  await assert.rejects(listAvailableGeminiModels({ apiKey: "x", fetchImpl: async () => response({ models: null }) }), /provider_invalid_json/, "models.list forma inválida");
  await assert.rejects(listAvailableGeminiModels({}), /gemini_disabled/, "models.list sin API key");
  let modelsUrl;
  const models = await listAvailableGeminiModels({ apiKey: "x", fetchImpl: async (url, options) => {
    modelsUrl = { url, options };
    return response({ models: [
      { name: "models/gemini-a", displayName: "Gemini A", supportedGenerationMethods: ["generateContent", "countTokens"], description: "no devolver" },
      { name: "models/gemini-b", displayName: "Gemini B", supportedGenerationMethods: ["countTokens"] },
      { name: "models/other", displayName: "Other", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-c", supportedGenerationMethods: ["generateContent", 1] }
    ] });
  } });
  assert.deepEqual(models, [
    { name: "models/gemini-a", displayName: "Gemini A", supportedGenerationMethods: ["generateContent", "countTokens"] },
    { name: "models/gemini-c", displayName: "", supportedGenerationMethods: ["generateContent"] }
  ], "models.list filtra Gemini + generateContent y devuelve solo campos permitidos");
  assert.match(modelsUrl.url, /\/models\?pageSize=1000$/);
  assert.equal(modelsUrl.options.headers["x-goog-api-key"], "x");

  let invalidJsonEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => invalidJsonEvents.push(item), fetchImpl: async () => response({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }) }), /provider_invalid_json/);
  assert.equal(invalidJsonEvents.at(-1).stage, "gemini_json_parse_failed");
  assert.equal(invalidJsonEvents.at(-1).usageAvailable, false);
  let emptyEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => emptyEvents.push(item), fetchImpl: async () => response("not-json-envelope") }), /provider_empty_response/);
  assert.equal(emptyEvents.at(-1).stage, "gemini_response_empty");
  emptyEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => emptyEvents.push(item), fetchImpl: async () => response({ candidates: [] }) }), /provider_empty_response/);
  assert.equal(emptyEvents.at(-1).stage, "gemini_response_empty");
  const schemaEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => schemaEvents.push(item), fetchImpl: async () => response(envelope({ ...valid, items: undefined })) }), /provider_schema_invalid/);
  assert.equal(schemaEvents.at(-1).stage, "gemini_schema_failed");
  let missingUsageEvents = [];
  await analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", onDiagnostic: item => missingUsageEvents.push(item), fetchImpl: async () => response({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }] }) });
  assert.equal(missingUsageEvents.find(item => item.stage === "gemini_usage_received").usageAvailable, false, "usageMetadata ausente");
  const disabledEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { onDiagnostic: item => disabledEvents.push(item) }), /gemini_disabled/);
  assert.equal(disabledEvents.at(-1).stage, "gemini_auth_failed");
  assert.equal(disabledEvents.at(-1).errorCode, "gemini_disabled");
  await assert.rejects(runProvider("gemini", new Uint8Array([1]), {}, new Request("https://test"), "success"), /gemini_disabled/);
  await assert.rejects(runProvider("unknown", new Uint8Array([1]), {}, new Request("https://test"), "success"), /invalid_provider/, "proveedor inválido");
  const controller = new AbortController(); controller.abort();
  const timeoutEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { apiKey: "x", signal: controller.signal, onDiagnostic: item => timeoutEvents.push(item), fetchImpl: async (_, options) => { if (options.signal.aborted) throw new DOMException("Aborted", "AbortError"); } }), /provider_timeout/, "cancelación");
  assert.equal(timeoutEvents.at(-1).stage, "gemini_timeout");

  const logs = []; const safe = safeLog({ requestId: "id", provider: "gemini", inputTokens: 300, outputTokens: 80, totalTokens: 380, prompt: PHOTO_FOOD_PROMPT, response: valid, image: "base64", apiKey: "secret", foods: ["pollo"] }, { log: line => logs.push(line) });
  assert.deepEqual(Object.keys(safe).sort(), ["inputTokens", "outputTokens", "provider", "requestId", "totalTokens"]);
  assert.equal(/secret|pollo|base64|observador visual/.test(logs[0]), false, "logs sin contenido sensible");
  const stageLogs = [];
  const safeStage = safeStageLog({ requestId: "id", stage: "gemini_request_invalid", provider: "gemini", model: "gemini-2.5-flash", providerHttpStatus: 400, providerErrorStatus: "INVALID_ARGUMENT", errorCode: "provider_request_failed", usageAvailable: false, prompt: PHOTO_FOOD_PROMPT, response: valid, image: "base64", apiKey: "secret", foods: ["pollo"], message: "mensaje sensible" }, { log: line => stageLogs.push(line) });
  assert.deepEqual(safeStage, { requestId: "id", stage: "gemini_request_invalid", provider: "gemini", model: "gemini-2.5-flash", providerHttpStatus: 400, providerErrorStatus: "INVALID_ARGUMENT", errorCode: "provider_request_failed", usageAvailable: false });
  assert.equal(/secret|pollo|base64|observador visual|mensaje sensible/.test(stageLogs[0]), false, "logs de stages sin contenido sensible");
  console.log("FORZA Gemini adapter tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
