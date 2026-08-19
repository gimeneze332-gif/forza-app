import { GEMINI_FALLBACK_SCHEMA, normalizeFallbackProposal } from "./nutrition-fallback-schema.js";

const MODEL = "gemini-3.5-flash-lite";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
export const NUTRITION_FALLBACK_PROMPT = `Estimá referencias nutricionales generales únicamente para los alimentos simples indicados. Devolvé valores por 100 g. No uses historial, contexto personal ni objetivos. No inventes una preparación: usá null si no está indicada. Clasificá recetas, productos comerciales o preparaciones compuestas como tales. No des recomendaciones ni calcules la porción consumida.`;
function providerError(response) { if (response.status === 429) return "provider_rate_limit"; if (response.status >= 500) return "provider_unavailable"; if ([401, 403].includes(response.status)) return "provider_auth_failed"; if (response.status === 404) return "provider_model_not_found"; return "provider_request_failed"; }
export async function estimateUnknownFoods(request, options = {}) {
  if (!options.apiKey) throw new Error("gemini_disabled");
  const fetchImpl = options.fetchImpl || fetch; const started = Date.now(); const diagnostic = details => options.onDiagnostic?.({ model: MODEL, ...details });
  diagnostic({ stage: "nutrition_fallback_model_started" });
  let response;
  try { response = await fetchImpl(`${API_ROOT}/${MODEL}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey }, signal: options.signal,
    body: JSON.stringify({ systemInstruction: { parts: [{ text: NUTRITION_FALLBACK_PROMPT }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(request) }] }], generationConfig: { maxOutputTokens: 700, responseMimeType: "application/json", responseJsonSchema: GEMINI_FALLBACK_SCHEMA, thinkingConfig: { thinkingLevel: "minimal" } } }) }); }
  catch (error) { const code = error?.name === "AbortError" ? "provider_timeout" : "provider_unavailable"; diagnostic({ stage: "nutrition_fallback_failed", errorCode: code, durationMs: Date.now() - started }); throw new Error(code); }
  diagnostic({ stage: "nutrition_fallback_response_received", providerHttpStatus: response.status, durationMs: Date.now() - started });
  if (!response.ok) { const code = providerError(response); diagnostic({ stage: "nutrition_fallback_failed", providerHttpStatus: response.status, errorCode: code, durationMs: Date.now() - started }); throw new Error(code); }
  let envelope; try { envelope = await response.json(); } catch (_) { throw new Error("provider_invalid_json"); }
  const text = envelope?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!text) throw new Error("provider_empty_response");
  let proposal; try { proposal = JSON.parse(text); } catch (_) { throw new Error("provider_invalid_json"); }
  let normalized; try { normalized = normalizeFallbackProposal(proposal, request); } catch (_) { diagnostic({ stage: "nutrition_fallback_schema_failed", errorCode: "provider_schema_invalid", durationMs: Date.now() - started }); throw new Error("provider_schema_invalid"); }
  const usage = envelope.usageMetadata || {};
  diagnostic({ stage: "nutrition_fallback_usage_received", usageAvailable: Boolean(envelope.usageMetadata), inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount, thinkingTokens: usage.thoughtsTokenCount, totalTokens: usage.totalTokenCount, durationMs: Date.now() - started });
  diagnostic({ stage: "nutrition_fallback_completed", durationMs: Date.now() - started });
  return { proposal: normalized, model: MODEL, usage: { inputTokens: Number(usage.promptTokenCount || 0), outputTokens: Number(usage.candidatesTokenCount || 0), thinkingTokens: Number(usage.thoughtsTokenCount || 0), totalTokens: Number(usage.totalTokenCount || 0) } };
}
