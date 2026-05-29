const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const PDFDocument = require("pdfkit");
const { print, getPrinters, getDefaultPrinter } = require("pdf-to-printer");

const app = express();
const execFileAsync = promisify(execFile);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  if (
    (req.path === "/print" || req.path === "/print-multiple") &&
    req.method === "POST"
  ) {
    console.log(`\n[REQUEST] POST ${req.path}`);
    console.log(
      "[JOB ID]",
      req.body.jobId || req.get("X-Print-Job-Id") || "none",
    );
    console.log(
      "[BODY SIZE]",
      req.body.pdf
        ? (req.body.pdf.length / 1024 / 1024).toFixed(2) + "MB"
        : "no PDF",
    );
  }
  next();
});

const PORT = 5000;

loadLocalEnvFiles();

/*
========================================
PRINTER CONFIGURATION
========================================

These are Windows printer queue names. Every configured printer must exist in
Windows "Printers & scanners" on the laptop running this service. For kitchen
LAN printers, add them as TCP/IP printer queues and name them exactly as below.
========================================
*/

 //live 
const PRINTERS_CONFIG = {
  MAIN_THERMAL: process.env.PRINT_MAIN_THERMAL || "POS-X Thermal Printer",
  LAN_1: process.env.PRINT_LAN_1 || "Continental",
  LAN_2: process.env.PRINT_LAN_2 || "Chaap",
};

const ALLOW_DUPLICATE_PRINTER_TARGETS = isEnabledEnvFlag(
  process.env.PRINT_ALLOW_DUPLICATE_TARGETS,
);

const PRINTER_NAME = PRINTERS_CONFIG.MAIN_THERMAL;

const PRINT_JOBS = [
  { printer: "MAIN_THERMAL", copies: 1, type: "CUSTOMER COPY" },
  { printer: "LAN_1", copies: 1, type: "KITCHEN COPY" },
  { printer: "LAN_2", copies: 1, type: "KITCHEN COPY" },
];

const APP_DATA_DIR = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  "Balaji Bill Generator",
);
const PRINT_TMP_DIR = path.join(APP_DATA_DIR, "print-jobs");
let activePrintJobId = null;

function loadLocalEnvFiles() {
  const envDirs = [process.cwd(), path.resolve(__dirname, ".."), __dirname];
  const seenFiles = new Set();

  envDirs.forEach((envDir) => {
    [".env.local", ".env"].forEach((fileName) => {
      const filePath = path.join(envDir, fileName);
      if (seenFiles.has(filePath)) return;
      seenFiles.add(filePath);

      if (!fs.existsSync(filePath)) return;

      const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (!key || Object.prototype.hasOwnProperty.call(process.env, key))
          return;

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        process.env[key] = value;
      });
    });
  });
}

function ensurePrintTmpDir() {
  if (!fs.existsSync(PRINT_TMP_DIR)) {
    fs.mkdirSync(PRINT_TMP_DIR, { recursive: true });
  }
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`[WARN] Could not delete temp print file: ${error.message}`);
  }
}

function normalizePrinterName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isEnabledEnvFlag(value) {
  return ["1", "true", "yes", "on"].includes(normalizePrinterName(value));
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function getWindowsPrinterInventory() {
  if (process.platform !== "win32") {
    return {
      printers: [],
      error: "Windows printer inventory is only available on Windows",
      source: "non-windows",
    };
  }

  try {
    const printerInventoryScript = [
      "$printers = @(Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus)",
      "$ports = @(Get-PrinterPort | Select-Object Name,PrinterHostAddress,PortNumber,Protocol)",
      "[pscustomobject]@{Printers=$printers;Ports=$ports} | ConvertTo-Json -Depth 5 -Compress",
    ].join("; ");

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        printerInventoryScript,
      ],
      {
        timeout: 5000,
        windowsHide: true,
      },
    );

    if (!stdout.trim()) {
      return {
        printers: [],
        error: null,
        source: "windows",
      };
    }

    const parsed = JSON.parse(stdout);
    const portsByName = new Map(
      toArray(parsed.Ports).map((port) => [
        normalizePrinterName(port.Name),
        port,
      ]),
    );
    const printers = toArray(parsed.Printers).map((printer) => {
      const port = portsByName.get(normalizePrinterName(printer.PortName));

      return {
        name: printer.Name || "",
        driverName: printer.DriverName || "",
        portName: printer.PortName || "",
        printerStatus: printer.PrinterStatus ?? "",
        portHostAddress: port?.PrinterHostAddress || "",
        portNumber: port?.PortNumber ?? "",
        portProtocol: port?.Protocol ?? "",
      };
    });

    return {
      printers,
      error: null,
      source: "windows",
    };
  } catch (error) {
    const message = `Could not read Windows printer details: ${error.message}`;
    console.warn(`[WARN] ${message}`);
    return {
      printers: [],
      error: message,
      source: "windows",
    };
  }
}

