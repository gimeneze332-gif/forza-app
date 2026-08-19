const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("nutrition.js", "utf8");
const gymStorage = new Map([
    ["forza_workouts", "GYM_WORKOUTS_UNCHANGED"],
    ["forza_routines", "GYM_ROUTINES_UNCHANGED"],
    ["forza_body", "GYM_BODY_UNCHANGED"],
    ["forza_goal", "GYM_GOAL_UNCHANGED"]
]);
const storageBefore = JSON.stringify([...gymStorage.entries()]);
let domReady = null;

const context = {
    console: { warn() {}, error: console.error },
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Map,
    Set,
    JSON,
    localStorage: {
        getItem(key) { return gymStorage.has(key) ? gymStorage.get(key) : null; },
        setItem(key, value) { gymStorage.set(key, String(value)); }
    },
    window: {},
    document: {
        addEventListener(type, callback) {
            if (type === "DOMContentLoaded") domReady = callback;
        },
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    }
};

vm.createContext(context);
vm.runInContext(source, context);

const api = context.window.ForzaNutrition;
assert.ok(api, "Nutrition expone únicamente su API aislada");
assert.deepEqual(
    Object.values(api.STORAGE).sort(),
    [
        "forza_nutrition_entries",
        "forza_nutrition_hydration",
        "forza_nutrition_meals",
        "forza_nutrition_settings",
        "forza_nutrition_smart_text_memory"
    ].sort()
);

const parsed = api.parseMealText("2 huevos, banana y yogur");
assert.equal(parsed.items.length, 3);
assert.equal(parsed.unrecognized.length, 0);
assert.equal(parsed.totals.calories, 339);
assert.equal(parsed.totals.protein, 18.9);
assert.equal(typeof parsed.totals.carbs, "number");
assert.equal(typeof parsed.totals.fat, "number");
assert.equal(context.window.ForzaSmartText, undefined, "Nutrition conserva el fallback sin motor Smart Text");

assert.equal(api.parseNutritionNumber("106.8"), 106.8);
assert.equal(api.parseNutritionNumber("1.3"), 1.3);
assert.equal(api.parseNutritionNumber("106,8"), 106.8);
assert.equal(api.parseNutritionNumber("1,3"), 1.3);
assert.equal(api.parseNutritionNumber("28.4"), 28.4, "carbohidratos decimales");
assert.equal(api.parseNutritionNumber("0.4"), 0.4, "grasas decimales");
assert.equal(api.parseNutritionNumber("106"), 106, "enteros");
assert.equal(api.parseNutritionNumber("0"), 0, "cero válido");
assert.equal(api.parseNutritionNumber("", { optional: true }), null, "opcional vacío");
assert.equal(api.parseNutritionNumber(""), null, "vacío rechazado");
assert.equal(api.parseNutritionNumber("banana"), null, "texto rechazado");
assert.equal(api.parseNutritionNumber(NaN), null, "NaN rechazado");
assert.equal(api.parseNutritionNumber(Infinity), null, "Infinity rechazado");
assert.equal(api.parseNutritionNumber("106,8.2"), null, "formato ambiguo rechazado");
assert.equal(api.parseNutritionNumber("1.3.2"), null, "múltiples puntos rechazados");
assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeMealNutrition({ calories: "106.8", protein: "1.3", carbs: "28.4", fat: "0.4" }))),
    { calories: 106.8, protein: 1.3, carbs: 28.4, fat: 0.4 }
);
assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeMealNutrition({ calories: "106,8", protein: "1,3", carbs: "28,4", fat: "0,4" }))),
    { calories: 106.8, protein: 1.3, carbs: 28.4, fat: 0.4 }
);
assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeMealNutrition({
        rawText: "120 g de banana",
        items: [{ name: "banana", grams: 120 }],
        calories: "106.8",
        protein: "1.3",
        carbs: "27.4",
        fat: "0.4"
    }))),
    { calories: 106.8, protein: 1.3, carbs: 27.4, fat: 0.4 },
    "Photo Food banana 120 g con decimales puede guardarse"
);
assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeMealNutrition({
        rawText: "15 almendras", items: [{ catalogId: "almond", name: "Almendra", quantity: 15, unit: "unit", grams: 18 }],
        calories: 104.2, protein: 3.8, carbs: 3.9, fat: 9
    }))),
    { calories: 104.2, protein: 3.8, carbs: 3.9, fat: 9 },
    "los valores calculados de almendras cumplen el contrato de guardado Nutrition"
);
assert.throws(() => api.normalizeMealNutrition({ calories: "", protein: "1.3", carbs: "", fat: "" }), /invalid_nutrition_number/);
assert.throws(() => api.normalizeMealNutrition({ calories: "106.8", protein: "texto", carbs: "", fat: "" }), /invalid_nutrition_number/);
assert.throws(() => api.normalizeMealNutrition({ calories: "106.8", protein: "1.3", carbs: "NaN", fat: "" }), /invalid_nutrition_number/);
assert.throws(() => api.normalizeMealNutrition({ calories: "106.8", protein: "1.3", carbs: "", fat: "Infinity" }), /invalid_nutrition_number/);

