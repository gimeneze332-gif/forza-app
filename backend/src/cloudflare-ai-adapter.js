import { validateProviderProposal } from "./schema.js";

export const CLOUDFLARE_AI_MODEL = "@cf/moondream/moondream3.1-9B-A2B";
const MIN_IDENTITY_CONFIDENCE = 0.55;
const FORBIDDEN_KEYS = new Set([
  "calorie", "calories", "kcal", "protein", "proteins", "proteina", "proteinas",
  "carb", "carbs", "carbohydrate", "carbohydrates", "carbohidrato", "carbohidratos",
  "fat", "fats", "grasa", "grasas", "lipid", "lipids", "macro", "macros",
  "nutrient", "nutrients", "nutrition", "nutritional",
  "instruction", "instructions", "prompt", "recommendation", "recommendations", "advice"
]);
const PORTION_ALIASES = new Map([
  ["small", "small"], ["pequena", "small"], ["pequeno", "small"],
  ["normal", "normal"], ["medium", "normal"], ["mediana", "normal"], ["mediano", "normal"],
  ["large", "large"], ["grande", "large"]
]);

export const PHOTO_FOOD_PROMPT = `Identifica solamente los alimentos visibles de esta foto. Separa los componentes del plato.
No calcules calorias, proteinas, carbohidratos, grasas ni otros nutrientes.
No inventes ingredientes, rellenos, salsas ni preparaciones ocultas.
Indica la preparacion solo si es razonablemente visible. Si hay duda, usa null y anota la incertidumbre.
Prefiere estimatedPortion small, normal o large. No inventes gramos exactos: usa estimatedGrams null salvo referencia visual clara.
Devuelve exclusivamente JSON con schemaVersion 1, items, unknownComponents y uncertainties. Cada item debe contener exactamente name, preparation, estimatedPortion, estimatedGrams, identityConfidence, quantityConfidence y notes.
Si no hay comida visible, devuelve items vacio.`;

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function diagnostic(options, stage, details = {}) { options.onDiagnostic?.({ stage, ...details }); }

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedKey(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!plainObject(value)) return false;
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_KEYS.has(normalizedKey(key)) || containsForbiddenKey(nested));
}

function compatibleAlias(source, primary, alias) {
  const primaryValue = source[primary];
  const aliasValue = source[alias];
  if (primaryValue == null) return aliasValue;
  if (aliasValue == null) return primaryValue;
  const left = typeof primaryValue === "string" ? primaryValue.trim() : primaryValue;
  const right = typeof aliasValue === "string" ? aliasValue.trim() : aliasValue;
  if (left !== right) throw new Error("schema_validation_failed");
  return primaryValue;
}

function optionalString(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("schema_validation_failed");
  const normalized = value.trim();
  return normalized || null;
}

function requiredName(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("schema_validation_failed");
  return value.trim();
}

function portion(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("schema_validation_failed");
  const canonical = PORTION_ALIASES.get(normalizedKey(value));
  if (!canonical) throw new Error("schema_validation_failed");
  return canonical;
}

function grams(value) {
  if (value == null || value === "") return null;
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,4})(?:\s*g(?:r(?:amos?)?)?)?$/i) : null;
  const numeric = match ? Number(match[1]) : value;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 3000) throw new Error("schema_validation_failed");
  return numeric;
}

function confidence(value, nullable) {
  if (value == null) {
    if (nullable) return null;
    throw new Error("schema_validation_failed");
  }
  const numeric = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new Error("schema_validation_failed");
  return numeric;
}

function notes(value) {
  if (value == null) return [];
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list) || list.some(note => typeof note !== "string")) throw new Error("schema_validation_failed");
  return list.map(note => note.trim()).filter(Boolean);
}

function stringArray(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new Error("schema_validation_failed");
  return value.map(item => item.trim()).filter(Boolean);
}

