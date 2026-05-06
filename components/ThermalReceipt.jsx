"use client";

import { forwardRef, useMemo } from "react";

const RUPEE = "\u20B9";

const ORDER_TYPE_LABELS = {
  DELIVERY: "Delivery",
  DINING: "Dining",
  DINEIN: "Dine In",
  DINE_IN: "Dine In",
  OFFLINE: "Pick Up",
  ONLINE: "Delivery",
  PICKUP: "Pick Up",
  PICK_UP: "Pick Up",
  TAKEAWAY: "Take Away",
  TAKE_AWAY: "Take Away",
};

const CODE39_PATTERNS = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  "*": "nwnnwnwnn",
};

function compactNumber(value) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function normalizeOrderType(bill) {
  const rawType = bill?.orderType ?? bill?.saleType ?? "PICK_UP";
  const key = String(rawType).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return ORDER_TYPE_LABELS[key] || String(rawType);
}

function getCustomerName(bill) {
  return bill?.customerName || bill?.customer || bill?.name || "";
}

function getCashierName(bill) {
  return bill?.cashierName || bill?.cashier || bill?.createdBy || "Counter";
}

function getBillCode(bill) {
  return bill?.billNo || bill?.billNumber || bill?.invoiceNo || bill?.id || "";
}

function getLineTotal(item) {
  return Number(item?.lineTotal ?? Number(item?.qty || 0) * Number(item?.price || 0));
}

function getVariantText(item) {
  const variant = item?.variant || item?.size || item?.portion || "";
  if (!variant) return "";
  const itemName = String(item?.name || "").toLowerCase();
  const normalizedVariant = String(variant).toLowerCase();
  return itemName.includes(normalizedVariant) ? "" : `(${variant})`;
}

function buildBarcodeSegments(value) {
  const sanitized = String(value || "").replace(/\D/g, "");
  if (!sanitized) return [];

  return `*${sanitized}*`
    .split("")
    .flatMap((character, characterIndex, characters) => {
      const pattern = CODE39_PATTERNS[character];
      if (!pattern) return [];

      const segments = pattern.split("").map((width, index) => ({
        kind: index % 2 === 0 ? "bar" : "space",
        wide: width === "w",
      }));

      if (characterIndex < characters.length - 1) {
        segments.push({ kind: "space", wide: false });
      }

      return segments;
    });
}

function ReceiptInfoRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div className="receipt-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryRow({ label, value, className = "" }) {
  return (
    <div className={`receipt-summary-row ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const ThermalReceipt = forwardRef(function ThermalReceipt(
  { bill, restaurant, className = "" },
  ref
) {
  const items = bill?.items || [];
  const billCode = getBillCode(bill);
  const barcodeSegments = useMemo(() => buildBarcodeSegments(billCode), [billCode]);
  const subtotal = Number(
    bill?.subtotal ?? items.reduce((sum, item) => sum + getLineTotal(item), 0)
  );
  const discountPercent = Number(bill?.discountPercent || 0);
  const discountAmount = Number(bill?.discountAmount || 0);
  const taxAmount = Number(bill?.taxAmount ?? bill?.tax ?? bill?.gstAmount ?? 0);
  const tipAmount = Number(bill?.tipAmount ?? bill?.tip ?? 0);
  const grandTotal = Number(
    bill?.grandTotal ?? subtotal - discountAmount + taxAmount + tipAmount
  );
  const totalQty = Number(
    bill?.totalQty ?? items.reduce((sum, item) => sum + Number(item?.qty || 0), 0)
  );
  const customerName = getCustomerName(bill);
  const orderType = normalizeOrderType(bill);

  return (
    <section
      ref={ref}
      className={`thermal-receipt-shell ${className}`.trim()}
      aria-label="Thermal receipt"
    >
      <article className="thermal-receipt">
        <header className="receipt-header">
          <div className="receipt-brand">{restaurant.name}</div>
          {restaurant.addressLines?.map((line) => (
            <div className="receipt-header-line" key={line}>
              {line}
            </div>
          ))}
          {restaurant.phone ? <div className="receipt-header-line">{restaurant.phone}</div> : null}
          {restaurant.waitingTime ? (
            <div className="receipt-header-line">{restaurant.waitingTime}</div>
          ) : null}
          {restaurant.vegNote ? <div className="receipt-header-line">{restaurant.vegNote}</div> : null}
          {restaurant.openTiming ? (
            <div className="receipt-header-line">{restaurant.openTiming}</div>
          ) : null}
        </header>

        <div className="receipt-divider" />

        {!bill ? (
          <div className="receipt-empty">Generate a bill to view thermal receipt.</div>
        ) : (
          <>
            {customerName ? <div className="receipt-customer">Name: {customerName}</div> : null}
            <div className="receipt-order-type">{orderType}</div>

            <div className="receipt-info-grid">
              <ReceiptInfoRow label="Date:" value={bill.date} />
              <ReceiptInfoRow label="Time:" value={bill.time} />
              <ReceiptInfoRow label="Cashier:" value={getCashierName(bill)} />
              <ReceiptInfoRow label="Bill No.:" value={billCode} />
              <ReceiptInfoRow label="Token No.:" value={bill.tokenNo} />
            </div>

            <div className="receipt-divider" />

            <table className="receipt-items">
              <colgroup>
                <col className="receipt-col-no" />
                <col className="receipt-col-item" />
                <col className="receipt-col-qty" />
                <col className="receipt-col-price" />
                <col className="receipt-col-amount" />
              </colgroup>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Item</th>
                  <th>Qty.</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const variantText = getVariantText(item);
                  return (
                    <tr key={item.itemId || item._id || `${item.name}-${index}`}>
                      <td className="receipt-number">{index + 1}</td>
                      <td className="receipt-item-name">
                        <span>{item.name}</span>
                        {variantText ? <small>{variantText}</small> : null}
                      </td>
                      <td className="receipt-numeric">{compactNumber(item.qty)}</td>
                      <td className="receipt-numeric">{formatMoney(item.price)}</td>
                      <td className="receipt-numeric">{formatMoney(getLineTotal(item))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="receipt-divider" />

            <section className="receipt-summary" aria-label="Bill summary">
              <SummaryRow label="Total Qty:" value={compactNumber(totalQty)} />
              <SummaryRow label="Sub Total" value={`${RUPEE}${formatMoney(subtotal)}`} />
              <SummaryRow
                label={`Discount (${formatMoney(discountPercent)}%)`}
                value={`-${RUPEE}${formatMoney(discountAmount)}`}
              />
              {taxAmount > 0 ? (
                <SummaryRow label="Taxes" value={`${RUPEE}${formatMoney(taxAmount)}`} />
              ) : null}
              {tipAmount > 0 ? (
                <SummaryRow label="Tip" value={`${RUPEE}${formatMoney(tipAmount)}`} />
              ) : null}
              <SummaryRow
                label="Grand Total"
                value={`${RUPEE}${formatMoney(grandTotal)}`}
                className="receipt-grand-total"
              />
            </section>

            <div className="receipt-divider" />

            <footer className="receipt-footer">
              {barcodeSegments.length ? (
                <div className="receipt-barcode-wrap">
                  <div className="receipt-barcode-caption">Bill Code: {billCode}</div>
                  <div className="receipt-barcode" aria-hidden="true">
                    {barcodeSegments.map((segment, index) => (
                      <span
                        className={
                          segment.kind === "bar" ? "receipt-barcode-bar" : "receipt-barcode-space"
                        }
                        key={`${segment.kind}-${index}`}
                        style={{ width: segment.wide ? "0.82mm" : "0.32mm" }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {restaurant.fssai ? (
                <div className="receipt-footer-line">FSSAI Lic No. {restaurant.fssai}</div>
              ) : null}
              {restaurant.onlineLine ? (
                <div className="receipt-footer-line">{restaurant.onlineLine}</div>
              ) : null}
              <div className="receipt-thanks">{restaurant.footerText || "Thanks For Visit !!"}</div>
            </footer>
          </>
        )}
      </article>
    </section>
  );
});

export default ThermalReceipt;
