"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiRequest } from "../services/apiClient";
import ThermalReceipt from "../components/ThermalReceipt";
import DynamicMenuPanel from "../components/pos/DynamicMenuPanel";
import QuickAddonPanel from "../components/pos/QuickAddonPanel";
import {
  calculateBillTotals,
  clampDiscountPercent,
  validateDiscountInput,
} from "../utils/billingCalculations";

const RESTAURANT = {
  name: "BALA JI FOOD ARTS",
  addressLines: [
    "Booth number 265 & 266, infront C",
    "flower market Phase 7 Mohali",
    "Punjab-160062",
  ],
  phone: "Phone 6280772610",
  waitingTime: "Waiting Time 10 to 15 Minutes",
  vegNote: "100 % Pure Veg",
  openTiming: "24 HOURS OPEN",
  fssai: "22121676000682",
  footerText: "Thanks For Visit !!",
};

const BUSINESS_PROFILES = [
  {
    id: "balaji-soya-chaap",
    name: "Balaji Soya Chaap",
    gstin: "03BJFPK1405G1ZY",
  },
  {
    id: "balaji-foods-arts",
    name: "Balaji Foods Arts",
    gstin: "03ICOPK2734K1ZB",
  },
];

const DEFAULT_BUSINESS_ID = "balaji-foods-arts";

function getBusinessProfile(profileId) {
  return (
    BUSINESS_PROFILES.find((profile) => profile.id === profileId) ||
    BUSINESS_PROFILES.find((profile) => profile.id === DEFAULT_BUSINESS_ID) ||
    BUSINESS_PROFILES[0]
  );
}

function normalizeCustomerPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const withoutCountryCode =
    digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  return withoutCountryCode.slice(0, 10);
}

function getCustomerPhoneError(phone) {
  if (!phone) return "";
  if (!/^\d{10}$/.test(phone)) return "Enter a valid 10 digit Indian mobile number.";
  if (!/^[6-9]/.test(phone)) return "Indian mobile number should start with 6, 7, 8 or 9.";
  return "";
}

