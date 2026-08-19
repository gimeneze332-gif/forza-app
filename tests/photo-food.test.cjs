const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("photo-food.js", "utf8");
const context = { console, JSON, Number, String, Object, Array, Math, Promise, globalThis: {} };
context.window = context.globalThis;
vm.createContext(context);
vm.runInContext(source, context);
const api = context.globalThis.ForzaPhotoFood;

function memoryIndexedDb() {
  const values = new Map();
  return { values, api: { open() {
    const request = {}; const database = { objectStoreNames: { contains: () => true }, createObjectStore() {}, close() {},
      transaction() { return { objectStore() { return {
        get(key) { const operation = {}; queueMicrotask(() => { operation.result = values.get(key); operation.onsuccess?.(); }); return operation; },
        put(value, key) { const operation = {}; queueMicrotask(() => { values.set(key, value); operation.onsuccess?.(); }); return operation; },
        delete(key) { const operation = {}; queueMicrotask(() => { values.delete(key); operation.onsuccess?.(); }); return operation; }
      }; } }; } };
    queueMicrotask(() => { request.result = database; request.onsuccess?.(); }); return request;
  } } };
}

assert.ok(api, "Photo Food expone una sola API aislada");
assert.equal(api.PHOTO_FOOD_MODE, "mock");
assert.equal(api.MAX_EDGE, 768);
assert.equal(api.MAX_BYTES, 750 * 1024);
assert.equal(typeof api.processImage, "function");

(async () => {
  const privateDb = memoryIndexedDb(); context.globalThis.indexedDB = privateDb.api;
  await api.saveDeviceToken("device-test-token"); assert.equal(await api.getDeviceToken(), "device-test-token");
  await api.clearDeviceToken(); assert.equal(await api.getDeviceToken(), undefined, "el token revocable se elimina de IndexedDB");

  const remoteDb = memoryIndexedDb(); const remoteCalls = [];
  const remoteRoot = { FORZA_PHOTO_FOOD_CONFIG: { mode: "remote", endpoint: "https://worker.test/" }, indexedDB: remoteDb.api,
    fetch: async (url, options) => { remoteCalls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ items: [], uncertainties: [] }) }; },
    setTimeout, clearTimeout, AbortController, URL, JSON };
  const remoteContext = { console, JSON, Number, String, Object, Array, Math, Promise, AbortController, globalThis: remoteRoot, window: remoteRoot };
  vm.createContext(remoteContext); vm.runInContext(source, remoteContext); const remoteApi = remoteRoot.ForzaPhotoFood;
  assert.equal(remoteApi.PHOTO_FOOD_MODE, "remote"); assert.equal(remoteApi.REMOTE_ENDPOINT, "https://worker.test");
  await remoteApi.saveDeviceToken("remote-token");
  assert.deepEqual(JSON.parse(JSON.stringify(await remoteApi.remoteAnalyze({}, "success"))), { items: [], uncertainties: [] });
  assert.equal(remoteCalls[0].options.headers.authorization, "Bearer remote-token");

  for (const scenario of ["chicken-rice", "milanesa-puree", "tortilla", "unknown", "low-confidence"]) {
    const proposal = await api.mockAnalyze(scenario);
    assert.equal(api.validateResponse(proposal), true, `${scenario} cumple el contrato futuro`);
  }
  await assert.rejects(api.mockAnalyze("service-error"), /service_error/);
  await assert.rejects(api.mockAnalyze("timeout"), /timeout/);
  assert.equal(api.validateResponse(await api.mockAnalyze("invalid-response")), false);

  const text = api.proposalToText(await api.mockAnalyze("chicken-rice"));
  assert.match(text, /150 g de pechuga de pollo a la plancha/);
  assert.match(text, /180 g de arroz cocido/);
  assert.equal(api.validateResponse({ items: [], uncertainties: [] }), true);
  assert.equal(api.validateResponse({ items: [{ name: "pollo", foodConfidence: 2 }], uncertainties: [] }), false);

  const almondProposalText = api.proposalToText({ items: [{
    name: "almendras", preparation: null, estimatedPortion: "normal", estimatedGrams: 30,
    foodConfidence: .95, quantityConfidence: .8, notes: "cantidad aproximada"
  }], uncertainties: [] });
  assert.equal(almondProposalText, "30 g de almendras");
  const smartContext = { console, Date, Math, Number, String, Object, Array, Map, Set, JSON };
  smartContext.window = smartContext;
  vm.createContext(smartContext);
  vm.runInContext(fs.readFileSync("smart-text-catalog.js", "utf8"), smartContext);
  vm.runInContext(fs.readFileSync("smart-text.js", "utf8"), smartContext);
  const almondFromPhoto = smartContext.ForzaSmartText.interpret(almondProposalText);
  assert.equal(almondFromPhoto.items[0].catalogId, "almond", "Photo Food llega al catálogo almond");
  assert.equal(almondFromPhoto.items[0].grams, 30);
  assert.deepEqual(
    JSON.parse(JSON.stringify(almondFromPhoto.totals)),
    { calories: 173.7, protein: 6.3, carbs: 6.5, fat: 15 },
    "Photo Food usa el cálculo nutricional local"
  );

  const html = fs.readFileSync("index.html", "utf8");
  const configSource = fs.readFileSync("photo-food-config.js", "utf8");
  assert.match(html, /capture="environment"/);
  assert.equal(html.includes("Modo de prueba"), false);
  assert.equal(html.includes("Caso simulado"), false);
  assert.match(html, /id="photo-food-scenario-select"[^>]+type="hidden"/);
  assert.ok(html.includes("Analizando foto…"));
  assert.ok(html.includes("Usar estos alimentos"));
  assert.ok(html.includes("No pude analizar la foto"));
  assert.ok(source.includes("No pude reconocer bien esta foto."), "fallback simple sin detalle técnico");
  assert.equal(source.includes("confianza ${confidence"), false, "la interfaz no muestra confianza técnica");
  assert.ok(html.indexOf('<script src="script.js"></script>') < html.indexOf('<script src="photo-food.js"></script>'));
  assert.ok(html.indexOf('<script src="photo-food-config.js"></script>') < html.indexOf('<script src="photo-food.js"></script>'));
  assert.ok(html.indexOf('<script src="photo-food.js"></script>') < html.indexOf('<script src="nutrition.js"></script>'));

  const sw = fs.readFileSync("sw.js", "utf8");
  assert.ok(sw.includes('"./photo-food.js"') && sw.includes('"./photo-food.css"'));
  assert.ok(sw.includes('"./photo-food-config.js"'));
  assert.match(sw, /blob:\|data:/);
  assert.equal(/localStorage|caches\./.test(source), false, "Photo Food no usa LocalStorage ni Cache Storage");
  assert.equal(source.includes("GEMINI_API_KEY"), false);
  assert.ok(source.includes("indexedDB"), "el token remoto usa IndexedDB");
  assert.equal(source.includes("localStorage"), false, "el token remoto nunca usa LocalStorage");
  assert.ok(source.includes('RUNTIME_CONFIG.mode === "remote"'));
  assert.ok(source.includes("AbortController"));
  assert.match(configSource, /mode:\s*"remote"/);
  assert.match(configSource, /endpoint:\s*"https:\/\/forza-photo-food\.gimeneze332\.workers\.dev"/);
  assert.equal(/token|secret|api.?key/i.test(configSource.replace(/No colocar secretos/, "")), false, "la configuración pública no contiene credenciales");
  console.log("FORZA Photo Food tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
