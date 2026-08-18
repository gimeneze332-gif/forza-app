const MODEL = "gemini-2.5-flash";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const OFFICIAL_ERROR_STATUSES = new Set(["INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "NOT_FOUND", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION", "INTERNAL", "UNAVAILABLE", "DEADLINE_EXCEEDED"]);

export const PHOTO_FOOD_PROMPT = `Actuás únicamente como observador visual de alimentos para FORZA Photo Food.
Describí solo alimentos y preparaciones realmente visibles en la imagen.
No inventes ingredientes ocultos, aceite, salsas, rellenos ni métodos de cocción que no sean razonablemente visibles.
No calcules calorías, proteínas, carbohidratos, grasas ni ningún dato nutricional.
No des recomendaciones, consejos ni interpretaciones sobre el usuario, su cuerpo, sus objetivos o su entrenamiento.
Identificá cada componente visible por separado cuando sea posible. Para platos mezclados, tartas, guisos y salsas, describí el plato visible sin reconstruir la receta.
Para milanesas, distinguí carne o pollo y frita, horno o air fryer solo si existe evidencia visual suficiente; de lo contrario usá null y explicá la incertidumbre.
Para hamburguesas, distinguí medallón o hamburguesa completa cuando sea visible y separá acompañamientos.
Para bebidas, identificá el tipo solo si es visible. La cantidad debe tener baja confianza salvo referencia clara.
Si no hay referencia suficiente para gramos, usá null y priorizá small, normal o large.
Si algo no puede identificarse, agregalo a unknownComponents. Si no hay comida, devolvé items y unknownComponents vacíos.
Priorizá precisión sobre completar la respuesta. Ante cualquier duda usá null, confianza baja o uncertainties.`;

export const PHOTO_FOOD_RESPONSE_SCHEMA = Object.freeze({
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "items", "unknownComponents", "uncertainties"],
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    items: { type: "array", maxItems: 12, items: {
      type: "object", additionalProperties: false,
      required: ["name", "preparation", "estimatedPortion", "estimatedGrams", "identityConfidence", "quantityConfidence", "notes"],
      properties: {
        name: { type: "string", maxLength: 80 },
        preparation: { anyOf: [{ type: "string", maxLength: 60 }, { type: "null" }] },
        estimatedPortion: { anyOf: [{ type: "string", enum: ["small", "normal", "large"] }, { type: "null" }] },
        estimatedGrams: { anyOf: [{ type: "integer", minimum: 1, maximum: 3000 }, { type: "null" }] },
        identityConfidence: { type: "number", minimum: 0, maximum: 1 },
        quantityConfidence: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }] },
        notes: { type: "array", maxItems: 6, items: { type: "string", maxLength: 160 } }
      }
    } },
    unknownComponents: { type: "array", maxItems: 12, items: { type: "string", maxLength: 160 } },
    uncertainties: { type: "array", maxItems: 12, items: { type: "string", maxLength: 180 } }
  }
});

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function providerError(response) {
  if (response.status === 429) return "provider_rate_limit";
  if (response.status >= 500) return "provider_unavailable";
  if (response.status === 401 || response.status === 403) return "provider_auth_failed";
  if (response.status === 404) return "provider_model_not_found";
  return "provider_request_failed";
}

function diagnosticStageFor(response, providerStatus = null) {
  if (response.status === 429) return "gemini_rate_limited";
  if (response.status === 404) return "gemini_model_not_found";
  if (response.status === 401 || response.status === 403) return "gemini_auth_failed";
  if (response.status === 400 && providerStatus === "FAILED_PRECONDITION") return "gemini_billing_failed";
  if (response.status >= 500) return "gemini_provider_unavailable";
  return "gemini_request_invalid";
}

function safeProviderStatus(value) {
  return OFFICIAL_ERROR_STATUSES.has(value) ? value : null;
}

async function readProviderErrorStatus(response) {
  try {
    const body = await response.clone().json();
    return safeProviderStatus(body?.error?.status || body?.status || null);
  } catch (_) {
    return null;
  }
}