function isPdfUnsafeDriver(driverName) {
  const normalizedDriver = normalizePrinterName(driverName);
  return (
    (normalizedDriver.includes("generic") &&
      normalizedDriver.includes("text")) ||
    normalizedDriver.includes("text only") ||
    normalizedDriver === "raw"
  );
}

function createServerJobId(rawJobId) {
  const cleaned = String(rawJobId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  return (
    cleaned || `print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function extractPdfBase64(pdf) {
  if (!pdf) {
    return { error: "PDF missing" };
  }

  let base64Data = pdf;
  if (pdf.includes(",")) {
    base64Data = pdf.split(",")[1] || pdf;
  }

  if (!base64Data || base64Data.trim().length === 0) {
    return { error: "Invalid PDF data" };
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data.trim())) {
    return { error: "Invalid base64 format" };
  }

  return { base64Data: base64Data.trim() };
}

async function getPrinterInventory() {
  const defaultPrinter = await getDefaultPrinter().catch(() => null);

  const windowsInventory = await getWindowsPrinterInventory();
  if (process.platform === "win32") {
    return {
      ...windowsInventory,
      defaultPrinter,
      driverVerificationError: windowsInventory.error,
    };
  }

  try {
    return {
      printers: toArray(await getPrinters()).map((printer) => ({
        name: printer.name || printer.deviceId || "",
        driverName: "",
        portName: "",
        printerStatus: printer.status || "",
        portHostAddress: "",
        portNumber: "",
        portProtocol: "",
      })),
      defaultPrinter,
      error: null,
      source: "pdf-to-printer",
      driverVerificationError:
        "Printer driver verification is only implemented on Windows",
    };
  } catch (error) {
    return {
      printers: [],
      defaultPrinter: null,
      error: error.message,
      source: "pdf-to-printer",
      driverVerificationError: error.message,
    };
  }
}

function buildConfiguredPrinterStatus(printers, driverVerificationError) {
  const installedPrintersByName = new Map(
    printers.map((printer) => [normalizePrinterName(printer.name), printer]),
  );

  return PRINT_JOBS.map((job) => {
    const printerName = PRINTERS_CONFIG[job.printer];
    const installedPrinter = installedPrintersByName.get(
      normalizePrinterName(printerName),
    );
    const driverName = installedPrinter?.driverName || "";
    let driverWarning = "";

    if (installedPrinter && driverVerificationError) {
      driverWarning = driverVerificationError;
    } else if (
      installedPrinter &&
      !driverName &&
      process.platform === "win32"
    ) {
      driverWarning = "Could not verify printer driver name";
    } else if (isPdfUnsafeDriver(driverName)) {
      driverWarning = "Generic/Text driver cannot render PDF/image print jobs";
    }

    return {
      key: job.printer,
      printerName,
      driverName,
      portName: installedPrinter?.portName || "",
      printerStatus: installedPrinter?.printerStatus || "",
      portHostAddress: installedPrinter?.portHostAddress || "",
      portNumber: installedPrinter?.portNumber || "",
      portProtocol: installedPrinter?.portProtocol || "",
      copies: job.copies,
      type: job.type,
      installed: Boolean(installedPrinter),
      readyForPdf: Boolean(installedPrinter) && !driverWarning,
      driverWarning,
    };
  });
}

function getConfiguredPrinterTarget(printer) {
  if (!printer.installed) return "";

  const host = normalizePrinterName(printer.portHostAddress);
  if (host) {
    return `tcp://${host}:${printer.portNumber || "9100"}`;
  }

  const portName = normalizePrinterName(printer.portName);
  if (portName) {
    return `port:${portName}`;
  }

  return `queue:${normalizePrinterName(printer.printerName)}`;
}

function findDuplicatePrinterTargets(configuredPrinters) {
  const printersByTarget = new Map();

  configuredPrinters.forEach((printer) => {
    const target = getConfiguredPrinterTarget(printer);
    if (!target) return;

    const printers = printersByTarget.get(target) || [];
    printers.push(printer);
    printersByTarget.set(target, printers);
  });

  return Array.from(printersByTarget.entries())
    .filter(([, printers]) => printers.length > 1)
    .map(([target, printers]) => ({
      target,
      printers: printers.map((printer) => ({
        key: printer.key,
        printerName: printer.printerName,
        portName: printer.portName,
        portHostAddress: printer.portHostAddress,
        portNumber: printer.portNumber,
        copies: printer.copies,
        type: printer.type,
      })),
    }));
}

function getTotalConfiguredCopies() {
  return PRINT_JOBS.reduce((sum, job) => sum + job.copies, 0);
}

async function getPrinterConfigurationStatus() {
  const inventory = await getPrinterInventory();
  const configuredPrinters = buildConfiguredPrinterStatus(
    inventory.printers,
    inventory.driverVerificationError,
  );

  return {
    ...inventory,
    configuredPrinters,
    allowDuplicatePrinterTargets: ALLOW_DUPLICATE_PRINTER_TARGETS,
    duplicatePrinterTargets: findDuplicatePrinterTargets(configuredPrinters),
    missingPrinters: configuredPrinters.filter((printer) => !printer.installed),
    blockedPrinters: configuredPrinters.filter(
      (printer) => printer.installed && !printer.readyForPdf,
    ),
  };
}

async function printPdfCopy(pdfPath, printerName) {
  await print(pdfPath, {
    printer: printerName,
    silent: true,
    copies: 1,
  });
}

/*
========================================
GENERATE RECEIPT PDF
========================================
*/

async function generateReceiptPDF(billData, filePath) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      margin: 8,
      size: [226, 800], // thermal width
    });

    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // ===== HEADER =====
    doc.fontSize(15).text(billData.businessName || "RESTAURANT", {
      align: "center",
    });

    doc.fontSize(9).text("CUSTOMER COPY", {
      align: "center",
    });

    doc.moveDown(0.5);

    doc.fontSize(9);

    doc.text(`Bill No : ${billData.billNo}`);
    doc.text(`Token   : ${billData.tokenNo || "-"}`);
    doc.text(`Date    : ${billData.date || "-"}`);
    doc.text(`Time    : ${billData.time || "-"}`);

    doc.moveDown(0.5);

    // ===== LINE =====
    doc.text("--------------------------------");

    // ===== ITEMS =====
    (billData.items || []).forEach((item) => {
      const qty = item.qty || 0;
      const price = item.price || 0;
      const total = qty * price;

      doc.text(item.name);

      doc.text(`${qty} x ${price}                     ${total}`, {
        align: "right",
      });

      doc.moveDown(0.3);
    });

    // ===== LINE =====
    doc.text("--------------------------------");

    // ===== TOTAL =====
    doc.moveDown(0.3);

    doc.fontSize(12).text(`TOTAL : Rs. ${billData.grandTotal}`, {
      align: "right",
    });

    doc.moveDown();

    // ===== FOOTER =====
    doc.fontSize(10).text("Thank You Visit Again", {
      align: "center",
    });

    doc.moveDown(0.5);

    doc.text("Powered By Balaji Billing", {
      align: "center",
    });

    doc.end();

    stream.on("finish", resolve);
  });
}

