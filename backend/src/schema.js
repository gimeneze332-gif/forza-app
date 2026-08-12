const EXACT_ROOT_KEYS = ["schemaVersion", "items", "unknownComponents", "uncertainties"];
const EXACT_ITEM_KEYS = ["name", "preparation", "estimatedPortion", "estimatedGrams", "identityConfidence", "quantityConfidence", "notes"];

function exactKeys(value, expected) {
  const keys = Object.keys(value || {}).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}
function nullableNumber(value) { return value === null || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1); }

export function validateProviderProposal(value) {
  if (!value || typeof value !== "object" || !exactKeys(value, EXACT_ROOT_KEYS) || value.schemaVersion !== 1 ||
      !Array.isArray(value.items) || !Array.isArray(value.unknownComponents) || !Array.isArray(value.uncertainties) || value.items.length > 12) return false;
  return value.items.every(item => item && exactKeys(item, EXACT_ITEM_KEYS) && typeof item.name === "string" && item.name.trim() &&
    (item.preparation === null || typeof item.preparation === "string") &&
    (item.estimatedPortion === null || ["small", "normal", "large"].includes(item.estimatedPortion)) &&
    (item.estimatedGrams === null || (Number.isInteger(item.estimatedGrams) && item.estimatedGrams > 0 && item.estimatedGrams <= 3000)) &&
    Number.isFinite(Number(item.identityConfidence)) && Number(item.identityConfidence) >= 0 && Number(item.identityConfidence) <= 1 &&
    nullableNumber(item.quantityConfidence) && Array.isArray(item.notes));
}

export function normalizeVisualProposal(value) {
  const modern = value?.schemaVersion === 1;
  if (modern && !validateProviderProposal(value)) throw new Error("invalid_provider_response");
  if (!modern && (!value || !Array.isArray(value.items) || !Array.isArray(value.uncertainties))) throw new Error("invalid_provider_response");
  return {
    schemaVersion: 1,
    items: value.items.slice(0, 12).map(item => {
      const identityConfidence = Number(item.identityConfidence ?? item.foodConfidence);
      const notes = Array.isArray(item.notes) ? item.notes.slice(0, 6).map(note => String(note).slice(0, 160)) : item.notes ? [String(item.notes).slice(0, 160)] : [];
      return {
        name: String(item?.name || "").trim().slice(0, 80),
        preparation: item?.preparation ? String(item.preparation).trim().slice(0, 60) : null,
        estimatedPortion: ["small", "normal", "large"].includes(item?.estimatedPortion) ? item.estimatedPortion : null,
        estimatedGrams: Number.isFinite(Number(item?.estimatedGrams)) ? Math.round(Number(item.estimatedGrams)) : null,
        identityConfidence: item?.identityConfidence == null && item?.foodConfidence == null ? null : Number.isFinite(identityConfidence) ? identityConfidence : null,
        foodConfidence: item?.identityConfidence == null && item?.foodConfidence == null ? null : Number.isFinite(identityConfidence) ? identityConfidence : null,
        quantityConfidence: item?.quantityConfidence == null ? null : Number.isFinite(Number(item.quantityConfidence)) ? Number(item.quantityConfidence) : null,
        notes,
        note: notes.join(" · ") || null
      };
    }).filter(item => item.name),
    unknownComponents: (value.unknownComponents || []).slice(0, 12).map(item => String(item).slice(0, 160)),
    uncertainties: value.uncertainties.slice(0, 12).map(item => String(item).slice(0, 180))
  };
}
