function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function clampDiscountPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

export function validateDiscountInput(rawValue) {
  const trimmed = String(rawValue ?? "").trim();

  if (!trimmed) {
    return { value: 0, error: "Enter a discount percentage." };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return { value: 0, error: "Discount must be a valid number." };
  }
  if (numeric < 0) {
    return { value: 0, error: "Discount cannot be negative." };
  }
  if (numeric > 100) {
    return { value: 0, error: "Discount cannot exceed 100%." };
  }

  return { value: roundToTwo(numeric), error: "" };
}

export function calculateBillTotals(cartItems, discountPercent) {
  const subtotal = roundToTwo(
    (cartItems || []).reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0)
  );
  const totalQty = (cartItems || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const safeDiscountPercent = roundToTwo(clampDiscountPercent(discountPercent));
  const discountAmount = roundToTwo((subtotal * safeDiscountPercent) / 100);
  const grandTotal = roundToTwo(subtotal - discountAmount);

  return {
    subtotal,
    totalQty,
    discountPercent: safeDiscountPercent,
    discountAmount,
    grandTotal,
  };
}
