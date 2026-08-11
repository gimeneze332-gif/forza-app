export function normalizeVisualProposal(value) {
  if (!value || !Array.isArray(value.items) || !Array.isArray(value.uncertainties)) throw new Error("invalid_provider_response");
  return {
    items: value.items.slice(0, 12).map(item => ({
      name: String(item?.name || "").trim().slice(0, 80),
      preparation: item?.preparation ? String(item.preparation).trim().slice(0, 60) : null,
      estimatedPortion: ["small", "normal", "large"].includes(item?.estimatedPortion) ? item.estimatedPortion : null,
      estimatedGrams: Number.isFinite(Number(item?.estimatedGrams)) ? Math.round(Number(item.estimatedGrams)) : null,
      foodConfidence: Number.isFinite(Number(item?.foodConfidence)) ? Number(item.foodConfidence) : null,
      quantityConfidence: Number.isFinite(Number(item?.quantityConfidence)) ? Number(item.quantityConfidence) : null,
      notes: item?.notes ? String(item.notes).trim().slice(0, 160) : null
    })).filter(item => item.name),
    uncertainties: value.uncertainties.slice(0, 12).map(item => String(item).slice(0, 180))
  };
}
