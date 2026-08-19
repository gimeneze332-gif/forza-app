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

const almondCases = [
    ["almendra", 1, 1.2, true],
    ["almendras", 1, 1.2, true],
    ["1 almendra", 1, 1.2, false],
    ["10 almendras", 10, 12, false],
    ["15 almendras", 15, 18, false],
    ["30 g almendras", 30, 30, false],
    ["30 g de almendras", 30, 30, false],
    ["30 gramos de almendras", 30, 30, false]
];
almondCases.forEach(([text, quantity, grams, estimated]) => {
    const result = api.interpret(text);
    assert.equal(result.items.length, 1, `${text}: alimento reconocido`);
    assert.equal(result.unrecognized.length, 0, `${text}: sin componente desconocido`);
    assert.equal(result.items[0].catalogId, "almond", `${text}: singular/plural almond`);
    assert.equal(result.items[0].quantity, quantity, `${text}: cantidad`);
    assert.equal(result.items[0].grams, grams, `${text}: gramos`);
    assert.equal(result.items[0].estimated, estimated, `${text}: estimación correcta`);
});

const fifteenAlmonds = api.interpret("15 almendras");
assert.equal(fifteenAlmonds.items[0].unit, "unit");
assert.equal(fifteenAlmonds.items[0].explicitQuantity, true);
assert.deepEqual(
    JSON.parse(JSON.stringify(fifteenAlmonds.totals)),
    { calories: 104.2, protein: 3.8, carbs: 3.9, fat: 9 },
    "15 almendras calculan nutrientes proporcionales para 18 g"
);
const fifteenGramsAlmonds = api.interpret("15 g de almendras");
assert.equal(fifteenGramsAlmonds.items[0].unit, "g");
assert.equal(fifteenGramsAlmonds.items[0].grams, 15);
assert.notEqual(fifteenAlmonds.items[0].grams, fifteenGramsAlmonds.items[0].grams, "15 unidades no son 15 gramos");
assert.equal(api.interpret("1.5 almendras").items[0].grams, 1.8, "decimales por unidad conservan la arquitectura");
assert.equal(api.interpret("almendras").requiresConfirmation, true, "sin cantidad requiere revisión");
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

// Sprint de calibración: frases reales convertidas en regresiones permanentes.
const calibratedMilanesaTart = api.interpret("milanesa de carne con tarta de choclo");
assert.deepEqual(Array.from(calibratedMilanesaTart.items, item => item.catalogId), ["milanesa_beef", "corn_tart"]);
assert.equal(calibratedMilanesaTart.unrecognized.length, 0);
assert.equal(calibratedMilanesaTart.items.every(item => item.estimated), true);
assert.equal(calibratedMilanesaTart.requiresConfirmation, true);

const writtenOne = api.interpret("2 huevos y una banana");
assert.deepEqual(Array.from(writtenOne.items, item => item.quantity), [2, 1]);
assert.equal(writtenOne.items.every(item => item.explicitQuantity), true);

const calibratedChickenRice = api.interpret("pollo con arroz");
assert.deepEqual(Array.from(calibratedChickenRice.items, item => item.catalogId), ["chicken", "rice_cooked"]);
assert.equal(calibratedChickenRice.items.every(item => item.estimated), true);

const calibratedYogurt = api.interpret("yogur con avena y granola");
assert.deepEqual(Array.from(calibratedYogurt.items, item => item.catalogId), ["yogurt", "oats", "granola"]);
assert.equal(calibratedYogurt.requiresConfirmation, true);

const tortillaCheese = api.interpret("tortilla de papa con queso");
assert.deepEqual(Array.from(tortillaCheese.items, item => item.catalogId), ["potato_omelette", "cheese_generic"]);
assert.equal(tortillaCheese.items[1].name, "Queso genérico");
assert.equal(tortillaCheese.items[1].confidence, 0.6);
assert.equal(tortillaCheese.items[1].estimated, true);

