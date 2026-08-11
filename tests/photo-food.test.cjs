const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("photo-food.js", "utf8");
const context = { console, JSON, Number, String, Object, Array, Math, Promise, globalThis: {} };
context.window = context.globalThis;
vm.createContext(context);
vm.runInContext(source, context);
const api = context.globalThis.ForzaPhotoFood;

assert.ok(api, "Photo Food expone una sola API aislada");
assert.equal(api.PHOTO_FOOD_MODE, "mock");
assert.equal(api.MAX_EDGE, 768);
assert.equal(api.MAX_BYTES, 750 * 1024);
assert.equal(typeof api.processImage, "function");

(async () => {
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

  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /capture="environment"/);
  assert.ok(html.includes("Modo de prueba"));
  assert.ok(html.includes("No pude analizar la foto"));
  assert.ok(html.indexOf('<script src="script.js"></script>') < html.indexOf('<script src="photo-food.js"></script>'));
  assert.ok(html.indexOf('<script src="photo-food.js"></script>') < html.indexOf('<script src="nutrition.js"></script>'));

  const sw = fs.readFileSync("sw.js", "utf8");
  assert.ok(sw.includes('"./photo-food.js"') && sw.includes('"./photo-food.css"'));
  assert.match(sw, /blob:\|data:/);
  assert.equal(/localStorage|indexedDB|caches\./.test(source), false, "Photo Food no persiste imágenes ni datos propios");
  assert.equal(source.includes("GEMINI_API_KEY"), false);
  console.log("FORZA Photo Food tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
