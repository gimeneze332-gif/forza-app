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
        "forza_nutrition_settings"
    ].sort()
);

const parsed = api.parseMealText("2 huevos, banana y yogur");
assert.equal(parsed.items.length, 3);
assert.equal(parsed.unrecognized.length, 0);
assert.equal(parsed.totals.calories, 339);
assert.equal(parsed.totals.protein, 18.9);
assert.equal(typeof parsed.totals.carbs, "number");
assert.equal(typeof parsed.totals.fat, "number");

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

assert.equal(typeof domReady, "function");
domReady();
assert.equal(JSON.stringify([...gymStorage.entries()]), storageBefore);
assert.equal(/forza_(workouts|routines|body|goal|darkmode)/.test(source), false);

const html = fs.readFileSync("index.html", "utf8");
assert.ok(
    html.indexOf('<script src="script.js"></script>') < html.indexOf('<script src="nutrition.js"></script>'),
    "Gym inicia antes que el complemento Nutrition"
);
assert.match(html, /id="nutrition-toast"[^>]+aria-live="polite"/);
assert.ok(html.includes("Nutrici\u00f3n de hoy"));
assert.equal(html.includes('id="nutrition-status"'), false);
assert.ok(source.includes("+250 ml"));
assert.ok(source.includes("Comida registrada"));

console.log("FORZA Nutrition tests: OK");