export async function analyzeFoodImage(image, options = {}) {
  const started = Date.now();
  const onDiagnostic = typeof options.onDiagnostic === "function" ? options.onDiagnostic : () => {};
  const apiKey = String(options.apiKey || "");
  if (!apiKey) {
    onDiagnostic({ stage: "gemini_auth_failed", errorCode: "gemini_disabled" });
    throw new Error("gemini_disabled");
  }
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image || []);
  if (!bytes.length) throw new Error("invalid_image");
  const fetchImpl = options.fetchImpl || fetch;
  onDiagnostic({ stage: "gemini_request_started" });
  let response;
  try {
    response = await fetchImpl(`${API_ROOT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: options.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PHOTO_FOOD_PROMPT }] },
        contents: [{ role: "user", parts: [
          { text: "Observá esta única imagen y devolvé exclusivamente el contrato JSON solicitado." },
          { inlineData: { mimeType: "image/jpeg", data: bytesToBase64(bytes) } }
        ] }],
        generationConfig: {
          temperature: 0.1, maxOutputTokens: 900,
          responseMimeType: "application/json", responseJsonSchema: PHOTO_FOOD_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      onDiagnostic({ stage: "gemini_timeout", errorCode: "provider_timeout", durationMs: Date.now() - started });
      throw new Error("provider_timeout");
    }
    onDiagnostic({ stage: "gemini_provider_unavailable", errorCode: "provider_unavailable", durationMs: Date.now() - started });
    throw new Error("provider_unavailable");
  }
  onDiagnostic({ stage: "gemini_response_received", providerHttpStatus: response.status, durationMs: Date.now() - started });
  if (!response.ok) {
    const providerErrorStatus = await readProviderErrorStatus(response);
    const errorCode = providerError(response);
    onDiagnostic({ stage: diagnosticStageFor(response, providerErrorStatus), providerHttpStatus: response.status, providerErrorStatus, errorCode, durationMs: Date.now() - started });
    throw new Error(errorCode);
  }
  let envelope;
  try {
    envelope = await response.json();
  } catch (_) {
    onDiagnostic({ stage: "gemini_response_empty", providerHttpStatus: response.status, errorCode: "provider_empty_response", durationMs: Date.now() - started });
    throw new Error("provider_empty_response");
  }
  const text = envelope?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!text) {
    onDiagnostic({ stage: "gemini_response_empty", providerHttpStatus: response.status, errorCode: "provider_empty_response", usageAvailable: Boolean(envelope?.usageMetadata), durationMs: Date.now() - started });
    throw new Error("provider_empty_response");
  }
  let proposal;
  try {
    proposal = JSON.parse(text);
  } catch (_) {
    onDiagnostic({ stage: "gemini_json_parse_failed", providerHttpStatus: response.status, errorCode: "provider_invalid_json", usageAvailable: Boolean(envelope?.usageMetadata), durationMs: Date.now() - started });
    throw new Error("provider_invalid_json");
  }
  const { validateProviderProposal } = await import("./schema.js");
  if (!validateProviderProposal(proposal)) {
    onDiagnostic({ stage: "gemini_schema_failed", providerHttpStatus: response.status, errorCode: "provider_schema_invalid", usageAvailable: Boolean(envelope?.usageMetadata), durationMs: Date.now() - started });
    throw new Error("provider_schema_invalid");
  }
  const usage = envelope.usageMetadata || {};
  onDiagnostic({ stage: "gemini_usage_received", providerHttpStatus: response.status, usageAvailable: Boolean(envelope.usageMetadata),
    inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount, thinkingTokens: usage.thoughtsTokenCount, totalTokens: usage.totalTokenCount, durationMs: Date.now() - started });
  onDiagnostic({ stage: "gemini_completed", providerHttpStatus: response.status, durationMs: Date.now() - started });
  return {
    proposal,
    usage: {
      inputTokens: Number(usage.promptTokenCount || 0),
      outputTokens: Number(usage.candidatesTokenCount || 0),
      thinkingTokens: Number(usage.thoughtsTokenCount || 0),
      totalTokens: Number(usage.totalTokenCount || 0)
    },
    model: MODEL
  };
}

export async function listAvailableGeminiModels(options = {}) {
  const apiKey = String(options.apiKey || "");
  if (!apiKey) throw new Error("gemini_disabled");
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${API_ROOT}?pageSize=1000`, {
    method: "GET",
    headers: { "x-goog-api-key": apiKey },
    signal: options.signal
  });
  if (!response.ok) throw new Error(providerError(response));
  let envelope;
  try {
    envelope = await response.json();
  } catch (_) {
    throw new Error("provider_invalid_json");
  }
  if (!Array.isArray(envelope?.models)) throw new Error("provider_invalid_json");
  return envelope.models
    .filter(model => typeof model?.name === "string" && model.name.startsWith("models/gemini"))
    .filter(model => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
    .map(model => ({
      name: model.name,
      displayName: typeof model.displayName === "string" ? model.displayName : "",
      supportedGenerationMethods: model.supportedGenerationMethods.filter(method => typeof method === "string")
    }));
}

export const analyzeWithGemini = analyzeFoodImage;
