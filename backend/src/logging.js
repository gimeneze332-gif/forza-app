const ALLOWED = new Set(["requestId", "timestamp", "status", "durationMs", "size", "componentCount", "quotaRemaining", "error", "provider", "model", "inputTokens", "outputTokens", "thinkingTokens", "totalTokens"]);

export function safeLog(details = {}, output = console) {
  const safe = {};
  for (const [key, value] of Object.entries(details)) if (ALLOWED.has(key) && value != null) safe[key] = value;
  output.log(JSON.stringify(safe));
  return safe;
}
