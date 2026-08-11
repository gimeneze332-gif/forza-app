import { bearerToken, constantTimeEqual } from "./auth.js";
import { validateImageHeaders, validateJpeg, MAX_IMAGE_BYTES } from "./image-validation.js";
import { normalizeVisualProposal } from "./schema.js";
import { safeLog } from "./logging.js";
import { analyzeMock } from "./mock-provider.js";
export { PhotoFoodState } from "./photo-food-state.js";

const TIMEOUT_MS = 5000;

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  return origin && origin === env.ALLOWED_ORIGIN ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
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

async function timeout(promise, milliseconds = TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

export function createHandler() {
  return async function handle(request, env) {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const cors = corsHeaders(request, env);
    const origin = request.headers.get("origin");
    if (origin && !cors) return json({ error: "origin_not_allowed", requestId }, 403);
    if (request.method === "OPTIONS") return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: "origin_not_allowed", requestId }, 403);
    if (request.method !== "POST") return json({ error: "method_not_allowed", requestId }, 405, cors);
    if (env.PHOTO_FOOD_ENABLED !== "true") return json({ error: "photo_food_disabled", requestId }, 503, cors);

    const url = new URL(request.url);
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
    if (url.pathname !== "/photo-food/analyze") return json({ error: "not_found", requestId }, 404, cors);

    const headerCheck = validateImageHeaders(request);
    if (!headerCheck.valid) return json({ error: headerCheck.error, requestId }, headerCheck.status, cors);
    const auth = await stateRequest(env, "/analysis/start", { method: "POST", headers: { authorization: `Bearer ${bearerToken(request)}` } });
    if (!auth.ok) return json(await auth.json(), auth.status, cors);
    let size = 0; let componentCount = 0; let status = 200; let genericError = null;
    try {
      const bytes = new Uint8Array(await request.arrayBuffer()); size = bytes.length;
      if (size > MAX_IMAGE_BYTES) { status = 413; genericError = "image_too_large"; return json({ error: genericError, requestId }, status, cors); }
      if (!validateJpeg(bytes)) { status = 400; genericError = "invalid_image"; return json({ error: genericError, requestId }, status, cors); }
      const scenario = request.headers.get("x-photo-food-mock-scenario") || "success";
      const raw = await timeout(analyzeMock(scenario));
      const result = normalizeVisualProposal(raw); componentCount = result.items.length;
      return json(result, 200, cors);
    } catch (error) {
      status = error.message === "timeout" ? 504 : error.message === "invalid_provider_response" ? 502 : 503;
      genericError = error.message === "timeout" ? "analysis_timeout" : error.message === "invalid_provider_response" ? "invalid_provider_response" : "analysis_failed";
      return json({ error: genericError, requestId }, status, cors);
    } finally {
      const finish = await stateRequest(env, "/analysis/finish", { method: "POST" });
      const quota = await finish.json().catch(() => ({}));
      safeLog({ requestId, timestamp: new Date().toISOString(), status, durationMs: Date.now() - started, size, componentCount, quotaRemaining: quota.dailyRemaining, error: genericError });
    }
  };
}

const handler = createHandler();
export default { fetch: handler };
