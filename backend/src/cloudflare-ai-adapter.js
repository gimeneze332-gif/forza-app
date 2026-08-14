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
const UNSUPPORTED_ALIAS_KEYS = new Set([
  "foodname", "itemname", "portionsize", "servingsize", "estimatedweight",
  "weightgrams", "identityscore", "foodconfidence", "quantityscore"
]);

class CanonicalizationError extends Error {
  constructor(code) {
    super("schema_validation_failed");
    this.canonicalizationErrorCode = code;
  }
}

function canonicalizationFailure(code) { throw new CanonicalizationError(code); }

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
  if (left !== right) canonicalizationFailure("conflicting_aliases");
  return primaryValue;
}

function optionalString(value, errorCode) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") canonicalizationFailure(errorCode);
  const normalized = value.trim();
  return normalized || null;
}

function requiredName(value) {
  if (value == null || value === "") canonicalizationFailure("name_missing");
  if (typeof value !== "string" || !value.trim()) canonicalizationFailure("name_invalid");
  return value.trim();
}

function portion(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") canonicalizationFailure("invalid_portion");
  const canonical = PORTION_ALIASES.get(normalizedKey(value));
  if (!canonical) canonicalizationFailure("invalid_portion");
  return canonical;
}

function grams(value) {
  if (value == null || value === "") return null;
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,4})(?:\s*g(?:r(?:amos?)?)?)?$/i) : null;
  const numeric = match ? Number(match[1]) : value;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 3000) canonicalizationFailure("invalid_grams");
  return numeric;
}

function confidence(value, nullable, errorCode) {
  if (value == null) {
    if (nullable) return null;
    canonicalizationFailure("confidence_missing");
  }
  const numeric = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) canonicalizationFailure(errorCode);
  return numeric;
}

function notes(value) {
  if (value == null) return [];
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list) || list.some(note => typeof note !== "string")) canonicalizationFailure("invalid_notes");
  return list.map(note => note.trim()).filter(Boolean);
}

function stringArray(value, errorCode) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) canonicalizationFailure(errorCode);
  return value.map(item => item.trim()).filter(Boolean);
}

export function canonicalizeCloudflareProposal(value) {
  if (!plainObject(value)) canonicalizationFailure("invalid_root_shape");
  if (containsForbiddenKey(value)) canonicalizationFailure("forbidden_nutrition_field");
  if (Object.keys(value).some(key => UNSUPPORTED_ALIAS_KEYS.has(normalizedKey(key)))) canonicalizationFailure("unsupported_alias");
  if (value.schemaVersion != null && Number(value.schemaVersion) !== 1) canonicalizationFailure("noncanonicalizable_response");
  if (!("items" in value) || value.items == null) canonicalizationFailure("items_missing");
  if (!Array.isArray(value.items)) canonicalizationFailure("items_not_array");
  if (value.items.length > 12) canonicalizationFailure("noncanonicalizable_response");
  const items = value.items.map(item => {
    if (!plainObject(item)) canonicalizationFailure("invalid_item_shape");
    if (Object.keys(item).some(key => UNSUPPORTED_ALIAS_KEYS.has(normalizedKey(key)))) canonicalizationFailure("unsupported_alias");
    return {
      name: requiredName(compatibleAlias(item, "name", "food")),
      preparation: optionalString(item.preparation, "invalid_preparation"),
      estimatedPortion: portion(compatibleAlias(item, "estimatedPortion", "portion")),
      estimatedGrams: grams(compatibleAlias(item, "estimatedGrams", "grams")),
      identityConfidence: confidence(compatibleAlias(item, "identityConfidence", "confidence"), false, "invalid_identity_confidence"),
      quantityConfidence: confidence(item.quantityConfidence, true, "invalid_quantity_confidence"),
      notes: notes(item.notes)
    };
  });
  return {
    schemaVersion: 1,
    items,
    unknownComponents: stringArray(value.unknownComponents, "invalid_unknown_components"),
    uncertainties: stringArray(value.uncertainties, "invalid_uncertainties")
  };
}

function candidateType(value) {
  if (value == null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "object" && !Array.isArray(value)) return "object";
  return "other";
}

function selectQueryCandidate(response) {
  if (response == null) return { selectedWrapper: "none", candidateType: "null", candidate: null };
  if (!plainObject(response)) return { selectedWrapper: "root", candidateType: candidateType(response), candidate: response };
  for (const selectedWrapper of ["answer", "response", "description"]) {
    if (Object.prototype.hasOwnProperty.call(response, selectedWrapper)) {
      const candidate = response[selectedWrapper];
      return { selectedWrapper, candidateType: candidateType(candidate), candidate };
    }
  }
  return { selectedWrapper: "root", candidateType: "object", candidate: response };
}

function queryResponseFailure(code, options) {
  diagnostic(options, "query_response_rejected", { errorCode: code });
  throw new Error(code);
}

function uniqueJsonObject(text, options) {
  const objects = [];
  let start = -1; let depth = 0; let quoted = false; let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === "{") { if (depth === 0) start = index; depth += 1; continue; }
    if (char === "}") {
      if (depth === 0) {
        diagnostic(options, "json_parse_failed", { errorCode: "json_parse_failed" });
        throw new Error("json_parse_failed");
      }
      depth -= 1;
      if (depth === 0) { objects.push(text.slice(start, index + 1)); start = -1; }
    }
  }
  if (quoted || depth !== 0) {
    diagnostic(options, "json_parse_failed", { errorCode: "json_parse_failed" });
    throw new Error("json_parse_failed");
  }
  if (objects.length !== 1) {
    diagnostic(options, "json_extraction_failed", { errorCode: "json_extraction_failed" });
    throw new Error("json_extraction_failed");
  }
  return objects[0];
}

function parseJsonAnswer(answer, options) {
  if (plainObject(answer) && Array.isArray(answer.items)) return answer;
  if (answer && typeof answer === "object") queryResponseFailure("unexpected_candidate_type", options);
  if (typeof answer !== "string" || !answer.trim()) queryResponseFailure("missing_query_answer", options);
  const cleaned = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const json = uniqueJsonObject(cleaned, options);
  try {
    const parsed = JSON.parse(json);
    if (!plainObject(parsed)) throw new Error("json_parse_failed");
    return parsed;
  } catch (_) {
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
  const selection = selectQueryCandidate(response);
  diagnostic(options, "model_call_completed", { durationMs: Date.now() - started, ...usage, selectedWrapper: selection.selectedWrapper, candidateType: selection.candidateType });
  if (selection.selectedWrapper === "none" || (selection.selectedWrapper === "answer" && selection.candidateType === "null")) queryResponseFailure("missing_query_answer", options);
  if (selection.selectedWrapper !== "answer") queryResponseFailure("unexpected_query_wrapper", options);
  if (selection.candidateType !== "string") queryResponseFailure("unexpected_candidate_type", options);
  let proposal;
  try { proposal = canonicalizeCloudflareProposal(parseJsonAnswer(selection.candidate, options)); }
  catch (error) {
    if (error.message !== "schema_validation_failed") throw error;
    diagnostic(options, "schema_validation_failed", {
      durationMs: Date.now() - started,
      status: 502,
      errorCode: "schema_validation_failed",
      canonicalizationErrorCode: error.canonicalizationErrorCode || "noncanonicalizable_response"
    });
    throw error;
  }
  if (!validateProviderProposal(proposal)) {
    diagnostic(options, "schema_validation_failed", {
      durationMs: Date.now() - started,
      status: 502,
      errorCode: "schema_validation_failed",
      canonicalizationErrorCode: "noncanonicalizable_response"
    });
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