const uncertain = api.parseMealText("pizza casera especial");
assert.equal(uncertain.rawText, "pizza casera especial");
assert.deepEqual(Array.from(uncertain.unrecognized), ["pizza casera especial"]);
assert.equal(uncertain.totals.calories, 0);
assert.equal(uncertain.totals.protein, 0);

const ambiguous = api.parseMealText("arroz con pollo");
assert.deepEqual(Array.from(ambiguous.unrecognized), ["arroz con pollo"]);
assert.equal(ambiguous.totals.calories, 0);

const totals = api.calculateDailyTotals(
    "2026-08-07",
    [
        { date: "2026-08-07", calories: 300, protein: 20, carbs: null, fat: 10 },
        { date: "2026-08-07", calories: 150, protein: 10, carbs: 25, fat: null },
        { date: "2026-08-06", calories: 999, protein: 99, carbs: 99, fat: 99 }
    ],
    [
        { date: "2026-08-07", milliliters: 250 },
        { date: "2026-08-07", milliliters: 500 }
    ]
);
assert.deepEqual(
    JSON.parse(JSON.stringify(totals)),
    { calories: 450, protein: 30, carbs: 25, fat: 10, water: 750 }
);

assert.equal(
    api.getDailyStatus(
        { calories: 1900, protein: 95, water: 1900 },
        { calories: 2000, protein: 100, water: 2000 }
    ).label,
    "Objetivo alcanzado"
);

const frequent = api.getFrequentMeals([
    { rawText: "Desayuno", isFavorite: true, createdAt: "1" },
    { rawText: "desayuno", isFavorite: true, createdAt: "2" },
    { rawText: "Almuerzo", isFavorite: false, createdAt: "3" }
]);
assert.equal(frequent.length, 1);
assert.equal(frequent[0].createdAt, "2");

