// /**
//  * Print API Service
//  * Handles communication with the local thermal print service
//  */

// const PRINT_SERVICE_URL = 'http://localhost:5000';

// /**
//  * Sends bill data to thermal printer service
//  * @param {object} bill - Bill object with: billNo, businessName, tokenNo, date, time, items, grandTotal
//  * @returns {Promise<{success: boolean, message: string, results: array}>}
//  */
// export async function sendToPrinter(bill) {
//   if (!bill) {
//     throw new Error('Bill data is required');
//   }

//   // Map bill structure to printer format
//   const printData = {
//     billNo: bill.billNo,
//     businessName: bill.businessName,
//     tokenNo: bill.tokenNo,
//     date: bill.date,
//     time: bill.time,
//     items: (bill.items || []).map(item => ({
//       name: item.name,
//       qty: item.qty,
//       price: item.price
//     })),
//     grandTotal: bill.grandTotal
//   };

//   try {
//     const response = await fetch(`${PRINT_SERVICE_URL}/print`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(printData)
//     });

//     if (!response.ok) {
//       throw new Error(`Print service error: ${response.statusText}`);
//     }

//     const result = await response.json();
//     return result;

//   } catch (error) {
//     throw new Error(
//       error.message.includes('Failed to fetch')
//         ? 'Print service not running. Start it with: node print-service/server.js'
//         : error.message
//     );
//   }
// }

// /**
//  * Tests printer connectivity
//  * @returns {Promise<{success: boolean, message: string}>}
//  */
// export async function testPrinter() {
//   try {
//     const response = await fetch(`${PRINT_SERVICE_URL}/test-print`, {
//       method: 'GET',
//       headers: {
//         'Content-Type': 'application/json'
//       }
//     });

//     if (!response.ok) {
//       throw new Error(`Test failed: ${response.statusText}`);
//     }

//     const result = await response.json();
//     return result;

//   } catch (error) {
//     throw new Error(
//       error.message.includes('Failed to fetch')
//         ? 'Print service not reachable at http://localhost:5000'
//         : error.message
//     );
//   }
// }

// /**
//  * Checks print service health
//  * @returns {Promise<{status: string, service: string}>}
//  */
// export async function checkPrintService() {
//   try {
//     const response = await fetch(`${PRINT_SERVICE_URL}/`, {
//       method: 'GET'
//     });

//     if (!response.ok) {
//       throw new Error('Print service not responding');
//     }

//     return await response.json();

//   } catch (error) {
//     throw new Error('Print service unreachable at http://localhost:5000');
//   }
// }


// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";
// import printJS from "print-js";

// export async function sendToPrinter(receiptElement) {
//   if (!receiptElement) {
//     throw new Error("Receipt element missing");
//   }

//   // Convert receipt HTML to image
//   const canvas = await html2canvas(receiptElement, {
//     scale: 3,
//     backgroundColor: "#ffffff",
//   });

//   const imgData = canvas.toDataURL("image/png");

//   // Thermal width
//   const pdf = new jsPDF({
//     orientation: "portrait",
//     unit: "mm",
//     format: [80, 200],
//   });

//   const pdfWidth = 80;
//   const pdfHeight =
//     (canvas.height * pdfWidth) / canvas.width;

//   pdf.addImage(
//     imgData,
//     "PNG",
//     0,
//     0,
//     pdfWidth,
//     pdfHeight
//   );

//   const blob = pdf.output("blob");

//   const blobUrl = URL.createObjectURL(blob);

//   printJS({
//     printable: blobUrl,
//     type: "pdf",
//     showModal: true,
//   });

//   return {
//     success: true,
//     message: "Print started",
//   };
// }

// const PRINT_SERVICE_URL = "http://localhost:5000";

// export async function sendToPrinter(bill) {
//   if (!bill) {
//     throw new Error("Bill data missing");
//   }

//   try {
//     const response = await fetch(
//       `${PRINT_SERVICE_URL}/print`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(bill),
//       }
//     );

//     const result = await response.json();

//     if (!response.ok) {
//       throw new Error(
//         result.error || "Print failed"
//       );
//     }

//     return result;

//   } catch (error) {
//     throw new Error(error.message);
//   }
// }

// export async function testPrinter() {
//   try {
//     const response = await fetch(
//       `${PRINT_SERVICE_URL}/test-print`
//     );

//     return await response.json();

//   } catch (error) {
//     throw new Error(error.message);
//   }
// }

// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";

// const PRINT_SERVICE_URL = "http://localhost:5000";

// export async function sendToPrinter(receiptElement) {
//   try {
//     // Capture receipt HTML
//     const canvas = await html2canvas(receiptElement, {
//       scale: 3,
//       useCORS: true,
//       backgroundColor: "#ffffff",
//     });

//     const imgData = canvas.toDataURL("image/png");

//     // Thermal receipt width
//     const pdf = new jsPDF({
//       orientation: "portrait",
//       unit: "mm",
//       format: [80, 250],
//     });

//     const pdfWidth = 80;
//     const pdfHeight =
//       (canvas.height * pdfWidth) / canvas.width;

//     pdf.addImage(
//       imgData,
//       "PNG",
//       0,
//       0,
//       pdfWidth,
//       pdfHeight
//     );

//     // Convert PDF to base64
//     const pdfBase64 = pdf.output("datauristring");

//     // Send to backend
//     const response = await fetch(
//       `${PRINT_SERVICE_URL}/print`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           pdf: pdfBase64,
//         }),
//       }
//     );

//     return await response.json();

//   } catch (error) {
//     throw new Error(error.message);
//   }
// }

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PRINT_SERVICE_URL = "http://localhost:5000";

export async function sendToPrinter(receiptElement) {
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

    // WAIT FOR CSS TO FULLY LOAD
    await new Promise((resolve) =>
      setTimeout(resolve, 1500)
    );

    // CAPTURE RECEIPT - SIMPLE AND RELIABLE
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      allowTaint: true,
    });

    console.log('[CANVAS CREATED]', {
      width: canvas.width,
      height: canvas.height,
    });

    const imgData = canvas.toDataURL("image/png");

    // CREATE PDF WITH AUTO HEIGHT
    const pdfWidth = 80;
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

    // SEND TO BACKEND
    const response = await fetch(
      `${PRINT_SERVICE_URL}/print`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdf: pdfBase64,
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
          errorMessage = errorData.details || errorData.error || errorMessage;
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