function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`,
  };
}

function randomNumber(length) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export default function Home() {
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountInput, setDiscountInput] = useState("0");
  const [discountError, setDiscountError] = useState("");
  const [discountPanelOpen, setDiscountPanelOpen] = useState(false);
  const [saleType, setSaleType] = useState("OFFLINE");
  const [orderType, setOrderType] = useState("TAKE_AWAY");
  const [bill, setBill] = useState(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState(DEFAULT_BUSINESS_ID);
  const [printGstNo, setPrintGstNo] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhoneError, setCustomerPhoneError] = useState("");
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const receiptRef = useRef(null);
  const selectedBusiness = useMemo(
    () => getBusinessProfile(selectedBusinessId),
    [selectedBusinessId]
  );
  const receiptRestaurant = useMemo(
    () => ({
      ...RESTAURANT,
      name: selectedBusiness.name,
      gstin: printGstNo ? selectedBusiness.gstin : "",
    }),
    [selectedBusiness, printGstNo]
  );

  const totals = useMemo(() => calculateBillTotals(cart, discountPercent), [cart, discountPercent]);
  const discountPreviewPercent = useMemo(() => clampDiscountPercent(discountInput), [discountInput]);
  const previewTotals = useMemo(
    () => calculateBillTotals(cart, discountPreviewPercent),
    [cart, discountPreviewPercent]
  );

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("balaji_cart");
      const savedBill = localStorage.getItem("balaji_last_bill");
      const savedDiscount = localStorage.getItem("balaji_discount_percent");
      const savedOrderType = localStorage.getItem("balaji_order_type");
      const savedBusinessId = localStorage.getItem("balaji_bill_business_id");
      const savedPrintGstNo = localStorage.getItem("balaji_print_gst_no");

      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedBill) setBill(JSON.parse(savedBill));
      if (savedDiscount) {
        const sanitized = clampDiscountPercent(savedDiscount);
        setDiscountPercent(sanitized);
        setDiscountInput(String(sanitized));
      }
      if (["TAKE_AWAY", "DINING"].includes(savedOrderType)) {
        setOrderType(savedOrderType);
      }

      localStorage.setItem("balaji_customer_name", "");
      localStorage.setItem("balaji_customer_phone", "");
      if (BUSINESS_PROFILES.some((profile) => profile.id === savedBusinessId)) {
        setSelectedBusinessId(savedBusinessId);
      }
      if (savedPrintGstNo !== null) {
        setPrintGstNo(savedPrintGstNo === "true");
      }
    } catch {
      setCart([]);
      setBill(null);
      setDiscountPercent(0);
      setDiscountInput("0");
      setOrderType("TAKE_AWAY");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerPhoneError("");
      setSelectedBusinessId(DEFAULT_BUSINESS_ID);
      setPrintGstNo(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_cart", JSON.stringify(cart));
    } catch {
      // Ignore storage write failures.
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_discount_percent", String(discountPercent));
    } catch {
      // Ignore storage write failures.
    }
  }, [discountPercent]);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_order_type", orderType);
    } catch {
      // Ignore storage write failures.
    }
  }, [orderType]);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_bill_business_id", selectedBusinessId);
    } catch {
      // Ignore storage write failures.
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_print_gst_no", String(printGstNo));
    } catch {
      // Ignore storage write failures.
    }
  }, [printGstNo]);

  const saveBill = (nextBill) => {
    setBill(nextBill);
    try {
      localStorage.setItem("balaji_last_bill", JSON.stringify(nextBill));
    } catch {
      // Ignore storage write failures.
    }
  };

  const addItem = (cartItem) => {
    setCart((prev) => {
      const found = prev.find((item) => item._id === cartItem._id);
      if (!found) return [...prev, { ...cartItem, qty: 1 }];
      return prev.map((item) =>
        item._id === cartItem._id ? { ...item, qty: item.qty + 1 } : item
      );
    });
  };

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item._id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const clearOrder = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountInput("0");
    setDiscountError("");
    setDiscountPanelOpen(false);
    setSaleType("OFFLINE");
    setOrderType("TAKE_AWAY");

    setCustomerName("");
    setCustomerPhone("");
    setCustomerPhoneError("");
    try {
      localStorage.setItem("balaji_customer_name", "");
      localStorage.setItem("balaji_customer_phone", "");
    } catch {
      // Ignore storage write failures.
    }
  };

  const clearCustomerInputs = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerPhoneError("");
    try {
      localStorage.setItem("balaji_customer_name", "");
      localStorage.setItem("balaji_customer_phone", "");
    } catch {
      // Ignore storage write failures.
    }
  };

  const updateCustomerPhone = (value) => {
    const nextPhone = normalizeCustomerPhone(value);
    setCustomerPhone(nextPhone);
    setCustomerPhoneError(getCustomerPhoneError(nextPhone));
  };

  const openDiscountPanel = () => {
    setDiscountInput(String(discountPercent));
    setDiscountError("");
    setDiscountPanelOpen(true);
  };

  const applyDiscount = () => {
    const parsed = validateDiscountInput(discountInput);
    if (parsed.error) {
      setDiscountError(parsed.error);
      return;
    }
    setDiscountPercent(parsed.value);
    setDiscountError("");
    setDiscountPanelOpen(false);
  };

  const persistSale = async (snapshot) => {
    try {
      await apiRequest("/api/sales", {
        method: "POST",
        body: snapshot,
      });
    } catch {
      // Billing should continue even if analytics persistence fails.
    }
  };

  const generateBill = () => {
    if (!cart.length) return;
    const sanitizedCustomerPhone = normalizeCustomerPhone(customerPhone);
    const phoneError = getCustomerPhoneError(sanitizedCustomerPhone);
    if (phoneError) {
      setCustomerPhone(sanitizedCustomerPhone);
      setCustomerPhoneError(phoneError);
      return;
    }
    setCustomerPhoneError("");

    const now = new Date();
    const { date, time } = formatDateTime(now);
    let nextToken = 1;

    try {
      nextToken = Number(localStorage.getItem("balaji_token_counter") || 0) + 1;
      localStorage.setItem("balaji_token_counter", String(nextToken));
    } catch {
      // Fall back to a non-persistent token.
    }

    const snapshot = {
      businessId: selectedBusiness.id,
      businessName: selectedBusiness.name,
      gstin: printGstNo ? selectedBusiness.gstin : "",
      saleType,
      orderType,
      billNo: randomNumber(5),
      tokenNo: nextToken,
      date,
      time,
      billedAt: now.toISOString(),

      customerName: String(customerName || "").trim() || "",
      customerPhone: sanitizedCustomerPhone,

      items: cart.map((item) => ({
        itemId: item.itemId || item._id,
        name: item.name,
        category: item.category,
        price: item.price,
        qty: item.qty,
        lineTotal: item.qty * item.price,
      })),
      totalQty: totals.totalQty,
      subtotal: totals.subtotal,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal,
    };
    saveBill(snapshot);
    persistSale(snapshot);
    setSaleType("OFFLINE");
    setOrderType("TAKE_AWAY");
  };

  const printBill = () => {
    if (!bill) return;
    const clearAfterPrint = () => clearCustomerInputs();
    window.addEventListener("afterprint", clearAfterPrint, { once: true });
    requestAnimationFrame(() => window.print());
  };

  const downloadPdf = async () => {
    if (!bill || !receiptRef.current) return;
    setIsPdfGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const imageData = canvas.toDataURL("image/png");
      const pageWidth = 80;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, Math.max(120, imgHeight + 4)],
      });

      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, imgHeight);
      pdf.save(`balaji-bill-${bill.billNo}.pdf`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <>
      <main className="app-shell min-h-screen p-3 text-slate-800 sm:p-5">
        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-4 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
            <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">
              Balaji Ji Food Arts
            </h1>
          </header>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(360px,0.72fr)]">
            <DynamicMenuPanel onAddItem={addItem} hideAddonItems />

            <div className="space-y-4">
              <QuickAddonPanel onAddItem={addItem} />

              <div className="rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:p-4">
                <h2 className="mb-3 text-xl font-semibold text-brand-900">Cart</h2>
                {!cart.length && <p className="text-sm text-gray-500">No items in cart.</p>}

                <div className="space-y-3 no-print">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-600">{"\u20B9"}{item.price} each</div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => changeQty(item._id, -1)}
                          className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-medium">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(item._id, 1)}
                          className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item._id)}
                          className="h-9 rounded-lg bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="no-print mt-4 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-3 text-sm shadow-inner sm:p-4">
                  <div className="mb-3 flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[170px]">
                      <label
                        className="mb-1 block text-xs font-medium text-slate-700"
                        htmlFor="customerNameInput"
                      >
                        Customer Name
                      </label>
                      <input
                        id="customerNameInput"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        placeholder="Enter name"
                      />
                    </div>
                    <div className="flex-1 min-w-[170px]">
                      <label
                        className="mb-1 block text-xs font-medium text-slate-700"
                        htmlFor="customerPhoneInput"
                      >
                        Phone Number
                      </label>
                      <input
                        id="customerPhoneInput"
                        type="tel"
                        inputMode="tel"
                        maxLength={14}
                        pattern="[6-9][0-9]{9}"
                        aria-invalid={customerPhoneError ? "true" : "false"}
                        value={customerPhone}
                        onChange={(e) => updateCustomerPhone(e.target.value)}
                        className={`h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
                          customerPhoneError ? "border-red-400" : "border-slate-300"
                        }`}
                        placeholder="Enter phone"
                      />
                      {customerPhoneError ? (
                        <p className="mt-1 text-xs text-red-600">{customerPhoneError}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span>Total Qty:</span>
                    <span>{totals.totalQty}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Subtotal:</span>
                    <span>{"\u20B9"}{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Discount ({totals.discountPercent.toFixed(2)}%):</span>
                    <span>-{"\u20B9"}{totals.discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold">
                    <span>Final Payable:</span>
                    <span>{"\u20B9"}{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="no-print mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm sm:col-span-1">
                    <span className="text-slate-700">Order:</span>
                    <div className="flex overflow-hidden rounded-md border border-slate-300">
                      {[
                        ["TAKE_AWAY", "Take Away"],
                        ["DINING", "Dining"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setOrderType(value)}
                          className={`h-8 px-3 text-xs font-semibold transition ${
                            orderType === value
                              ? "bg-brand-700 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm sm:col-span-1">
                    <span className="text-slate-700">Sale Type:</span>
                    <select
                      value={saleType}
                      onChange={(event) => setSaleType(event.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="ONLINE">ONLINE</option>
                      <option value="OFFLINE">OFFLINE</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={openDiscountPanel}
                    className="h-11 rounded-xl border border-brand-500 bg-white px-4 text-brand-800 shadow-sm transition hover:bg-brand-50 sm:w-auto"
                  >
                    Discount
                  </button>

                  <button
                    type="button"
                    onClick={generateBill}
                    disabled={!cart.length}
                    className="h-11 rounded-xl bg-brand-700 px-4 font-semibold text-white shadow-sm transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Generate Bill
                  </button>

                  <button
                    type="button"
                    onClick={printBill}
                    disabled={!bill}
                    className="h-11 rounded-xl border border-brand-700 bg-white px-4 text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Print Bill
                  </button>

                  <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={!bill || isPdfGenerating}
                    className="h-11 rounded-xl border border-slate-400 bg-white px-4 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
                  </button>

                  <div className="col-span-2 flex w-full flex-col gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:min-w-[300px] sm:flex-row sm:flex-wrap sm:items-center">
                    <label className="text-slate-700" htmlFor="billBusinessSelect">
                      Bill Name:
                    </label>
                    <select
                      id="billBusinessSelect"
                      value={selectedBusinessId}
                      onChange={(event) => setSelectedBusinessId(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-auto sm:min-w-[170px]"
                    >
                      {BUSINESS_PROFILES.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>

                    <label
                      className="flex items-center gap-2 whitespace-nowrap text-slate-700"
                      htmlFor="printGstNoInput"
                    >
                      <input
                        id="printGstNoInput"
                        type="checkbox"
                        checked={printGstNo}
                        onChange={(event) => setPrintGstNo(event.target.checked)}
                        className="h-4 w-4 accent-brand-700"
                      />
                      <span>Print GST No.</span>
                    </label>

                    {printGstNo ? (
                      <span className="basis-full text-xs text-slate-500">
                        GSTIN: {selectedBusiness.gstin}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={clearOrder}
                    className="col-span-2 h-11 rounded-xl border border-red-300 bg-white px-4 text-red-700 shadow-sm transition hover:bg-red-50 sm:col-span-1"
                  >
                    Clear Cart
                  </button>
                </div>

                <div className="mt-5">
                  <h3 className="no-print mb-2 text-lg font-semibold text-brand-900">
                    Receipt Preview
                  </h3>
                  <div className="overflow-x-auto rounded-xl bg-slate-50 p-3">
                    <ThermalReceipt
                      ref={receiptRef}
                      bill={bill}
                      restaurant={receiptRestaurant}
                      className="thermal-screen-receipt"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {discountPanelOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-900">Apply Discount</h3>
                <button
                  type="button"
                  onClick={() => setDiscountPanelOpen(false)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                >
                  Close
                </button>
              </div>

              <label
                className="mb-2 block text-sm text-slate-700"
                htmlFor="discountPercentInput"
              >
                Discount percentage
              </label>

              <input
                id="discountPercentInput"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountInput}
                onChange={(event) => {
                  setDiscountInput(event.target.value);
                  if (discountError) setDiscountError("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Enter discount %"
              />
              {discountError ? <p className="mt-2 text-xs text-red-600">{discountError}</p> : null}

              <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{"\u20B9"}{previewTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Discount ({previewTotals.discountPercent.toFixed(2)}%):</span>
                  <span>-{"\u20B9"}{previewTotals.discountAmount.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Final Payable:</span>
                  <span>{"\u20B9"}{previewTotals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={applyDiscount}
                className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white"
              >
                Apply Discount
              </button>
            </div>
          </div>
        ) : null}
      </main>

      <div className="thermal-print-area" aria-hidden="true">
        <ThermalReceipt
          bill={bill}
          restaurant={receiptRestaurant}
          className="thermal-print-receipt"
        />
      </div>
    </>
  );
}
