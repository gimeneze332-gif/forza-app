import { bearerToken, constantTimeEqual } from "./auth.js";
import { validateImageHeaders, validateJpeg, MAX_IMAGE_BYTES } from "./image-validation.js";
import { normalizeVisualProposal } from "./schema.js";
import { safeLog, safeStageLog } from "./logging.js";
import { analyzeMock } from "./mock-provider.js";
import { analyzeFoodImage as analyzeWithGemini, listAvailableGeminiModels } from "./gemini-adapter.js";
import { analyzeFoodImage as analyzeWithCloudflareAI } from "./cloudflare-ai-adapter.js";
import { estimateUnknownFoods } from "./nutrition-fallback-adapter.js";
import { validateFallbackRequest } from "./nutrition-fallback-schema.js";
export { PhotoFoodState } from "./photo-food-state.js";

const TIMEOUT_MS = 12000;

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  return origin && origin === env.ALLOWED_ORIGIN ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Photo-Food-Mock-Scenario",
    "access-control-max-age": "86400",
    "vary": "Origin"
  } : null;
}

function json(value, status, cors = null) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...(cors || {}) } });
}

async function stateRequest(env, path, init = {}) {
  const id = env.PHOTO_FOOD_STATE.idFromName("personal");
  return env.PHOTO_FOOD_STATE.get(id).fetch(`https://state.internal${path}`, init);
}

export async function runProvider(provider, bytes, env, request, scenario, diagnostics = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  request.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const operation = provider === "mock"
      ? analyzeMock(scenario).then(proposal => ({ proposal, usage: null, model: "mock" }))
      : provider === "gemini"
        ? env.GEMINI_API_KEY ? analyzeWithGemini(bytes, { apiKey: env.GEMINI_API_KEY, signal: controller.signal, onDiagnostic: diagnostics.onDiagnostic }) : Promise.reject(new Error("gemini_disabled"))
        : provider === "cloudflare-ai"
          ? analyzeWithCloudflareAI(bytes, { ai: env.AI, onDiagnostic: diagnostics.onDiagnostic })
        : Promise.reject(new Error("invalid_provider"));
    return await Promise.race([operation, new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }))]);
  }
  catch (error) { if (error.name === "AbortError") throw new Error("timeout"); throw error; }
  finally { clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); }
}

