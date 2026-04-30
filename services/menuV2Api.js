import { apiRequest } from "./apiClient";

export const ITEM_TYPES = ["regular", "combo", "addon", "beverage", "bread", "meal"];
export const PRICING_TYPES = ["single", "half-full", "size-based", "custom"];
export const VARIANT_CODES = ["half", "full", "small", "medium", "large", "custom"];

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getCategoryName(item) {
  return item?.categoryName || item?.category?.name || (typeof item?.category === "string" ? item.category : "") || "Uncategorized";
}

export function getCategoryId(item) {
  return item?.categoryId || item?.category?.id || item?.category?._id || "";
}

export function getItemId(item) {
  return item?.id || item?._id || "";
}

export function isMenuItemAvailable(item) {
  return Boolean(item?.isAvailable ?? item?.available ?? true);
}

export function getDisplayPrice(item) {
  const directPrice = numberOrNull(item?.price ?? item?.basePrice);
  if (directPrice !== null) return directPrice;

  const firstVariantPrice = numberOrNull(item?.variants?.[0]?.price);
  return firstVariantPrice ?? 0;
}

export function formatMoney(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function normalizeCategory(category) {
  return {
    ...category,
    id: category?.id || category?._id || "",
    isActive: category?.isActive ?? true,
  };
}

function normalizeMenuItem(item) {
  const categoryName = getCategoryName(item);
  const categoryId = item?.categoryId || item?.category?.id || item?.category?._id || "";
  const price = numberOrNull(item?.price ?? item?.basePrice);

  return {
    ...item,
    id: item?.id || item?._id || "",
    categoryId,
    categoryName,
    price: price ?? getDisplayPrice(item),
    isAvailable: item?.isAvailable ?? item?.available ?? item?.available === undefined,
    available: item?.available ?? item?.isAvailable ?? true,
    isActive: item?.isActive ?? true,
  };
}

function normalizeCategoriesResponse(data) {
  return {
    ...data,
    categories: Array.isArray(data?.categories) ? data.categories.map(normalizeCategory) : [],
  };
}

function normalizeMenuResponse(data) {
  return {
    ...data,
    items: Array.isArray(data?.items) ? data.items.map(normalizeMenuItem) : [],
  };
}

export function toMenuPayload(form) {
  const basePrice = numberOrNull(form.basePrice);
  const variants = (form.variants || [])
    .filter((variant) => variant.label.trim() || variant.code || variant.price !== "")
    .map((variant) => ({
      label: variant.label.trim(),
      code: variant.code,
      price: Number(variant.price || 0),
    }));

  const addons = (form.addons || [])
    .filter((addon) => addon.name.trim() || addon.price !== "")
    .map((addon) => ({
      name: addon.name.trim(),
      price: Number(addon.price || 0),
    }));

  const tags = Array.isArray(form.tags)
    ? form.tags
    : String(form.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

  return {
    name: form.name.trim(),
    category: form.categoryName || form.category || form.categoryId,
    itemType: form.itemType,
    pricingType: form.pricingType,
    basePrice,
    price: basePrice,
    variants,
    addons,
    description: form.description.trim(),
    tags,
    isRecommended: Boolean(form.isRecommended),
    isAvailable: Boolean(form.isAvailable),
    available: Boolean(form.isAvailable),
    isActive: Boolean(form.isActive),
    sortOrder: Number(form.sortOrder || 0),
  };
}

export function fetchCategoriesV2() {
  return apiRequest("/api/v2/categories").then(normalizeCategoriesResponse);
}

export function createCategoryV2(payload) {
  return apiRequest("/api/v2/categories", {
    method: "POST",
    body: payload,
  });
}

export function updateCategoryV2(id, payload) {
  return apiRequest(`/api/v2/categories/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteCategoryV2(id) {
  return apiRequest(`/api/v2/categories/${id}`, { method: "DELETE" });
}

export function fetchMenuV2(query = {}) {
  return apiRequest("/api/v2/menu", { query }).then(normalizeMenuResponse);
}

export function fetchMenuItemV2(id) {
  return apiRequest(`/api/v2/menu/${id}`).then(normalizeMenuItem);
}

export function createMenuItemV2(payload) {
  return apiRequest("/api/v2/menu", {
    method: "POST",
    body: payload,
  });
}

export function updateMenuItemV2(id, payload) {
  return apiRequest(`/api/v2/menu/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteMenuItemV2(id) {
  return apiRequest(`/api/v2/menu/${id}`, { method: "DELETE" });
}

export function previewMenuImportV2(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("autoCreateCategories", "true");

  return apiRequest("/api/v2/menu/import/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitMenuImportV2(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("autoCreateCategories", "true");

  return apiRequest("/api/v2/menu/import/commit", {
    method: "POST",
    body: formData,
  });
}