const ambiguousBurger = api.interpret("hamburguesa con papas");
assert.equal(ambiguousBurger.questions[0].type, "food-choice");
assert.deepEqual(Array.from(ambiguousBurger.questions[0].choices, choice => choice.id), ["hamburger_simple", "hamburger_complete"]);
assert.equal(ambiguousBurger.requiresConfirmation, true);

const writtenTwoEggs = api.interpret("pechuga con tomate y dos huevos");
assert.equal(writtenTwoEggs.items.find(item => item.catalogId === "egg").quantity, 2);
assert.equal(writtenTwoEggs.items.find(item => item.catalogId === "egg").explicitQuantity, true);

const calibrationMeal = api.createMealDefinition("Mi desayuno", calibratedYogurt.items, { id: "calibration-meal" });
assert.equal(api.interpret("mi desayuno", { meals: [calibrationMeal] }).requiresConfirmation, true);
assert.equal(api.interpret("lo de siempre", { entries: [oldEntry, { ...oldEntry, id: "old-3" }] }).requiresConfirmation, true);
assert.equal(api.interpret("lo de ayer", { entries: [oldEntry], now: new Date("2026-08-07T12:00:00") }).requiresConfirmation, true);

assert.equal(api.interpret("una banana").items[0].quantity, 1);
assert.equal(api.interpret("una banana").items[0].explicitQuantity, true);
assert.equal(api.interpret("dos huevos").items[0].quantity, 2);
assert.equal(api.interpret("tres tostadas").items[0].quantity, 3);
assert.equal(api.interpret("media banana").items[0].quantity, 0.5);

const genericCheese = api.interpret("queso").items[0];
assert.equal(genericCheese.catalogId, "cheese_generic");
assert.equal(genericCheese.confidence, 0.6);
assert.equal(genericCheese.estimated, true);
assert.equal(api.interpret("queso cremoso").items[0].catalogId, "cheese_creamy");

function resolveMilanesaPreparation(text) {
    const result = api.interpret(text);
    return api.resolveChoice(result, 0, "milanesa_beef", "normal").items.find(item => item.catalogId === "milanesa_beef");
}

const friedMilanesa = resolveMilanesaPreparation("milanesa frita");
const bakedMilanesa = resolveMilanesaPreparation("milanesa al horno");
const airFryerMilanesa = resolveMilanesaPreparation("milanesa en air fryer");
assert.equal(friedMilanesa.preparation, "frita");
assert.equal(bakedMilanesa.preparation, "horno");
assert.equal(airFryerMilanesa.preparation, "air_fryer");
assert.equal([friedMilanesa, bakedMilanesa, airFryerMilanesa].every(item => item.estimated && item.nutritionEstimated), true);
assert.equal(api.interpret("milanesa de carne").items[0].confidence < friedMilanesa.confidence, true, "Falta de preparación reduce confianza");

assert.equal(api.interpret("hamburguesa simple").items[0].catalogId, "hamburger_simple");
assert.equal(api.interpret("hamburguesa completa").items[0].catalogId, "hamburger_complete");

const partial = api.interpret("pollo con alimento lunar");
assert.equal(partial.totalKind, "subtotal");
assert.equal(partial.totals.calories, null, "Un subtotal nunca ocupa el total principal");
assert.ok(partial.recognizedSubtotal.calories > 0);
assert.deepEqual(Array.from(partial.unrecognized), ["alimento lunar"]);
assert.equal(partial.requiresConfirmation, true);

assert.equal(Number(String(genericCheese.confidence).split(".")[1]?.length || 0) <= 2, true);

const serviceWorkerSource = fs.readFileSync("sw.js", "utf8");
assert.ok(serviceWorkerSource.includes("forza-v2-smart-text-calibration-1"));
assert.ok(serviceWorkerSource.includes('"./smart-text-catalog.js"'));
assert.ok(serviceWorkerSource.includes('"./smart-text.js"'));

console.log("FORZA Smart Text tests: OK");
