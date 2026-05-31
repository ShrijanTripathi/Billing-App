"use client";

import { forwardRef } from "react";

/**
 * KotReceipt - Kitchen Order Ticket
 * Clean, compact, thermal-friendly layout optimized for 58mm/80mm.
 * - Monospace font
 * - Dashed separators
 * - Compact spacing
 * - Item lines: "2 x Burger"
 */

const KotReceipt = forwardRef(function KotReceipt({ bill = {}, className = "" }, ref) {
  const items = bill?.items || [];
  const billNo = bill?.billNo || bill?.billNumber || bill?.invoiceNo || bill?.id || "";
  const customerName = bill?.customerName || bill?.customer || bill?.name || "";
  const instructions = bill?.instructions || bill?.notes || bill?.customerDescription || "";
  const orderType = (bill?.orderType || bill?.saleType || "TAKEAWAY").toString().toUpperCase();
  const dateTime = bill?.dateTime || `${bill?.date || ""} ${bill?.time || ""}`.trim();

  return (
    <section ref={ref} className={`kot-receipt-shell ${className}`.trim()} aria-label="Kitchen Order Ticket" suppressHydrationWarning>
      <article className="kot-receipt">
        <div className="kot-header">
          <div className="kot-datetime">{dateTime}</div>
        </div>

        <div className="kot-divider" />

        <div className="kot-bill">
          <div className="kot-label">KOT</div>
          <div className="kot-billno">{billNo}</div>
        </div>

        <div className="kot-divider" />

        {customerName && (
          <div className="kot-meta">
            <div className="kot-small-label">NAME</div>
            <div className="kot-meta-value">{customerName}</div>
          </div>
        )}

        {instructions && (
          <div className="kot-instructions">
            <div className="kot-small-label">INSTRUCTIONS</div>
            <div className="kot-instructions-box">{instructions}</div>
          </div>
        )}

        <div className="kot-divider" />

        <div className="kot-items-section">
          <div className="kot-small-label">ITEMS</div>
          <div className="kot-items-list">
            {items.map((it = {}, idx) => {
              const qty = Number(it.qty || it.quantity || 0) || 0;
              const name = (it.name || it.item || it.title || "").toString();
              const modifiers = it.modifiers || it.options || [];
              return (
                <div key={(it.itemId || it._id || `${name}-${idx}`) + "-kot"} className="kot-item-line">
                  <div className="kot-item-main">{qty} x {name}</div>
                  {modifiers && modifiers.length > 0 && (
                    <div className="kot-item-mods">{modifiers.join?.(", ") || JSON.stringify(modifiers)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="kot-divider" />

        <div className="kot-footer">
          <div className="kot-small-label centered">ORDER TYPE</div>
          <div className="kot-order-type">{orderType}</div>
        </div>
      </article>

      <style suppressHydrationWarning>{`
        /* Scoped, printer-friendly variables */
        .kot-receipt-shell {
          position: absolute;
          left: -9999px;
          top: -9999px;
          /* default to 80mm; override by adding class receipt-58 on the shell */
          --receipt-width: 80mm;
        }

        .kot-receipt-shell.receipt-58 {
          --receipt-width: 58mm;
        }

        .kot-receipt {
          width: var(--receipt-width);
          font-family: "Courier New", Courier, monospace;
          color: #000;
          background: #fff;
          font-size: 12px; /* base */
          line-height: 1.25;
          padding: 6px 8px; /* minimal padding */
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
        }

        /* Header */
        .kot-header { text-align: center; margin-bottom: 4px; }
        .kot-datetime { font-size: 10px; font-weight: normal; }

        /* Divider - dashed and thin */
        .kot-divider { border-top: 1px dashed #000; margin: 6px 0; height: 0; }

        /* Bill / KOT number */
        .kot-bill { text-align: center; margin: 2px 0 4px; }
        .kot-label { font-size: 11px; font-weight: bold; letter-spacing: 1px; }
        .kot-billno { font-size: 28px; font-weight: 700; letter-spacing: 1px; margin-top: 4px; }

        /* Small labels used throughout */
        .kot-small-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }

        .kot-meta { margin-bottom: 4px; }
        .kot-meta-value { font-size: 12px; font-weight: 700; }

        /* Instructions emphasized with dashed box */
        .kot-instructions { margin: 4px 0; }
        .kot-instructions-box {
          font-size: 12px;
          font-weight: 700;
          padding: 6px 6px;
          border: 1px dashed #000;
          margin-top: 4px;
          white-space: pre-wrap;
        }

        /* Items - visually strongest, slightly larger and bold */
        .kot-items-section { margin: 2px 0; }
        .kot-items-list { margin-top: 4px; }
        .kot-item-line { padding: 6px 0; border-bottom: 1px dashed #000; page-break-inside: avoid; break-inside: avoid; }
        .kot-item-main { font-size: 14px; font-weight: 700; }
        .kot-item-mods { font-size: 11px; font-weight: 600; margin-top: 4px; color: #000; }

        /* Order type */
        .kot-footer { text-align: center; margin-top: 6px; }
        .kot-order-type { font-size: 12px; font-weight: 700; margin-top: 4px; }

        /* Prevent page breaks inside item blocks when printing long orders */
        .kot-items-list, .kot-item-line { page-break-inside: avoid; -webkit-column-break-inside: avoid; -moz-column-break-inside: avoid; }

        /* Print-specific tweaks */
        @media print {
          body { margin: 0; padding: 0; }
          .kot-receipt-shell { position: static; left: auto; top: auto; }
          .kot-receipt { padding: 6px 6px; box-shadow: none; }
          /* It's safer not to force @page size as many POS systems set that; using container width instead */
        }
      `}</style>
    </section>
  );
});

export default KotReceipt;
