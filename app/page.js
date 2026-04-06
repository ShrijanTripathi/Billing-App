"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { menuItems } from "../data/menu";

const RESTAURANT = {
  name: "BALA JI FOOD ARTS",
  address: "Booth number 265 & 266, Phase 7 Mohali",
  phone: "+91-98765-43210",
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
  const [bill, setBill] = useState(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const receiptRef = useRef(null);

  const totalQty = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );
  const grandTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price, 0),
    [cart]
  );

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("balaji_cart");
      const savedBill = localStorage.getItem("balaji_last_bill");
      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedBill) setBill(JSON.parse(savedBill));
    } catch {
      // Ignore invalid persisted data and start with a clean state.
      setCart([]);
      setBill(null);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("balaji_cart", JSON.stringify(cart));
    } catch {
      // Ignore storage write failures (private mode/quota).
    }
  }, [cart]);

  const saveBill = (nextBill) => {
    setBill(nextBill);
    try {
      localStorage.setItem("balaji_last_bill", JSON.stringify(nextBill));
    } catch {
      // Ignore storage write failures (private mode/quota).
    }
  };

  const addItem = (menuItem) => {
    setCart((prev) => {
      const found = prev.find((item) => item.name === menuItem.name);
      if (!found) return [...prev, { ...menuItem, qty: 1 }];
      return prev.map((item) =>
        item.name === menuItem.name ? { ...item, qty: item.qty + 1 } : item
      );
    });
  };

  const changeQty = (name, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.name === name ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (name) => {
    setCart((prev) => prev.filter((item) => item.name !== name));
  };

  const clearOrder = () => {
    setCart([]);
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
      // Fall back to a non-persistent token if storage is unavailable.
    }

    const snapshot = {
      billNo: randomNumber(5),
      tokenNo: nextToken,
      date,
      time,
      items: cart.map((item) => ({
        ...item,
        lineTotal: item.qty * item.price,
      })),
      totalQty,
      grandTotal,
    };
    saveBill(snapshot);
  };

  const printBill = () => {
    if (!bill) return;
    window.print();
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
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 200],
      });

      const pageWidth = 80;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, imgHeight);
      pdf.save(`balaji-bill-${bill.billNo}.pdf`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <main className="min-h-screen p-3 sm:p-5">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-4 rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Balaji Ji Food Arts - Bill Generator
          </h1>
          <p className="text-sm text-brand-700">Simple POS for billing and thermal receipt printing</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="no-print rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-brand-900">Menu</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => addItem(item)}
                  className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-left transition hover:border-brand-500 hover:bg-brand-100"
                >
                  <div className="font-medium text-brand-900">{item.name}</div>
                  <div className="text-sm text-brand-700">{"\u20B9"}{item.price}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-brand-900">Cart</h2>
            {!cart.length && <p className="text-sm text-gray-500">No items in cart.</p>}

            <div className="space-y-3 no-print">
              {cart.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-sm text-gray-600">{"\u20B9"}{item.price} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(item.name, -1)}
                      className="h-8 w-8 rounded border border-gray-300 text-lg"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-medium">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(item.name, 1)}
                      className="h-8 w-8 rounded border border-gray-300 text-lg"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.name)}
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
                <span>{totalQty}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>Grand Total:</span>
                <span>{"\u20B9"}{grandTotal}</span>
              </div>
            </div>

            <div className="no-print mt-4 flex flex-wrap gap-2">
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
              <h3 className="mb-2 text-lg font-semibold text-brand-900">Receipt Preview</h3>
              <div ref={receiptRef} className="thermal-receipt p-3">
                <div className="text-center text-sm font-bold">{RESTAURANT.name}</div>
                <div className="text-center text-xs">{RESTAURANT.address}</div>
                <div className="text-center text-xs">{RESTAURANT.phone}</div>
                <div className="my-2 thermal-divider" />

                {bill ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>Date: {bill.date}</span>
                      <span>Time: {bill.time}</span>
                    </div>
                    <div className="mt-1 text-xs">Bill No: {bill.billNo}</div>
                    <div className="text-xs">Token No: {bill.tokenNo}</div>
                    <div className="my-2 thermal-divider" />

                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="w-1/2 text-left">Item</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Price</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((item) => (
                          <tr key={item.name}>
                            <td className="py-1 pr-2">{item.name}</td>
                            <td className="py-1 text-right">{item.qty}</td>
                            <td className="py-1 text-right">{item.price}</td>
                            <td className="py-1 text-right">{item.lineTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="my-2 thermal-divider" />
                    <div className="flex justify-between text-xs">
                      <span>Total Qty:</span>
                      <span>{bill.totalQty}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm font-bold">
                      <span>Grand Total:</span>
                      <span>{"\u20B9"}{bill.grandTotal}</span>
                    </div>
                    <div className="my-2 thermal-divider" />
                    <div className="text-center text-[10px]">Thank you. Visit again.</div>
                  </>
                ) : (
                  <div className="text-center text-xs text-gray-500">
                    Generate a bill to view thermal receipt.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
