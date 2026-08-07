const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const catalogSource = fs.readFileSync("smart-text-catalog.js", "utf8");
const engineSource = fs.readFileSync("smart-text.js", "utf8");

function loadEngine(withCatalog = true) {
    const context = { console, Date, Math, Number, String, Object, Array, Map, Set, JSON };
    context.window = context;
    vm.createContext(context);
    if (withCatalog) vm.runInContext(catalogSource, context);
    vm.runInContext(engineSource, context);
    return context.window.ForzaSmartText;
}

const api = loadEngine();
assert.equal(api.version, 1);
assert.ok(api.catalogVersion > 0);
assert.equal(Object.keys(api).includes("__catalog"), false, "El catálogo interno no queda expuesto");
assert.equal(api.normalizeText("  HÚEVOS,   Tomáte "), "huevos, tomate");

const eggsTomato = api.interpret("2 huevos con tomate");
assert.equal(eggsTomato.items.length, 2);
assert.equal(eggsTomato.items[0].catalogId, "egg");
assert.equal(eggsTomato.items[0].quantity, 2);
assert.equal(eggsTomato.items[0].explicitQuantity, true);
assert.equal(eggsTomato.items[1].estimated, true);
assert.equal(eggsTomato.requiresConfirmation, true);

const weighted = api.interpret("150 g de pollo con 200 g de arroz");
assert.equal(weighted.items.length, 2);
assert.equal(weighted.items[0].grams, 150);
assert.equal(weighted.items[1].grams, 200);
assert.equal(weighted.items.every(item => item.explicitQuantity), true);
assert.equal(weighted.totals.calories, 507.5);

const breakfast = api.interpret("yogur con avena y granola");
assert.deepEqual(Array.from(breakfast.items, item => item.catalogId), ["yogurt", "oats", "granola"]);
assert.equal(breakfast.items.every(item => item.estimated), true);

const milanesa = api.interpret("milanesa con puré");
assert.equal(milanesa.dishId, "milanesa_puree");
assert.equal(milanesa.questions[0].type, "food-choice");
assert.equal(milanesa.requiresConfirmation, true);
const resolvedMilanesa = api.resolveChoice(milanesa, 0, "milanesa_beef", "normal");
assert.equal(resolvedMilanesa.items.some(item => item.catalogId === "milanesa_beef"), true);

const pizza = api.interpret("pizza");
assert.equal(pizza.items[0].catalogId, "pizza_mozzarella");
assert.equal(pizza.items[0].estimated, true);
assert.equal(pizza.requiresConfirmation, true);

const toast = api.interpret("2 tostadas");
assert.equal(toast.items[0].quantity, 2);
assert.equal(toast.items[0].grams, 60);

const halfBanana = api.interpret("media banana");
assert.equal(halfBanana.items[0].quantity, 0.5);
assert.equal(halfBanana.items[0].estimated, false);

assert.equal(api.interpret("1 taza de arroz").items[0].grams, 195);
assert.equal(api.interpret("1 cucharada de avena").items[0].grams, 10);
assert.equal(api.interpret("1 vaso de leche").items[0].grams, 200);
assert.equal(api.interpret("1 rodaja de pan").items[0].grams, 30);

const unknown = api.interpret("guiso secreto familiar");
assert.equal(unknown.items.length, 0);
assert.deepEqual(Array.from(unknown.unrecognized), ["guiso secreto familiar"]);
assert.equal(unknown.totals.calories, null);

const typo = api.interpret("yogurr");
assert.equal(typo.items[0].catalogId, "yogurt");
assert.ok(typo.items[0].confidence < .85);

const ambiguousPreparation = api.interpret("pollo frito");
assert.equal(ambiguousPreparation.items[0].preparationAmbiguous, true);
assert.equal(ambiguousPreparation.questions[0].type, "preparation");

const meal = api.createMealDefinition("Mi desayuno", breakfast.items, { id: "meal-1" });
const namedMeal = api.interpret("mi desayuno", { meals: [meal] });
assert.equal(namedMeal.contextType, "meal");
assert.equal(namedMeal.requiresConfirmation, true);
assert.equal(namedMeal.items.length, 3);

const postWorkoutMeal = api.createMealDefinition("Mi post entreno", weighted.items, { id: "meal-2" });
assert.equal(api.interpret("mi post entreno", { meals: [postWorkoutMeal] }).requiresConfirmation, true);

const missingMeal = api.interpret("mi merienda", { meals: [meal] });
assert.equal(missingMeal.contextType, "meal-missing");
assert.equal(missingMeal.requiresConfirmation, true);
assert.equal(missingMeal.items.length, 0);

const oldEntry = {
    id: "old-1", date: "2026-08-06", createdAt: "2026-08-06T12:00:00.000Z",
    rawText: "pollo con arroz", items: weighted.items,
    calories: weighted.totals.calories, protein: weighted.totals.protein,
    carbs: weighted.totals.carbs, fat: weighted.totals.fat,
    source: "text", isFavorite: false
};
const yesterday = api.interpret("lo de ayer", { entries: [oldEntry], now: new Date("2026-08-07T12:00:00") });
assert.equal(yesterday.contextType, "yesterday");
assert.equal(yesterday.requiresConfirmation, true);
assert.equal(yesterday.items.length, 2);

const usual = api.interpret("lo de siempre", { entries: [oldEntry, { ...oldEntry, id: "old-2", date: "2026-08-05" }] });
assert.equal(usual.contextType, "usual");
assert.equal(usual.requiresConfirmation, true);

const damagedMemory = api.sanitizeMemory({ schemaVersion: 1, catalogVersion: 999, aliases: "roto" });
assert.deepEqual(JSON.parse(JSON.stringify(damagedMemory)), {
    schemaVersion: 1, catalogVersion: api.catalogVersion, aliases: {}, portions: {}
});
const learned = api.rememberCorrection(damagedMemory, { alias: "mi pollito", foodId: "chicken", grams: 180 });
const learnedResult = api.interpret("mi pollito", { memory: learned });
assert.equal(learnedResult.items[0].catalogId, "chicken");
assert.equal(learnedResult.items[0].grams, 180);
assert.equal(learnedResult.items[0].estimated, true);

const noCatalog = loadEngine(false);
assert.equal(noCatalog.catalogVersion, 0);
assert.throws(() => noCatalog.interpret("2 huevos"), /catálogo/i);

const allSources = `${catalogSource}\n${engineSource}`;
assert.equal(/forza_(workouts|routines|body|goal|darkmode|last_backup|data_updated_at)/.test(allSources), false);

console.log("FORZA Smart Text tests: OK");
