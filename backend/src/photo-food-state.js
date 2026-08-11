import { bearerToken, hashSecret, randomToken } from "./auth.js";
import { evaluateQuota, LIMITS } from "./limits.js";

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }

export class PhotoFoodState {
  constructor(state) { this.state = state; this.storage = state.storage; }

  async read() { return (await this.storage.get("state")) || {}; }
  async write(value) { await this.storage.put("state", value); }

  async fetch(request) {
    const url = new URL(request.url); const current = await this.read(); const now = Date.now();
    if (url.pathname === "/pairing/create") {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, "0");
      await this.write({ ...current, pairingHash: await hashSecret(code), pairingExpiresAt: now + 10 * 60 * 1000 });
      return json({ code, expiresInSeconds: 600 });
    }
    if (url.pathname === "/pairing/claim") {
      let body; try { body = await request.json(); } catch (_) { return json({ error: "invalid_json" }, 400); }
      if (!current.pairingHash) return json({ error: "pairing_used" }, 410);
      if (Number(current.pairingExpiresAt) < now) return json({ error: "pairing_expired" }, 410);
      if (await hashSecret(body?.code) !== current.pairingHash) return json({ error: "invalid_pairing_code" }, 403);
      const token = randomToken();
      await this.write({ tokenHash: await hashSecret(token), tokenRevoked: false, daily: 0, monthly: 0, perMinute: 0, busy: false });
      return json({ token });
    }
    const token = bearerToken(request);
    const authorized = Boolean(token && current.tokenHash && !current.tokenRevoked && await hashSecret(token) === current.tokenHash);
    if (url.pathname === "/device/revoke") {
      if (!authorized) return json({ error: "unauthorized" }, 401);
      await this.write({ ...current, tokenRevoked: true, busy: false }); return json({ revoked: true });
    }
    if (url.pathname === "/analysis/start") {
      if (!authorized) return json({ error: "unauthorized" }, 401);
      const quota = evaluateQuota(current, new Date());
      if (!quota.allowed) return json({ error: quota.error }, quota.status);
      await this.write({ ...current, day: quota.keys.day, month: quota.keys.month, minute: quota.keys.minute, ...quota.next, busy: true });
      return json({ allowed: true, dailyRemaining: LIMITS.daily - quota.next.daily, monthlyRemaining: LIMITS.monthly - quota.next.monthly });
    }
    if (url.pathname === "/analysis/finish") {
      const updated = { ...current, busy: false }; await this.write(updated);
      return json({ dailyRemaining: Math.max(0, LIMITS.daily - Number(updated.daily || 0)), monthlyRemaining: Math.max(0, LIMITS.monthly - Number(updated.monthly || 0)) });
    }
    return json({ error: "not_found" }, 404);
  }
}
