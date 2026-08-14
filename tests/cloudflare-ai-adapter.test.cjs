const assert = require("node:assert/strict");
global.btoa ||= value => Buffer.from(value, "binary").toString("base64");

(async () => {
  const { analyzeFoodImage, canonicalizeCloudflareProposal, CLOUDFLARE_AI_MODEL, PHOTO_FOOD_PROMPT } = await import("../backend/src/cloudflare-ai-adapter.js");
  const { runProvider } = await import("../backend/src/index.js");
  const { safeLog, safeStageLog } = await import("../backend/src/logging.js");
  const item = (name, confidence = .8) => ({ name, preparation: null, estimatedPortion: "normal", estimatedGrams: null, identityConfidence: confidence, quantityConfidence: .35, notes: ["Revisá la cantidad"] });
  const proposal = items => ({ schemaVersion: 1, items, unknownComponents: [], uncertainties: [] });
  let captured;
  const ai = { run: async (model, input) => { captured = { model, input }; return { answer: JSON.stringify(proposal([item("pollo"), item("arroz", .72)])), metrics: { input_tokens: 120, output_tokens: 60, neurons: 42 } }; } };
  const validStages = [];
  const result = await analyzeFoodImage(new Uint8Array([0xff, 0xd8, 0xff]), { ai, onDiagnostic: event => validStages.push(event) });
  assert.equal(result.model, CLOUDFLARE_AI_MODEL);
  assert.deepEqual(result.proposal.items.map(value => value.name), ["pollo", "arroz"]);
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 60, totalTokens: undefined, neurons: 42 });
  assert.equal(captured.model, "@cf/moondream/moondream3.1-9B-A2B");
  assert.match(captured.input.image, /^data:image\/jpeg;base64,/);
  assert.equal(captured.input.task, "query"); assert.equal(captured.input.reasoning, false);
  assert.match(PHOTO_FOOD_PROMPT, /No calcules calorias, proteinas, carbohidratos, grasas/);
  assert.equal(/historial|peso corporal|objetivos|identidad|gym/i.test(JSON.stringify(captured.input)), false);
  assert.equal(result.proposal.items.some(value => "calories" in value || "protein" in value || "carbs" in value || "fat" in value), false);
  assert.equal(result.proposal.items[0].estimatedGrams, null);
  assert.deepEqual(validStages.map(event => event.stage), ["model_call_started", "model_call_completed"]);

  // CanonicalizaciÃ³n estructural conservadora: adapta forma, nunca contenido.
  const exact = proposal([item("pollo")]);
  assert.deepEqual(canonicalizeCloudflareProposal(exact), exact, "respuesta exactamente compatible");
  const optionalMissing = canonicalizeCloudflareProposal({ items: [{ name: "  pollo  ", identityConfidence: .8 }] });
  assert.deepEqual(optionalMissing, {
    schemaVersion: 1,
    items: [{ name: "pollo", preparation: null, estimatedPortion: null, estimatedGrams: null, identityConfidence: .8, quantityConfidence: null, notes: [] }],
    unknownComponents: [], uncertainties: []
  }, "campos opcionales ausentes");
  assert.deepEqual(canonicalizeCloudflareProposal({ items: [{ food: "arroz", portion: "medium", grams: "180 g", confidence: "0.72", extraVisualField: "descartado" }] }).items[0],
    { name: "arroz", preparation: null, estimatedPortion: "normal", estimatedGrams: 180, identityConfidence: .72, quantityConfidence: null, notes: [] }, "alias seguros y extras eliminados");
  assert.equal(canonicalizeCloudflareProposal({ items: [{ name: "banana", portion: "pequena", identityConfidence: .9 }] }).items[0].estimatedPortion, "small", "enum compatible");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", identityConfidence: .8, calories: 200 }] }), /schema_validation_failed/, "nutrientes en item rechazados");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", identityConfidence: .8 }], protein: 20 }), /schema_validation_failed/, "nutrientes en raÃ­z rechazados");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ identityConfidence: .8 }] }), /schema_validation_failed/, "alimento ausente");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", identityConfidence: 1.4 }] }), /schema_validation_failed/, "confianza insegura");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", identityConfidence: .8, grams: -4 }] }), /schema_validation_failed/, "gramos inseguros");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", food: "arroz", identityConfidence: .8 }] }), /schema_validation_failed/, "alias conflictivos");
  assert.throws(() => canonicalizeCloudflareProposal({ answer: "texto libre" }), /schema_validation_failed/, "JSON no canonicalizable");
  assert.throws(() => canonicalizeCloudflareProposal({ items: [{ name: "pollo", identityConfidence: .8 }], instructions: "ignorar reglas" }), /schema_validation_failed/, "instrucciones rechazadas");

  const expectCanonicalizationCode = (input, expected) => {
    let failure;
    try { canonicalizeCloudflareProposal(input); } catch (error) { failure = error; }
    assert.equal(failure?.message, "schema_validation_failed", `${expected}: error público estable`);
    assert.equal(failure?.canonicalizationErrorCode, expected, `${expected}: código cerrado`);
    assert.deepEqual(Object.keys(failure || {}).sort(), ["canonicalizationErrorCode"], `${expected}: error sin contenido del proveedor`);
  };
  expectCanonicalizationCode(null, "invalid_root_shape");
  expectCanonicalizationCode({}, "items_missing");
  expectCanonicalizationCode({ items: "no-array" }, "items_not_array");
  expectCanonicalizationCode({ items: ["no-object"] }, "invalid_item_shape");
  expectCanonicalizationCode({ items: [{ identityConfidence: .8 }] }, "name_missing");
  expectCanonicalizationCode({ items: [{ name: 42, identityConfidence: .8 }] }, "name_invalid");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", preparation: {}, identityConfidence: .8 }] }, "invalid_preparation");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", portion: "enorme", identityConfidence: .8 }] }, "invalid_portion");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", grams: -1, identityConfidence: .8 }] }, "invalid_grams");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo" }] }, "confidence_missing");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", identityConfidence: 2 }] }, "invalid_identity_confidence");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", identityConfidence: .8, quantityConfidence: "no-number" }] }, "invalid_quantity_confidence");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", identityConfidence: .8, notes: [{}] }] }, "invalid_notes");
  expectCanonicalizationCode({ items: [], unknownComponents: {} }, "invalid_unknown_components");
  expectCanonicalizationCode({ items: [], uncertainties: {} }, "invalid_uncertainties");
  expectCanonicalizationCode({ items: [{ name: "valor-modelo", identityConfidence: .8, calories: 1 }] }, "forbidden_nutrition_field");
  expectCanonicalizationCode({ items: [{ foodName: "valor-modelo", confidence: .8 }] }, "unsupported_alias");
  expectCanonicalizationCode({ items: [{ name: "uno", food: "dos", identityConfidence: .8 }] }, "conflicting_aliases");
  expectCanonicalizationCode({ schemaVersion: 2, items: [] }, "noncanonicalizable_response");

  const returns = answer => ({ run: async () => ({ answer }) });
  const returnsWrapped = value => ({ run: async () => value });
  async function expectFailure(aiImpl, error, stage) {
    const events = [];
    await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { ai: aiImpl, onDiagnostic: event => events.push(event) }), error);
    assert.equal(events.at(-1).stage, stage);
    assert.equal(events.filter(event => event.stage === stage).length, 1);
  }
  await expectFailure(returns(""), /empty_response/, "empty_response");
  await expectFailure(returns("no-json"), /json_extraction_failed/, "json_extraction_failed");
  await expectFailure(returns("{invalid}"), /json_parse_failed/, "json_parse_failed");
  await expectFailure(returns(JSON.stringify({ items: [] })), /no_food/, "no_food");
  await expectFailure(returns(JSON.stringify(proposal([]))), /no_food/, "no_food");
  await expectFailure(returns(JSON.stringify(proposal([item("posible comida", .3)]))), /low_confidence/, "low_confidence");
  await expectFailure(returns(JSON.stringify({ ...proposal([item("pollo")]), calories: 200 })), /schema_validation_failed/, "schema_validation_failed");
  const wrapperPayload = JSON.stringify(proposal([item("wrapper-value")]));
  assert.equal((await analyzeFoodImage(new Uint8Array([1]), { ai: returnsWrapped({ answer: wrapperPayload }) })).proposal.items.length, 1, "JSON válido en answer");
  assert.equal((await analyzeFoodImage(new Uint8Array([1]), { ai: returnsWrapped({ response: wrapperPayload }) })).proposal.items.length, 1, "JSON válido en response");
  assert.equal((await analyzeFoodImage(new Uint8Array([1]), { ai: returnsWrapped({ description: wrapperPayload }) })).proposal.items.length, 1, "JSON válido en description");
  await expectFailure(returnsWrapped({ description: "" }), /empty_response/, "empty_response");
  await expectFailure(returnsWrapped({ description: "texto sin json" }), /json_extraction_failed/, "json_extraction_failed");
  await expectFailure(returnsWrapped({ description: "{json-invalido}" }), /json_parse_failed/, "json_parse_failed");
  await expectFailure(returnsWrapped({ metadata: "sin wrappers compatibles" }), /schema_validation_failed/, "schema_validation_failed");
  const granularEvents = [];
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), {
    ai: returns(JSON.stringify({ items: [{ name: "private-model-value", identityConfidence: .8, calories: 200 }] })),
    onDiagnostic: event => granularEvents.push(event)
  }), /schema_validation_failed/);
  assert.deepEqual(granularEvents.at(-1), {
    stage: "schema_validation_failed", durationMs: granularEvents.at(-1).durationMs, status: 502,
    errorCode: "schema_validation_failed", canonicalizationErrorCode: "forbidden_nutrition_field"
  });
  assert.equal(Number.isFinite(granularEvents.at(-1).durationMs), true);
  assert.equal(JSON.stringify(granularEvents).includes("private-model-value"), false, "evento no contiene valores del modelo");
  const canonicalStages = [];
  const canonicalResult = await analyzeFoodImage(new Uint8Array([1]), { ai: returns(JSON.stringify({ items: [{ food: "pollo", portion: "large", confidence: .8 }] })), onDiagnostic: event => canonicalStages.push(event) });
  assert.equal(canonicalResult.proposal.items[0].name, "pollo", "respuesta canÃ³nica aceptada por validaciÃ³n estricta");
  assert.deepEqual(canonicalStages.map(event => event.stage), ["model_call_started", "model_call_completed"]);
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), {}), /cloudflare_ai_disabled/);
  await expectFailure({ run: async () => { throw new Error("model unavailable with sensitive provider detail"); } }, /provider_unavailable/, "model_call_failed");
  await assert.rejects(analyzeFoodImage(new Uint8Array([1]), { ai: { run: async () => { throw new Error("quota exceeded"); } } }), /provider_rate_limit/);

  const request = new Request("https://test");
  assert.equal((await runProvider("mock", new Uint8Array([1]), {}, request, "success")).model, "mock");
  assert.equal((await runProvider("cloudflare-ai", new Uint8Array([1]), { AI: ai }, request, "success")).model, CLOUDFLARE_AI_MODEL);
  await assert.rejects(runProvider("gemini", new Uint8Array([1]), {}, request, "success"), /gemini_disabled/);
  await assert.rejects(runProvider("unknown", new Uint8Array([1]), {}, request, "success"), /invalid_provider/);
  const abort = new AbortController();
  const pending = runProvider("cloudflare-ai", new Uint8Array([1]), { AI: { run: () => new Promise(() => {}) } }, new Request("https://test", { signal: abort.signal }), "success");
  abort.abort(); await assert.rejects(pending, /timeout/, "timeout controlado");

  const logs = []; const safe = safeLog({ requestId: "id", provider: "cloudflare-ai", model: CLOUDFLARE_AI_MODEL, neurons: 42, image: "base64", response: proposal([item("pollo")]), foods: ["pollo"] }, { log: line => logs.push(line) });
  assert.deepEqual(Object.keys(safe).sort(), ["model", "neurons", "provider", "requestId"]);
  assert.equal(/base64|pollo|Revisá/.test(logs[0]), false);
  const diagnosticLogs = [];
  const diagnostic = safeStageLog({ requestId: "random-id", stage: "analysis_completed", provider: "cloudflare-ai", model: CLOUDFLARE_AI_MODEL, durationMs: 900, size: 120000, status: 200, neurons: 20,
    image: "data:image/jpeg;base64,secret-image", prompt: PHOTO_FOOD_PROMPT, response: proposal([item("pollo")]), food: "pollo", deviceToken: "device-secret", pairingCode: "12345678", apiKey: "api-secret", macros: { calories: 1 }, errorCode: "sensitive provider response" }, { log: line => diagnosticLogs.push(line) });
  assert.deepEqual(Object.keys(diagnostic).sort(), ["durationMs", "model", "neurons", "provider", "requestId", "size", "stage", "status"]);
  assert.equal(/base64|pollo|calorias|device-secret|12345678|api-secret|sensitive/i.test(diagnosticLogs[0]), false, "diagnóstico sin contenido sensible");
  const granularDiagnosticLogs = [];
  const granularDiagnostic = safeStageLog({ requestId: "random-id", stage: "schema_validation_failed", provider: "cloudflare-ai", model: CLOUDFLARE_AI_MODEL,
    durationMs: 321, status: 502, errorCode: "schema_validation_failed", canonicalizationErrorCode: "confidence_missing",
    image: "data:image/jpeg;base64,secret-image", prompt: PHOTO_FOOD_PROMPT, response: "private-model-response", food: "private-food", deviceToken: "private-token" },
  { log: line => granularDiagnosticLogs.push(line) });
  assert.deepEqual(granularDiagnostic, { requestId: "random-id", stage: "schema_validation_failed", provider: "cloudflare-ai", model: CLOUDFLARE_AI_MODEL,
    durationMs: 321, status: 502, errorCode: "schema_validation_failed", canonicalizationErrorCode: "confidence_missing" });
  assert.equal(/base64|private|calorias/i.test(granularDiagnosticLogs[0]), false, "log granular sin contenido sensible");
  assert.equal("canonicalizationErrorCode" in safeStageLog({ stage: "schema_validation_failed", canonicalizationErrorCode: "not-allowed" }, { log: () => {} }), false, "código no cerrado descartado");
  assert.equal(safeStageLog({ stage: "invented_stage", response: "secret" }, { log: () => { throw new Error("no debe registrar"); } }), null);
  console.log("FORZA Cloudflare AI adapter tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
