import { authorize } from "./auth.js";
import { checkLimits } from "./limits.js";
import { validateImageRequest } from "./image-validation.js";

function json(value, status) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!authorize(request, env)) return json({ error: "unauthorized" }, 401);
    if (!validateImageRequest(request)) return json({ error: "invalid_image" }, 400);
    const limit = await checkLimits(request, env);
    if (!limit.allowed) return json({ error: limit.reason }, 503);
    return json({ error: "remote_disabled" }, 503);
  }
};
