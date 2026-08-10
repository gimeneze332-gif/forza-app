/* FORZA Smart Text v1: intérprete local, determinista y offline. */
(function (root) {
    "use strict";

    const catalogBundle = root.ForzaSmartText && root.ForzaSmartText.__catalog;
    const CATALOG_VERSION = catalogBundle?.version || 0;
    const FOODS = Array.isArray(catalogBundle?.foods) ? catalogBundle.foods : [];
    const DISHES = Array.isArray(catalogBundle?.dishes) ? catalogBundle.dishes : [];
    const MEMORY_SCHEMA = 1;
    const MEAL_SCHEMA = 1;

    const unitAliases = Object.freeze({
        g: "g", gr: "g", gramo: "g", gramos: "g",
        ml: "ml", mililitro: "ml", mililitros: "ml",
        unidad: "unit", unidades: "unit",
        taza: "cup", tazas: "cup",
        cucharada: "tbsp", cucharadas: "tbsp",
        cucharadita: "tsp", cucharaditas: "tsp",
        vaso: "glass", vasos: "glass",
        rodaja: "slice", rodajas: "slice", rebanada: "slice", rebanadas: "slice",
        porcion: "portion", porciones: "portion"
    });

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es-AR")
            .replace(/[;:!?()[\]{}]/g, " ")
            .replace(/\s+/g, " ").trim();
    }

    function round(value) {
        return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
    }

    function roundConfidence(value) {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    function dateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function previousDateKey(now = new Date()) {
        const date = new Date(now);
        date.setDate(date.getDate() - 1);
        return dateKey(date);
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function hasPhrase(text, phrase) {
        return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizeText(phrase))}([^a-z0-9]|$)`).test(text);
    }

    function levenshtein(a, b) {
        if (a === b) return 0;
        const row = Array.from({ length: b.length + 1 }, (_, index) => index);
        for (let i = 1; i <= a.length; i += 1) {
            let previous = row[0];
            row[0] = i;
            for (let j = 1; j <= b.length; j += 1) {
                const current = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
                previous = current;
            }
        }
        return row[b.length];
    }

    function foodById(id) {
        return FOODS.find(item => item.id === id) || null;
    }

    function sanitizeMemory(value) {
        if (!value || typeof value !== "object" || value.schemaVersion !== MEMORY_SCHEMA || value.catalogVersion !== CATALOG_VERSION) {
            return { schemaVersion: MEMORY_SCHEMA, catalogVersion: CATALOG_VERSION, aliases: {}, portions: {} };
        }
        return {
            schemaVersion: MEMORY_SCHEMA,
            catalogVersion: CATALOG_VERSION,
            aliases: value.aliases && typeof value.aliases === "object" ? { ...value.aliases } : {},
            portions: value.portions && typeof value.portions === "object" ? { ...value.portions } : {}
        };
    }

    function rememberCorrection(memoryValue, correction) {
        const memory = sanitizeMemory(memoryValue);
        const food = foodById(correction?.foodId);
        if (!food) return memory;
        const alias = normalizeText(correction.alias);
        if (alias) memory.aliases[alias] = { foodId: food.id, confirmedAt: new Date().toISOString() };
        if (Number(correction.grams) > 0) {
            memory.portions[food.id] = { grams: Number(correction.grams), confirmedAt: new Date().toISOString() };
        }
        return memory;
    }

    function sanitizeMeal(meal) {
        if (!meal || typeof meal !== "object" || !Array.isArray(meal.items)) return null;
        const name = String(meal.name || "").trim();
        if (!name) return null;
        return {
            id: String(meal.id || ""), name, normalizedName: normalizeText(meal.normalizedName || name),
            aliases: Array.isArray(meal.aliases) ? meal.aliases.map(normalizeText).filter(Boolean) : [],
            items: meal.items.filter(item => item && typeof item === "object").map(item => ({ ...item })),
            isFavorite: Boolean(meal.isFavorite), usageCount: Number(meal.usageCount || 0),
            createdAt: meal.createdAt || null, updatedAt: meal.updatedAt || null,
            schemaVersion: MEAL_SCHEMA
        };
    }

    function createMealDefinition(name, items, extra = {}) {
        return sanitizeMeal({ ...extra, name, items, schemaVersion: MEAL_SCHEMA });
    }

    function nutritionFor(food, grams) {
        const result = {};
        ["calories", "protein", "carbs", "fat"].forEach(key => {
            const value = food.nutrition[key];
            result[key] = value == null ? null : round(value * grams / 100);
        });
        return result;
    }

    function quantityFromText(text, food, rememberedPortion) {
        const normalized = normalizeText(text);
        let value = null;
        let unit = null;
        let explicit = false;
        if (/\b(?:medio|media)\s+taza\b/.test(normalized)) { value = 0.5; unit = "cup"; explicit = true; }
        else if (/\b(?:medio|media)\b/.test(normalized)) {
            value = 0.5;
            unit = /\bvaso\b/.test(normalized) ? "glass" : (food.measures.unit ? "unit" : food.defaultQuantity.unit);
            explicit = true;
        } else {
            const match = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(g|gr|gramos?|ml|mililitros?|unidades?|tazas?|cucharadas?|cucharaditas?|vasos?|rodajas?|rebanadas?|porciones?)?\b/);
            if (match) {
                value = Number(match[1].replace(",", "."));
                unit = match[2] ? unitAliases[match[2]] : (food.measures.unit ? "unit" : null);
                explicit = Boolean(unit);
            } else {
                const wordMatch = normalized.match(/\b(un|una|uno|dos|tres)\s*(g|gr|gramos?|ml|mililitros?|unidades?|tazas?|cucharadas?|cucharaditas?|vasos?|rodajas?|rebanadas?|porciones?)?\b/);
                if (wordMatch) {
                    value = { un: 1, una: 1, uno: 1, dos: 2, tres: 3 }[wordMatch[1]];
                    unit = wordMatch[2] ? unitAliases[wordMatch[2]] : (food.measures.unit ? "unit" : food.defaultQuantity.unit);
                    explicit = true;
                }
            }
        }

        if (value != null && unit === "g") return { value, unit, grams: value, explicit, estimated: false };
        if (value != null && unit === "ml") return { value, unit, grams: value, explicit, estimated: false };
        if (value != null && unit && food.measures[unit]) {
            return { value, unit, grams: round(value * food.measures[unit]), explicit, estimated: false };
        }
        if (value != null && !unit && food.measures.unit) {
            return { value, unit: "unit", grams: round(value * food.measures.unit), explicit: true, estimated: false };
        }
        if (rememberedPortion?.grams > 0) {
            return { value: rememberedPortion.grams, unit: "g", grams: rememberedPortion.grams, explicit: false, estimated: true, remembered: true };
        }
        return { ...food.defaultQuantity, explicit: false, estimated: true };
    }

    function matchFood(text, memory) {
        const normalized = normalizeText(text);
        const remembered = memory.aliases[normalized];
        if (remembered && foodById(remembered.foodId)) return { food: foodById(remembered.foodId), confidence: 0.96, match: "memory" };

        const exact = [];
        FOODS.forEach(food => food.aliases.forEach(alias => {
            if (hasPhrase(normalized, alias)) exact.push({ food, alias: normalizeText(alias) });
        }));
        if (exact.length) {
            exact.sort((a, b) => b.alias.length - a.alias.length);
            const bestLength = exact[0].alias.length;
            const best = exact.filter(item => item.alias.length === bestLength);
            const uniqueIds = [...new Set(best.map(item => item.food.id))];
            if (uniqueIds.length === 1) return { food: best[0].food, confidence: 0.94, match: "alias" };
            return { ambiguous: best.map(item => item.food), confidence: 0.35 };
        }

        const words = normalized.split(/\s+/).filter(word => word.length >= 5);
        const fuzzy = [];
        FOODS.forEach(food => food.aliases.forEach(alias => {
            const normalizedAlias = normalizeText(alias);
            if (!normalizedAlias.includes(" ") && words.some(word => levenshtein(word, normalizedAlias) === 1)) fuzzy.push(food);
        }));
        const unique = [...new Map(fuzzy.map(food => [food.id, food])).values()];
        if (unique.length === 1) return { food: unique[0], confidence: 0.72, match: "fuzzy" };
        if (unique.length > 1) return { ambiguous: unique, confidence: 0.3 };
        return null;
    }

    function detectPreparation(text, food) {
        const normalized = normalizeText(text);
        const known = [
            ["en freidora de aire", "air_fryer"], ["freidora de aire", "air_fryer"],
            ["en air fryer", "air_fryer"], ["air fryer", "air_fryer"],
            ["a la plancha", "plancha"], ["plancha", "plancha"], ["al horno", "horno"],
            ["hervido", "hervido"], ["hervida", "hervido"], ["frito", "frito"], ["frita", "frita"],
            ["revuelto", "revuelto"], ["revueltos", "revuelto"]
        ].find(([phrase]) => hasPhrase(normalized, phrase));
        if (!known) return { preparation: null, ambiguous: false };
        const preparation = known[1];
        const allowed = food.preparations || [];
        return { preparation, ambiguous: allowed.length > 0 && !allowed.includes(preparation) };
    }

    function itemFromFood(food, sourceText, memory, confidence, options = {}) {
        const quantity = options.quantity || quantityFromText(sourceText, food, memory.portions[food.id]);
        const preparation = detectPreparation(sourceText, food);
        const nutrition = nutritionFor(food, quantity.grams);
        let finalConfidence = Math.min(confidence, food.confidenceCap || 1);
        if (quantity.estimated) finalConfidence -= 0.16;
        if (food.relevantPreparation && !preparation.preparation) finalConfidence -= 0.12;
        if (food.variable) finalConfidence -= 0.08;
        if (preparation.ambiguous) finalConfidence -= 0.22;
        const estimated = Boolean(quantity.estimated || food.variable);
        return {
            catalogId: food.id, name: food.name, sourceText,
            quantity: quantity.value, unit: quantity.unit, grams: quantity.grams,
            baseQuantity: quantity.value, baseGrams: quantity.grams,
            explicitQuantity: quantity.explicit, estimated,
            quantityEstimated: quantity.estimated, nutritionEstimated: Boolean(food.variable),
            preparation: preparation.preparation,
            confidence: roundConfidence(Math.max(0, finalConfidence)),
            requiresConfirmation: Boolean(estimated || preparation.ambiguous || finalConfidence < 0.85),
            preparationAmbiguous: preparation.ambiguous,
            ...nutrition
        };
    }

    function splitSegments(text) {
        return String(text || "").split(/,|\s+(?:con|y|mas|más)\s+/i).map(value => value.trim()).filter(Boolean);
    }

    function totalsFor(items) {
        const totals = {};
        ["calories", "protein", "carbs", "fat"].forEach(key => {
            const values = items.map(item => item[key]).filter(value => value != null && Number.isFinite(Number(value)));
            totals[key] = values.length ? round(values.reduce((sum, value) => sum + Number(value), 0)) : null;
        });
        return totals;
    }

    function cloneItems(items, contextual = false) {
        return items.map(item => ({ ...item, requiresConfirmation: contextual || Boolean(item.requiresConfirmation) }));
    }

    function contextualResult(rawText, context, memory) {
        const normalized = normalizeText(rawText);
        const meals = (Array.isArray(context.meals) ? context.meals : []).map(sanitizeMeal).filter(Boolean);
        const entries = Array.isArray(context.entries) ? context.entries : [];
        const meal = meals.find(candidate => candidate.normalizedName === normalized || candidate.aliases.includes(normalized));
        if (meal) {
            const items = cloneItems(meal.items, true);
            return { rawText, normalizedText: normalized, items, unrecognized: [], totals: totalsFor(items), confidence: 0.98, contextType: "meal", contextLabel: meal.name, mealId: meal.id, requiresConfirmation: true, questions: [] };
        }

        const namedMealReference = ["mi desayuno", "mi merienda", "mi post entreno"].includes(normalized);
        if (namedMealReference) {
            return { rawText, normalizedText: normalized, items: [], unrecognized: [rawText], totals: totalsFor([]), confidence: 0, contextType: "meal-missing", requiresConfirmation: true, questions: [{ type: "missing-meal", label: `No existe una Meal llamada “${rawText}”.` }] };
        }

        if (normalized === "lo de ayer") {
            const day = previousDateKey(context.now || new Date());
            const candidates = entries.filter(entry => entry.date === day).map(entry => ({
                id: entry.id, label: entry.rawText || "Comida de ayer", items: cloneItems(Array.isArray(entry.items) ? entry.items : [], true),
                totals: { calories: entry.calories ?? null, protein: entry.protein ?? null, carbs: entry.carbs ?? null, fat: entry.fat ?? null }
            }));
            if (candidates.length === 1) return { rawText, normalizedText: normalized, ...candidates[0], unrecognized: [], confidence: 0.9, contextType: "yesterday", requiresConfirmation: true, questions: [] };
            return { rawText, normalizedText: normalized, items: [], unrecognized: candidates.length ? [] : [rawText], totals: totalsFor([]), candidates, confidence: candidates.length ? 0.7 : 0, contextType: "yesterday", requiresConfirmation: true, questions: candidates.length ? [{ type: "candidate", label: "¿Cuál comida de ayer?", candidates }] : [{ type: "missing-context", label: "No encontré comidas de ayer." }] };
        }

        if (normalized === "lo de siempre") {
            const counts = new Map();
            entries.forEach(entry => {
                const key = normalizeText(entry.rawText);
                if (!key) return;
                const current = counts.get(key) || { count: 0, entry };
                current.count += 1; current.entry = entry; counts.set(key, current);
            });
            const candidates = [...counts.values()].filter(value => value.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3).map(value => ({
                id: value.entry.id, label: value.entry.rawText, items: cloneItems(Array.isArray(value.entry.items) ? value.entry.items : [], true),
                totals: { calories: value.entry.calories ?? null, protein: value.entry.protein ?? null, carbs: value.entry.carbs ?? null, fat: value.entry.fat ?? null }
            }));
            if (candidates.length === 1) return { rawText, normalizedText: normalized, ...candidates[0], unrecognized: [], confidence: 0.82, contextType: "usual", requiresConfirmation: true, questions: [] };
            return { rawText, normalizedText: normalized, items: [], unrecognized: candidates.length ? [] : [rawText], totals: totalsFor([]), candidates, confidence: candidates.length ? 0.65 : 0, contextType: "usual", requiresConfirmation: true, questions: candidates.length ? [{ type: "candidate", label: "¿Cuál de tus comidas habituales?", candidates }] : [{ type: "missing-context", label: "Todavía no hay una comida suficientemente habitual." }] };
        }
        return null;
    }

    function dishResult(rawText, memory) {
        const normalized = normalizeText(rawText);
        const dish = DISHES.find(candidate => candidate.aliases.some(alias => normalizeText(alias) === normalized));
        if (!dish) return null;
        const items = [];
        const questions = [];
        dish.components.forEach(component => {
            if (component.foodId) items.push(itemFromFood(foodById(component.foodId), rawText, memory, 0.86));
            else if (component.ambiguous) {
                questions.push({ type: "food-choice", label: component.label, sourceText: rawText, choices: component.choices.map(id => ({ id, label: foodById(id).name })) });
            }
        });
        return { rawText, normalizedText: normalized, items, unrecognized: [], totals: totalsFor(items), confidence: questions.length ? 0.55 : 0.72, dishId: dish.id, requiresConfirmation: true, questions };
    }

    function interpret(rawValue, context = {}) {
        const rawText = String(rawValue || "").trim();
        const memory = sanitizeMemory(context.memory);
        if (!CATALOG_VERSION || !FOODS.length) throw new Error("Smart Text no tiene catálogo disponible.");
        const contextual = contextualResult(rawText, context, memory);
        if (contextual) return contextual;
        const dish = dishResult(rawText, memory);
        if (dish) return dish;

        const items = [];
        const unrecognized = [];
        const questions = [];
        splitSegments(rawText).forEach(sourceText => {
            const match = matchFood(sourceText, memory);
            if (!match) { unrecognized.push(sourceText); return; }
            if (match.ambiguous) {
                questions.push({ type: "food-choice", label: sourceText, sourceText, choices: match.ambiguous.map(food => ({ id: food.id, label: food.name })) });
                return;
            }
            const item = itemFromFood(match.food, sourceText, memory, match.confidence);
            items.push(item);
            if (item.preparationAmbiguous) questions.push({ type: "preparation", label: `Confirmá la preparación de ${item.name}.`, itemId: item.catalogId });
        });
        const componentScores = items.map(item => item.confidence);
        let confidence = componentScores.length ? roundConfidence(componentScores.reduce((sum, value) => sum + value, 0) / componentScores.length) : 0;
        if (unrecognized.length) confidence = roundConfidence(Math.max(0, confidence - .2));
        const recognizedSubtotal = totalsFor(items);
        const hasPartialTotal = Boolean(items.length && unrecognized.length);
        return {
            rawText, normalizedText: normalizeText(rawText), items, unrecognized,
            totals: hasPartialTotal ? totalsFor([]) : recognizedSubtotal,
            recognizedSubtotal: hasPartialTotal ? recognizedSubtotal : null,
            totalKind: hasPartialTotal ? "subtotal" : "total",
            confidence,
            requiresConfirmation: Boolean(unrecognized.length || questions.length || items.some(item => item.requiresConfirmation)), questions
        };
    }

    function resolveChoice(result, questionIndex, choiceId, size = "normal") {
        const question = result?.questions?.[questionIndex];
        const food = foodById(choiceId);
        if (!question || !food) return result;
        const sizeMultiplier = { small: 0.7, normal: 1, large: 1.4 }[size] || 1;
        const base = food.defaultQuantity;
        const quantity = { value: round(base.value * sizeMultiplier), unit: base.unit, grams: round(base.grams * sizeMultiplier), explicit: false, estimated: true };
        const item = itemFromFood(food, question.sourceText || question.label, sanitizeMemory(), 0.78, { quantity });
        const questions = result.questions.filter((_, index) => index !== questionIndex);
        const items = [...result.items, item];
        return { ...result, items, questions, totals: totalsFor(items), requiresConfirmation: true, confidence: Math.min(result.confidence || 0.78, 0.78) };
    }

    function selectContextCandidate(result, candidateIndex) {
        const candidate = result?.candidates?.[candidateIndex];
        if (!candidate) return result;
        return { ...result, items: cloneItems(candidate.items || [], true), totals: candidate.totals || totalsFor(candidate.items || []), contextLabel: candidate.label, questions: [], requiresConfirmation: true };
    }

    root.ForzaSmartText = Object.freeze({
        version: 1,
        catalogVersion: CATALOG_VERSION,
        normalizeText,
        interpret,
        resolveChoice,
        selectContextCandidate,
        sanitizeMemory,
        rememberCorrection,
        createMealDefinition
    });
}(typeof window !== "undefined" ? window : globalThis));