export function createHandler() {
  return async function handle(request, env) {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const cors = corsHeaders(request, env);
    const origin = request.headers.get("origin");
    if (origin && !cors) return json({ error: "origin_not_allowed", requestId }, 403);
    if (request.method === "OPTIONS") return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: "origin_not_allowed", requestId }, 403);
    const url = new URL(request.url);
    if (env.BACKEND_ENABLED !== "true") return json({ error: "backend_disabled", requestId }, 503, cors);
    if (url.pathname === "/health") {
      if (request.method !== "GET") return json({ error: "method_not_allowed", requestId }, 405, cors);
      return json({ status: "ok", analysisEnabled: env.PHOTO_ANALYSIS_ENABLED === "true", provider: env.PHOTO_FOOD_PROVIDER || "mock", nutritionFallbackEnabled: env.NUTRITION_FALLBACK_ENABLED === "true" }, 200, cors);
    }
    if (url.pathname === "/admin/gemini/models") {
      if (request.method !== "GET") return json({ error: "method_not_allowed", requestId }, 405, cors);
      if (!constantTimeEqual(bearerToken(request), env.PAIRING_ADMIN_SECRET)) {
        safeLog({ requestId, timestamp: new Date().toISOString(), status: 403, durationMs: Date.now() - started, error: "forbidden", provider: "gemini" });
        return json({ error: "forbidden", requestId }, 403, cors);
      }
      if (!env.GEMINI_API_KEY) {
        safeLog({ requestId, timestamp: new Date().toISOString(), status: 503, durationMs: Date.now() - started, error: "gemini_disabled", provider: "gemini" });
        return json({ error: "gemini_disabled", requestId }, 503, cors);
      }
      let status = 200; let genericError = null; let models = [];
      try {
        models = await listAvailableGeminiModels({ apiKey: env.GEMINI_API_KEY });
        return json(models, 200, cors);
      } catch (error) {
        status = error.message === "provider_rate_limit" ? 429 : ["provider_auth_failed", "provider_request_failed", "provider_model_not_found", "provider_unavailable", "provider_invalid_json", "gemini_disabled"].includes(error.message) ? 502 : 503;
        genericError = error.message === "provider_rate_limit" ? "provider_rate_limit" : "models_lookup_failed";
        return json({ error: genericError, requestId }, status, cors);
      } finally {
        safeLog({ requestId, timestamp: new Date().toISOString(), status, durationMs: Date.now() - started, modelCount: models.length, error: genericError, provider: "gemini" });
      }
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed", requestId }, 405, cors);
    if (url.pathname === "/pairing/create") {
      if (!constantTimeEqual(bearerToken(request), env.PAIRING_ADMIN_SECRET)) return json({ error: "forbidden", requestId }, 403, cors);
      const response = await stateRequest(env, "/pairing/create", { method: "POST" });
      return json(await response.json(), response.status, cors);
    }
    if (url.pathname === "/pairing/claim") {
      if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return json({ error: "unsupported_content_type", requestId }, 415, cors);
      let body; try { body = await request.json(); } catch (_) { return json({ error: "invalid_json", requestId }, 400, cors); }
      const response = await stateRequest(env, "/pairing/claim", { method: "POST", body: JSON.stringify({ code: body?.code }) });
      return json(await response.json(), response.status, cors);
    }
    if (url.pathname === "/device/revoke") {
      const response = await stateRequest(env, "/device/revoke", { method: "POST", headers: { authorization: `Bearer ${bearerToken(request)}` } });
      return json(await response.json(), response.status, cors);
    }
    if (url.pathname === "/nutrition-fallback/estimate") {
      if (env.NUTRITION_FALLBACK_ENABLED !== "true") return json({ error: "fallback_disabled", requestId }, 503, cors);
      if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return json({ error: "unsupported_content_type", requestId }, 415, cors);
      let body; try { body = await request.json(); } catch (_) { return json({ error: "invalid_json", requestId }, 400, cors); }
      if (!validateFallbackRequest(body)) return json({ error: "invalid_fallback_request", requestId }, 400, cors);
      const auth = await stateRequest(env, "/nutrition-fallback/start", { method: "POST", headers: { authorization: `Bearer ${bearerToken(request)}` } });
      if (!auth.ok) return json(await auth.json(), auth.status, cors);
      const quotaStart = await auth.json(); let status = 200; let genericError = null; let usage = null; let model = "gemini-3.5-flash-lite";
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const onDiagnostic = details => safeStageLog({ requestId, provider: "gemini", model, ...details });
      onDiagnostic({ stage: "nutrition_fallback_request_received" });
      try {
        if (!env.GEMINI_API_KEY) throw new Error("gemini_disabled");
        const estimated = await estimateUnknownFoods(body, { apiKey: env.GEMINI_API_KEY, signal: controller.signal, onDiagnostic });
        usage = estimated.usage; model = estimated.model;
        return json({ ...estimated.proposal, quota: { dailyRemaining: quotaStart.dailyRemaining, monthlyRemaining: quotaStart.monthlyRemaining } }, 200, cors);
      } catch (error) {
        const rate = error.message === "provider_rate_limit"; const timeout = error.message === "provider_timeout";
        status = timeout ? 504 : rate ? 429 : 502; genericError = timeout ? "fallback_timeout" : rate ? "fallback_rate_limit" : "fallback_unavailable";
        return json({ error: genericError, requestId }, status, cors);
      } finally {
        clearTimeout(timer); const finish = await stateRequest(env, "/nutrition-fallback/finish", { method: "POST" }); const quota = await finish.json().catch(() => ({}));
        safeLog({ requestId, timestamp: new Date().toISOString(), status, durationMs: Date.now() - started, componentCount: body.foods.length, quotaRemaining: quota.dailyRemaining, monthlyQuotaRemaining: quota.monthlyRemaining, error: genericError, provider: "gemini", model,
          inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, thinkingTokens: usage?.thinkingTokens, totalTokens: usage?.totalTokens });
      }
    }
    if (url.pathname !== "/photo-food/analyze") return json({ error: "not_found", requestId }, 404, cors);
    if (env.PHOTO_ANALYSIS_ENABLED !== "true") return json({ error: "photo_analysis_disabled", requestId }, 503, cors);

    const headerCheck = validateImageHeaders(request);
    if (!headerCheck.valid) return json({ error: headerCheck.error, requestId }, headerCheck.status, cors);
    const auth = await stateRequest(env, "/analysis/start", { method: "POST", headers: { authorization: `Bearer ${bearerToken(request)}` } });
    if (!auth.ok) return json(await auth.json(), auth.status, cors);
    const provider = env.PHOTO_FOOD_PROVIDER || "mock";
    let size = 0; let componentCount = 0; let status = 200; let genericError = null; let usage = null; let model = provider;
    try {
      const bytes = new Uint8Array(await request.arrayBuffer()); size = bytes.length;
      if (size > MAX_IMAGE_BYTES) { status = 413; genericError = "image_too_large"; return json({ error: genericError, requestId }, status, cors); }
      if (!validateJpeg(bytes)) { status = 400; genericError = "invalid_image"; return json({ error: genericError, requestId }, status, cors); }
      const scenario = request.headers.get("x-photo-food-mock-scenario") || "success";
      const onDiagnostic = details => safeStageLog({ requestId, provider, model: provider === "cloudflare-ai" ? "@cf/moondream/moondream3.1-9B-A2B" : provider, size, ...details });
      onDiagnostic({ stage: "request_received" });
      const analyzed = await runProvider(provider, bytes, env, request, scenario, { onDiagnostic });
      usage = analyzed.usage; model = analyzed.model;
      const result = normalizeVisualProposal(analyzed.proposal); componentCount = result.items.length;
      onDiagnostic({ stage: "normalization_completed", durationMs: Date.now() - started });
      onDiagnostic({ stage: "analysis_completed", durationMs: Date.now() - started, status: 200,
        inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, thinkingTokens: usage?.thinkingTokens, totalTokens: usage?.totalTokens,
        inputCostUsd: usage?.inputCostUsd, outputCostUsd: usage?.outputCostUsd, estimatedCostUsd: usage?.estimatedCostUsd, neurons: usage?.neurons });
      return json(result, 200, cors);
    } catch (error) {
      const providerRateLimit = error.message === "provider_rate_limit";
      const providerContract = ["provider_invalid_json", "provider_empty_response", "provider_schema_invalid", "invalid_provider_response", "no_food_detected", "provider_auth_failed", "provider_request_failed", "provider_model_not_found", "provider_unavailable", "gemini_disabled", "unexpected_query_wrapper", "unexpected_candidate_type", "missing_query_answer", "empty_response", "json_extraction_failed", "json_parse_failed", "schema_validation_failed", "no_food", "low_confidence"].includes(error.message);
      status = error.message === "timeout" || error.message === "provider_timeout" ? 504 : providerRateLimit ? 429 : providerContract ? 502 : error.message === "invalid_provider" ? 503 : 503;
      genericError = error.message === "timeout" || error.message === "provider_timeout" ? "analysis_timeout" : providerRateLimit ? "provider_rate_limit" : providerContract ? "invalid_provider_response" : error.message === "invalid_provider" ? "provider_disabled" : "analysis_failed";
      return json({ error: genericError, requestId }, status, cors);
    } finally {
      const finish = await stateRequest(env, "/analysis/finish", { method: "POST" });
      const quota = await finish.json().catch(() => ({}));
      safeLog({ requestId, timestamp: new Date().toISOString(), status, durationMs: Date.now() - started, size, componentCount, quotaRemaining: quota.dailyRemaining, error: genericError, provider, model,
        inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, thinkingTokens: usage?.thinkingTokens, totalTokens: usage?.totalTokens,
        inputCostUsd: usage?.inputCostUsd, outputCostUsd: usage?.outputCostUsd, estimatedCostUsd: usage?.estimatedCostUsd, neurons: usage?.neurons });
    }
  };
}

const handler = createHandler();
export default { fetch: handler };