const historyEntries = [
    { id: "old-day", date: "2026-08-06", rawText: "Otro día", createdAt: "2026-08-06T20:00:00.000Z", calories: 900, protein: 90 },
    { id: "one", date: "2026-08-07", rawText: "Primera", createdAt: "2026-08-07T08:00:00.000Z", calories: 100, protein: 10 },
    { id: "two", date: "2026-08-07", rawText: "Segunda", createdAt: "2026-08-07T12:00:00.000Z", calories: 200, protein: 20 },
    { id: "three", date: "2026-08-07", rawText: "Tercera", createdAt: "2026-08-07T16:00:00.000Z", calories: 300, protein: 30 },
    { id: "four", date: "2026-08-07", rawText: "Cuarta", createdAt: "2026-08-07T18:00:00.000Z", calories: 400, protein: 40 },
    { id: "five", date: "2026-08-07", rawText: "Quinta", createdAt: "2026-08-07T20:00:00.000Z", calories: 500, protein: 50 },
    { date: "2026-08-07", rawText: "Legado", calories: 50, protein: 5 }
];
assert.deepEqual(Array.from(api.getTodayMeals("2026-08-08", historyEntries)), [], "estado vacío");
const todayHistory = api.getTodayMeals("2026-08-07", historyEntries);
assert.equal(todayHistory.length, 6, "incluye solo el día actual");
assert.equal(todayHistory.some(item => item.rawText === "Otro día"), false, "excluye otros días");
assert.deepEqual(Array.from(todayHistory.slice(0, 5), item => item.id), ["five", "four", "three", "two", "one"], "ordena createdAt descendente");
assert.equal(todayHistory.at(-1).rawText, "Legado", "sin createdAt queda al final");
assert.equal(api.getVisibleTodayMeals("2026-08-07", historyEntries).length, 4, "muestra máximo cuatro");
assert.equal(api.getVisibleTodayMeals("2026-08-07", historyEntries, true).length, 6, "Ver todas expande");
assert.equal(api.getVisibleTodayMeals("2026-08-07", historyEntries, false).length, 4, "Mostrar menos vuelve a cuatro");
assert.equal(api.isSafeEntryId(historyEntries.at(-1), historyEntries), false, "registro sin id no es editable");

const editableEntry = {
    id: "edit-me", date: "2026-08-07", createdAt: "2026-08-07T10:00:00.000Z",
    rawText: "Banana", items: [{ name: "banana" }], calories: 106.8, protein: 1.3,
    carbs: null, fat: null, source: "frequent", isFavorite: true, recognition: "smart-text-v1"
};
const renamed = api.updateMealEntry([editableEntry], "edit-me", {
    rawText: "Banana madura", calories: "107.2", protein: "1.4", carbs: "", fat: ""
})[0];
assert.equal(renamed.rawText, "Banana madura", "edita Alimento");
assert.equal(renamed.calories, 107.2, "edita decimal con punto");
assert.equal(renamed.protein, 1.4);
assert.equal(renamed.carbs, null, "carbs null se conserva correctamente");
assert.equal(renamed.fat, null, "fat null se conserva correctamente");
assert.equal(renamed.source, "frequent", "frecuente original intacto");
assert.equal(renamed.isFavorite, true);
assert.deepEqual(JSON.parse(JSON.stringify(renamed.items)), [{ name: "banana" }], "metadatos intactos");
const commaEdited = api.updateMealEntry([editableEntry], "edit-me", {
    rawText: "Banana", calories: "106,8", protein: "1,3", carbs: "27,4", fat: "0,4"
})[0];
assert.deepEqual(
    { calories: commaEdited.calories, protein: commaEdited.protein, carbs: commaEdited.carbs, fat: commaEdited.fat },
    { calories: 106.8, protein: 1.3, carbs: 27.4, fat: 0.4 },
    "edición acepta coma decimal"
);
assert.throws(() => api.updateMealEntry([historyEntries.at(-1)], undefined, {
    rawText: "Legado", calories: "50", protein: "5", carbs: "", fat: ""
}), /unsafe_nutrition_entry/, "registro sin id no puede editarse");

const beforeEditTotals = api.calculateDailyTotals("2026-08-07", [editableEntry], [{ date: "2026-08-07", milliliters: 250 }]);
const afterEditTotals = api.calculateDailyTotals("2026-08-07", [commaEdited], [{ date: "2026-08-07", milliliters: 250 }]);
assert.equal(beforeEditTotals.water, 250);
assert.equal(afterEditTotals.water, 250, "editar no altera agua");
assert.equal(afterEditTotals.carbs, 27.4, "totales se actualizan después de editar");
assert.deepEqual(Array.from(api.deleteMealEntry([editableEntry], "edit-me")), [], "eliminación quita el registro");
assert.equal(api.calculateDailyTotals("2026-08-07", api.deleteMealEntry([editableEntry], "edit-me"), []).calories, 0, "totales se actualizan después de eliminar");
assert.throws(() => api.deleteMealEntry([historyEntries.at(-1)], undefined), /unsafe_nutrition_entry/, "registro sin id no puede eliminarse");

