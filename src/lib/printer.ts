import { Order, BranchPrinterConfig } from "./types";

// Mutex to prevent duplicate print jobs from double-clicks or React re-renders
const activePrintJobs = new Set<string>();

export interface PrintSettings {
  cafeName?: string;
  phone?: string;
  address?: string;
  branchName?: string;
  branchCode?: string;
  counterNumber?: string;
  counterName?: string;
  gstNumber?: string;
  footerText?: string;
  paperWidth?: "58mm" | "80mm";
}

export interface PrintResult {
  success: boolean;
  message?: string;
}

/**
 * Generates and prints an F2C-compatible thermal receipt
 */
export async function printThermalReceipt(
  order: Order,
  settings: PrintSettings = {}
): Promise<PrintResult> {
  const orderId = order.id || order.orderNumber;

  // 1. Anti-duplicate guard: If this order is already printing, reject duplicate request
  if (activePrintJobs.has(orderId)) {
    return {
      success: false,
      message: "Print job already in progress. Please wait.",
    };
  }

  activePrintJobs.add(orderId);

  try {
    const cafeName = settings.cafeName || "EL PRESTO PIZZA";
    const phone = settings.phone || "+91 6392512314";
    const address =
      settings.address || "United College of Engineering & Research, Naini, Prayagraj";

    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt || Date.now());
    const dateStr = orderDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = orderDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const orderTypeLabel = (order.type || order.orderType || "takeaway").toUpperCase();
    const isDelivery = orderTypeLabel === "DELIVERY";

    const itemsRows = (order.items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 3px 0; font-weight: bold; width: 60%; word-break: break-word;">
            ${item.quantity}x ${item.name}
          </td>
          <td style="padding: 3px 0; text-align: right; width: 40%; font-family: monospace;">
            ₹${((item.price || 0) * item.quantity).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join("");

    const subtotal =
      order.subtotal ||
      order.items?.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0) ||
      0;
    const discount = order.discount || 0;
    const deliveryFee = order.deliveryFee || 0;
    const grandTotal = order.total || Math.max(0, subtotal + deliveryFee - discount);

    const paymentLabel =
      order.paymentMethod === "online"
        ? `ONLINE (${(order.paymentStatus || "paid").toUpperCase()})`
        : `CASH (${(order.paymentStatus || "pending").toUpperCase()})`;

    // F2C Thermal Printer 58mm compact layout
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${order.orderNumber}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: 58mm auto;
            margin: 0mm;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11.5px;
            line-height: 1.35;
            width: 58mm;
            max-width: 58mm;
            margin: 0 auto;
            padding: 4px 6px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .double-dashed { border-top: 2px dashed #000; margin: 4px 0; }
          .header h1 { font-size: 15px; font-weight: 900; letter-spacing: -0.5px; }
          .header p { font-size: 9.5px; margin-top: 1px; }
          .badge-type {
            display: inline-block;
            border: 1px solid #000;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 900;
            margin: 3px 0;
            text-transform: uppercase;
          }
          .info-row { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10.5px; }
          .total-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin: 3px 0; }
          .sub-row { display: flex; justify-content: space-between; font-size: 10.5px; margin: 1px 0; }
          .footer { text-align: center; font-size: 9px; margin-top: 6px; }
          .note-box { border: 1px solid #000; padding: 3px; font-size: 9.5px; margin: 3px 0; }
          @media print {
            body { width: 58mm; padding: 2px 4px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- STORE HEADER -->
        <div class="header center">
          <h1>🍕 ${cafeName}</h1>
          ${settings.branchName ? `<p class="bold" style="font-size: 11px; margin-top: 1px;">${settings.branchName}</p>` : ""}
          <p>${address}</p>
          <p>Phone: ${phone}</p>
          ${settings.gstNumber ? `<p style="font-size: 8.5px; margin-top: 1px;">GSTIN: ${settings.gstNumber}</p>` : ""}
        </div>

        <div class="dashed"></div>

        <!-- ORDER NUMBER & TYPE -->
        <div class="center">
          <div style="font-size: 17px; font-weight: 900; letter-spacing: 0.5px;">
            ${order.orderNumber}
          </div>
          <div class="badge-type">
            ${isDelivery ? "🛵 HOME DELIVERY" : orderTypeLabel === "COUNTER" ? "🏪 COUNTER / DINE-IN" : "🛍️ TAKE AWAY"}
          </div>
        </div>

        <div class="dashed"></div>

        <!-- ORDER META -->
        <div class="info-row">
          <span>Date: ${dateStr}</span>
          <span>Time: ${timeStr}</span>
        </div>
        ${
          settings.counterNumber || settings.counterName || order.counterId
            ? `<div class="info-row"><span>Register:</span><span class="bold">${settings.counterName || settings.counterNumber || order.counterId}</span></div>`
            : ""
        }
        ${
          order.customerName
            ? `<div class="info-row"><span>Customer:</span><span class="bold">${order.customerName}</span></div>`
            : ""
        }
        ${
          order.phone && order.phone !== "Counter"
            ? `<div class="info-row"><span>Phone:</span><span>${order.phone}</span></div>`
            : ""
        }
        ${
          order.tableNumber
            ? `<div class="info-row"><span>Table/Token:</span><span class="bold">${order.tableNumber}</span></div>`
            : ""
        }

        ${
          isDelivery && order.deliveryAddress?.fullAddress
            ? `<div class="note-box"><strong>Deliver to:</strong> ${order.deliveryAddress.fullAddress}</div>`
            : ""
        }

        <div class="double-dashed"></div>

        <!-- ITEMS TABLE -->
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9.5px;">
              <th style="text-align: left; padding-bottom: 2px;">ITEM</th>
              <th style="text-align: right; padding-bottom: 2px;">AMT (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="dashed"></div>

        <!-- BILLING TOTALS -->
        <div class="sub-row">
          <span>Subtotal:</span>
          <span>₹${subtotal.toFixed(2)}</span>
        </div>
        ${
          discount > 0
            ? `<div class="sub-row"><span>Discount:</span><span>-₹${discount.toFixed(2)}</span></div>`
            : ""
        }
        ${
          deliveryFee > 0
            ? `<div class="sub-row"><span>Delivery Fee:</span><span>+₹${deliveryFee.toFixed(2)}</span></div>`
            : ""
        }

        <div class="dashed"></div>

        <div class="total-row">
          <span>GRAND TOTAL:</span>
          <span>₹${grandTotal.toFixed(2)}</span>
        </div>

        <div class="dashed"></div>

        <!-- PAYMENT INFO -->
        <div class="info-row">
          <span>Payment Mode:</span>
          <span class="bold">${paymentLabel}</span>
        </div>

        ${
          order.instructions
            ? `<div class="note-box"><strong>Instructions:</strong> ${order.instructions}</div>`
            : ""
        }

        <div class="dashed"></div>

        <!-- FOOTER -->
        <div class="footer">
          <p class="bold">*** THANK YOU! VISIT AGAIN ***</p>
          <p style="margin-top: 2px;">F2C Mobile POS Print • Powered by El Presto</p>
        </div>
      </body>
      </html>
    `;

    // Open print popup
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      return {
        success: false,
        message: "Popup blocked. Please allow popups for printing.",
      };
    }

    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();

    // Trigger print once rendered
    return new Promise((resolve) => {
      const handlePrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
          resolve({ success: true, message: "Receipt sent to printer!" });
        } catch (err: any) {
          resolve({
            success: false,
            message: "Printer error: " + (err.message || "Failed to trigger print"),
          });
        }
      };

      if (printWindow.document.readyState === "complete") {
        setTimeout(handlePrint, 250);
      } else {
        printWindow.onload = () => setTimeout(handlePrint, 250);
      }
    });
  } catch (error: any) {
    return {
      success: false,
      message: "Print failed: " + (error.message || "Unknown error"),
    };
  } finally {
    // Release the print lock after 2 seconds to allow retry if needed
    setTimeout(() => {
      activePrintJobs.delete(orderId);
    }, 2000);
  }
}

/**
 * Generates and prints an F2C-compatible Kitchen Order Ticket (KOT)
 */
export async function printThermalKOT(
  order: Order,
  settings: PrintSettings = {}
): Promise<PrintResult> {
  const orderId = (order.id || order.orderNumber) + "-kot";

  if (activePrintJobs.has(orderId)) {
    return { success: false, message: "KOT printing already in progress." };
  }

  activePrintJobs.add(orderId);

  try {
    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt || Date.now());
    const timeStr = orderDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const itemsRows = (order.items || [])
      .map(
        (item) => `
        <tr>
          <td style="font-size: 14px; font-weight: 900; padding: 4px 0;">
            ${item.quantity}x ${item.name}
          </td>
        </tr>
      `
      )
      .join("");

    const kotHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KOT - ${order.orderNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page { size: 58mm auto; margin: 0mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            width: 58mm;
            margin: 0 auto;
            padding: 4px 6px;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .dashed { border-top: 1px dashed #000; margin: 4px 0; }
          .double-dashed { border-top: 2px dashed #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          .note { border: 1px solid #000; padding: 4px; font-weight: bold; margin: 4px 0; font-size: 11px; }
          @media print { body { width: 58mm; padding: 2px; } }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="font-size: 16px; font-weight: 900;">*** KITCHEN TICKET ***</h2>
          <p style="font-size: 11px;">${settings.branchName || "EL PRESTO"} KDS</p>
        </div>
        <div class="dashed"></div>
        <div style="font-size: 18px; font-weight: 900; text-align: center;">
          ${order.orderNumber}
        </div>
        <div class="center" style="font-size: 11px; font-weight: bold; margin-top: 2px;">
          TYPE: ${(order.type || order.orderType || "takeaway").toUpperCase()}
        </div>
        <div class="dashed"></div>
        <div style="font-size: 10.5px; display: flex; justify-content: space-between;">
          <span>Time: ${timeStr}</span>
          <span>Source: ${(order.source || "POS").toUpperCase()}</span>
        </div>
        ${order.customerName ? `<div style="font-size: 10.5px;">Customer: <strong>${order.customerName}</strong></div>` : ""}
        <div class="double-dashed"></div>
        <table>
          <tbody>${itemsRows}</tbody>
        </table>
        ${
          order.instructions
            ? `<div class="note">NOTE: ${order.instructions}</div>`
            : ""
        }
        ${
          order.kitchenNotes
            ? `<div class="note">KITCHEN: ${order.kitchenNotes}</div>`
            : ""
        }
        <div class="dashed"></div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=380,height=500");
    if (!printWindow) {
      return { success: false, message: "Popup blocked. Please allow popups." };
    }

    printWindow.document.open();
    printWindow.document.write(kotHtml);
    printWindow.document.close();

    return new Promise((resolve) => {
      const handlePrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
          resolve({ success: true, message: "KOT printed!" });
        } catch (err: any) {
          resolve({ success: false, message: "Print error: " + err.message });
        }
      };

      if (printWindow.document.readyState === "complete") {
        setTimeout(handlePrint, 250);
      } else {
        printWindow.onload = () => setTimeout(handlePrint, 250);
      }
    });
  } catch (err: any) {
    return { success: false, message: "KOT print failed: " + err.message };
  } finally {
    setTimeout(() => activePrintJobs.delete(orderId), 2000);
  }
}

export const printKOT = printThermalKOT;

