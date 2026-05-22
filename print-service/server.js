// // const express = require('express');
// // const cors = require('cors');
// // const {
// //   ThermalPrinter,
// //   PrinterTypes
// // } = require('node-thermal-printer');

// // const app = express();

// // app.use(cors());
// // app.use(express.json());

// // // ==========================
// // // PRINTER CONFIGURATION
// // // ==========================

// // const PRINTERS = {
// //   // POS_X: 'POS-X',                  // USB POS-X Thermal Printer (Windows printer name)
// //   POS_X: 'printer:Microsoft Print to PDF', // For testing on non-Windows environments (prints to PDF)
// //   KITCHEN_1: 'tcp://192.168.1.16:9100', // Kitchen Printer 1
// //   KITCHEN_2: 'tcp://192.168.1.87:9100'  // Kitchen Printer 2
// // };

// // const PRINTER_CONNECTION_TIMEOUT = 5000;

// // // ==========================
// // // PRINT RECEIPT FUNCTION
// // // ==========================

// // /**
// //  * Prints receipt to specified printer
// //  * @param {string} printerInterface - Printer interface/address
// //  * @param {object} billData - Bill data with structure: { billNo, businessName, items: [{name, qty, price}], grandTotal }
// //  * @param {string} copyType - Type of copy (e.g., "CUSTOMER COPY", "FRONTDESK COPY", "KITCHEN COPY")
// //  * @returns {Promise<{success: boolean, message: string, printerInterface: string}>}
// //  */
// // async function printReceipt(printerInterface, billData, copyType) {
// //   try {
// //     const printer = new ThermalPrinter({
// //       type: PrinterTypes.EPSON,
// //       interface: printerInterface,
// //       options: {
// //         timeout: PRINTER_CONNECTION_TIMEOUT
// //       }
// //     });

// //     const isConnected = await printer.isPrinterConnected();
    
// //     if (!isConnected) {
// //       const msg = `Printer not connected: ${printerInterface}`;
// //       console.warn(`[PRINT WARNING] ${msg}`);
// //       return {
// //         success: false,
// //         message: msg,
// //         printerInterface
// //       };
// //     }

// //     // Format receipt
// //     printer.alignCenter();
// //     printer.setTextDoubleHeight();
// //     printer.bold(true);
// //     printer.println(billData.businessName || 'RESTAURANT');
    
// //     printer.setTextNormal();
// //     printer.bold(false);
// //     printer.println(copyType);
// //     printer.drawLine();

// //     // Bill details
// //     printer.alignLeft();
// //     printer.println(`Bill No: ${billData.billNo}`);
// //     if (billData.tokenNo) {
// //       printer.println(`Token: ${billData.tokenNo}`);
// //     }
// //     if (billData.date) {
// //       printer.println(`Date: ${billData.date}`);
// //     }
// //     if (billData.time) {
// //       printer.println(`Time: ${billData.time}`);
// //     }

// //     printer.drawLine();

// //     // Items
// //     if (Array.isArray(billData.items) && billData.items.length > 0) {
// //       billData.items.forEach((item) => {
// //         const lineTotal = (Number(item.qty || 0) * Number(item.price || 0)).toFixed(2);
// //         printer.leftRight(
// //           `${item.name} x${item.qty}`,
// //           `₹${Number(item.price || 0).toFixed(2)}`
// //         );
// //       });
// //       printer.drawLine();
// //     }

// //     // Total
// //     printer.bold(true);
// //     printer.alignRight();
// //     printer.println(`Total: ₹${Number(billData.grandTotal || 0).toFixed(2)}`);
// //     printer.bold(false);

// //     printer.alignCenter();
// //     printer.println('');
// //     printer.println('Thank You! Visit Again');
// //     printer.drawLine();

// //     // Execute print
// //     await printer.execute();

// //     const msg = `Printed successfully: ${copyType}`;
// //     console.log(`[PRINT SUCCESS] ${msg} on ${printerInterface}`);
    
// //     return {
// //       success: true,
// //       message: msg,
// //       printerInterface
// //     };

// //   } catch (error) {
// //     const msg = `Print error: ${error.message}`;
// //     console.error(`[PRINT ERROR] ${msg} on ${printerInterface}`);
    
// //     return {
// //       success: false,
// //       message: msg,
// //       printerInterface,
// //       error: error.message
// //     };
// //   }
// // }

 

// // // ==========================

// // // API ENDPOINTS

// // // ==========================

// // /**
// //  * Health check endpoint
// //  */
// // app.get('/', (req, res) => {
// //   res.json({
// //     status: 'ok',
// //     service: 'Thermal Print Service',
// //     version: '1.0.0',
// //     port: 5000
// //   });
// // });

