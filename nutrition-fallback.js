/* FORZA Nutrition Fallback: memoria confirmada y estimación remota solo para texto manual. */
(function (root) {
    "use strict";

    const STORAGE_KEY = "forza_nutrition_learned_foods";
    const SCHEMA_VERSION = 1;
    const MAX_REFERENCES = 200;
    const SIMPLE_CATEGORIES = new Set(["fish", "meat", "egg", "dairy", "legume", "grain", "vegetable", "fruit", "nut_seed", "other_simple"]);
    const BLOCKED_CATEGORIES = new Set(["recipe", "prepared_food", "commercial_product"]);
    const NUTRIENTS = ["calories", "protein", "carbs", "fat"];

    function normalizeText(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es-AR").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
    }
    function round(value) { return Math.round((Number(value) + Number.EPSILON) * 10) / 10; }
    function finite(value, max) { return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max; }
    function safeNutrition(value) {
        if (!value || !finite(value.calories, 1000) || !finite(value.protein, 100) || !finite(value.carbs, 100) || !finite(value.fat, 100)) return null;
        return Object.fromEntries(NUTRIENTS.map(key => [key, Number(value[key])]));
    }
    function sanitizeFood(value) {
        const nutrition = safeNutrition(value?.nutrition);
        const normalizedName = normalizeText(value?.normalizedName);
        if (!value || !normalizedName || value.basis !== "per_100g" || !nutrition || !SIMPLE_CATEGORIES.has(value.category)) return null;
        const aliases = [...new Set([normalizedName, ...(Array.isArray(value.aliases) ? value.aliases.map(normalizeText) : [])].filter(Boolean))].slice(0, 8);
        return {
            id: String(value.id || ""), normalizedName, displayName: String(value.displayName || value.normalizedName || "").trim().slice(0, 80), aliases,
            category: value.category, preparation: value.preparation == null ? null : String(value.preparation).slice(0, 60), basis: "per_100g", nutrition,
            unitWeightGrams: value.unitWeightGrams == null ? null : finite(value.unitWeightGrams, 1000) && Number(value.unitWeightGrams) > 0 ? Number(value.unitWeightGrams) : null,
            origin: "user_confirmed_gemini_estimate", firstConfirmedAt: value.firstConfirmedAt || null, confirmedAt: value.confirmedAt || null,
            lastUsedAt: value.lastUsedAt || null, useCount: Math.max(0, Number(value.useCount || 0))
        };
    }
    function sanitizeMemory(value) {
        if (!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.foods)) return { schemaVersion: SCHEMA_VERSION, updatedAt: null, foods: [] };
        return { schemaVersion: SCHEMA_VERSION, updatedAt: value.updatedAt || null, foods: value.foods.map(sanitizeFood).filter(Boolean).slice(0, MAX_REFERENCES) };
    }
    function findLearned(memory, label) {
        const normalized = normalizeText(label);
        return sanitizeMemory(memory).foods.find(food => food.normalizedName === normalized || food.aliases.includes(normalized)) || null;
    }
    function nutritionFor(food, grams) {
        return Object.fromEntries(NUTRIENTS.map(key => [key, food.nutrition[key] == null ? null : round(food.nutrition[key] * grams / 100)]));
    }
    function itemFromFood(food, sourceText, grams, kind) {
        return {
            name: food.displayName || food.normalizedName, sourceText, grams, quantity: grams, unit: "g", explicitQuantity: true,
            estimated: true, requiresConfirmation: true, nutritionEstimated: true, fallbackKind: kind,
            fallbackReference: { normalizedName: food.normalizedName, category: food.category, preparation: food.preparation, basis: food.basis, unitWeightGrams: food.unitWeightGrams },
            ...nutritionFor(food, grams)
        };
    }
    function labelWithoutQuantity(sourceText) {
        return normalizeText(sourceText).replace(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|gramos?)\b/g, " ").trim().replace(/^de\s+/, "").replace(/\s+/g, " ").trim();
    }
    function mergeResult(result, resolved) {
        const resolvedSources = new Set(resolved.map(item => item.sourceText));
        const items = [...(result.items || []), ...resolved];
        const totals = {};
        NUTRIENTS.forEach(key => { const values = items.map(item => item[key]).filter(value => value != null && Number.isFinite(Number(value))); totals[key] = values.length ? round(values.reduce((sum, value) => sum + Number(value), 0)) : null; });
        const unrecognized = (result.unrecognized || []).filter(value => !resolvedSources.has(value));
        return { ...result, items, unrecognized, totals: unrecognized.length ? Object.fromEntries(NUTRIENTS.map(key => [key, null])) : totals, recognizedSubtotal: unrecognized.length ? totals : null, totalKind: unrecognized.length ? "subtotal" : "total", requiresConfirmation: true };
    }
    async function resolve(result, options = {}) {
        const parseQuantity = options.parseQuantity;
        const memory = sanitizeMemory(options.memory);
        const candidates = (result.unrecognized || []).map(sourceText => {
            const quantity = parseQuantity?.(sourceText);
            return quantity ? { sourceText, label: labelWithoutQuantity(sourceText), grams: quantity.grams } : null;
        }).filter(candidate => candidate && candidate.label);
        if (!candidates.length) return { result, memory, usedRemote: false, failed: Boolean(result.unrecognized?.length) };
        const resolved = []; const remote = [];
        candidates.forEach(candidate => { const food = findLearned(memory, candidate.label); food ? resolved.push(itemFromFood(food, candidate.sourceText, candidate.grams, "learned")) : remote.push(candidate); });
        let next = mergeResult(result, resolved);
        if (!remote.length) return { result: next, memory, usedRemote: false, failed: false };
        if (typeof options.estimate !== "function") return { result: next, memory, usedRemote: false, failed: true };
        try {
            const response = await options.estimate(remote.map(({ sourceText, ...item }, index) => ({ clientRef: `u${index + 1}`, ...item })));
            const foods = Array.isArray(response?.foods) ? response.foods : [];
            const estimated = remote.map((candidate, index) => {
                const proposal = foods.find(food => food.clientRef === `u${index + 1}`);
                if (!proposal) return null;
                const nutrition = Object.fromEntries(NUTRIENTS.map(key => [key, proposal[key] == null ? null : Number(proposal[key])]));
                if (!proposal.normalizedName || proposal.basis !== "per_100g" || !SIMPLE_CATEGORIES.has(proposal.category) || NUTRIENTS.some(key => nutrition[key] != null && !finite(nutrition[key], key === "calories" ? 1000 : 100))) return null;
                const food = { normalizedName: normalizeText(proposal.normalizedName), displayName: String(proposal.normalizedName).trim(), aliases: [candidate.label], category: proposal.category, preparation: proposal.preparation || null, basis: "per_100g", nutrition, unitWeightGrams: proposal.unitWeightGrams ?? null };
                return food ? itemFromFood(food, candidate.sourceText, candidate.grams, "estimated") : null;
            }).filter(Boolean);
            next = mergeResult(next, estimated);
            return { result: next, memory, usedRemote: true, failed: estimated.length !== remote.length };
        } catch (_) { return { result: next, memory, usedRemote: true, failed: true }; }
    }
    function canLearn(draft, confirmed) {
        const estimated = (draft?.items || []).filter(item => item.fallbackKind === "estimated");
        if (estimated.length !== 1 || draft.items.length !== 1 || draft.unrecognized?.length) return false;
        const item = estimated[0]; const ref = item.fallbackReference;
        if (!ref || !SIMPLE_CATEGORIES.has(ref.category) || BLOCKED_CATEGORIES.has(ref.category) || ref.preparation !== null || !finite(item.grams, 3000) || Number(item.grams) <= 0) return false;
        return Boolean(safeNutrition(confirmed));
    }
    function learn(memoryValue, draft, confirmed, now = new Date()) {
        const memory = sanitizeMemory(memoryValue);
        if (!canLearn(draft, confirmed)) return memory;
        const item = draft.items.find(candidate => candidate.fallbackKind === "estimated"); const ref = item.fallbackReference; const grams = Number(item.grams);
        const nutrition = Object.fromEntries(NUTRIENTS.map(key => [key, round(Number(confirmed[key]) * 100 / grams)]));
        if (!safeNutrition(nutrition)) return memory;
        const normalizedName = normalizeText(ref.normalizedName); const alias = labelWithoutQuantity(item.sourceText); const timestamp = now.toISOString();
        const existing = memory.foods.find(food => food.normalizedName === normalizedName || food.aliases.includes(alias));
        const learned = sanitizeFood({ ...(existing || {}), id: existing?.id || (root.crypto?.randomUUID?.() || `learned-${Date.now()}`), normalizedName,
            displayName: ref.normalizedName, aliases: [...(existing?.aliases || []), alias], category: ref.category, preparation: null, basis: "per_100g", nutrition,
            unitWeightGrams: ref.unitWeightGrams, firstConfirmedAt: existing?.firstConfirmedAt || timestamp, confirmedAt: timestamp, lastUsedAt: timestamp, useCount: Number(existing?.useCount || 0) + 1 });
        const foods = [learned, ...memory.foods.filter(food => food !== existing)].filter(Boolean).slice(0, MAX_REFERENCES);
        return { schemaVersion: SCHEMA_VERSION, updatedAt: timestamp, foods };
    }
    async function remoteEstimate(foods) {
        const endpoint = String(root.FORZA_PHOTO_FOOD_CONFIG?.endpoint || "").replace(/\/$/, "");
        const token = await root.ForzaPhotoFood?.getDeviceToken?.();
        if (!endpoint || !token) throw new Error("fallback_unavailable");
        const response = await fetch(`${endpoint}/nutrition-fallback/estimate`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, foods }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "fallback_unavailable");
        return body;
    }
    root.ForzaNutritionFallback = Object.freeze({ STORAGE_KEY, SCHEMA_VERSION, MAX_REFERENCES, normalizeText, sanitizeMemory, findLearned, nutritionFor, resolve, canLearn, learn, remoteEstimate });
}(typeof window !== "undefined" ? window : globalThis));