/*
========================================
PRINT RECEIPT
========================================
*/

async function printReceipt(billData) {
  ensurePrintTmpDir();
  const pdfPath = path.join(PRINT_TMP_DIR, `test-${Date.now()}.pdf`);

  try {
    // Generate PDF
    await generateReceiptPDF(billData, pdfPath);

    // Print silently
    await printPdfCopy(pdfPath, PRINTER_NAME);

    return {
      success: true,
      message: "Printed successfully",
    };
  } finally {
    safeUnlink(pdfPath);
  }
}

/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    printer: PRINTER_NAME,
    configured_printers: PRINTERS_CONFIG,
    active_print_job: activePrintJobId,
  });
});

/*
========================================
TEST PRINT
========================================
*/

app.get("/test-print", async (req, res) => {
  try {
    const printerStatus = await getPrinterConfigurationStatus();
    const mainPrinter = printerStatus.configuredPrinters.find(
      (printer) => printer.key === "MAIN_THERMAL",
    );

    if (
      printerStatus.error ||
      !mainPrinter?.installed ||
      !mainPrinter.readyForPdf
    ) {
      return res.status(400).json({
        success: false,
        error: printerStatus.error
          ? `Could not read Windows printer list: ${printerStatus.error}`
          : !mainPrinter?.installed
            ? `Printer "${PRINTER_NAME}" not found. Check Windows Printers list.`
            : `Printer "${PRINTER_NAME}" driver cannot render PDF/image print jobs.`,
        configuredPrinter: mainPrinter || null,
        installedPrinters: printerStatus.printers.map(
          (printer) => printer.name,
        ),
      });
    }

    const result = await printReceipt({
      billNo: "TEST001",
      businessName: "BALAJI FOOD ARTS",
      tokenNo: 1,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      items: [
        {
          name: "Burger",
          qty: 1,
          price: 120,
        },
        {
          name: "French Fries",
          qty: 2,
          price: 80,
        },
      ],
      grandTotal: 280,
    });

    res.json(result);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
========================================
DIAGNOSTIC ENDPOINT
========================================
*/
app.get("/diagnose", async (req, res) => {
  const printerStatus = await getPrinterConfigurationStatus();

  res.json({
    status: "ok",
    printer_name: PRINTER_NAME,
    configured_printers: printerStatus.configuredPrinters,
    missing_printers: printerStatus.missingPrinters,
    blocked_printers: printerStatus.blockedPrinters,
    installed_printers: printerStatus.printers.map((printer) => ({
      name: printer.name,
      driverName: printer.driverName,
      portName: printer.portName,
      printerStatus: printer.printerStatus,
      portHostAddress: printer.portHostAddress,
      portNumber: printer.portNumber,
      portProtocol: printer.portProtocol,
    })),
    allow_duplicate_printer_targets: printerStatus.allowDuplicatePrinterTargets,
    duplicate_printer_targets: printerStatus.duplicatePrinterTargets,
    default_printer: printerStatus.defaultPrinter?.name || null,
    printer_inventory_source: printerStatus.source,
    printer_discovery_error: printerStatus.error,
    active_print_job: activePrintJobId,
    platform: process.platform,
    node_version: process.version,
    help: "Every configured printer must be a Windows printer queue with the exact same name and a driver that can render PDF/image jobs.",
  });
});

/*
========================================
MULTI-PRINTER PRINT API
========================================
Prints PDF to multiple printers with specified copies.
Preflight checks configured Windows printer queues before sending anything.
*/
app.post("/print-multiple", async (req, res) => {
  const requestedJobId = createServerJobId(
    req.body.jobId || req.get("X-Print-Job-Id"),
  );

  if (activePrintJobId) {
    return res.status(409).json({
      success: false,
      error: "A print job is already running",
      activePrintJobId,
    });
  }

  activePrintJobId = requestedJobId;
  let receiptPdfPath = "";
  let kotPdfPath = "";

  try {
    // Support both new format (receiptPdf + kotPdf) and legacy format (pdf)
    const { pdf, receiptPdf, kotPdf } = req.body;
    const hasNewFormat = receiptPdf || kotPdf;
    const pdfToUse = hasNewFormat ? receiptPdf : pdf;

    const parsedReceipt = extractPdfBase64(pdfToUse);
    if (parsedReceipt.error) {
      return res.status(400).json({
        success: false,
        error: parsedReceipt.error,
      });
    }

    // Parse KOT PDF if provided in new format
    let parsedKot = null;
    if (kotPdf && hasNewFormat) {
      parsedKot = extractPdfBase64(kotPdf);
      if (parsedKot.error) {
        console.log('[WARNING] KOT PDF parsing failed, will use receipt PDF for kitchen printers');
        parsedKot = null;
      }
    }

    const printerStatus = await getPrinterConfigurationStatus();
    if (printerStatus.error) {
      return res.status(400).json({
        success: false,
        error: `Could not read Windows printer list: ${printerStatus.error}`,
      });
    }

    if (printerStatus.missingPrinters.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Configured printer not found in Windows",
        missingPrinters: printerStatus.missingPrinters,
        installedPrinters: printerStatus.printers.map(
          (printer) => printer.name,
        ),
      });
    }

    if (printerStatus.blockedPrinters.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Configured printer driver cannot render PDF/image print jobs",
        blockedPrinters: printerStatus.blockedPrinters,
      });
    }

    if (
      !printerStatus.allowDuplicatePrinterTargets &&
      printerStatus.duplicatePrinterTargets.length > 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Multiple configured printer queues point to the same physical printer/port",
        allowDuplicatePrinterTargets:
          printerStatus.allowDuplicatePrinterTargets,
        duplicatePrinterTargets: printerStatus.duplicatePrinterTargets,
      });
    }

    ensurePrintTmpDir();
    receiptPdfPath = path.join(PRINT_TMP_DIR, `${requestedJobId}-receipt.pdf`);
    kotPdfPath = hasNewFormat && parsedKot ? path.join(PRINT_TMP_DIR, `${requestedJobId}-kot.pdf`) : null;

    // Write Receipt PDF file
    try {
      fs.writeFileSync(receiptPdfPath, parsedReceipt.base64Data, "base64");
      console.log(`\n[PDF] Saved receipt ${requestedJobId} to: ${receiptPdfPath}`);
    } catch (writeError) {
      return res.status(500).json({
        success: false,
        error: `Failed to save receipt PDF: ${writeError.message}`,
      });
    }

    // Write KOT PDF file if available
    if (kotPdfPath && parsedKot) {
      try {
        fs.writeFileSync(kotPdfPath, parsedKot.base64Data, "base64");
        console.log(`[PDF] Saved KOT ${requestedJobId} to: ${kotPdfPath}`);
      } catch (writeError) {
        console.log(`[WARNING] Failed to save KOT PDF, will use receipt PDF: ${writeError.message}`);
        kotPdfPath = null;
      }
    }

    if (!fs.existsSync(receiptPdfPath)) {
      return res.status(500).json({
        success: false,
        error: "Receipt PDF file was not created",
      });
    }

    // Print to all printers
    const results = [];
    const errors = [];

    for (const job of PRINT_JOBS) {
      const printerName = PRINTERS_CONFIG[job.printer];
      // Use KOT PDF for kitchen printers (LAN_1, LAN_2), receipt PDF for main printer
      const pdfPathToUse = (job.printer !== "MAIN_THERMAL" && kotPdfPath) ? kotPdfPath : receiptPdfPath;

      for (let copy = 1; copy <= job.copies; copy++) {
        try {
          console.log(
            `[PRINT] Job ${requestedJobId} - ${job.type} - Copy ${copy}/${job.copies} to ${printerName}`,
          );

          await printPdfCopy(pdfPathToUse, printerName);

          console.log(
            `[SUCCESS] Job ${requestedJobId} - ${job.type} - Copy ${copy} sent`,
          );
          results.push({
            jobId: requestedJobId,
            printer: job.printer,
            printerName,
            type: job.type,
            copy: copy,
            totalCopies: job.copies,
            success: true,
          });
        } catch (printError) {
          const errorMsg = `Failed to print ${job.type} copy ${copy} to ${printerName}: ${printError.message}`;
          console.error(`[ERROR] ${errorMsg}`);
          errors.push({
            jobId: requestedJobId,
            printer: job.printer,
            printerName,
            type: job.type,
            copy: copy,
            error: errorMsg,
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(results.length > 0 ? 207 : 500).json({
        success: false,
        partialSuccess: results.length > 0,
        message:
          results.length > 0
            ? "Some printers failed after other copies were already sent"
            : "All printers failed",
        jobId: requestedJobId,
        results,
        errors,
      });
    }

    res.json({
      success: true,
      partialSuccess: false,
      message: `All ${getTotalConfiguredCopies()} copies printed successfully`,
      jobId: requestedJobId,
      results,
    });
  } catch (error) {
    console.error("\n[PRINT MULTIPLE ERROR]", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    safeUnlink(receiptPdfPath);
    safeUnlink(kotPdfPath);
    activePrintJobId = null;
  }
});

/*
========================================
LEGACY SINGLE PRINTER API
========================================
*/
app.post("/print", async (req, res) => {
  const requestedJobId = createServerJobId(
    req.body.jobId || req.get("X-Print-Job-Id"),
  );
  let pdfPath = "";

  try {
    const { pdf } = req.body;

    const parsedPdf = extractPdfBase64(pdf);
    if (parsedPdf.error) {
      return res.status(400).json({
        success: false,
        error: parsedPdf.error,
      });
    }

    const printerStatus = await getPrinterConfigurationStatus();
    const mainPrinterMissing = printerStatus.configuredPrinters.find(
      (printer) => printer.key === "MAIN_THERMAL" && !printer.installed,
    );
    const mainPrinterBlocked = printerStatus.configuredPrinters.find(
      (printer) =>
        printer.key === "MAIN_THERMAL" &&
        printer.installed &&
        !printer.readyForPdf,
    );

    if (printerStatus.error || mainPrinterMissing || mainPrinterBlocked) {
      return res.status(400).json({
        success: false,
        error: printerStatus.error
          ? `Could not read Windows printer list: ${printerStatus.error}`
          : mainPrinterMissing
            ? `Printer "${PRINTER_NAME}" not found. Check Windows Printers list.`
            : `Printer "${PRINTER_NAME}" driver cannot render PDF/image print jobs.`,
        blockedPrinters: mainPrinterBlocked ? [mainPrinterBlocked] : [],
        installedPrinters: printerStatus.printers.map(
          (printer) => printer.name,
        ),
      });
    }

    ensurePrintTmpDir();
    pdfPath = path.join(PRINT_TMP_DIR, `${requestedJobId}-single.pdf`);

    // Write file with error checking
    try {
      fs.writeFileSync(pdfPath, parsedPdf.base64Data, "base64");
      console.log(`[PDF] Saved to: ${pdfPath}`);
    } catch (writeError) {
      console.error("[PDF WRITE ERROR]", writeError);
      return res.status(500).json({
        success: false,
        error: `Failed to save PDF file: ${writeError.message}`,
      });
    }

    // Verify file was written
    if (!fs.existsSync(pdfPath)) {
      return res.status(500).json({
        success: false,
        error: "PDF file was not created",
      });
    }

    console.log(`[PRINT] Sending to printer: ${PRINTER_NAME}`);

    try {
      await printPdfCopy(pdfPath, PRINTER_NAME);
      console.log(`[SUCCESS] Print sent to: ${PRINTER_NAME}`);
    } catch (printError) {
      console.error(`[PRINTER ERROR] ${PRINTER_NAME}`);
      console.error(`[ERROR MESSAGE]`, printError.message);
      console.error(`[ERROR CODE]`, printError.code);

      // Check if printer not found
      if (
        printError.message.includes("not found") ||
        printError.code === "ENOENT"
      ) {
        throw new Error(
          `Printer "${PRINTER_NAME}" not found. Check Windows Printers list.`,
        );
      }

      throw printError;
    }

    res.json({
      success: true,
      jobId: requestedJobId,
      message: "Printed successfully",
    });
  } catch (error) {
    console.error("\n[PRINT ENDPOINT ERROR]");
    console.error("[MESSAGE]", error.message);
    console.error("[STACK]", error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.message.includes("not found")
        ? `Printer "${PRINTER_NAME}" not available on this system`
        : error.message,
    });
  } finally {
    safeUnlink(pdfPath);
  }
});
/*
========================================
GLOBAL ERROR HANDLER
========================================
*/
app.use((err, req, res, next) => {
  console.error("\n[GLOBAL ERROR HANDLER]");
  console.error("[ERROR]", err.message);
  console.error("[STACK]", err.stack);

  res.status(500).json({
    success: false,
    error: err.message,
    type: "server_error",
  });
});

/*
========================================
START SERVER
========================================
*/
module.exports = app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==================================");
  console.log(`Print Server Running On ${PORT}`);
  console.log("\nMulti-Printer Configuration:");
  console.log(`  Main Thermal: ${PRINTERS_CONFIG.MAIN_THERMAL} (1 copies)`);
  console.log(`  LAN 1 (KOT):  ${PRINTERS_CONFIG.LAN_1} (1 copy)`);
  console.log(`  LAN 2 (KOT):  ${PRINTERS_CONFIG.LAN_2} (1 copy)`);
  console.log(
    `  Allow duplicate targets: ${ALLOW_DUPLICATE_PRINTER_TARGETS ? "yes" : "no"}`,
  );
  console.log("\nEndpoint: POST /print-multiple");
  console.log("==================================");
  console.log("");
});