// // /**
// //  * Main print endpoint
// //  * Expected POST body:
// //  * {
// //  *   billNo, businessName, tokenNo, date, time,
// //  *   items: [{name, qty, price}],
// //  *   grandTotal
// //  * }
// //  */
// // // app.post('/print', async (req, res) => {
// // //   try {
// // //     const billData = req.body;

// // //     // Validate required fields
// // //     if (!billData || typeof billData !== 'object') {
// // //       return res.status(400).json({
// // //         success: false,
// // //         message: 'Invalid bill data'
// // //       });
// // //     }

// // //     const printResults = [];

// // //     // STEP 1: Print CUSTOMER COPY on POS-X
// // //     const customerCopyResult = await printReceipt(
// // //       PRINTERS.POS_X,
// // //       billData,
// // //       'CUSTOMER COPY'
// // //     );
// // //     printResults.push(customerCopyResult);

// // //     // STEP 2: Print FRONTDESK COPY on POS-X
// // //     const frontdeskCopyResult = await printReceipt(
// // //       PRINTERS.POS_X,
// // //       billData,
// // //       'FRONTDESK COPY'
// // //     );
// // //     printResults.push(frontdeskCopyResult);

// // //     // STEP 3: Print KITCHEN COPY on KITCHEN PRINTER 1
// // //     const kitchen1Result = await printReceipt(
// // //       PRINTERS.KITCHEN_1,
// // //       billData,
// // //       'KITCHEN COPY'
// // //     );
// // //     printResults.push(kitchen1Result);

// // //     // STEP 4: Print KITCHEN COPY on KITCHEN PRINTER 2
// // //     const kitchen2Result = await printReceipt(
// // //       PRINTERS.KITCHEN_2,
// // //       billData,
// // //       'KITCHEN COPY'
// // //     );
// // //     printResults.push(kitchen2Result);

// // //     // Check if any prints succeeded
// // //     const anySuccess = printResults.some(r => r.success);

// // //     res.json({
// // //       success: anySuccess,
// // //       message: anySuccess ? 'Print jobs processed' : 'All print jobs failed',
// // //       results: printResults,
// // //       billNo: billData.billNo
// // //     });

// // //   } catch (error) {
// // //     console.error('[API ERROR]', error.message);
// // //     res.status(500).json({
// // //       success: false,
// // //       message: 'Print service error',
// // //       error: error.message
// // //     });
// // //   }
// // // });

// // /**
// //  * Test print endpoint (for debugging)
// //  */
// // app.get('/test-print', async (req, res) => {
// //   try {
// //     const testData = {
// //       billNo: 'TEST-001',
// //       businessName: 'BALAJI FOOD ARTS',
// //       tokenNo: 1,
// //       date: new Date().toLocaleDateString(),
// //       time: new Date().toLocaleTimeString(),
// //       items: [
// //         {
// //           name: 'Paneer Butter Masala',
// //           qty: 1,
// //           price: 250
// //         },
// //         {
// //           name: 'Naan',
// //           qty: 2,
// //           price: 50
// //         }
// //       ],
// //       grandTotal: 350
// //     };

// //     const result = await printReceipt(
// //       PRINTERS.POS_X,
// //       testData,
// //       'TEST COPY'
// //     );

// //     res.json({
// //       success: result.success,
// //       message: result.message,
// //       result
// //     });

// //   } catch (error) {
// //     console.error('[TEST ERROR]', error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: 'Test print failed',
// //       error: error.message
// //     });
// //   }
// // });

// // // ==========================
// // // START SERVER
// // // ==========================

// // const PORT = process.env.PORT || 5000;

// // app.listen(PORT, () => {
// //   console.log(`\n╔════════════════════════════════════════════════════╗`);
// //   console.log(`║  🖨️  Thermal Print Service Running                 ║`);
// //   console.log(`║  📍 http://localhost:${PORT}                           ║`);
// //   console.log(`║  📋 POST /print    - Print bill to all printers     ║`);
// //   console.log(`║  🧪 GET  /test-print - Test print on POS-X         ║`);
// //   console.log(`║  💚 GET  /          - Health check                  ║`);
// //   console.log(`╚════════════════════════════════════════════════════╝\n`);
// // });

// // // Graceful shutdown
// // process.on('SIGTERM', () => {
// //   console.log('\n[SHUTDOWN] Received SIGTERM signal');
// //   process.exit(0);
// // });

// // process.on('SIGINT', () => {
// //   console.log('\n[SHUTDOWN] Received SIGINT signal');
// //   process.exit(0);
// // });




