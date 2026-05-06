"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../admin/Modal";
import {
  createMenuItemV2,
  fetchCategoriesV2,
  fetchMenuV2,
  formatMoney,
  getCategoryName,
  getDisplayPrice,
  getItemId,
  isMenuItemAvailable,
  toMenuPayload,
} from "../../services/menuV2Api";
import {
  buildCartItem,
  isAddonMenuItem,
  requiresVariantSelection,
} from "./menuCartItem";

function getSelectionState(state, itemId) {
  return state[itemId] || { variantCode: "" };
}

function sortAddonItems(items) {
  return [...items].sort((a, b) => {
    const orderA = Number(a.sortOrder || 0);
    const orderB = Number(b.sortOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const orderA = Number(a.sortOrder || 0);
    const orderB = Number(b.sortOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

const emptyAddonForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  basePrice: "",
  description: "",
  isAvailable: true,
};

export default function QuickAddonPanel({ onAddItem }) {
  const [addonItems, setAddonItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectionByItem, setSelectionByItem] = useState({});
  const [selectionErrors, setSelectionErrors] = useState({});
  const [addedItemId, setAddedItemId] = useState("");
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [addonForm, setAddonForm] = useState(emptyAddonForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const requestIdRef = useRef(0);

  const loadAddons = async () => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setLoading(true);
    setError("");

    try {
      const [menuData, categoryData] = await Promise.all([
        fetchMenuV2({ available: true }),
        fetchCategoriesV2().catch(() => ({ categories: [] })),
      ]);
      if (requestIdRef.current !== currentRequestId) return;

      const nextAddons = (menuData.items || []).filter(
        (item) => item.isActive !== false && isMenuItemAvailable(item) && isAddonMenuItem(item),
      );
      setAddonItems(sortAddonItems(nextAddons));
      setCategories(
        sortCategories((categoryData.categories || []).filter((category) => category.isActive !== false)),
      );
    } catch (requestError) {
      if (requestIdRef.current !== currentRequestId) return;
      setAddonItems([]);
      setError(requestError.message || "Unable to load addons.");
    } finally {
      if (requestIdRef.current === currentRequestId) setLoading(false);
    }
  };

  useEffect(() => {
    loadAddons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAddons = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return addonItems;

    return addonItems.filter((item) => {
      const haystack = `${item.name || ""} ${getCategoryName(item)} ${item.description || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [addonItems, searchText]);

  const openAddonModal = () => {
    const firstCategory = categories.find((category) => category.isActive !== false);
    setAddonForm({
      ...emptyAddonForm,
      categoryId: firstCategory?.id || "",
      categoryName: firstCategory?.name || "",
    });
    setFormError("");
    setAddonModalOpen(true);
  };

  const validateAddonForm = () => {
    if (!addonForm.name.trim()) return "Addon name is required.";
    if (!addonForm.categoryId) return "Select a category.";
    if (addonForm.basePrice === "" || !Number.isFinite(Number(addonForm.basePrice))) {
      return "Enter a valid price.";
    }
    if (Number(addonForm.basePrice) < 0) return "Price cannot be negative.";
    return "";
  };

  const submitAddonForm = async (event) => {
    event.preventDefault();
    const validationMessage = validateAddonForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setFormError("");
    setError("");

    try {
      await createMenuItemV2(
        toMenuPayload({
          ...addonForm,
          itemType: "addon",
          pricingType: "single",
          variants: [],
          addons: [],
          tags: "addon, cashier",
          isRecommended: false,
          isActive: true,
          sortOrder: "0",
        }),
      );
      setAddonModalOpen(false);
      setSearchText("");
      await loadAddons();
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save addon.");
    } finally {
      setSaving(false);
    }
  };

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

  const addAddon = (item) => {
    const itemId = getItemId(item);
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const selection = getSelectionState(selectionByItem, itemId);
    const selectedVariant = variants.find(
      (variant) => variant.code === selection.variantCode || variant.label === selection.variantCode,
    );

    if (!isMenuItemAvailable(item)) return;

    if (requiresVariantSelection(item) && !selectedVariant) {
      setSelectionErrors((prev) => ({
        ...prev,
        [itemId]: "Select a variant first.",
      }));
      return;
    }

    onAddItem(buildCartItem(item, selectedVariant, []));
    setSelectionErrors((prev) => ({ ...prev, [itemId]: "" }));
    setAddedItemId(itemId);
    window.setTimeout(() => setAddedItemId((current) => (current === itemId ? "" : current)), 900);
  };

  return (
    <section className="no-print rounded-xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-900">Quick Addons</h2>
          <p className="text-xs text-slate-500">
            {loading ? "Loading addons..." : `${filteredAddons.length} addon items`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={openAddonModal}
            className="h-9 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-900"
          >
            Add Addon
          </button>
          <button
            type="button"
            onClick={loadAddons}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <input
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Search addons"
        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600"
      />

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {filteredAddons.map((item) => {
          const itemId = getItemId(item);
          const variants = Array.isArray(item.variants) ? item.variants : [];
          const selection = getSelectionState(selectionByItem, itemId);
          const selectedVariant = variants.find(
            (variant) => variant.code === selection.variantCode || variant.label === selection.variantCode,
          );
          const available = isMenuItemAvailable(item);
          const mustSelectVariant = requiresVariantSelection(item);
          const canAdd = available && (!mustSelectVariant || Boolean(selectedVariant));

          return (
            <article
              key={itemId}
              className="rounded-lg border border-brand-100 bg-brand-50 p-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold leading-tight text-brand-900">
                    {item.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">{getCategoryName(item)}</p>
                  {!variants.length ? (
                    <p className="mt-1 text-sm font-semibold text-brand-900">
                      {formatMoney(getDisplayPrice(item))}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => addAddon(item)}
                  disabled={!available}
                  className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    canAdd
                      ? "bg-brand-700 text-white hover:bg-brand-900"
                      : "border border-brand-200 bg-white text-brand-800"
                  }`}
                >
                  {addedItemId === itemId ? "Added" : "Add"}
                </button>
              </div>

              {variants.length ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {variants.map((variant) => {
                    const selected =
                      selection.variantCode === variant.code || selection.variantCode === variant.label;

                    return (
                      <button
                        key={`${itemId}-${variant.code}-${variant.label}`}
                        type="button"
                        onClick={() => setVariant(itemId, variant.code || variant.label)}
                        className={`min-h-10 rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                          selected
                            ? "border-brand-700 bg-white text-brand-900 shadow-sm"
                            : "border-brand-100 bg-white/80 text-slate-700"
                        }`}
                      >
                        <span className="block truncate font-semibold">{variant.label}</span>
                        <span className="block">{formatMoney(variant.price)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectionErrors[itemId] ? (
                <p className="mt-2 text-xs font-medium text-red-600">{selectionErrors[itemId]}</p>
              ) : null}
            </article>
          );
        })}
      </div>

      {!loading && !error && filteredAddons.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          No addon items found.
        </div>
      ) : null}

      <Modal
        open={addonModalOpen}
        onClose={() => setAddonModalOpen(false)}
        title="Add Addon"
        size="lg"
      >
        <form className="space-y-4" onSubmit={submitAddonForm}>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Addon Name
              <input
                value={addonForm.name}
                onChange={(event) =>
                  setAddonForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
                placeholder="Extra cheese"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Price
              <input
                value={addonForm.basePrice}
                onChange={(event) =>
                  setAddonForm((prev) => ({ ...prev, basePrice: event.target.value }))
                }
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
                placeholder="30"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Category
            <select
              value={addonForm.categoryId}
              onChange={(event) => {
                const selectedCategory = categories.find(
                  (category) => category.id === event.target.value,
                );
                setAddonForm((prev) => ({
                  ...prev,
                  categoryId: event.target.value,
                  categoryName: selectedCategory?.name || "",
                }));
              }}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={addonForm.description}
              onChange={(event) =>
                setAddonForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
              placeholder="Optional"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <input
              checked={addonForm.isAvailable}
              onChange={(event) =>
                setAddonForm((prev) => ({ ...prev, isAvailable: event.target.checked }))
              }
              type="checkbox"
            />
            Available
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Addon"}
          </button>
        </form>
      </Modal>
    </section>
  );
}
