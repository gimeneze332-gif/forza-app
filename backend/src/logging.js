const ALLOWED = new Set(["requestId", "timestamp", "status", "durationMs", "size", "componentCount", "quotaRemaining", "error", "provider", "model", "inputTokens", "outputTokens", "thinkingTokens", "totalTokens", "neurons"]);
const DIAGNOSTIC_FIELDS = new Set(["requestId", "stage", "provider", "model", "durationMs", "size", "status", "inputTokens", "outputTokens", "totalTokens", "neurons", "errorCode", "canonicalizationErrorCode", "selectedWrapper", "candidateType", "rootKeyProfile", "unknownRootKeysCount", "resultShape", "dataShape", "outputShape", "rootShapeCodes"]);
const DIAGNOSTIC_STAGES = new Set(["request_received", "model_call_started", "model_call_completed", "model_call_failed", "query_response_rejected", "empty_response", "json_extraction_failed", "json_parse_failed", "schema_validation_failed", "no_food", "low_confidence", "normalization_completed", "analysis_completed"]);
const DIAGNOSTIC_ERRORS = new Set(["provider_rate_limit", "provider_unavailable", "unexpected_query_wrapper", "unexpected_candidate_type", "missing_query_answer", "empty_response", "json_extraction_failed", "json_parse_failed", "schema_validation_failed", "no_food", "low_confidence"]);
const DIAGNOSTIC_PROVIDERS = new Set(["mock", "cloudflare-ai", "gemini"]);
const QUERY_WRAPPERS = new Set(["answer", "response", "description", "root", "none"]);
const CANDIDATE_TYPES = new Set(["string", "object", "null", "other"]);
const PROFILE_TYPES = new Set(["string", "object", "array", "number", "boolean", "null", "other"]);
const ROOT_PROFILE_KEYS = new Set(["answer", "result", "response", "description", "caption", "data", "output", "message", "messages", "success", "errors", "metrics", "usage", "request_id", "id"]);
const NESTED_PROFILE_KEYS = new Set(["answer", "response", "description", "caption", "result", "output"]);
const ROOT_SHAPE_CODES = new Set(["root_has_known_wrapper", "root_has_unknown_shape", "nested_answer_detected", "nested_response_detected", "nested_description_detected", "nested_caption_detected", "no_supported_text_field_detected"]);
const CANONICALIZATION_ERRORS = new Set([
  "invalid_root_shape", "items_missing", "items_not_array", "invalid_item_shape",
  "name_missing", "name_invalid", "invalid_preparation", "invalid_portion", "invalid_grams",
  "confidence_missing", "invalid_identity_confidence", "invalid_quantity_confidence", "invalid_notes",
  "invalid_unknown_components", "invalid_uncertainties", "forbidden_nutrition_field",
  "unsupported_alias", "conflicting_aliases", "noncanonicalizable_response"
]);

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeProfile(value, allowedKeys) {
  if (!plainObject(value)) return null;
  const safe = {};
  for (const [key, type] of Object.entries(value)) {
    if (!allowedKeys.has(key) || !PROFILE_TYPES.has(type)) continue;
    safe[key] = type;
  }
  return Object.keys(safe).length ? safe : null;
}

function safeShapeCodes(value) {
  if (!Array.isArray(value)) return null;
  const safe = value.filter(code => ROOT_SHAPE_CODES.has(code));
  return safe.length ? [...new Set(safe)].sort() : null;
}

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
    if (key === "canonicalizationErrorCode" && !CANONICALIZATION_ERRORS.has(value)) continue;
    if (key === "provider" && !DIAGNOSTIC_PROVIDERS.has(value)) continue;
    if (key === "selectedWrapper" && !QUERY_WRAPPERS.has(value)) continue;
    if (key === "candidateType" && !CANDIDATE_TYPES.has(value)) continue;
    if (key === "rootKeyProfile") {
      const profile = safeProfile(value, ROOT_PROFILE_KEYS);
      if (profile) safe[key] = profile;
      continue;
    }
    if (["resultShape", "dataShape", "outputShape"].includes(key)) {
      const profile = safeProfile(value, NESTED_PROFILE_KEYS);
      if (profile) safe[key] = profile;
      continue;
    }
    if (key === "rootShapeCodes") {
      const codes = safeShapeCodes(value);
      if (codes) safe[key] = codes;
      continue;
    }
    if (["durationMs", "size", "status", "inputTokens", "outputTokens", "totalTokens", "neurons", "unknownRootKeysCount"].includes(key) && !Number.isFinite(Number(value))) continue;
    safe[key] = ["durationMs", "size", "status", "inputTokens", "outputTokens", "totalTokens", "neurons", "unknownRootKeysCount"].includes(key) ? Number(value) : value;
  }
  output.log(JSON.stringify(safe));
  return safe;
}