// const express = require('express');
// const cors = require('cors');
// const {
//   ThermalPrinter,
//   PrinterTypes
// } = require('node-thermal-printer');

// const app = express();

// app.use(cors());
// app.use(express.json());

// // ==========================
// // PRINTER CONFIGURATION
// // ==========================

// const PRINTERS = {
//   // Testing Printer
//   POS_X: 'printer:Microsoft Print to PDF',

//   // REAL PRINTER (UNCOMMENT IN SHOP)
//   // POS_X: 'printer:TVS RP 3160 Gold',
// };

// const PRINTER_CONNECTION_TIMEOUT = 5000;

// // ==========================
// // PRINT RECEIPT FUNCTION
// // ==========================

// async function printReceipt(printerInterface, billData, copyType) {
//   try {

//     console.log('\n=================================');
//     console.log('STARTING PRINT');
//     console.log('Printer:', printerInterface);
//     console.log('Copy:', copyType);
//     console.log('=================================\n');

//     const printer = new ThermalPrinter({
//       type: PrinterTypes.EPSON,
//       interface: printerInterface,
//       options: {
//         timeout: PRINTER_CONNECTION_TIMEOUT
//       }
//     });

//     // ==========================
//     // RECEIPT DESIGN
//     // ==========================

//     printer.clear();

//     printer.alignCenter();
//     printer.bold(true);
//     printer.setTextDoubleHeight();
//     printer.println(billData.businessName || 'RESTAURANT');

//     printer.setTextNormal();
//     printer.bold(false);

//     printer.println(copyType);
//     printer.drawLine();

//     printer.alignLeft();

//     printer.println(`Bill No : ${billData.billNo}`);

//     if (billData.tokenNo) {
//       printer.println(`Token   : ${billData.tokenNo}`);
//     }

//     if (billData.date) {
//       printer.println(`Date    : ${billData.date}`);
//     }

//     if (billData.time) {
//       printer.println(`Time    : ${billData.time}`);
//     }

//     printer.drawLine();

//     // ==========================
//     // ITEMS
//     // ==========================

//     if (Array.isArray(billData.items)) {

//       billData.items.forEach((item) => {

//         const qty = Number(item.qty || 0);
//         const price = Number(item.price || 0);

//         printer.leftRight(
//           `${item.name} x${qty}`,
//           `Rs ${price.toFixed(2)}`
//         );
//       });

//       printer.drawLine();
//     }

//     // ==========================
//     // TOTAL
//     // ==========================

//     printer.bold(true);
//     printer.alignRight();

//     printer.println(
//       `TOTAL : Rs ${Number(
//         billData.grandTotal || 0
//       ).toFixed(2)}`
//     );

//     printer.bold(false);

//     printer.alignCenter();

//     printer.println('');
//     printer.println('Thank You Visit Again');
//     printer.println('');

//     printer.cut();

//     // ==========================
//     // EXECUTE PRINT
//     // ==========================

//     await printer.execute();

//     console.log('\n✅ PRINT SUCCESS\n');

//     return {
//       success: true,
//       message: `Printed successfully : ${copyType}`,
//       printerInterface
//     };

//   } catch (error) {

//     console.error('\n❌ PRINT ERROR');
//     console.error(error);
//     console.error(error.message);
//     console.error(error.stack);

//     return {
//       success: false,
//       message: error.message,
//       printerInterface,
//       error: error.message
//     };
//   }
// }

// // ==========================
// // HEALTH CHECK
// // ==========================

// app.get('/', (req, res) => {

//   res.json({
//     status: 'ok',
//     service: 'Thermal Print Service',
//     version: '1.0.0',
//     port: 5000
//   });

// });

// // ==========================
// // MAIN PRINT API
// // ==========================

// app.post('/print', async (req, res) => {

//   try {

//     const billData = req.body;

//     if (!billData || typeof billData !== 'object') {

//       return res.status(400).json({
//         success: false,
//         message: 'Invalid bill data'
//       });
//     }

//     const printResults = [];

//     // CUSTOMER COPY

//     const customerCopy = await printReceipt(
//       PRINTERS.POS_X,
//       billData,
//       'CUSTOMER COPY'
//     );

//     printResults.push(customerCopy);

//     // FRONTDESK COPY

//     const frontdeskCopy = await printReceipt(
//       PRINTERS.POS_X,
//       billData,
//       'FRONTDESK COPY'
//     );

//     printResults.push(frontdeskCopy);

//     // SUCCESS CHECK

//     const anySuccess = printResults.some(
//       result => result.success
//     );

