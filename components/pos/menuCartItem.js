import {
  getCategoryName,
  getDisplayPrice,
  getItemId,
} from "../../services/menuV2Api";

export function isAddonMenuItem(item) {
  return String(item?.itemType || "").toLowerCase() === "addon";
}

export function requiresVariantSelection(item) {
  const variants = Array.isArray(item.variants) ? item.variants : [];
  return ["half-full", "size-based", "custom"].includes(item.pricingType) && variants.length > 0;
}

export function buildCartItem(item, selectedVariant, selectedAddons = []) {
  const category = getCategoryName(item);
  const addonTotal = selectedAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const basePrice = Number(selectedVariant?.price ?? item.price ?? item.basePrice ?? getDisplayPrice(item));
  const variantLabel = selectedVariant?.label ? ` - ${selectedVariant.label}` : "";
  const addonLabel = selectedAddons.length
    ? ` + ${selectedAddons.map((addon) => addon.name).join(", ")}`
    : "";
  const variantKey = selectedVariant?.code || selectedVariant?.label || "single";
  const addonKey = selectedAddons.map((addon) => addon.name).join("+") || "no-addons";

  return {
    _id: `${getItemId(item)}::${variantKey}::${addonKey}`,
    itemId: getItemId(item),
    name: `${item.name}${variantLabel}${addonLabel}`,
    category,
    price: basePrice + addonTotal,
    qty: 1,
  };
}
