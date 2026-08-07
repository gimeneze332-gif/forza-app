/* FORZA Nutrition: módulo aislado. No lee ni escribe claves de Gym. */
(function () {
    "use strict";

    const STORAGE = Object.freeze({
        entries: "forza_nutrition_entries",
        hydration: "forza_nutrition_hydration",
        settings: "forza_nutrition_settings"
    });

    const CATALOG = [
        ["huevo", ["huevo", "huevos"], "count", 1, 72, 6.3, .4, 4.8],
        ["banana", ["banana", "bananas", "platano"], "count", 1, 105, 1.3, 27, .4],
        ["manzana", ["manzana", "manzanas"], "count", 1, 95, .5, 25, .3],
        ["yogur", ["yogur", "yogurt"], "grams", 125, 90, 5, 12, 2.5],
        ["leche", ["leche"], "milliliters", 200, 122, 6.4, 9.6, 6.6],
        ["avena", ["avena"], "grams", 100, 389, 16.9, 66.3, 6.9],
        ["arroz cocido", ["arroz", "arroz cocido"], "grams", 100, 130, 2.7, 28.2, .3],
        ["pollo", ["pollo", "pechuga", "pechuga de pollo"], "grams", 100, 165, 31, 0, 3.6],
        ["pan", ["pan", "tostada", "tostadas"], "count", 1, 80, 3, 15, 1],
        ["atun", ["atun"], "grams", 100, 116, 26, 0, 1],
        ["carne", ["carne", "carne vacuna"], "grams", 100, 250, 26, 0, 15]
    ].map(([name, aliases, basis, amount, calories, protein, carbs, fat]) => ({
        name, aliases, basis, amount, calories, protein, carbs, fat
    }));

    let entries = [];
    let hydration = [];
    let settings = null;
    let draft = null;
    let el = null;
    let closeTimer = null;
    let toastTimer = null;
    let returnFocus = null;

    function normalizeText(value) {
        return String(value || "").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es-AR").trim();
    }

    function read(key, fallback, validate) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            const value = JSON.parse(raw);
            return validate(value) ? value : fallback;
        } catch (error) {
            console.warn(`Nutrition no pudo leer ${key}.`, error);
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function dateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function round(value) {
        return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
    }

    function quantityFor(segment, food) {
        const match = segment.match(/\b(\d+(?:[.,]\d+)?)\b/);
        const amount = match ? Number(match[1].replace(",", ".")) : null;
        if (food.basis === "count") return amount || 1;
        return amount && /\b(g|gr|gramos?|ml|mililitros?)\b/.test(segment)
            ? amount : food.amount;
    }

    function containsFoodAlias(segment, alias) {
        const escaped = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(segment);
    }

    function parseMealText(rawText) {
        const original = String(rawText || "").trim();
        const recognized = [];
        const unrecognized = [];
        original.split(/,|\s+y\s+/i).map(item => item.trim()).filter(Boolean)
            .forEach(sourceText => {
                const segment = normalizeText(sourceText);
                const matches = CATALOG.filter(candidate =>
                    candidate.aliases.some(alias => containsFoodAlias(segment, alias))
                );
                if (matches.length !== 1) {
                    unrecognized.push(sourceText);
                    return;
                }
                const [food] = matches;
                const quantity = quantityFor(segment, food);
                const multiplier = quantity / food.amount;
                recognized.push({
                    name: food.name, sourceText, quantity, unit: food.basis,
                    calories: round(food.calories * multiplier),
                    protein: round(food.protein * multiplier),
                    carbs: round(food.carbs * multiplier),
                    fat: round(food.fat * multiplier)
                });
            });

        const totals = recognized.reduce((total, item) => ({
            calories: round(total.calories + item.calories),
            protein: round(total.protein + item.protein),
            carbs: round(total.carbs + item.carbs),
            fat: round(total.fat + item.fat)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        return { rawText: original, items: recognized, unrecognized, totals };
    }

    function calculateDailyTotals(day = dateKey(), meals = entries, waterEntries = hydration) {
        const totals = meals.filter(item => item.date === day).reduce((total, item) => ({
            calories: round(total.calories + Number(item.calories || 0)),
            protein: round(total.protein + Number(item.protein || 0)),
            carbs: round(total.carbs + Number(item.carbs || 0)),
            fat: round(total.fat + Number(item.fat || 0))
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        totals.water = waterEntries.filter(item => item.date === day)
            .reduce((sum, item) => sum + Number(item.milliliters || 0), 0);
        return totals;
    }

    function getDailyStatus(totals, goals) {
        if (!goals) return { label: "Sin configurar", tone: "" };
        if (!totals.calories && !totals.protein && !totals.water) return { label: "Sin registros", tone: "" };
        if (totals.calories > goals.calories * 1.1) return { label: "Revisar calorías", tone: "warning" };
        const ratios = [totals.calories / goals.calories, totals.protein / goals.protein, totals.water / goals.water];
        if (ratios.every(value => value >= .9)) return { label: "Objetivo alcanzado", tone: "good" };
        if (ratios.reduce((sum, value) => sum + value, 0) / 3 >= .55) return { label: "Bien encaminado", tone: "good" };
        return { label: "En progreso", tone: "" };
    }

    function id(prefix) {
        const value = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${prefix}-${value}`;
    }

    function saveMeal(meal) {
        const saved = {
            id: id("meal"), date: dateKey(), createdAt: new Date().toISOString(),
            rawText: String(meal.rawText || "").trim(),
            items: Array.isArray(meal.items) ? meal.items : [],
            calories: Number(meal.calories || 0), protein: Number(meal.protein || 0),
            carbs: meal.carbs === "" || meal.carbs == null ? null : Number(meal.carbs),
            fat: meal.fat === "" || meal.fat == null ? null : Number(meal.fat),
            source: meal.source === "frequent" ? "frequent" : "text",
            isFavorite: Boolean(meal.isFavorite)
        };
        entries.push(saved);
        write(STORAGE.entries, entries);
        return saved;
    }

    function addWater(milliliters = 250) {
        hydration.push({ id: id("water"), date: dateKey(), createdAt: new Date().toISOString(), milliliters });
        write(STORAGE.hydration, hydration);
    }

    function getFrequentMeals(meals = entries) {
        const unique = new Map();
        meals.filter(item => item.isFavorite).slice().reverse().forEach(item => {
            const key = normalizeText(item.rawText);
            if (key && !unique.has(key)) unique.set(key, item);
        });
        return [...unique.values()].slice(0, 8);
    }

    function renderCard() {
        const totals = calculateDailyTotals();
        const target = (value, goal, unit) => settings
            ? `${value.toLocaleString("es-AR")} / ${goal.toLocaleString("es-AR")} ${unit}`
            : `${value.toLocaleString("es-AR")} ${unit} / objetivo pendiente`;
        el.calories.textContent = target(totals.calories, settings?.calories, "kcal");
        el.protein.textContent = target(totals.protein, settings?.protein, "g");
        el.water.textContent = target(totals.water, settings?.water, "ml");
    }

    function announce(message) {
        window.clearTimeout(toastTimer);
        el.toast.textContent = message;
        el.toast.classList.add("show");
        toastTimer = window.setTimeout(() => {
            el.toast.classList.remove("show");
            window.setTimeout(() => { el.toast.textContent = ""; }, 180);
        }, 1800);
    }

    function show(view) {
        el.setup.hidden = view !== "setup";
        el.entry.hidden = view !== "entry";
        el.reviewView.hidden = view !== "review";
        el.sheetTitle.textContent = view === "setup" ? "Objetivos diarios" : "Registrar comida";
    }

    function open() {
        window.clearTimeout(closeTimer);
        returnFocus = document.activeElement;
        el.modal.hidden = false;
        document.body.style.overflow = "hidden";
        el.feedback.textContent = "";
        show(settings ? "entry" : "setup");
        window.requestAnimationFrame(() => {
            el.modal.classList.add("is-open");
            window.setTimeout(() => {
                if (settings) entryMode("text");
                else el.calorieGoal.focus();
            }, 180);
        });
    }

    function close() {
        if (el.modal.hidden) return;
        el.modal.classList.remove("is-open");
        document.body.style.overflow = "";
        draft = null;
        closeTimer = window.setTimeout(() => {
            el.modal.hidden = true;
            if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
            returnFocus = null;
        }, 220);
    }

    function entryMode(mode) {
        const frequent = mode === "frequent";
        el.textView.hidden = frequent;
        el.frequentView.hidden = !frequent;
        el.optionButtons.forEach(button => button.classList.toggle("active", button.dataset.nutritionView === mode));
        if (frequent) renderFrequent(); else el.mealText.focus();
    }

    function renderFrequent() {
        const meals = getFrequentMeals();
        el.frequentList.innerHTML = "";
        if (!meals.length) {
            const empty = document.createElement("p");
            empty.textContent = "Todavía no guardaste comidas frecuentes.";
            el.frequentList.appendChild(empty);
            return;
        }
        meals.forEach(meal => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "nutrition-frequent-item";
            button.textContent = meal.rawText;
            const detail = document.createElement("span");
            detail.textContent = `${meal.calories} kcal · ${meal.protein} g proteína`;
            button.appendChild(detail);
            button.addEventListener("click", () => {
                saveMeal({ ...meal, source: "frequent", isFavorite: true });
                renderCard(); close(); announce("✓ Comida registrada");
            });
            el.frequentList.appendChild(button);
        });
    }

    function review() {
        const text = el.mealText.value.trim();
        if (!text) { el.feedback.textContent = "Escribí qué comiste."; el.mealText.focus(); return; }
        draft = parseMealText(text);
        el.originalText.textContent = draft.rawText;
        el.reviewCalories.value = draft.totals.calories;
        el.reviewProtein.value = draft.totals.protein;
        el.reviewCarbs.value = draft.items.length ? draft.totals.carbs : "";
        el.reviewFat.value = draft.items.length ? draft.totals.fat : "";
        el.reviewFavorite.checked = false;
        const recognized = draft.items.map(item => item.sourceText);
        el.recognitionNote.className = `nutrition-recognition-note${draft.unrecognized.length ? " warning" : ""}`;
        el.recognitionNote.textContent = draft.unrecognized.length
            ? `${recognized.length ? `Reconocido: ${recognized.join(", ")}. ` : ""}Sin reconocer: ${draft.unrecognized.join(", ")}. Los valores incluyen únicamente lo reconocido; corregilos antes de guardar.`
            : `Catálogo local: ${recognized.join(", ")}. Revisá cantidades y valores antes de guardar.`;
        el.feedback.textContent = "";
        show("review"); el.reviewCalories.focus();
    }

    function saveSettings(event) {
        event.preventDefault();
        const values = {
            calories: Number(el.calorieGoal.value),
            protein: Number(el.proteinGoal.value),
            water: Number(el.waterGoal.value)
        };
        if (Object.values(values).some(value => !Number.isFinite(value) || value <= 0)) {
            el.feedback.textContent = "Completá los tres objetivos."; return;
        }
        settings = values; write(STORAGE.settings, settings); renderCard(); show("entry");
        announce("✓ Objetivos guardados"); el.mealText.focus();
    }

    function saveReviewed(event) {
        event.preventDefault();
        if (!draft) return;
        saveMeal({
            rawText: draft.rawText, items: draft.items,
            calories: el.reviewCalories.value, protein: el.reviewProtein.value,
            carbs: el.reviewCarbs.value, fat: el.reviewFat.value,
            source: "text", isFavorite: el.reviewFavorite.checked
        });
        el.mealText.value = ""; renderCard(); close(); announce("✓ Comida registrada");
    }

    function collect() {
        const get = name => document.getElementById(`nutrition-${name}`);
        return {
            modal: get("modal"), open: get("open"), close: get("close"), backdrop: get("backdrop"),
            sheetTitle: get("sheet-title"), setup: get("setup"), entry: get("entry"), reviewView: get("review-view"),
            settingsForm: get("settings-form"), calorieGoal: get("calorie-goal"), proteinGoal: get("protein-goal"), waterGoal: get("water-goal"),
            editGoals: get("edit-goals"), addWater: get("add-water"), optionButtons: document.querySelectorAll("[data-nutrition-view]"),
            textView: get("text-view"), frequentView: get("frequent-view"), mealText: get("meal-text"), review: get("review"),
            frequentList: get("frequent-list"), reviewBack: get("review-back"), originalText: get("original-text"), recognitionNote: get("recognition-note"),
            saveForm: get("save-form"), reviewCalories: get("review-calories"), reviewProtein: get("review-protein"),
            reviewCarbs: get("review-carbs"), reviewFat: get("review-fat"), reviewFavorite: get("review-favorite"), feedback: get("feedback"),
            calories: get("calories"), protein: get("protein"), water: get("water"), toast: get("toast")
        };
    }

    function init() {
        el = collect();
        if (!el.modal || !el.open) return;
        entries = read(STORAGE.entries, [], Array.isArray);
        hydration = read(STORAGE.hydration, [], Array.isArray);
        settings = read(STORAGE.settings, null, value => value !== null && typeof value === "object");
        el.open.addEventListener("click", open);
        el.close.addEventListener("click", close);
        el.backdrop.addEventListener("click", close);
        el.settingsForm.addEventListener("submit", saveSettings);
        el.editGoals.addEventListener("click", () => {
            el.calorieGoal.value = settings?.calories || "";
            el.proteinGoal.value = settings?.protein || "";
            el.waterGoal.value = settings?.water || "";
            show("setup");
        });
        el.addWater.addEventListener("click", () => { addWater(250); renderCard(); announce("✓ +250 ml"); });
        el.optionButtons.forEach(button => button.addEventListener("click", () => entryMode(button.dataset.nutritionView)));
        el.review.addEventListener("click", review);
        el.reviewBack.addEventListener("click", () => show("entry"));
        el.saveForm.addEventListener("submit", saveReviewed);
        document.addEventListener("keydown", event => { if (event.key === "Escape" && !el.modal.hidden) close(); });
        renderCard();
    }

    const api = Object.freeze({ STORAGE, parseMealText, calculateDailyTotals, getDailyStatus, getFrequentMeals, normalizeText });
    if (typeof window !== "undefined") window.ForzaNutrition = api;
    if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => {
        try { init(); }
        catch (error) { console.error("Nutrition no pudo iniciarse. Gym continúa disponible.", error); }
    });
}());