//     res.json({
//       success: anySuccess,
//       message: anySuccess
//         ? 'Print jobs processed successfully'
//         : 'All print jobs failed',
//       results: printResults,
//       billNo: billData.billNo
//     });

//   } catch (error) {

//     console.error('\n❌ API ERROR');
//     console.error(error);

//     res.status(500).json({
//       success: false,
//       message: 'Print service error',
//       error: error.message
//     });
//   }
// });

// // ==========================
// // TEST PRINT API
// // ==========================

// app.get('/test-print', async (req, res) => {

//   try {

//     const testData = {
//       billNo: 'TEST-001',
//       businessName: 'BALAJI FOOD ARTS',
//       tokenNo: 1,
//       date: new Date().toLocaleDateString(),
//       time: new Date().toLocaleTimeString(),

//       items: [
//         {
//           name: 'Paneer Butter Masala',
//           qty: 1,
//           price: 250
//         },
//         {
//           name: 'Butter Naan',
//           qty: 2,
//           price: 50
//         }
//       ],

//       grandTotal: 350
//     };

//     const result = await printReceipt(
//       PRINTERS.POS_X,
//       testData,
//       'TEST COPY'
//     );

//     res.json({
//       success: result.success,
//       message: result.message,
//       result
//     });

//   } catch (error) {

//     console.error('\n❌ TEST PRINT ERROR');
//     console.error(error);

//     res.status(500).json({
//       success: false,
//       message: 'Test print failed',
//       error: error.message
//     });
//   }
// });

