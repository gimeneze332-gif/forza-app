import { validateProviderProposal } from "./schema.js";

export const CLOUDFLARE_AI_MODEL = "@cf/moondream/moondream3.1-9B-A2B";
const MIN_IDENTITY_CONFIDENCE = 0.55;

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
  const proposal = parseJsonAnswer(response?.answer ?? response?.response ?? response, options);
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
