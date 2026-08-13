/* FORZA Photo Food: captura local y flujo visual desacoplado del proveedor. */
(function (root) {
    "use strict";

    const RUNTIME_CONFIG = root.FORZA_PHOTO_FOOD_CONFIG || {};
    const PHOTO_FOOD_MODE = RUNTIME_CONFIG.mode === "remote" ? "remote" : "mock";
    const REMOTE_ENDPOINT = String(RUNTIME_CONFIG.endpoint || "").replace(/\/$/, "");
    const AUTH_DB = "forza_photo_food_private";
    const AUTH_STORE = "auth";
    const MAX_EDGE = 768;
    const MAX_BYTES = 750 * 1024;
    const MOCK_DELAY = 650;
    const PORTION_FACTOR = Object.freeze({ small: .72, normal: 1, large: 1.35 });

    const MOCKS = Object.freeze({
        "chicken-rice": { items: [
            { name: "pechuga de pollo", preparation: "a la plancha", estimatedPortion: "normal", estimatedGrams: 150, foodConfidence: .91, quantityConfidence: .66, notes: "cantidad aproximada" },
            { name: "arroz cocido", preparation: null, estimatedPortion: "normal", estimatedGrams: 180, foodConfidence: .9, quantityConfidence: .61, notes: "cantidad aproximada" }
        ], uncertainties: [] },
        "milanesa-puree": { items: [
            { name: "milanesa de carne", preparation: null, estimatedPortion: "normal", estimatedGrams: 180, foodConfidence: .82, quantityConfidence: .48, notes: "preparación y cantidad aproximadas" },
            { name: "puré de papa", preparation: null, estimatedPortion: "normal", estimatedGrams: 200, foodConfidence: .84, quantityConfidence: .54, notes: "cantidad aproximada" }
        ], uncertainties: ["No se distingue si la milanesa es frita o al horno."] },
        tortilla: { items: [
            { name: "tortilla de papa", preparation: null, estimatedPortion: "normal", estimatedGrams: 220, foodConfidence: .88, quantityConfidence: .47, notes: "plato casero variable" }
        ], uncertainties: ["No se puede estimar con precisión el aceite utilizado."] },
        unknown: { items: [
            { name: "pollo", preparation: null, estimatedPortion: "normal", estimatedGrams: 140, foodConfidence: .78, quantityConfidence: .5, notes: "cantidad aproximada" },
            { name: "componente sin identificar", preparation: null, estimatedPortion: "normal", estimatedGrams: null, foodConfidence: .24, quantityConfidence: null, notes: "requiere identificación" }
        ], uncertainties: ["Hay un componente que no pude identificar."] },
        "low-confidence": { items: [
            { name: "posible guiso", preparation: null, estimatedPortion: "normal", estimatedGrams: null, foodConfidence: .34, quantityConfidence: .2, notes: "identificación poco segura" }
        ], uncertainties: ["La preparación no se distingue con suficiente seguridad."] }
    });

    let elements = null;
    let callbacks = {};
    let processedBlob = null;
    let previewUrl = null;
    let proposal = null;
    let analyzing = false;
    let activeController = null;

    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function get(id) { return document.getElementById(`photo-food-${id}`); }
    function reviewHint(item) {
        if (!Number.isFinite(Number(item.foodConfidence)) || Number(item.foodConfidence) < .55) {
            return "No pude reconocer esto. Corregí el alimento.";
        }
        if (!Number.isFinite(Number(item.quantityConfidence)) || Number(item.quantityConfidence) < .7) {
            return "Revisá la cantidad.";
        }
        return "";
    }
    function validateResponse(value) {
        if (!value || !Array.isArray(value.items) || !Array.isArray(value.uncertainties)) return false;
        return value.items.every(item => item && typeof item.name === "string" && item.name.trim() &&
            (item.estimatedGrams == null || Number.isFinite(Number(item.estimatedGrams))) &&
            Number.isFinite(Number(item.foodConfidence)) && item.foodConfidence >= 0 && item.foodConfidence <= 1 &&
            (item.quantityConfidence == null || (Number.isFinite(Number(item.quantityConfidence)) && item.quantityConfidence >= 0 && item.quantityConfidence <= 1)));
    }
    function mockAnalyze(scenario) {
        if (scenario === "service-error") return Promise.reject(new Error("service_error"));
        if (scenario === "timeout") return Promise.reject(new Error("timeout"));
        if (scenario === "invalid-response") return Promise.resolve({ foods: "invalid" });
        return Promise.resolve(clone(MOCKS[scenario] || MOCKS["chicken-rice"]));
    }

    function authDatabase() {
        return new Promise((resolve, reject) => {
            if (!root.indexedDB) return reject(new Error("indexeddb_unavailable"));
            const request = root.indexedDB.open(AUTH_DB, 1);
            request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(AUTH_STORE)) request.result.createObjectStore(AUTH_STORE); };
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error("indexeddb_error"));
        });
    }
    async function authValue(action, value) {
        const database = await authDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const transaction = database.transaction(AUTH_STORE, "readwrite"); const store = transaction.objectStore(AUTH_STORE);
                const request = action === "get" ? store.get("deviceToken") : action === "put" ? store.put(value, "deviceToken") : store.delete("deviceToken");
                request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error("indexeddb_error"));
            });
        } finally { database.close(); }
    }
    const getDeviceToken = () => authValue("get");
    const saveDeviceToken = token => authValue("put", String(token));
    const clearDeviceToken = () => authValue("delete");

    async function claimPairing(code) {
        if (!REMOTE_ENDPOINT) throw new Error("remote_not_configured");
        const response = await root.fetch(`${REMOTE_ENDPOINT}/pairing/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: String(code || "").trim() }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.token) throw new Error(body.error || "pairing_failed");
        await saveDeviceToken(body.token); return true;
    }

    async function remoteAnalyze(blob, scenario = "success", timeoutMs = 12000) {
        if (!REMOTE_ENDPOINT) throw new Error("remote_not_configured");
        const token = await getDeviceToken(); if (!token) throw new Error("unauthorized");
        activeController = new AbortController();
        const timer = root.setTimeout(() => activeController.abort(), timeoutMs);
        try {
            const response = await root.fetch(`${REMOTE_ENDPOINT}/photo-food/analyze`, { method: "POST", headers: {
                authorization: `Bearer ${token}`, "content-type": "image/jpeg", "x-photo-food-mock-scenario": scenario
            }, body: blob, signal: activeController.signal });
            const body = await response.json().catch(() => ({}));
            if (response.status === 401 || response.status === 403) { await clearDeviceToken(); throw new Error("unauthorized"); }
            if (response.status === 429) throw new Error(body.error || "rate_limit");
            if (response.status === 503) throw new Error(body.error || "service_unavailable");
            if (!response.ok) throw new Error(body.error || "remote_error");
            return body;
        } catch (error) {
            if (error.name === "AbortError") throw new Error("timeout");
            throw error;
        } finally { root.clearTimeout(timer); activeController = null; }
    }
    function itemToText(item) {
        const grams = Number(item.estimatedGrams);
        const quantity = Number.isFinite(grams) && grams > 0 ? `${Math.round(grams)} g de ` : "";
        const preparation = item.preparation ? ` ${item.preparation}` : "";
        return `${quantity}${String(item.name || "").trim()}${preparation}`.trim();
    }
    function proposalToText(value, extraText = "") {
        return [...(value?.items || []).map(itemToText).filter(Boolean), String(extraText || "").trim()].filter(Boolean).join(" con ");
    }

    function revokePreview() {
        if (previewUrl && root.URL?.revokeObjectURL) root.URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        if (elements?.preview) elements.preview.removeAttribute("src");
    }
    function releaseImage() { revokePreview(); processedBlob = null; }
    function showStep(name) {
        ["picker", "previewStep", "loading", "review", "error"].forEach(key => { elements[key].hidden = key !== name; });
    }
    function reset() {
        if (activeController) activeController.abort();
        analyzing = false; proposal = null; releaseImage();
        if (elements) {
            elements.cameraInput.value = ""; elements.galleryInput.value = ""; elements.addText.value = "";
            showStep("picker");
        }
    }
    async function showPairing() {
        showStep("picker");
        let panel = elements.view.querySelector(".photo-food-pairing");
        if (!panel) {
            panel = document.createElement("div"); panel.className = "photo-food-pairing";
            panel.innerHTML = '<h3>Vincular este dispositivo</h3><p class="photo-food-hint">Ingresá el código temporal generado en Cloudflare.</p><label>Código de emparejamiento<input inputmode="numeric" maxlength="8" autocomplete="one-time-code"></label><button class="nutrition-primary-button" type="button">Vincular</button><p role="status" aria-live="polite"></p>';
            elements.view.appendChild(panel);
            panel.querySelector("button").addEventListener("click", async () => {
                const status = panel.querySelector('[role="status"]'); const button = panel.querySelector("button"); button.disabled = true; status.textContent = "Vinculando...";
                try { await claimPairing(panel.querySelector("input").value); panel.remove(); reset(); elements.camera.focus(); }
                catch (_) { status.textContent = "No pude vincular el dispositivo. Revisá el código."; }
                finally { button.disabled = false; }
            });
        }
        [elements.picker, elements.previewStep, elements.loading, elements.review, elements.error].forEach(item => { item.hidden = true; });
        panel.hidden = false; panel.querySelector("input").focus();
    }
    async function open() {
        if (!elements) return; elements.view.hidden = false; reset();
        if (PHOTO_FOOD_MODE === "remote") {
            try { if (!await getDeviceToken()) return showPairing(); }
            catch (_) { return showError("Este dispositivo no puede guardar la autorización de Photo Food."); }
        }
        elements.camera.focus();
    }
    function hide() { if (!elements) return; elements.view.hidden = true; reset(); }

    function canvasBlob(canvas, quality) {
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("image_encode_failed")), "image/jpeg", quality));
    }
    async function loadBitmap(file) {
        if (typeof root.createImageBitmap === "function") return root.createImageBitmap(file, { imageOrientation: "from-image" });
        const url = root.URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = url;
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("image_decode_failed")); });
            return image;
        } finally { root.URL.revokeObjectURL(url); }
    }
    async function processImage(file) {
        if (!file || !String(file.type || "").startsWith("image/")) throw new Error("invalid_image");
        const bitmap = await loadBitmap(file);
        try {
            const width = bitmap.naturalWidth || bitmap.width;
            const height = bitmap.naturalHeight || bitmap.height;
            const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
            const context = canvas.getContext("2d", { alpha: false });
            context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            let result = await canvasBlob(canvas, .82);
            for (const quality of [.7, .58, .46]) { if (result.size <= MAX_BYTES) break; result = await canvasBlob(canvas, quality); }
            return result;
        } finally { if (typeof bitmap.close === "function") bitmap.close(); }
    }
    async function selectFile(file) {
        releaseImage();
        try {
            processedBlob = await processImage(file);
            previewUrl = root.URL.createObjectURL(processedBlob);
            elements.preview.src = previewUrl; showStep("previewStep"); elements.analyze.focus();
        } catch (_) { showError("La imagen no pudo procesarse en este dispositivo."); }
    }
    function showError() {
        analyzing = false;
        const title = elements.error.querySelector("strong");
        if (title) title.textContent = "No pude reconocer bien esta foto.";
        elements.errorDetail.textContent = "Podés escribir la comida y continuar.";
        showStep("error"); elements.fallback.focus(); releaseImage();
    }

    function renderItems() {
        elements.items.innerHTML = "";
        proposal.items.forEach((item, index) => {
            const card = document.createElement("article"); card.className = "photo-food-item";
            card.innerHTML = `<div class="photo-food-item-grid"><label>Alimento<input data-field="name" value=""></label><label>Porción<select data-field="portion"><option value="small">Pequeña</option><option value="normal">Normal</option><option value="large">Grande</option></select></label></div><div class="photo-food-item-grid photo-food-item-secondary"><label>Preparación<input data-field="preparation" value="" placeholder="No visible"></label><label>Gramos aprox.<input data-field="grams" type="number" min="1" inputmode="numeric"></label></div><p class="photo-food-confidence"></p><button class="photo-food-remove" type="button">Eliminar</button>`;
            const name = card.querySelector('[data-field="name"]'); const grams = card.querySelector('[data-field="grams"]');
            const prep = card.querySelector('[data-field="preparation"]'); const portion = card.querySelector('[data-field="portion"]');
            name.value = item.name; grams.value = item.estimatedGrams ?? ""; prep.value = item.preparation || ""; portion.value = item.estimatedPortion || "normal";
            const hint = card.querySelector(".photo-food-confidence");
            hint.textContent = reviewHint(item); hint.hidden = !hint.textContent;
            name.addEventListener("input", () => { item.name = name.value; });
            grams.addEventListener("input", () => { item.estimatedGrams = grams.value ? Number(grams.value) : null; item._baseGrams = item.estimatedGrams; });
            prep.addEventListener("input", () => { item.preparation = prep.value.trim() || null; });
            portion.addEventListener("change", () => { const base = item._baseGrams || item.estimatedGrams; item.estimatedPortion = portion.value; if (base) { item.estimatedGrams = Math.round(base * PORTION_FACTOR[portion.value]); grams.value = item.estimatedGrams; } });
            card.querySelector(".photo-food-remove").addEventListener("click", () => { proposal.items.splice(index, 1); renderItems(); });
            elements.items.appendChild(card);
        });
        (proposal.uncertainties || []).forEach(message => { const note = document.createElement("p"); note.className = "photo-food-hint"; note.textContent = `Revisar: ${message}`; elements.items.appendChild(note); });
    }
    async function analyze() {
        if (analyzing || !processedBlob) return;
        analyzing = true; showStep("loading");
        try {
            const scenario = elements.scenario.value;
            let result;
            if (PHOTO_FOOD_MODE === "remote") result = await remoteAnalyze(processedBlob, scenario === "service-error" ? "error" : scenario);
            else {
                if (scenario === "timeout") await new Promise(resolve => root.setTimeout(resolve, 900));
                else await new Promise(resolve => root.setTimeout(resolve, MOCK_DELAY));
                result = await mockAnalyze(scenario);
            }
            if (!validateResponse(result)) throw new Error("invalid_response");
            proposal = result; proposal.items.forEach(item => { item._baseGrams = item.estimatedGrams; });
            analyzing = false; renderItems(); showStep("review"); elements.use.focus(); releaseImage();
        } catch (error) {
            const detail = error.message === "timeout" ? "El análisis tardó demasiado. No se reintentó automáticamente."
                : error.message === "unauthorized" ? "Este dispositivo debe volver a vincularse."
                : ["daily_limit", "monthly_limit", "rate_limit", "analysis_in_progress"].includes(error.message) ? "Se alcanzó temporalmente el límite de análisis."
                : error.message === "photo_food_disabled" ? "Photo Food está desactivado temporalmente."
                : "La respuesta no pudo utilizarse.";
            showError(detail);
        }
    }
    function useProposal() {
        const text = proposalToText(proposal, elements.addText.value);
        if (!text) return showError("No quedó ningún alimento para revisar.");
        const meta = { recognition: PHOTO_FOOD_MODE === "remote" ? "photo-food-remote-mock-v1" : "photo-food-mock-v1", visualItems: proposal.items.map(item => ({
            name: item.name, preparation: item.preparation || null, estimatedPortion: item.estimatedPortion || null,
            estimatedGrams: item.estimatedGrams ?? null, foodConfidence: item.foodConfidence, quantityConfidence: item.quantityConfidence
        })) };
        releaseImage(); callbacks.onProposal?.(text, meta);
    }
    function init(options = {}) {
        callbacks = options;
        elements = { view: get("view"), picker: get("picker"), previewStep: get("preview-step"), loading: get("loading"), review: get("review"), error: get("error"),
            camera: get("camera"), gallery: get("gallery"), cameraInput: get("camera-input"), galleryInput: get("gallery-input"), preview: get("preview"), scenario: get("scenario-select"),
            analyze: get("analyze"), change: get("change"), cancel: get("cancel"), items: get("items"), addText: get("add-text"), add: get("add"), use: get("use"),
            errorDetail: get("error-detail"), fallback: get("fallback"), retry: get("retry") };
        if (!elements.view) return false;
        elements.camera.addEventListener("click", () => elements.cameraInput.click()); elements.gallery.addEventListener("click", () => elements.galleryInput.click());
        [elements.cameraInput, elements.galleryInput].forEach(input => input.addEventListener("change", () => input.files?.[0] && selectFile(input.files[0])));
        elements.analyze.addEventListener("click", analyze); elements.change.addEventListener("click", reset); elements.cancel.addEventListener("click", () => { if (activeController) activeController.abort(); callbacks.onFallback?.(); });
        elements.retry.addEventListener("click", () => processedBlob ? (showStep("previewStep"), elements.analyze.focus()) : reset());
        elements.fallback.addEventListener("click", () => callbacks.onFallback?.()); elements.use.addEventListener("click", useProposal);
        elements.add.addEventListener("click", () => { const name = elements.addText.value.trim(); if (!name) return; proposal.items.push({ name, preparation: null, estimatedPortion: null, estimatedGrams: null, foodConfidence: null, quantityConfidence: null, notes: "agregado por el usuario" }); elements.addText.value = ""; renderItems(); });
        reset(); return true;
    }

    const api = Object.freeze({ PHOTO_FOOD_MODE, REMOTE_ENDPOINT, MAX_EDGE, MAX_BYTES, init, open, hide, reset, validateResponse, mockAnalyze, remoteAnalyze, claimPairing, getDeviceToken, saveDeviceToken, clearDeviceToken, proposalToText, processImage });
    root.ForzaPhotoFood = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
