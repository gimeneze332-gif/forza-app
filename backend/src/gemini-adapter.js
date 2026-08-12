const MODEL = "gemini-2.5-flash";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

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
  return "provider_request_failed";
}

export async function analyzeFoodImage(image, options = {}) {
  const apiKey = String(options.apiKey || "");
  if (!apiKey) throw new Error("gemini_disabled");
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image || []);
  if (!bytes.length) throw new Error("invalid_image");
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${API_ROOT}/${MODEL}:generateContent`, {
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
  if (!response.ok) throw new Error(providerError(response));
  const envelope = await response.json().catch(() => { throw new Error("provider_empty_response"); });
  const text = envelope?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!text) throw new Error("provider_empty_response");
  let proposal; try { proposal = JSON.parse(text); } catch (_) { throw new Error("provider_invalid_json"); }
  const usage = envelope.usageMetadata || {};
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

export const analyzeWithGemini = analyzeFoodImage;
