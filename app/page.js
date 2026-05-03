"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiRequest, API_BASE_URL } from "../services/apiClient";
import ThermalReceipt from "../components/ThermalReceipt";
import DynamicMenuPanel from "../components/pos/DynamicMenuPanel";
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
  const [bill, setBill] = useState(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const receiptRef = useRef(null);

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
      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedBill) setBill(JSON.parse(savedBill));
      if (savedDiscount) {
        const sanitized = clampDiscountPercent(savedDiscount);
        setDiscountPercent(sanitized);
        setDiscountInput(String(sanitized));
      }
    } catch {
      setCart([]);
      setBill(null);
      setDiscountPercent(0);
      setDiscountInput("0");
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
      saleType,
      billNo: randomNumber(5),
      tokenNo: nextToken,
      date,
      time,
      billedAt: now.toISOString(),
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
  };

  const printBill = () => {
    if (!bill) return;
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
      <main className="app-shell min-h-screen p-3 sm:p-5">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-4 rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Balaji Ji Food Arts - Bill Generator
          </h1>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
          <DynamicMenuPanel onAddItem={addItem} />

          <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-brand-900">Cart</h2>
            {!cart.length && <p className="text-sm text-gray-500">No items in cart.</p>}

            <div className="space-y-3 no-print">
              {cart.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-sm text-gray-600">{"\u20B9"}{item.price} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(item._id, -1)}
                      className="h-8 w-8 rounded border border-gray-300 text-lg"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-medium">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(item._id, 1)}
                      className="h-8 w-8 rounded border border-gray-300 text-lg"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item._id)}
                      className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="no-print mt-4 rounded-lg bg-brand-50 p-3 text-sm">
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

            <div className="no-print mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <span className="text-slate-700">Sale Type:</span>
                <select
                  value={saleType}
                  onChange={(event) => setSaleType(event.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm outline-none"
                >
                  <option value="ONLINE">ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>
              <button
                type="button"
                onClick={openDiscountPanel}
                className="rounded-lg border border-brand-500 px-4 py-2 text-brand-800"
              >
                Discount
              </button>
              <button
                type="button"
                onClick={generateBill}
                disabled={!cart.length}
                className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Bill
              </button>
              <button
                type="button"
                onClick={printBill}
                disabled={!bill}
                className="rounded-lg border border-brand-700 px-4 py-2 text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Print Bill
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={!bill || isPdfGenerating}
                className="rounded-lg border border-gray-400 px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={clearOrder}
                className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
              >
                Clear Cart
              </button>
            </div>

            <div className="mt-5">
              <h3 className="no-print mb-2 text-lg font-semibold text-brand-900">
                Receipt Preview
              </h3>
              <ThermalReceipt
                ref={receiptRef}
                bill={bill}
                restaurant={RESTAURANT}
                className="thermal-screen-receipt"
              />
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

            <label className="mb-2 block text-sm text-slate-700" htmlFor="discountPercentInput">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
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
        <ThermalReceipt bill={bill} restaurant={RESTAURANT} className="thermal-print-receipt" />
      </div>
    </>
  );
}
