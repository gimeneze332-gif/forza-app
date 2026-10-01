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
const html = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("sw.js", "utf8");

assert.match(html, /id="performedSetsList"/);
assert.match(html, /id="copyPreviousSets"/);
assert.match(html, /Series realizadas/);
assert.doesNotMatch(html, /id="weight"/);
assert.match(serviceWorker, /gym-sets-v2-1/);

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
assert.equal(existingData.context.normalizeExerciseName("  PRESS BANCA "), "press banca");
assert.equal(existingData.context.escapeHTML("<Press & banca>"), "&lt;Press &amp; banca&gt;");
assert.equal(existingData.context.getWorkoutsByDate("07/08/2026").length, 1);
assert.equal(existingData.context.getWorkoutsByDate("08/08/2026").length, 0);
assert.equal(existingData.context.formatCalendarDate(2026, 7, 7), "7/8/2026");
assert.deepEqual(
    JSON.parse(JSON.stringify(existingData.context.getPerformedSets({ weight: 80, sets: 3, reps: 8 }))),
    [
        { id: null, order: 1, targetSetId: null, weight: 80, reps: 8 },
        { id: null, order: 2, targetSetId: null, weight: 80, reps: 8 },
        { id: null, order: 3, targetSetId: null, weight: 80, reps: 8 }
    ]
);
assert.equal(existingData.context.getWorkoutVolume({ weight: 80, sets: 3, reps: 8 }), 1920);
const v2Workout = {
    schemaVersion: 2,
    exerciseId: "exercise-1",
    exerciseName: "Press inclinado",
    performedSets: [
        { id: "set-1", weight: 55, reps: 7 },
        { id: "set-2", weight: 50, reps: 9 },
        { id: "set-3", weight: 45, reps: 11 }
    ]
};
assert.equal(existingData.context.getWorkoutVolume(v2Workout), 1330);
assert.equal(existingData.context.getWorkoutMaxWeight(v2Workout), 55);
assert.equal(existingData.context.getWorkoutBestSet(v2Workout).weight, 55);
assert.equal(existingData.context.getWorkoutExerciseName(v2Workout), "Press inclinado");
assert.equal(existingData.context.getWorkoutExerciseKey(v2Workout), "id:exercise-1");
assert.equal(existingData.context.getWorkoutExerciseKey({ exercise: " Press Banca " }), "name:press banca");
assert.equal(existingData.context.sameExercise(v2Workout, { id: "exercise-1", name: "Otro nombre" }), true);
assert.equal(existingData.context.sameExercise(
    { exercise: " Press Banca " },
    { id: null, name: "press banca" }
), true);
assert.equal(existingData.context.readRoutineExercise("Remo", "Día 1", 0).id, null);
assert.equal(existingData.context.readRoutineExercise({
    id: "exercise-2",
    name: "Remo",
    targetSets: [{ targetWeight: 60, targetRepsMin: 8, targetRepsMax: 10 }]
}).targetSets.length, 1);
assert.equal(existingData.context.countWorkoutSessions([
    { date: "07/08/2026" },
    { date: "07/08/2026" },
    { date: "08/08/2026" }
]), 2);
assert.equal(existingData.context.countWorkoutSessions([
    { date: "07/08/2026", sessionId: "session-1" },
    { date: "07/08/2026", sessionId: "session-1" },
    { date: "07/08/2026", sessionId: "session-2" }
]), 2);
const achievements = existingData.context.getAchievements();
assert.equal(achievements.length, 12);
assert.equal(achievements.find(item => item.title === "Primer paso").unlocked, true);
assert.equal(achievements.find(item => item.title === "Rutina en marcha").unlocked, false);
existingData.context.saveWorkouts();
assert.equal(existingData.storage.has("forza_data_updated_at"), true);
existingData.context.backupJSON();
assert.equal(existingData.storage.has("forza_last_backup"), true);

console.log("FORZA smoke tests: OK");
