const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadApp(initialStorage = {}) {
    const storage = new Map(Object.entries(initialStorage));
    const listeners = {};

    const context = {
        console: {
            log: console.log,
            warn() {},
            error: console.error
        },
        Date,
        Math,
        JSON,
        Number,
        String,
        Set,
        Blob,
        FileReader: function FileReader() {},
        alert() {},
        confirm() { return true; },
        prompt() { return null; },
        URL: {
            createObjectURL() { return "blob:test"; },
            revokeObjectURL() {}
        },
        localStorage: {
            getItem(key) { return storage.has(key) ? storage.get(key) : null; },
            setItem(key, value) { storage.set(key, String(value)); }
        },
        document: {
            body: { classList: { add() {}, remove() {}, toggle() {} } },
            querySelectorAll() { return []; },
            getElementById() { return null; },
            createElement() { return { click() {} }; },
            addEventListener(type, callback) { listeners[type] = callback; }
        }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync("script.js", "utf8"), context);

    return { context, storage, listeners };
}

const clean = loadApp();

assert.equal(clean.context.calculateVolume(80, 4, 8), 2560);
assert.equal(clean.context.calculate1RM(80, 8), 101);
assert.equal(
    clean.context.parseWorkoutDate("07/08/2026").toISOString().slice(0, 10),
    "2026-08-07"
);
assert.equal(clean.context.parseWorkoutDate("fecha inválida"), null);
assert.equal(typeof clean.listeners.DOMContentLoaded, "function");

const corrupted = loadApp({
    forza_workouts: "{json roto",
    forza_routines: "{json roto",
    forza_body: "{json roto",
    forza_goal: "{json roto"
});

assert.equal(corrupted.context.getTotalWorkouts(), 0);
assert.equal(corrupted.context.getTotalVolume(), 0);

const existingData = loadApp({
    forza_workouts: JSON.stringify([
        {
            id: 1,
            date: "07/08/2026",
            trainingDay: "Día 1",
            exercise: "Press banca",
            weight: 80,
            sets: 4,
            reps: 8,
            volume: 2560
        }
    ])
});

assert.equal(existingData.context.getTotalWorkouts(), 1);
assert.equal(existingData.context.getTotalVolume(), 2560);
assert.equal(existingData.context.isNewPR("Press banca", 82.5), true);
assert.equal(existingData.context.isNewPR("Press banca", 80), false);

console.log("FORZA smoke tests: OK");
