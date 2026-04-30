"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCategoriesV2,
  fetchMenuV2,
  formatMoney,
  getCategoryName,
  getDisplayPrice,
  getItemId,
  isMenuItemAvailable,
} from "../../services/menuV2Api";

const PRICING_LABELS = {
  single: "Single price",
  "half-full": "Half / Full",
  "size-based": "Sizes",
  custom: "Custom variants",
};

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const orderA = Number(a.sortOrder || 0);
    const orderB = Number(b.sortOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function requiresVariantSelection(item) {
  const variants = Array.isArray(item.variants) ? item.variants : [];
  return ["half-full", "size-based", "custom"].includes(item.pricingType) && variants.length > 0;
}

function getVariantPriceLine(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  return variants.map((variant) => `${variant.label}: ${formatMoney(variant.price)}`).join(" | ");
}

function getSelectionState(state, itemId) {
  return state[itemId] || { variantCode: "", addonNames: [] };
}

function buildCartItem(item, selectedVariant, selectedAddons) {
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

export default function DynamicMenuPanel({ onAddItem }) {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectionByItem, setSelectionByItem] = useState({});
  const [selectionErrors, setSelectionErrors] = useState({});
  const [addedItemId, setAddedItemId] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const data = await fetchCategoriesV2();
        if (!mounted) return;
        setCategories(sortCategories((data.categories || []).filter((category) => category.isActive !== false)));
      } catch {
        if (!mounted) return;
        setCategories([]);
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    };

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    const loadMenu = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMenuV2({
          available: true,
          category: activeCategory === "all" ? undefined : activeCategory,
          search: debouncedSearch || undefined,
          recommended: recommendedOnly ? true : undefined,
        });

        if (requestIdRef.current !== currentRequestId) return;
        setMenuItems(data.items || []);
      } catch (requestError) {
        if (requestIdRef.current !== currentRequestId) return;
        setMenuItems([]);
        setError(requestError.message || "Unable to load menu from backend.");
      } finally {
        if (requestIdRef.current === currentRequestId) setLoading(false);
      }
    };

    loadMenu();
  }, [activeCategory, debouncedSearch, recommendedOnly]);

  const visibleCategoryName = useMemo(() => {
    if (activeCategory === "all") return "All categories";
    return categories.find((category) => category.id === activeCategory)?.name || "Selected category";
  }, [activeCategory, categories]);

  const setVariant = (itemId, variantCode) => {
    setSelectionByItem((prev) => ({
      ...prev,
      [itemId]: {
        ...getSelectionState(prev, itemId),
        variantCode,
      },
    }));
    setSelectionErrors((prev) => ({ ...prev, [itemId]: "" }));
  };

  const toggleAddon = (itemId, addonName) => {
    setSelectionByItem((prev) => {
      const current = getSelectionState(prev, itemId);
      const addonNames = current.addonNames.includes(addonName)
        ? current.addonNames.filter((name) => name !== addonName)
        : [...current.addonNames, addonName];

      return {
        ...prev,
        [itemId]: {
          ...current,
          addonNames,
        },
      };
    });
  };

  const addItem = (item) => {
    const itemId = getItemId(item);
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const addons = Array.isArray(item.addons) ? item.addons : [];
    const selection = getSelectionState(selectionByItem, itemId);
    const selectedVariant = variants.find(
      (variant) => variant.code === selection.variantCode || variant.label === selection.variantCode
    );
    const selectedAddons = addons.filter((addon) => selection.addonNames.includes(addon.name));

    if (!isMenuItemAvailable(item)) return;

    if (requiresVariantSelection(item) && !selectedVariant) {
      setSelectionErrors((prev) => ({
        ...prev,
        [itemId]: "Select a variant before adding.",
      }));
      return;
    }

    onAddItem(buildCartItem(item, selectedVariant, selectedAddons));
    setSelectionErrors((prev) => ({ ...prev, [itemId]: "" }));
    setAddedItemId(itemId);
    window.setTimeout(() => setAddedItemId((current) => (current === itemId ? "" : current)), 900);
  };

  return (
    <section className="no-print rounded-xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-900">Menu</h2>
          <p className="text-xs text-slate-500">
            {loading ? "Loading live items..." : `${menuItems.length} items in ${visibleCategoryName}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRecommendedOnly((prev) => !prev)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            recommendedOnly
              ? "border-amber-500 bg-amber-50 text-amber-800"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Recommended
        </button>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search menu item"
          className="h-11 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-brand-600"
        />
        <select
          value={activeCategory}
          onChange={(event) => setActiveCategory(event.target.value)}
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`h-10 whitespace-nowrap rounded-lg border px-3 text-sm font-medium ${
            activeCategory === "all"
              ? "border-brand-700 bg-brand-700 text-white"
              : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={`h-10 whitespace-nowrap rounded-lg border px-3 text-sm font-medium ${
              activeCategory === category.id
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {categoriesLoading && !categories.length ? (
        <p className="mb-3 text-sm text-slate-500">Loading categories...</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {menuItems.map((item) => {
          const itemId = getItemId(item);
          const variants = Array.isArray(item.variants) ? item.variants : [];
          const addons = Array.isArray(item.addons) ? item.addons : [];
          const selection = getSelectionState(selectionByItem, itemId);
          const selectedVariant = variants.find(
            (variant) => variant.code === selection.variantCode || variant.label === selection.variantCode
          );
          const available = isMenuItemAvailable(item);
          const mustSelectVariant = requiresVariantSelection(item);
          const canAdd = available && (!mustSelectVariant || Boolean(selectedVariant));

          return (
            <article
              key={itemId}
              className={`rounded-lg border p-3 transition ${
                available ? "border-brand-100 bg-brand-50" : "border-slate-200 bg-slate-50 opacity-75"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold leading-tight text-brand-900">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">{getCategoryName(item)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {item.isRecommended ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                      Recommended
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded bg-white px-2 py-1 font-medium text-slate-700">
                  {PRICING_LABELS[item.pricingType] || item.pricingType || "Single price"}
                </span>
                <span className="rounded bg-white px-2 py-1 font-medium text-slate-700">
                  {item.itemType || "regular"}
                </span>
                {addons.length ? (
                  <span className="rounded bg-white px-2 py-1 font-medium text-slate-700">
                    {addons.length} addon{addons.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              {variants.length ? (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">{getVariantPriceLine(variants)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {variants.map((variant) => {
                      const variantSelected =
                        selection.variantCode === variant.code || selection.variantCode === variant.label;

                      return (
                        <button
                          key={`${itemId}-${variant.code}-${variant.label}`}
                          type="button"
                          onClick={() => setVariant(itemId, variant.code || variant.label)}
                          className={`min-h-11 rounded-lg border px-2 py-2 text-left text-sm transition ${
                            variantSelected
                              ? "border-brand-700 bg-white text-brand-900 shadow-sm"
                              : "border-brand-100 bg-white/80 text-slate-700"
                          }`}
                        >
                          <span className="block font-semibold">{variant.label}</span>
                          <span className="block text-xs">{formatMoney(variant.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mb-3 text-lg font-semibold text-brand-900">{formatMoney(getDisplayPrice(item))}</p>
              )}

              {addons.length ? (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Addons</p>
                  <div className="flex flex-wrap gap-2">
                    {addons.map((addon) => {
                      const selected = selection.addonNames.includes(addon.name);
                      return (
                        <button
                          key={`${itemId}-${addon.name}`}
                          type="button"
                          onClick={() => toggleAddon(itemId, addon.name)}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                            selected
                              ? "border-brand-700 bg-white text-brand-900"
                              : "border-slate-300 bg-white/80 text-slate-700"
                          }`}
                        >
                          {addon.name} +{formatMoney(addon.price)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectionErrors[itemId] ? (
                <p className="mb-2 text-xs font-medium text-red-600">{selectionErrors[itemId]}</p>
              ) : null}

              <button
                type="button"
                onClick={() => addItem(item)}
                disabled={!available}
                className={`h-11 w-full rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  canAdd
                    ? "bg-brand-700 text-white hover:bg-brand-900"
                    : "border border-brand-200 bg-white text-brand-800"
                }`}
              >
                {addedItemId === itemId ? "Added" : canAdd ? "Add to Cart" : "Select Variant"}
              </button>
            </article>
          );
        })}
      </div>

      {!loading && !error && menuItems.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No menu items match this filter.
        </div>
      ) : null}
    </section>
  );
}