assert.equal(typeof domReady, "function");
domReady();
assert.equal(JSON.stringify([...gymStorage.entries()]), storageBefore);
assert.equal(/forza_(workouts|routines|body|goal|darkmode)/.test(source), false);

const html = fs.readFileSync("index.html", "utf8");
assert.ok(
    html.indexOf('<script src="script.js"></script>') < html.indexOf('<script src="nutrition.js"></script>'),
    "Gym inicia antes que el complemento Nutrition"
);
assert.ok(
    html.indexOf('<script src="script.js"></script>') < html.indexOf('<script src="smart-text-catalog.js"></script>') &&
    html.indexOf('<script src="smart-text-catalog.js"></script>') < html.indexOf('<script src="smart-text.js"></script>') &&
    html.indexOf('<script src="smart-text.js"></script>') < html.indexOf('<script src="nutrition.js"></script>'),
    "Smart Text se carga después de Gym y antes de Nutrition"
);
assert.match(html, /id="nutrition-toast"[^>]+aria-live="polite"/);
assert.ok(html.includes("Nutrici\u00f3n de hoy"));
assert.equal(html.includes('id="nutrition-status"'), false);
assert.ok(source.includes("+250 ml"));
assert.ok(source.includes("Comida registrada"));
assert.ok(html.includes('id="nutrition-review-meal-name"'));
assert.ok(html.includes('data-nutrition-view="photo"'));
assert.ok(html.includes('class="nutrition-secondary-options"'));
assert.match(html, /id="nutrition-review-calories"[^>]+type="text"[^>]+inputmode="decimal"/);
assert.match(html, /id="nutrition-review-protein"[^>]+type="text"[^>]+inputmode="decimal"/);
assert.match(html, /id="nutrition-review-carbs"[^>]+type="text"[^>]+inputmode="decimal"/);
assert.match(html, /id="nutrition-review-fat"[^>]+type="text"[^>]+inputmode="decimal"/);
assert.ok(html.includes('id="nutrition-today-list"'));
assert.ok(html.includes('id="nutrition-today-toggle"'));
assert.ok(html.includes("Comidas de hoy"));
assert.match(html, /id="nutrition-history-food"[^>]+type="text"/);
assert.ok(html.includes("¿Eliminar esta comida?" ) || source.includes("¿Eliminar esta comida?"));
assert.ok(source.includes('cancel.textContent = "Cancelar"'), "cancelación de eliminación disponible");
assert.ok(source.includes('todayExpanded ? "Mostrar menos" : `Ver todas (${todayMeals.length})`'));
assert.ok(source.includes("✓ Comida eliminada"));
assert.equal(html.includes("Registro rápido"), false);
assert.equal(source.includes("Catálogo local:"), false);
assert.ok(source.includes("No pude reconocer esto"));
assert.ok(source.includes('recognition: draft.recognition ||'));

const serviceWorker = fs.readFileSync("sw.js", "utf8");
assert.ok(serviceWorker.includes('"./smart-text-catalog.js"'));
assert.ok(serviceWorker.includes('"./smart-text.js"'));

const oldNutritionEntry = {
    rawText: "Registro anterior", items: [], calories: 300, protein: 20,
    carbs: null, fat: null, source: "text", isFavorite: false,
    date: "2026-08-07", createdAt: "2026-08-07T10:00:00.000Z"
};
assert.deepEqual(
    JSON.parse(JSON.stringify(api.calculateDailyTotals("2026-08-07", [oldNutritionEntry], []))),
    { calories: 300, protein: 20, carbs: 0, fat: 0, water: 0 }
);

console.log("FORZA Nutrition tests: OK");
