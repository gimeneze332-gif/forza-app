/* FORZA Nutrition: módulo aislado. No lee ni escribe claves de Gym. */
(function () {
    "use strict";

    const STORAGE = Object.freeze({
        entries: "forza_nutrition_entries",
        hydration: "forza_nutrition_hydration",
        settings: "forza_nutrition_settings",
        meals: "forza_nutrition_meals",
        smartMemory: "forza_nutrition_smart_text_memory"
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
    let meals = [];
    let smartMemory = null;
    let draft = null;
    let el = null;
    let closeTimer = null;
    let toastTimer = null;
    let returnFocus = null;
    let todayExpanded = false;
    let selectedEntryId = null;
    let editingEntryId = null;

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

    function parseNutritionNumber(value, { optional = false } = {}) {
        if (typeof value === "number") {
            return Number.isFinite(value) && value >= 0 ? value : null;
        }
        const text = String(value ?? "").trim();
        if (!text) return optional ? null : null;
        if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
        const normalized = Number(text.replace(",", "."));
        return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
    }

    function normalizeMealNutrition(meal) {
        const calories = parseNutritionNumber(meal.calories);
        const protein = parseNutritionNumber(meal.protein);
        const carbs = parseNutritionNumber(meal.carbs, { optional: true });
        const fat = parseNutritionNumber(meal.fat, { optional: true });
        const hasCarbs = String(meal.carbs ?? "").trim() !== "";
        const hasFat = String(meal.fat ?? "").trim() !== "";
        if (calories == null || protein == null || carbs == null && hasCarbs || fat == null && hasFat) {
            throw new Error("invalid_nutrition_number");
        }
        return { calories, protein, carbs, fat };
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
        const nutrition = normalizeMealNutrition(meal);
        const saved = {
            id: id("meal"), date: dateKey(), createdAt: new Date().toISOString(),
            rawText: String(meal.rawText || "").trim(),
            items: Array.isArray(meal.items) ? meal.items : [],
            ...nutrition,
            source: meal.source === "frequent" ? "frequent" : "text",
            isFavorite: Boolean(meal.isFavorite)
        };
        if (meal.recognition) saved.recognition = meal.recognition;
        if (meal.contextType) saved.contextType = meal.contextType;
        if (Number.isFinite(Number(meal.confidence))) saved.confidence = Number(meal.confidence);
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

    function createdAtTime(entry) {
        if (!entry?.createdAt) return null;
        const value = Date.parse(entry.createdAt);
        return Number.isFinite(value) ? value : null;
    }

    function getTodayMeals(day = dateKey(), meals = entries) {
        return meals.filter(item => item?.date === day).map((item, index) => ({ item, index, time: createdAtTime(item) }))
            .sort((left, right) => {
                if (left.time == null && right.time == null) return left.index - right.index;
                if (left.time == null) return 1;
                if (right.time == null) return -1;
                return right.time - left.time || right.index - left.index;
            }).map(row => row.item);
    }

    function getVisibleTodayMeals(day = dateKey(), meals = entries, expanded = false) {
        const todayMeals = getTodayMeals(day, meals);
        return expanded ? todayMeals : todayMeals.slice(0, 4);
    }

    function isSafeEntryId(entry, meals = entries) {
        if (typeof entry?.id !== "string" || !entry.id.trim()) return false;
        return meals.filter(item => item?.id === entry.id).length === 1;
    }

    function updateMealEntry(meals, entryId, changes) {
        const current = meals.find(item => item?.id === entryId);
        if (!current || !isSafeEntryId(current, meals)) throw new Error("unsafe_nutrition_entry");
        const rawText = String(changes.rawText || "").trim();
        if (!rawText) throw new Error("invalid_nutrition_name");
        const nutrition = normalizeMealNutrition(changes);
        return meals.map(item => item === current ? { ...item, rawText, ...nutrition } : item);
    }

    function deleteMealEntry(meals, entryId) {
        const current = meals.find(item => item?.id === entryId);
        if (!current || !isSafeEntryId(current, meals)) throw new Error("unsafe_nutrition_entry");
        return meals.filter(item => item !== current);
    }

    function formatNutritionValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number.toLocaleString("es-AR", { maximumFractionDigits: 10 }) : "0";
    }

    function smartTextApi() {
        const api = typeof window !== "undefined" ? window.ForzaSmartText : null;
        return api && typeof api.interpret === "function" ? api : null;
    }

    function recalculateDraftTotals() {
        const keys = ["calories", "protein", "carbs", "fat"];
        draft.totals = {};
        keys.forEach(key => {
            const values = draft.items.map(item => item[key]).filter(value => value != null && Number.isFinite(Number(value)));
            draft.totals[key] = values.length ? round(values.reduce((sum, value) => sum + Number(value), 0)) : null;
        });
        fillReviewTotals();
    }

    function fillReviewTotals() {
        const value = key => draft?.totals?.[key] == null ? "" : draft.totals[key];
        el.reviewCalories.value = value("calories");
        el.reviewProtein.value = value("protein");
        el.reviewCarbs.value = value("carbs");
        el.reviewFat.value = value("fat");
    }

    function rememberItem(item) {
        const api = smartTextApi();
        if (!api || !item?.catalogId || !item?.sourceText) return;
        smartMemory = api.rememberCorrection(smartMemory, {
            alias: item.sourceText, foodId: item.catalogId, grams: item.grams
        });
        write(STORAGE.smartMemory, smartMemory);
    }

    function resizeDraftItem(index, multiplier) {
        const item = draft.items[index];
        if (!item || !Number.isFinite(Number(item.grams)) || item.grams <= 0) return;
        const previousGrams = Number(item.grams);
        const grams = round(Number(item.baseGrams || previousGrams) * multiplier);
        ["calories", "protein", "carbs", "fat"].forEach(key => {
            if (item[key] != null) item[key] = round(Number(item[key]) * grams / previousGrams);
        });
        item.grams = grams;
        item.quantity = item.unit === "g" || item.unit === "ml"
            ? grams : round(Number(item.baseQuantity || item.quantity || 1) * multiplier);
        item.estimated = true;
        item.requiresConfirmation = true;
        recalculateDraftTotals();
        rememberItem(item);
        renderSmartDetails();
    }

    function renderSmartDetails() {
        el.smartDetails.innerHTML = "";
        if (!draft?.smartText) { if (el.saveAction) el.saveAction.disabled = false; return; }
        if (el.saveAction) el.saveAction.disabled = Boolean((draft.questions || []).length);

        if (draft.items.length) {
            const list = document.createElement("div");
            list.className = "smart-text-items";
            draft.items.forEach((item, index) => {
                const card = document.createElement("article");
                card.className = "smart-text-item";
                const title = document.createElement("strong");
                title.textContent = item.name || item.sourceText || "Componente";
                const detail = document.createElement("span");
                const quantity = item.grams ? `${item.grams} g` : "Cantidad pendiente";
                detail.textContent = item.estimated ? `${quantity} · Revisá la cantidad` : quantity;
                card.append(title, detail);
                if (item.estimated) {
                    const sizes = document.createElement("div");
                    sizes.className = "smart-text-choices";
                    [[.7, "Pequeña"], [1, "Normal"], [1.4, "Grande"]].forEach(([multiplier, label]) => {
                        const button = document.createElement("button");
                        button.type = "button"; button.textContent = label;
                        button.addEventListener("click", () => resizeDraftItem(index, multiplier));
                        sizes.appendChild(button);
                    });
                    card.appendChild(sizes);
                }
                list.appendChild(card);
            });
            el.smartDetails.appendChild(list);
        }

        (draft.questions || []).forEach((question, questionIndex) => {
            const block = document.createElement("div");
            block.className = "smart-text-question";
            const label = document.createElement("strong");
            label.textContent = question.label;
            block.appendChild(label);
            const choices = document.createElement("div");
            choices.className = "smart-text-choices";
            if (question.type === "food-choice") {
                question.choices.forEach(choice => {
                    const button = document.createElement("button");
                    button.type = "button"; button.textContent = choice.label;
                    button.addEventListener("click", () => {
                        const api = smartTextApi();
                        draft = { ...api.resolveChoice(draft, questionIndex, choice.id, "normal"), smartText: true };
                        const added = draft.items[draft.items.length - 1];
                        rememberItem(added); recalculateDraftTotals(); renderSmartDetails(); renderRecognitionNote();
                    });
                    choices.appendChild(button);
                });
            } else if (question.type === "candidate") {
                (question.candidates || []).forEach((candidate, candidateIndex) => {
                    const button = document.createElement("button");
                    button.type = "button"; button.textContent = candidate.label;
                    button.addEventListener("click", () => {
                        draft = { ...smartTextApi().selectContextCandidate(draft, candidateIndex), smartText: true };
                        recalculateDraftTotals(); renderSmartDetails(); renderRecognitionNote();
                    });
                    choices.appendChild(button);
                });
            } else if (question.type === "preparation") {
                const button = document.createElement("button");
                button.type = "button"; button.textContent = "Confirmar y continuar";
                button.addEventListener("click", () => {
                    draft.questions = draft.questions.filter((_, index) => index !== questionIndex);
                    renderSmartDetails(); renderRecognitionNote();
                });
                choices.appendChild(button);
            }
            block.appendChild(choices);
            el.smartDetails.appendChild(block);
        });
    }

    function renderRecognitionNote() {
        const recognized = draft.items.map(item => item.name || item.sourceText);
        const warnings = [];
        if (draft.unrecognized?.length) warnings.push(`No pude reconocer esto: ${draft.unrecognized.join(", ")}.`);
        if (draft.requiresConfirmation) warnings.push("Revisá lo marcado antes de guardar.");
        if (draft.contextType) warnings.push("Confirmá que sea la comida correcta.");
        el.recognitionNote.className = `nutrition-recognition-note${warnings.length ? " warning" : ""}`;
        el.recognitionNote.textContent = warnings.length
            ? warnings.join(" ")
            : `Revisá ${recognized.length ? "los alimentos y " : ""}las cantidades antes de guardar.`;
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

    function mealLabel(meal) {
        const rawText = String(meal?.rawText || "").trim();
        if (rawText) return rawText;
        const itemNames = Array.isArray(meal?.items)
            ? meal.items.map(item => String(item?.name || item?.sourceText || "").trim()).filter(Boolean)
            : [];
        return itemNames.join(", ") || "Comida";
    }

    function renderTodayMeals() {
        if (!el.todayList) return;
        const todayMeals = getTodayMeals();
        const visible = getVisibleTodayMeals(dateKey(), entries, todayExpanded);
        el.todayList.innerHTML = "";
        if (!visible.length) {
            const empty = document.createElement("p");
            empty.className = "nutrition-today-empty";
            empty.textContent = "Aún no registraste comidas hoy.";
            el.todayList.appendChild(empty);
        }
        visible.forEach(meal => {
            const safe = isSafeEntryId(meal);
            const row = document.createElement(safe ? "button" : "article");
            if (safe) row.type = "button";
            row.className = `nutrition-today-item${safe ? "" : " is-readonly"}`;
            const title = document.createElement("strong");
            title.textContent = mealLabel(meal);
            const detail = document.createElement("span");
            detail.textContent = `${formatNutritionValue(meal.calories)} kcal · ${formatNutritionValue(meal.protein)} g proteína`;
            row.append(title, detail);
            if (safe) row.addEventListener("click", () => {
                selectedEntryId = selectedEntryId === meal.id ? null : meal.id;
                renderTodayMeals();
            });
            el.todayList.appendChild(row);
            if (safe && selectedEntryId === meal.id) el.todayList.appendChild(createTodayActions(meal));
        });
        const hasMore = todayMeals.length > 4;
        el.todayToggle.hidden = !hasMore;
        el.todayToggle.textContent = todayExpanded ? "Mostrar menos" : `Ver todas (${todayMeals.length})`;
    }

    function createTodayActions(meal) {
        const actions = document.createElement("div");
        actions.className = "nutrition-today-actions";
        const edit = document.createElement("button");
        edit.type = "button"; edit.className = "nutrition-text-button"; edit.textContent = "Editar";
        edit.addEventListener("click", () => beginHistoryEdit(meal));
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "nutrition-text-button nutrition-delete-button"; remove.textContent = "Eliminar";
        remove.addEventListener("click", () => renderDeleteConfirmation(meal, actions));
        actions.append(edit, remove);
        return actions;
    }

    function renderDeleteConfirmation(meal, container) {
        container.innerHTML = "";
        const question = document.createElement("p");
        question.textContent = "¿Eliminar esta comida?";
        const cancel = document.createElement("button");
        cancel.type = "button"; cancel.className = "nutrition-text-button"; cancel.textContent = "Cancelar";
        cancel.addEventListener("click", () => { selectedEntryId = null; renderTodayMeals(); });
        const confirm = document.createElement("button");
        confirm.type = "button"; confirm.className = "nutrition-delete-confirm"; confirm.textContent = "Eliminar";
        confirm.addEventListener("click", () => {
            entries = deleteMealEntry(entries, meal.id);
            write(STORAGE.entries, entries);
            selectedEntryId = null;
            renderTodayMeals(); renderCard(); announce("✓ Comida eliminada");
        });
        container.append(question, cancel, confirm);
    }

    function beginHistoryEdit(meal) {
        if (!isSafeEntryId(meal)) return;
        editingEntryId = meal.id;
        el.historyFood.value = mealLabel(meal);
        el.historyCalories.value = meal.calories ?? "";
        el.historyProtein.value = meal.protein ?? "";
        el.historyCarbs.value = meal.carbs ?? "";
        el.historyFat.value = meal.fat ?? "";
        el.feedback.textContent = "";
        show("history-edit");
        el.historyFood.focus({ preventScroll: true });
    }

    function saveHistoryEdit(event) {
        event.preventDefault();
        try {
            entries = updateMealEntry(entries, editingEntryId, {
                rawText: el.historyFood.value, calories: el.historyCalories.value,
                protein: el.historyProtein.value, carbs: el.historyCarbs.value, fat: el.historyFat.value
            });
        } catch (error) {
            el.feedback.textContent = error?.message === "invalid_nutrition_name"
                ? "Ingresá el alimento." : "Ingresá un número válido.";
            return;
        }
        write(STORAGE.entries, entries);
        editingEntryId = null; selectedEntryId = null;
        el.feedback.textContent = "";
        renderTodayMeals(); renderCard(); show("entry"); announce("✓ Comida actualizada");
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
        el.historyEdit.hidden = view !== "history-edit";
        el.sheetTitle.textContent = view === "setup" ? "Objetivos diarios"
            : view === "history-edit" ? "Editar comida" : "Registrar comida";
        if (el.sheet) el.sheet.scrollTop = 0;
    }

    function open() {
        window.clearTimeout(closeTimer);
        returnFocus = document.activeElement;
        el.modal.hidden = false;
        document.body.style.overflow = "hidden";
        el.feedback.textContent = "";
        selectedEntryId = null;
        todayExpanded = false;
        renderTodayMeals();
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
        editingEntryId = null;
        if (window.ForzaPhotoFood?.reset) window.ForzaPhotoFood.reset();
        closeTimer = window.setTimeout(() => {
            el.modal.hidden = true;
            if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
            returnFocus = null;
        }, 220);
    }

    function entryMode(mode) {
        const frequent = mode === "frequent";
        const photo = mode === "photo";
        el.textView.hidden = frequent || photo;
        el.frequentView.hidden = !frequent;
        if (el.photoView) el.photoView.hidden = !photo;
        el.optionButtons.forEach(button => button.classList.toggle("active", button.dataset.nutritionView === mode));
        if (photo) {
            try { window.ForzaPhotoFood?.open(); }
            catch (error) { console.warn("Photo Food no pudo iniciarse. Nutrition continúa disponible.", error); entryMode("text"); }
        } else {
            if (window.ForzaPhotoFood?.hide) window.ForzaPhotoFood.hide();
            if (frequent) renderFrequent(); else el.mealText.focus();
        }
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
                renderTodayMeals(); renderCard(); close(); announce("✓ Comida registrada");
            });
            el.frequentList.appendChild(button);
        });
    }

    function reviewText(text, metadata = {}) {
        if (!text) { el.feedback.textContent = "Escribí qué comiste."; el.mealText.focus(); return; }
        const api = smartTextApi();
        if (api) {
            try {
                draft = { ...api.interpret(text, { entries, meals, memory: smartMemory, now: new Date() }), smartText: true, ...metadata };
            } catch (error) {
                console.warn("Smart Text no pudo interpretar la comida. Se usará el reconocimiento básico.", error);
                draft = { ...parseMealText(text), ...metadata };
            }
        } else draft = { ...parseMealText(text), ...metadata };
        el.originalText.textContent = draft.rawText;
        fillReviewTotals();
        el.reviewFavorite.checked = false;
        el.reviewMealName.value = "";
        renderRecognitionNote(); renderSmartDetails();
        el.feedback.textContent = "";
        show("review"); el.reviewTitle?.focus({ preventScroll: true });
    }

    function review() { reviewText(el.mealText.value.trim()); }

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
        let saved;
        try {
            saved = saveMeal({
                rawText: draft.rawText, items: draft.items,
                calories: el.reviewCalories.value, protein: el.reviewProtein.value,
                carbs: el.reviewCarbs.value, fat: el.reviewFat.value,
                source: "text", isFavorite: el.reviewFavorite.checked,
                recognition: draft.recognition || (draft.smartText ? "smart-text-v1" : undefined),
                contextType: draft.contextType, confidence: draft.confidence
            });
        } catch (error) {
            if (error?.message === "invalid_nutrition_number") {
                el.feedback.textContent = "Ingresá un número válido.";
                return;
            }
            throw error;
        }
        const mealName = el.reviewMealName.value.trim();
        const api = smartTextApi();
        if (mealName && api && draft.items.length) {
            const definition = api.createMealDefinition(mealName, draft.items, {
                id: id("meal-template"), aliases: [], isFavorite: el.reviewFavorite.checked,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
            if (definition) {
                const normalized = api.normalizeText(mealName);
                meals = meals.filter(meal => api.normalizeText(meal.name) !== normalized);
                meals.push(definition); write(STORAGE.meals, meals);
            }
        }
        el.mealText.value = ""; renderTodayMeals(); renderCard(); close(); announce("✓ Comida registrada");
    }

    function collect() {
        const get = name => document.getElementById(`nutrition-${name}`);
        return {
            modal: get("modal"), open: get("open"), close: get("close"), backdrop: get("backdrop"),
            sheet: document.querySelector(".nutrition-sheet"),
            sheetTitle: get("sheet-title"), setup: get("setup"), entry: get("entry"), reviewView: get("review-view"),
            settingsForm: get("settings-form"), calorieGoal: get("calorie-goal"), proteinGoal: get("protein-goal"), waterGoal: get("water-goal"),
            editGoals: get("edit-goals"), addWater: get("add-water"), optionButtons: document.querySelectorAll("[data-nutrition-view]"),
            textView: get("text-view"), frequentView: get("frequent-view"), photoView: document.getElementById("photo-food-view"), mealText: get("meal-text"), review: get("review"),
            frequentList: get("frequent-list"), reviewBack: get("review-back"), reviewTitle: get("review-title"), originalText: get("original-text"), recognitionNote: get("recognition-note"),
            saveForm: get("save-form"), reviewCalories: get("review-calories"), reviewProtein: get("review-protein"),
            reviewCarbs: get("review-carbs"), reviewFat: get("review-fat"), reviewFavorite: get("review-favorite"),
            reviewMealName: get("review-meal-name"), smartDetails: get("smart-details"), saveAction: document.querySelector(".nutrition-save-action"), feedback: get("feedback"),
            calories: get("calories"), protein: get("protein"), water: get("water"), toast: get("toast"),
            todayList: get("today-list"), todayToggle: get("today-toggle"), historyEdit: get("history-edit"),
            historyEditBack: get("history-edit-back"), historyEditForm: get("history-edit-form"),
            historyFood: get("history-food"), historyCalories: get("history-calories"), historyProtein: get("history-protein"),
            historyCarbs: get("history-carbs"), historyFat: get("history-fat")
        };
    }

    function init() {
        el = collect();
        if (!el.modal || !el.open) return;
        entries = read(STORAGE.entries, [], Array.isArray);
        hydration = read(STORAGE.hydration, [], Array.isArray);
        settings = read(STORAGE.settings, null, value => value !== null && typeof value === "object");
        meals = read(STORAGE.meals, [], Array.isArray);
        const api = smartTextApi();
        const rawMemory = read(STORAGE.smartMemory, null, value => value !== null && typeof value === "object");
        smartMemory = api ? api.sanitizeMemory(rawMemory) : rawMemory;
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
        el.todayToggle.addEventListener("click", () => { todayExpanded = !todayExpanded; renderTodayMeals(); });
        el.historyEditBack.addEventListener("click", () => { editingEntryId = null; show("entry"); renderTodayMeals(); });
        el.historyEditForm.addEventListener("submit", saveHistoryEdit);
        document.addEventListener("keydown", event => { if (event.key === "Escape" && !el.modal.hidden) close(); });
        try {
            window.ForzaPhotoFood?.init({
                onProposal(text, metadata) { el.mealText.value = text; reviewText(text, metadata); },
                onFallback() { entryMode("text"); }
            });
        } catch (error) {
            console.warn("Photo Food no pudo iniciarse. Nutrition y Gym continúan disponibles.", error);
            const button = Array.from(el.optionButtons).find(item => item.dataset.nutritionView === "photo");
            if (button) button.hidden = true;
        }
        renderTodayMeals(); renderCard();
    }

    const api = Object.freeze({ STORAGE, parseMealText, parseNutritionNumber, normalizeMealNutrition, calculateDailyTotals, getDailyStatus, getFrequentMeals, getTodayMeals, getVisibleTodayMeals, isSafeEntryId, updateMealEntry, deleteMealEntry, formatNutritionValue, normalizeText });
    if (typeof window !== "undefined") window.ForzaNutrition = api;
    if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => {
        try { init(); }
        catch (error) { console.error("Nutrition no pudo iniciarse. Gym continúa disponible.", error); }
    });
}());
