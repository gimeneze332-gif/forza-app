const ALLOWED = new Set(["requestId", "timestamp", "status", "durationMs", "size", "componentCount", "quotaRemaining", "error", "provider", "model", "inputTokens", "outputTokens", "thinkingTokens", "totalTokens", "neurons"]);
const DIAGNOSTIC_FIELDS = new Set(["requestId", "stage", "provider", "model", "durationMs", "size", "status", "inputTokens", "outputTokens", "totalTokens", "neurons", "errorCode"]);
const DIAGNOSTIC_STAGES = new Set(["request_received", "model_call_started", "model_call_completed", "model_call_failed", "empty_response", "json_extraction_failed", "json_parse_failed", "schema_validation_failed", "no_food", "low_confidence", "normalization_completed", "analysis_completed"]);
const DIAGNOSTIC_ERRORS = new Set(["provider_rate_limit", "provider_unavailable", "empty_response", "json_extraction_failed", "json_parse_failed", "schema_validation_failed", "no_food", "low_confidence"]);
const DIAGNOSTIC_PROVIDERS = new Set(["mock", "cloudflare-ai", "gemini"]);

export function safeLog(details = {}, output = console) {
  const safe = {};
  for (const [key, value] of Object.entries(details)) if (ALLOWED.has(key) && value != null) safe[key] = value;
  output.log(JSON.stringify(safe));
  return safe;
}

export function safeStageLog(details = {}, output = console) {
  if (!DIAGNOSTIC_STAGES.has(details.stage)) return null;
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (!DIAGNOSTIC_FIELDS.has(key) || value == null) continue;
    if (key === "errorCode" && !DIAGNOSTIC_ERRORS.has(value)) continue;
    if (key === "provider" && !DIAGNOSTIC_PROVIDERS.has(value)) continue;
    if (["durationMs", "size", "status", "inputTokens", "outputTokens", "totalTokens", "neurons"].includes(key) && !Number.isFinite(Number(value))) continue;
    safe[key] = value;
  }
  output.log(JSON.stringify(safe));
  return safe;
}