// // ==========================
// // START SERVER
// // ==========================

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {

//   console.log(`
// ╔══════════════════════════════════════════════╗
// ║   THERMAL PRINT SERVICE RUNNING             ║
// ║                                              ║
// ║   URL  : http://localhost:${PORT}             ║
// ║                                              ║
// ║   GET  /            -> Health Check          ║
// ║   POST /print       -> Print Bill            ║
// ║   GET  /test-print  -> Test Printer          ║
// ╚══════════════════════════════════════════════╝
// `);

// });

// // ==========================
// // GRACEFUL SHUTDOWN
// // ==========================

// process.on('SIGTERM', () => {

//   console.log('\nShutting down server...');
//   process.exit(0);

// });

// process.on('SIGINT', () => {

//   console.log('\nShutting down server...');
//   process.exit(0);

// });


// const express = require("express");
// const cors = require("cors");
// const fs = require("fs");
// const path = require("path");
// const PDFDocument = require("pdfkit");
// const { print } = require("pdf-to-printer");

// const app = express();

// app.use(cors());
// app.use(express.json());

// const PORT = 5000;

// const PRINTER_NAME = "CutePDF Writer";

// async function generateReceiptPDF(billData, filePath) {
//   return new Promise((resolve) => {
//     const doc = new PDFDocument({
//       margin: 10,
//       size: [220, 600],
//     });

//     const stream = fs.createWriteStream(filePath);

//     doc.pipe(stream);

//     doc.fontSize(16).text(
//       billData.businessName || "RESTAURANT",
//       { align: "center" }
//     );

//     doc.moveDown();

//     doc.fontSize(10).text("CUSTOMER COPY", {
//       align: "center",
//     });

//     doc.moveDown();

//     doc.text(`Bill No: ${billData.billNo}`);
//     doc.text(`Token: ${billData.tokenNo || ""}`);
//     doc.text(`Date: ${billData.date || ""}`);
//     doc.text(`Time: ${billData.time || ""}`);

//     doc.moveDown();

//     (billData.items || []).forEach((item) => {
//       doc.text(
//         `${item.name} x${item.qty} - Rs.${item.price}`
//       );
//     });

//     doc.moveDown();

//     doc.fontSize(12).text(
//       `Total: Rs.${billData.grandTotal}`,
//       {
//         align: "right",
//       }
//     );

//     doc.moveDown();

//     doc.text("Thank You Visit Again", {
//       align: "center",
//     });

//     doc.end();

//     stream.on("finish", resolve);
//   });
// }

// async function printReceipt(billData) {
//   const pdfPath = path.join(__dirname, "receipt.pdf");

//   await generateReceiptPDF(billData, pdfPath);

//   await print(pdfPath, {
//     printer: PRINTER_NAME,
//   });

//   return {
//     success: true,
//     message: "Printed successfully",
//   };
// }

// app.get("/", (req, res) => {
//   res.json({
//     status: "ok",
//   });
// });

// app.get("/test-print", async (req, res) => {
//   try {
//     const result = await printReceipt({
//       billNo: "TEST001",
//       businessName: "BALAJI FOOD ARTS",
//       tokenNo: 1,
//       date: new Date().toLocaleDateString(),
//       time: new Date().toLocaleTimeString(),
//       items: [
//         {
//           name: "Burger",
//           qty: 1,
//           price: 120,
//         },
//       ],
//       grandTotal: 120,
//     });

//     res.json(result);
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// app.post("/print", async (req, res) => {
//   try {
//     const result = await printReceipt(req.body);

//     res.json(result);
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Print server running on ${PORT}`);
// });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { print } = require("pdf-to-printer");

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  if (req.path === '/print' && req.method === 'POST') {
    console.log('\n[REQUEST] POST /print');
    console.log('[BODY SIZE]', req.body.pdf ? (req.body.pdf.length / 1024 / 1024).toFixed(2) + 'MB' : 'no PDF');
  }
  next();
});

const PORT = 5000;

/*
========================================
CHANGE THIS LATER AT OWNER SHOP
========================================

FOR TESTING (available on all Windows):
"Microsoft Print to PDF"

FOR REAL THERMAL PRINTER:
"RP3160"
or exact printer name from Windows
*/
const PRINTER_NAME = "CutePDF Writer";

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
    doc
      .fontSize(15)
      .text(billData.businessName || "RESTAURANT", {
        align: "center",
      });

    doc
      .fontSize(9)
      .text("CUSTOMER COPY", {
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

      doc.text(
        `${qty} x ${price}                     ${total}`,
        {
          align: "right",
        }
      );

      doc.moveDown(0.3);
    });

    // ===== LINE =====
    doc.text("--------------------------------");

    // ===== TOTAL =====
    doc.moveDown(0.3);

    doc
      .fontSize(12)
      .text(`TOTAL : Rs. ${billData.grandTotal}`, {
        align: "right",
      });

    doc.moveDown();

    // ===== FOOTER =====
    doc
      .fontSize(10)
      .text("Thank You Visit Again", {
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
  const pdfPath = path.join(__dirname, "receipt.pdf");

  // Generate PDF
  await generateReceiptPDF(billData, pdfPath);

  // Print silently
  await print(pdfPath, {
    printer: PRINTER_NAME,
    silent: true,
  });

  return {
    success: true,
    message: "Printed successfully",
  };
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
  });
});

/*
========================================
TEST PRINT
========================================
*/

app.get("/test-print", async (req, res) => {
  try {
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
app.get("/diagnose", (req, res) => {
  res.json({
    status: "ok",
    printer_name: PRINTER_NAME,
    platform: process.platform,
    node_version: process.version,
    help: "If printing fails, check if printer name matches Windows Printers list",
  });
});

/*
========================================
MAIN PRINT API
========================================
*/

// app.post("/print", async (req, res) => {
//   try {
//     const billData = req.body;

//     const result = await printReceipt(billData);

//     res.json(result);

//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });
app.post("/print", async (req, res) => {
  try {
    const { pdf } = req.body;

    if (!pdf) {
      return res.status(400).json({
        success: false,
        error: "PDF missing",
      });
    }

    // Extract base64 from data URI
    let base64Data = pdf;
    
    // Handle multiple possible formats
    if (pdf.includes(",")) {
      base64Data = pdf.split(",")[1] || pdf;
    }
    
    // Validate base64 format
    if (!base64Data || base64Data.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid PDF data - empty after removing header",
      });
    }

    // Validate it looks like base64
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data.trim())) {
      return res.status(400).json({
        success: false,
        error: "Invalid base64 format",
      });
    }

    const pdfPath = path.join(
      __dirname,
      "receipt.pdf"
    );

    // Write file with error checking
    try {
      fs.writeFileSync(
        pdfPath,
        base64Data.trim(),
        "base64"
      );
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
      await print(pdfPath, {
        printer: PRINTER_NAME,
        silent: true,
      });
      console.log(`[SUCCESS] Print sent to: ${PRINTER_NAME}`);
    } catch (printError) {
      console.error(`[PRINTER ERROR] ${PRINTER_NAME}`);
      console.error(`[ERROR MESSAGE]`, printError.message);
      console.error(`[ERROR CODE]`, printError.code);
      
      // Check if printer not found
      if (printError.message.includes("not found") || printError.code === "ENOENT") {
        throw new Error(`Printer "${PRINTER_NAME}" not found. Check Windows Printers list.`);
      }
      
      throw printError;
    }

    res.json({
      success: true,
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

app.listen(PORT, () => {
  console.log("");
  console.log("==================================");
  console.log(`Print Server Running On ${PORT}`);
  console.log(`Printer: ${PRINTER_NAME}`);
  console.log("==================================");
  console.log("");
});