export const LIMITS = Object.freeze({ daily: 10, monthly: 300, perMinute: 4 });

export function quotaKeys(now = new Date()) {
  const iso = now.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7), minute: iso.slice(0, 16) };
}

export function evaluateQuota(state, now = new Date()) {
  const keys = quotaKeys(now);
  const daily = state.day === keys.day ? Number(state.daily || 0) : 0;
  const monthly = state.month === keys.month ? Number(state.monthly || 0) : 0;
  const perMinute = state.minute === keys.minute ? Number(state.perMinute || 0) : 0;
  if (state.busy) return { allowed: false, status: 429, error: "analysis_in_progress" };
  if (daily >= LIMITS.daily) return { allowed: false, status: 429, error: "daily_limit" };
  if (monthly >= LIMITS.monthly) return { allowed: false, status: 429, error: "monthly_limit" };
  if (perMinute >= LIMITS.perMinute) return { allowed: false, status: 429, error: "rate_limit" };
  return { allowed: true, keys, next: { daily: daily + 1, monthly: monthly + 1, perMinute: perMinute + 1 } };
}
