const assert = require("node:assert/strict");
const fs = require("node:fs");
const { webcrypto } = require("node:crypto");
global.crypto = webcrypto;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
}

(async () => {
  const deploymentConfig = fs.readFileSync("backend/wrangler.jsonc", "utf8");
  assert.match(deploymentConfig, /"BACKEND_ENABLED":\s*"true"/);
  assert.match(deploymentConfig, /"PHOTO_ANALYSIS_ENABLED":\s*"true"/);
  assert.match(deploymentConfig, /"PHOTO_FOOD_PROVIDER":\s*"gemini"/);
  assert.match(deploymentConfig, /"observability":\s*\{[\s\S]*?"enabled":\s*true/);
  assert.match(deploymentConfig, /"invocation_logs":\s*false/);
  const { createHandler } = await import("../backend/src/index.js");
  const { PhotoFoodState } = await import("../backend/src/photo-food-state.js");
  const { safeLog } = await import("../backend/src/logging.js");
  const storage = new MemoryStorage();
  const durable = new PhotoFoodState({ storage });
  const env = {
    BACKEND_ENABLED: "true", PHOTO_ANALYSIS_ENABLED: "false", ALLOWED_ORIGIN: "https://gimeneze332-gif.github.io", PAIRING_ADMIN_SECRET: "admin-test-only",
    PHOTO_FOOD_STATE: { idFromName: () => "personal", get: () => ({ fetch: (url, init) => durable.fetch(new Request(url, init)) }) }
  };
  const handle = createHandler();
  const origin = env.ALLOWED_ORIGIN;
  const call = (path, init = {}) => handle(new Request(`https://worker.test${path}`, { method: "POST", ...init, headers: { origin, ...(init.headers || {}) } }), env);

  let response = await handle(new Request("https://worker.test/health", { method: "GET", headers: { origin } }), env);
  assert.equal(response.status, 200, "healthcheck disponible con backend habilitado");
  assert.deepEqual(await response.json(), { status: "ok", analysisEnabled: false, provider: "mock" });
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: "Bearer no-token", "content-type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) })).status, 503, "análisis apagado responde 503");

  const originalFetch = global.fetch;
  try {
    env.GEMINI_API_KEY = "gemini-secret-test";
    global.fetch = async (url, options) => {
      assert.match(String(url), /generativelanguage\.googleapis\.com\/v1beta\/models\?pageSize=1000/);
      assert.equal(options.headers["x-goog-api-key"], "gemini-secret-test");
      return new Response(JSON.stringify({ models: [
        { name: "models/gemini-visible", displayName: "Gemini Visible", supportedGenerationMethods: ["generateContent"], description: "no devolver" },
        { name: "models/gemini-hidden", displayName: "Gemini Hidden", supportedGenerationMethods: ["countTokens"] },
        { name: "models/not-gemini", displayName: "Other", supportedGenerationMethods: ["generateContent"] }
      ] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const adminLogs = []; const originalConsoleLog = console.log;
    try {
      console.log = line => adminLogs.push(String(line));
      response = await handle(new Request("https://worker.test/admin/gemini/models", { method: "GET", headers: { origin, authorization: "Bearer admin-test-only" } }), env);
    } finally { console.log = originalConsoleLog; }
    assert.equal(response.status, 200, "admin models auth válida");
    assert.deepEqual(await response.json(), [{ name: "models/gemini-visible", displayName: "Gemini Visible", supportedGenerationMethods: ["generateContent"] }], "admin models devuelve solo campos permitidos filtrados");
    assert.equal(/gemini-secret-test|description|no devolver/.test(adminLogs.join("\n")), false, "admin logs sin secreto ni raw response");
    assert.match(adminLogs.join("\n"), /"modelCount":1/);
    assert.equal((await handle(new Request("https://worker.test/admin/gemini/models", { method: "GET", headers: { origin, authorization: "Bearer bad" } }), env)).status, 403, "admin models auth inválida");
    delete env.GEMINI_API_KEY;
    assert.equal((await handle(new Request("https://worker.test/admin/gemini/models", { method: "GET", headers: { origin, authorization: "Bearer admin-test-only" } }), env)).status, 503, "admin models sin API key");
    env.GEMINI_API_KEY = "gemini-secret-test";
    global.fetch = async () => new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "no registrar" } }), { status: 400, headers: { "content-type": "application/json" } });
    response = await handle(new Request("https://worker.test/admin/gemini/models", { method: "GET", headers: { origin, authorization: "Bearer admin-test-only" } }), env);
    assert.equal(response.status, 502, "admin models error Google");
    global.fetch = async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
    response = await handle(new Request("https://worker.test/admin/gemini/models", { method: "GET", headers: { origin, authorization: "Bearer admin-test-only" } }), env);
    assert.equal(response.status, 502, "admin models respuesta inválida");
    assert.equal((await handle(new Request("https://worker.test/admin/gemini/models", { method: "POST", headers: { origin, authorization: "Bearer admin-test-only" } }), env)).status, 405, "admin models solo GET");
  } finally {
    global.fetch = originalFetch;
    delete env.GEMINI_API_KEY;
  }

  response = await call("/pairing/create", { headers: { authorization: "Bearer admin-test-only" } });
  assert.equal(response.status, 200, "pairing válido");
  const pairing = await response.json(); assert.match(pairing.code, /^\d{8}$/);
  response = await call("/pairing/claim", { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: pairing.code }) });
  assert.equal(response.status, 200, "pairing permitido con análisis apagado"); const token = (await response.json()).token; assert.equal(typeof token, "string");
  assert.equal((await call("/pairing/claim", { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: pairing.code }) })).status, 410, "pairing usado");

  await durable.fetch(new Request("https://state.internal/pairing/create", { method: "POST" }));
  const expiredState = await storage.get("state"); expiredState.pairingExpiresAt = Date.now() - 1; await storage.put("state", expiredState);
  assert.equal((await call("/pairing/claim", { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "00000000" }) })).status, 410, "pairing vencido");

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const analyze = auth => call("/photo-food/analyze", { headers: { authorization: `Bearer ${auth}`, "content-type": "image/jpeg" }, body: jpeg });
  env.PHOTO_ANALYSIS_ENABLED = "true";
  assert.equal((await analyze("bad-token")).status, 401, "token inválido");

  // Restore a valid token through a fresh pairing.
  response = await call("/pairing/create", { headers: { authorization: "Bearer admin-test-only" } }); const code2 = (await response.json()).code;
  response = await call("/pairing/claim", { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code2 }) }); const validToken = (await response.json()).token;
  const diagnosticLines = []; const originalConsoleLog = console.log; let validAnalysis;
  try { console.log = line => diagnosticLines.push(String(line)); validAnalysis = await analyze(validToken); }
  finally { console.log = originalConsoleLog; }
  assert.equal(validAnalysis.status, 200, "token válido");
  const diagnosticStages = diagnosticLines.map(line => { try { return JSON.parse(line).stage; } catch (_) { return null; } }).filter(Boolean);
  assert.deepEqual(diagnosticStages, ["request_received", "normalization_completed", "analysis_completed"], "respuesta válida completa el diagnóstico");

  let quotaState = await storage.get("state"); quotaState.daily = 9; quotaState.day = new Date().toISOString().slice(0, 10); quotaState.monthly = 299; quotaState.month = new Date().toISOString().slice(0, 7); quotaState.perMinute = 0; quotaState.busy = false; await storage.put("state", quotaState);
  assert.equal((await analyze(validToken)).status, 200, "el análisis diario 10 y mensual 300 todavía se aceptan");
  let state = await storage.get("state"); state.daily = 10; state.day = new Date().toISOString().slice(0, 10); state.perMinute = 0; state.busy = false; await storage.put("state", state);
  assert.equal((await analyze(validToken)).status, 429, "análisis 11 rechazado");
  env.PHOTO_FOOD_PROVIDER = "gemini"; env.GEMINI_API_KEY = "gemini-secret-test";
  let geminiCallsAfterLimit = 0;
  global.fetch = async () => { geminiCallsAfterLimit += 1; return new Response("{}", { status: 200 }); };
  assert.equal((await analyze(validToken)).status, 429, "límite diario se aplica antes de Gemini");
  assert.equal(geminiCallsAfterLimit, 0, "Gemini no se llama si no hay cuota");
  env.PHOTO_FOOD_PROVIDER = "mock"; delete env.GEMINI_API_KEY; global.fetch = originalFetch;
  state = await storage.get("state"); state.daily = 0; state.monthly = 300; state.month = new Date().toISOString().slice(0, 7); state.perMinute = 0; await storage.put("state", state);
  assert.equal((await analyze(validToken)).status, 429, "límite mensual 300");
  state = await storage.get("state"); state.monthly = 0; state.busy = true; await storage.put("state", state);
  assert.equal((await analyze(validToken)).status, 429, "una simultánea");
  state.busy = false; state.perMinute = 4; state.minute = new Date().toISOString().slice(0, 16); await storage.put("state", state);
  assert.equal((await analyze(validToken)).status, 429, "rate limit por minuto");

  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${validToken}`, "content-type": "text/plain" }, body: "x" })).status, 415);
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${validToken}`, "content-type": "image/jpeg", "content-length": String(800000) }, body: jpeg })).status, 413);
  state = await storage.get("state"); state.perMinute = 0; state.busy = false; await storage.put("state", state);
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${validToken}`, "content-type": "image/jpeg" }, body: new Uint8Array([1, 2, 3, 4]) })).status, 400, "imagen inválida");

  assert.equal((await handle(new Request("https://worker.test/photo-food/analyze", { method: "GET", headers: { origin } }), env)).status, 405);
  assert.equal((await handle(new Request("https://worker.test/photo-food/analyze", { method: "OPTIONS", headers: { origin } }), env)).status, 204);
  assert.equal((await handle(new Request("https://worker.test/photo-food/analyze", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), env)).status, 403);
  env.PHOTO_ANALYSIS_ENABLED = "false"; assert.equal((await analyze(validToken)).status, 503, "kill switch exclusivo del análisis");
  assert.equal((await call("/device/revoke", { headers: { authorization: `Bearer ${validToken}` } })).status, 200, "revocación sigue disponible con análisis apagado");
  env.PHOTO_ANALYSIS_ENABLED = "true";

  // Pair another device after the revocation so remaining provider tests stay authorized.
  response = await call("/pairing/create", { headers: { authorization: "Bearer admin-test-only" } }); const code3 = (await response.json()).code;
  response = await call("/pairing/claim", { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code3 }) }); const providerToken = (await response.json()).token;

  state = await storage.get("state"); state.perMinute = 0; state.busy = false; state.daily = 0; state.monthly = 0; await storage.put("state", state);
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${providerToken}`, "content-type": "image/jpeg", "x-photo-food-mock-scenario": "error" }, body: jpeg })).status, 503, "error mock");
  state = await storage.get("state"); state.perMinute = 0; await storage.put("state", state);
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${providerToken}`, "content-type": "image/jpeg", "x-photo-food-mock-scenario": "invalid-response" }, body: jpeg })).status, 502, "respuesta inválida");
  state = await storage.get("state"); state.perMinute = 0; state.busy = false; await storage.put("state", state);
  assert.equal((await call("/photo-food/analyze", { headers: { authorization: `Bearer ${providerToken}`, "content-type": "image/jpeg", "x-photo-food-mock-scenario": "timeout" }, body: jpeg })).status, 504, "timeout controlado");

  response = await call("/device/revoke", { headers: { authorization: `Bearer ${providerToken}` } }); assert.equal(response.status, 200);
  assert.equal((await analyze(providerToken)).status, 401, "revocación");

  env.BACKEND_ENABLED = "false";
  assert.equal((await handle(new Request("https://worker.test/health", { method: "GET", headers: { origin } }), env)).status, 503, "backend completamente apagado");
  assert.equal((await call("/pairing/create", { headers: { authorization: "Bearer admin-test-only" } })).status, 503);

  const logged = []; const safe = safeLog({ requestId: "id", status: 200, token: "secret", code: "123", body: "photo", foods: ["pollo"] }, { log: value => logged.push(value) });
  assert.deepEqual(Object.keys(safe).sort(), ["requestId", "status"]); assert.equal(logged[0].includes("secret"), false, "logs sin datos sensibles");
  console.log("FORZA Photo Food backend tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
