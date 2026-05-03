"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import {
  ITEM_TYPES,
  PRICING_TYPES,
  VARIANT_CODES,
  createCategoryV2,
  createMenuItemV2,
  deleteCategoryV2,
  deleteMenuItemV2,
  fetchCategoriesV2,
  fetchMenuV2,
  formatMoney,
  getCategoryName,
  getDisplayPrice,
  getItemId,
  isMenuItemAvailable,
  toMenuPayload,
  updateCategoryV2,
  updateMenuItemV2,
} from "../../services/menuV2Api";


const emptyItemForm = {
  id: "",
  name: "",
  categoryId: "",
  categoryName: "",
  itemType: "regular",
  pricingType: "single",
  basePrice: "",
  variants: [],
  addons: [],
  description: "",
  tags: "",
  isRecommended: false,
  isAvailable: true,
  isActive: true,
  sortOrder: "0",
};

const emptyCategoryForm = {
  id: "",
  name: "",
  sortOrder: "0",
  isActive: true,
};

const VARIANT_PRESETS = {
  "half-full": [
    { label: "Half", code: "half", price: "" },
    { label: "Full", code: "full", price: "" },
  ],
  "size-based": [
    { label: "Small", code: "small", price: "" },
    { label: "Medium", code: "medium", price: "" },
    { label: "Large", code: "large", price: "" },
  ],
  custom: [{ label: "Custom", code: "custom", price: "" }],
};

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const orderA = Number(a.sortOrder || 0);
    const orderB = Number(b.sortOrder || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function variantRowsFromItem(item) {
  return Array.isArray(item.variants)
    ? item.variants.map((variant) => ({
        label: variant.label || "",
        code: VARIANT_CODES.includes(variant.code) ? variant.code : "custom",
        price: variant.price === null || variant.price === undefined ? "" : String(variant.price),
      }))
    : [];
}

function addonRowsFromItem(item) {
  return Array.isArray(item.addons)
    ? item.addons.map((addon) => ({
        name: addon.name || "",
        price: addon.price === null || addon.price === undefined ? "" : String(addon.price),
      }))
    : [];
}

function formFromItem(item) {
  const basePrice = item.basePrice ?? item.price ?? "";

  return {
    id: getItemId(item),
    name: item.name || "",
    categoryId: item.categoryId || item.category?.id || item.category?._id || "",
    categoryName: getCategoryName(item),
    itemType: ITEM_TYPES.includes(item.itemType) ? item.itemType : "regular",
    pricingType: PRICING_TYPES.includes(item.pricingType) ? item.pricingType : "single",
    basePrice: basePrice === null || basePrice === undefined ? "" : String(basePrice),
    variants: variantRowsFromItem(item),
    addons: addonRowsFromItem(item),
    description: item.description || "",
    tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
    isRecommended: Boolean(item.isRecommended),
    isAvailable: Boolean(item.isAvailable ?? item.available ?? true),
    isActive: Boolean(item.isActive ?? true),
    sortOrder: item.sortOrder === null || item.sortOrder === undefined ? "0" : String(item.sortOrder),
  };
}

function statusLabel(item) {
  if (item.isActive === false) return "Inactive";
  if (!isMenuItemAvailable(item)) return "Unavailable";
  return "Available";
}

function StatusPill({ item }) {
  const label = statusLabel(item);
  const classes =
    label === "Available"
      ? "bg-emerald-100 text-emerald-700"
      : label === "Unavailable"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-200 text-slate-700";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function MenuManagementClient() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalMode, setItemModalMode] = useState("create");
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState("create");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const loadCategories = async () => {
    const data = await fetchCategoriesV2();
    setCategories(sortCategories(data.categories || []));
  };

  const loadMenu = async () => {
    const data = await fetchMenuV2({
      category: categoryFilter === "all" ? undefined : categoryFilter,
      search: debouncedSearch || undefined,
    });
    setItems(data.items || []);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryData, menuData] = await Promise.all([
        fetchCategoriesV2(),
        fetchMenuV2({
          category: categoryFilter === "all" ? undefined : categoryFilter,
          search: debouncedSearch || undefined,
        }),
      ]);
      setCategories(sortCategories(categoryData.categories || []));
      setItems(menuData.items || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load V2 menu data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, debouncedSearch]);

  const dashboardStats = useMemo(() => {
    return {
      total: items.length,
      available: items.filter((item) => isMenuItemAvailable(item)).length,
      inactive: items.filter((item) => item.isActive === false).length,
      recommended: items.filter((item) => item.isRecommended).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "available") return isMenuItemAvailable(item);
      if (statusFilter === "unavailable") return !isMenuItemAvailable(item);
      if (statusFilter === "active") return item.isActive !== false;
      if (statusFilter === "inactive") return item.isActive === false;
      if (statusFilter === "recommended") return Boolean(item.isRecommended);
      return true;
    });
  }, [items, statusFilter]);

  const openCreateItemModal = () => {
    const firstActiveCategory = categories.find((category) => category.isActive !== false);
    setItemModalMode("create");
    setItemForm({
      ...emptyItemForm,
      categoryId: firstActiveCategory?.id || "",
      categoryName: firstActiveCategory?.name || "",
    });
    setFormError("");
    setItemModalOpen(true);
  };

  const openEditItemModal = (item) => {
    setItemModalMode("edit");
    setItemForm(formFromItem(item));
    setFormError("");
    setItemModalOpen(true);
  };

  const openCreateCategoryModal = () => {
    setCategoryModalMode("create");
    setCategoryForm(emptyCategoryForm);
    setFormError("");
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category) => {
    setCategoryModalMode("edit");
    setCategoryForm({
      id: category.id,
      name: category.name || "",
      sortOrder: category.sortOrder === null || category.sortOrder === undefined ? "0" : String(category.sortOrder),
      isActive: Boolean(category.isActive ?? true),
    });
    setFormError("");
    setCategoryModalOpen(true);
  };

  const validateItemForm = () => {
    if (!itemForm.name.trim()) return "Item name is required.";
    if (!itemForm.categoryId) return "Select a category.";
    if (!ITEM_TYPES.includes(itemForm.itemType)) return "Select a valid item type.";
    if (!PRICING_TYPES.includes(itemForm.pricingType)) return "Select a valid pricing type.";

    const hasBasePrice = itemForm.basePrice !== "" && Number.isFinite(Number(itemForm.basePrice));
    const hasVariants = safeArray(itemForm.variants).some(
      (variant) => variant.label.trim() && VARIANT_CODES.includes(variant.code) && Number.isFinite(Number(variant.price))
    );

    if (itemForm.pricingType === "single" && !hasBasePrice) {
      return "Single pricing requires a base price.";
    }

    if (["half-full", "size-based"].includes(itemForm.pricingType) && !hasVariants) {
      return "This pricing type requires at least one valid variant.";
    }

    const invalidVariant = safeArray(itemForm.variants).find(
      (variant) =>
        (variant.label.trim() || variant.price !== "") &&
        (!VARIANT_CODES.includes(variant.code) || !Number.isFinite(Number(variant.price)))
    );
    if (invalidVariant) return "Each variant needs an allowed code and a valid price.";

    const invalidAddon = safeArray(itemForm.addons).find(
      (addon) => (addon.name.trim() || addon.price !== "") && (!addon.name.trim() || !Number.isFinite(Number(addon.price)))
    );
    if (invalidAddon) return "Each addon needs a name and a valid price.";

    return "";
  };

  const submitItemForm = async (event) => {
    event.preventDefault();
    const validationMessage = validateItemForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setError("");
    setFormError("");
    try {
      const payload = toMenuPayload(itemForm);
      if (itemModalMode === "create") {
        await createMenuItemV2(payload);
      } else {
        await updateMenuItemV2(itemForm.id, payload);
      }
      setItemModalOpen(false);
      await Promise.all([loadMenu(), loadCategories()]);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save menu item.");
    } finally {
      setSaving(false);
    }
  };

  const submitCategoryForm = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setFormError("");
    try {
      const payload = {
        name: categoryForm.name.trim(),
        sortOrder: Number(categoryForm.sortOrder || 0),
        isActive: Boolean(categoryForm.isActive),
      };

      if (categoryModalMode === "create") {
        await createCategoryV2(payload);
      } else {
        await updateCategoryV2(categoryForm.id, payload);
      }
      setCategoryModalOpen(false);
      await Promise.all([loadCategories(), loadMenu()]);
    } catch (requestError) {
      setFormError(requestError.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}" permanently?`)) return;

    setError("");
    try {
      await deleteMenuItemV2(getItemId(item));
      await loadMenu();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete menu item.");
    }
  };

  const toggleItemFlag = async (item, flag) => {
    setError("");
    try {
      const form = formFromItem(item);
      const nextValue = !form[flag];
      const payload = toMenuPayload({ ...form, [flag]: nextValue });
      if (flag === "isAvailable") payload.available = nextValue;
      await updateMenuItemV2(getItemId(item), payload);
      setItems((prevItems) =>
        prevItems.map((menuItem) =>
          getItemId(menuItem) === getItemId(item)
            ? {
                ...menuItem,
                [flag]: nextValue,
                ...(flag === "isAvailable" ? { available: nextValue } : {}),
              }
            : menuItem
        )
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to update menu item.");
    }
  };

  const handleEditItemAction = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    openEditItemModal(item);
  };

  const handleToggleItemAction = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    toggleItemFlag(item, "isAvailable");
  };

  const handleDeleteItemAction = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    deleteItem(item);
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? This works only when no menu item uses it.`)) return;

    setError("");
    try {
      await deleteCategoryV2(category.id);
      await Promise.all([loadCategories(), loadMenu()]);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete category.");
    }
  };

  const updateVariant = (index, key, value) => {
    setItemForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [key]: value } : variant
      ),
    }));
  };

  const updateAddon = (index, key, value) => {
    setItemForm((prev) => ({
      ...prev,
      addons: prev.addons.map((addon, addonIndex) => (addonIndex === index ? { ...addon, [key]: value } : addon)),
    }));
  };

  const applyVariantPreset = () => {
    setItemForm((prev) => ({
      ...prev,
      variants: VARIANT_PRESETS[prev.pricingType] || [{ label: "", code: "custom", price: "" }],
    }));
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Menu Management</h1>
          <p className="text-sm text-slate-600">Backend-driven V2 menu, categories, variants, and addons.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/menu/import"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Bulk Import
          </a>
          <button
            type="button"
            onClick={openCreateCategoryModal}
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700"
          >
            Add Category
          </button>
          <button
            type="button"
            onClick={openCreateItemModal}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Add Item
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Visible items</p>
          <p className="text-2xl font-semibold text-slate-900">{dashboardStats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Available</p>
          <p className="text-2xl font-semibold text-emerald-900">{dashboardStats.available}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Categories</p>
          <p className="text-2xl font-semibold text-slate-900">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Recommended</p>
          <p className="text-2xl font-semibold text-amber-900">{dashboardStats.recommended}</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search menu items"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="recommended">Recommended</option>
          </select>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading V2 menu...</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">Item</th>
                <th className="py-2">Category</th>
                <th className="py-2">Type</th>
                <th className="py-2">Price</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={getItemId(item)} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.description || "No description"}</p>
                    {safeArray(item.tags).length ? (
                      <p className="mt-1 text-xs text-slate-500">Tags: {item.tags.join(", ")}</p>
                    ) : null}
                  </td>
                  <td className="py-3 text-slate-700">{getCategoryName(item)}</td>
                  <td className="py-3 text-slate-700">
                    <p>{item.itemType || "regular"}</p>
                    <p className="text-xs text-slate-500">{item.pricingType || "single"}</p>
                  </td>
                  <td className="py-3 text-slate-700">
                    <p>{formatMoney(getDisplayPrice(item))}</p>
                    {safeArray(item.variants).length ? (
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        {item.variants.map((variant) => `${variant.label} ${formatMoney(variant.price)}`).join(" | ")}
                      </p>
                    ) : null}
                    {safeArray(item.addons).length ? (
                      <p className="mt-1 text-xs text-slate-500">{item.addons.length} addon(s)</p>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col items-start gap-2">
                      <StatusPill item={item} />
                      {item.isRecommended ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => handleEditItemAction(event, item)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleToggleItemAction(event, item)}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleDeleteItemAction(event, item)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No menu items found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
          <button
            type="button"
            onClick={openCreateCategoryModal}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Add Category
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <article key={category.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-500">Slug: {category.slug || "-"}</p>
                  <p className="text-xs text-slate-500">Sort: {Number(category.sortOrder || 0)}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    category.isActive === false ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {category.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditCategoryModal(category)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCategoryV2(category.id, {
                      name: category.name,
                      sortOrder: Number(category.sortOrder || 0),
                      isActive: category.isActive === false,
                    })
                      .then(() => loadCategories())
                      .catch((requestError) => setError(requestError.message || "Unable to update category."))
                  }
                  className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700"
                >
                  Toggle Active
                </button>
                <button
                  type="button"
                  onClick={() => deleteCategory(category)}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!loading && categories.length === 0 ? (
            <p className="text-sm text-slate-500">No categories available.</p>
          ) : null}
        </div>
      </section>

      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={itemModalMode === "create" ? "Create Menu Item" : "Edit Menu Item"}
        size="xl"
      >
        <form className="space-y-4" onSubmit={submitItemForm}>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Name
              <input
                value={itemForm.name}
                onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Category
              <select
                value={itemForm.categoryId}
                onChange={(event) => {
                  const selectedCategory = categories.find((category) => category.id === event.target.value);
                  setItemForm((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                    categoryName: selectedCategory?.name || "",
                  }));
                }}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Item Type
              <select
                value={itemForm.itemType}
                onChange={(event) => setItemForm((prev) => ({ ...prev, itemType: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Pricing Type
              <select
                value={itemForm.pricingType}
                onChange={(event) => setItemForm((prev) => ({ ...prev, pricingType: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                {PRICING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Base Price
              <input
                value={itemForm.basePrice}
                onChange={(event) => setItemForm((prev) => ({ ...prev, basePrice: event.target.value }))}
                type="number"
                step="0.01"
                min="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Sort Order
              <input
                value={itemForm.sortOrder}
                onChange={(event) => setItemForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                type="number"
                step="1"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={itemForm.description}
              onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Tags
            <input
              value={itemForm.tags}
              onChange={(event) => setItemForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="comma, separated, tags"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["isRecommended", "Recommended"],
              ["isAvailable", "Available"],
              ["isActive", "Active"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  checked={Boolean(itemForm[key])}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, [key]: event.target.checked }))}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">Variants</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyVariantPreset}
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  Use Pricing Preset
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItemForm((prev) => ({
                      ...prev,
                      variants: [...prev.variants, { label: "", code: "custom", price: "" }],
                    }))
                  }
                  className="rounded border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700"
                >
                  Add Variant
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {itemForm.variants.map((variant, index) => (
                <div key={`${variant.code}-${index}`} className="grid gap-2 md:grid-cols-[1fr_170px_160px_auto]">
                  <input
                    value={variant.label}
                    onChange={(event) => updateVariant(index, "label", event.target.value)}
                    placeholder="Label"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                  <select
                    value={variant.code}
                    onChange={(event) => updateVariant(index, "code", event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  >
                    {VARIANT_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <input
                    value={variant.price}
                    onChange={(event) => updateVariant(index, "price", event.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItemForm((prev) => ({
                        ...prev,
                        variants: prev.variants.filter((_, variantIndex) => variantIndex !== index),
                      }))
                    }
                    className="rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {itemForm.variants.length === 0 ? (
                <p className="text-sm text-slate-500">No variants configured.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">Addons</h4>
              <button
                type="button"
                onClick={() =>
                  setItemForm((prev) => ({
                    ...prev,
                    addons: [...prev.addons, { name: "", price: "" }],
                  }))
                }
                className="rounded border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700"
              >
                Add Addon
              </button>
            </div>

            <div className="space-y-2">
              {itemForm.addons.map((addon, index) => (
                <div key={`${addon.name}-${index}`} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                  <input
                    value={addon.name}
                    onChange={(event) => updateAddon(index, "name", event.target.value)}
                    placeholder="Addon name"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                  <input
                    value={addon.price}
                    onChange={(event) => updateAddon(index, "price", event.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItemForm((prev) => ({
                        ...prev,
                        addons: prev.addons.filter((_, addonIndex) => addonIndex !== index),
                      }))
                    }
                    className="rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {itemForm.addons.length === 0 ? <p className="text-sm text-slate-500">No addons configured.</p> : null}
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : itemModalMode === "create" ? "Create Item" : "Save Changes"}
          </button>
        </form>
      </Modal>

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={categoryModalMode === "create" ? "Create Category" : "Edit Category"}
        size="lg"
      >
        <form className="space-y-4" onSubmit={submitCategoryForm}>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Sort Order
            <input
              value={categoryForm.sortOrder}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
              type="number"
              step="1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <input
              checked={categoryForm.isActive}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              type="checkbox"
            />
            Active
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : categoryModalMode === "create" ? "Create Category" : "Save Category"}
          </button>
        </form>
      </Modal>
    </>
  );
}
