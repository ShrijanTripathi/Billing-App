

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PRINT_SERVICE_URL = "http://localhost:5000";
const RECEIPT_PDF_WIDTH_MM = 80;
const HIGH_QUALITY_CAPTURE_SCALE = 2;

function createPrintJobId(printMeta) {
  const billNo = String(printMeta?.billNo || "bill").replace(/[^a-zA-Z0-9_-]/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${billNo}-${Date.now()}-${suffix}`;
}

function formatPrinterErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return "";

  return errors
    .map((item) => {
      const printer = item.printerName || item.printer || "Unknown printer";
      return `${printer}: ${item.error || item.message || "failed"}`;
    })
    .join("; ");
}

function formatPrinterConfigIssues(errorData) {
  const missing = (errorData?.missingPrinters || [])
    .map((item) => item.printerName || item.key)
    .filter(Boolean);
  const blocked = (errorData?.blockedPrinters || [])
    .map((item) => {
      const printer = item.printerName || item.key;
      return item.driverName ? `${printer} (${item.driverName})` : printer;
    })
    .filter(Boolean);
  const duplicateTargets = (errorData?.duplicatePrinterTargets || [])
    .map((target) => {
      const printers = (target.printers || [])
        .map((printer) => printer.printerName || printer.key)
        .filter(Boolean)
        .join(", ");
      return printers ? `${printers} share ${target.target}` : target.target;
    })
    .filter(Boolean);

  return [...missing, ...blocked, ...duplicateTargets].join("; ");
}

export async function sendToPrinter(receiptElement, printMeta = {}) {
  try {
    if (!receiptElement) {
      throw new Error("Receipt element missing");
    }

    // Check if element has content
    if (!receiptElement.innerText || receiptElement.innerText.trim().length === 0) {
      throw new Error("Receipt is empty - no data to print");
    }

    console.log('[ELEMENT CHECK]', {
      hasContent: receiptElement.innerText.length > 0,
      visible: receiptElement.offsetParent !== null,
      width: receiptElement.scrollWidth,
      height: receiptElement.scrollHeight,
    });

    // Wait for browser font/layout work to settle before rasterizing the receipt.
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Capture at print-friendly density so text remains readable on thermal printers.
    const canvas = await html2canvas(receiptElement, {
      scale: HIGH_QUALITY_CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      allowTaint: true,
      imageTimeout: 0,
      windowWidth: Math.ceil(receiptElement.scrollWidth),
      windowHeight: Math.ceil(receiptElement.scrollHeight),
    });

    console.log('[CANVAS CREATED]', {
      width: canvas.width,
      height: canvas.height,
    });

    const imgData = canvas.toDataURL("image/png");

    // CREATE PDF WITH AUTO HEIGHT
    const pdfWidth = RECEIPT_PDF_WIDTH_MM;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    // CONVERT TO BASE64
    const pdfBase64 = pdf.output("datauristring");
    
    console.log('[PDF SIZE]', (pdfBase64.length / 1024 / 1024).toFixed(2), 'MB');

    const printJobId = createPrintJobId(printMeta);

    // SEND TO BACKEND (Multi-Printer: 2x Main + 1x LAN1 + 1x LAN2 = 4 copies)
    const response = await fetch(
      `${PRINT_SERVICE_URL}/print-multiple`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Print-Job-Id": printJobId,
        },
        body: JSON.stringify({
          pdf: pdfBase64,
          jobId: printJobId,
          billNo: printMeta?.billNo || "",
          tokenNo: printMeta?.tokenNo || "",
        }),
      }
    );

    // Handle response
    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      let errorMessage = "Print request failed";
      
      try {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          const printerErrors = formatPrinterErrors(errorData.errors);
          const printerConfigIssues = formatPrinterConfigIssues(errorData);
          errorMessage =
            errorData.details ||
            errorData.error ||
            errorData.message ||
            errorMessage;
          const extraDetails = [printerErrors, printerConfigIssues].filter(Boolean).join("; ");
          if (extraDetails) {
            errorMessage = `${errorMessage}: ${extraDetails}`;
          }
        } else {
          errorMessage = "Print service error - please restart it with: node print-service/server.js";
        }
      } catch (parseError) {
        console.error("Could not parse error response:", parseError);
        errorMessage = "Print service error - invalid response";
      }
      
      throw new Error(errorMessage);
    }

    // Parse successful response
    try {
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        throw new Error("Invalid response format from print service");
      }
    } catch (parseError) {
      throw new Error("Failed to parse print service response: " + parseError.message);
    }

  } catch (error) {
    console.error("Print Error:", error);

    throw new Error(
      error.message || "Printing failed"
    );
  }
}