export function canonicalizeCloudflareProposal(value) {
  if (!plainObject(value) || containsForbiddenKey(value)) throw new Error("schema_validation_failed");
  if (value.schemaVersion != null && Number(value.schemaVersion) !== 1) throw new Error("schema_validation_failed");
  if (!Array.isArray(value.items) || value.items.length > 12) throw new Error("schema_validation_failed");
  const items = value.items.map(item => {
    if (!plainObject(item)) throw new Error("schema_validation_failed");
    return {
      name: requiredName(compatibleAlias(item, "name", "food")),
      preparation: optionalString(item.preparation),
      estimatedPortion: portion(compatibleAlias(item, "estimatedPortion", "portion")),
      estimatedGrams: grams(compatibleAlias(item, "estimatedGrams", "grams")),
      identityConfidence: confidence(compatibleAlias(item, "identityConfidence", "confidence"), false),
      quantityConfidence: confidence(item.quantityConfidence, true),
      notes: notes(item.notes)
    };
  });
  return {
    schemaVersion: 1,
    items,
    unknownComponents: stringArray(value.unknownComponents),
    uncertainties: stringArray(value.uncertainties)
  };
}

function parseJsonAnswer(answer, options) {
  if (answer && typeof answer === "object") return answer;
  if (typeof answer !== "string" || !answer.trim()) {
    diagnostic(options, "empty_response", { errorCode: "empty_response" });
    throw new Error("empty_response");
  }
  const cleaned = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) {
    diagnostic(options, "json_extraction_failed", { errorCode: "json_extraction_failed" });
    throw new Error("json_extraction_failed");
  }
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch (_) {
    diagnostic(options, "json_parse_failed", { errorCode: "json_parse_failed" });
    throw new Error("json_parse_failed");
  }
}

function normalizeUsage(metrics) {
  const source = metrics && typeof metrics === "object" ? metrics : {};
  const number = (...keys) => { for (const key of keys) if (Number.isFinite(Number(source[key]))) return Number(source[key]); return undefined; };
  return { inputTokens: number("input_tokens", "inputTokens"), outputTokens: number("output_tokens", "outputTokens"), totalTokens: number("total_tokens", "totalTokens"), neurons: number("neurons") };
}

function modelError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return new Error(/quota|rate|limit|429|neurons/.test(message) ? "provider_rate_limit" : "provider_unavailable");
}

export async function analyzeFoodImage(image, options = {}) {
  if (!options.ai || typeof options.ai.run !== "function") throw new Error("cloudflare_ai_disabled");
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image || []);
  if (!bytes.length) throw new Error("invalid_image");
  const started = Date.now();
  let response;
  diagnostic(options, "model_call_started");
  try {
    response = await options.ai.run(CLOUDFLARE_AI_MODEL, {
      task: "query", image: `data:image/jpeg;base64,${bytesToBase64(bytes)}`, question: PHOTO_FOOD_PROMPT,
      reasoning: false, temperature: 0.1, max_tokens: 700, stream: false
    });
  } catch (error) {
    const safeError = modelError(error);
    diagnostic(options, "model_call_failed", { durationMs: Date.now() - started, errorCode: safeError.message });
    throw safeError;
  }
  const usage = normalizeUsage(response?.metrics);
  diagnostic(options, "model_call_completed", { durationMs: Date.now() - started, ...usage });
  let proposal;
  try { proposal = canonicalizeCloudflareProposal(parseJsonAnswer(response?.answer ?? response?.response ?? response, options)); }
  catch (error) {
    if (error.message !== "schema_validation_failed") throw error;
    diagnostic(options, "schema_validation_failed", { errorCode: "schema_validation_failed" });
    throw error;
  }
  if (!validateProviderProposal(proposal)) {
    diagnostic(options, "schema_validation_failed", { errorCode: "schema_validation_failed" });
    throw new Error("schema_validation_failed");
  }
  if (!proposal.items.length) {
    diagnostic(options, "no_food", { errorCode: "no_food" });
    throw new Error("no_food");
  }
  if (proposal.items.every(item => Number(item.identityConfidence) < MIN_IDENTITY_CONFIDENCE)) {
    diagnostic(options, "low_confidence", { errorCode: "low_confidence" });
    throw new Error("low_confidence");
  }
  return { proposal, usage, model: CLOUDFLARE_AI_MODEL };
}

export const analyzeWithCloudflareAI = analyzeFoodImage;
