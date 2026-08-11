export function safeLog(event, details = {}) {
  console.log(JSON.stringify({ event, status: details.status, durationMs: details.durationMs }));
}
