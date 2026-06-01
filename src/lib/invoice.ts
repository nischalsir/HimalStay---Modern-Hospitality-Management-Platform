import jsPDF from "jspdf";

export interface InvoiceData {
  invoiceNumber: string;
  bookingId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  issuedAt: string | Date;
  hotel: { name: string; city: string; country: string; address?: string | null };
  room: { name: string; room_type: string };
  guest: { name: string; email: string; phone?: string | null };
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  subtotal: number; // USD
  service: number;
  tax: number;
  total: number;
  nprRate: number; // NPR per USD at time of invoice
  transactionId?: string | null;
}

const npr = (usd: number, rate: number) =>
  "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(usd * rate));
const usd = (v: number) => "$" + v.toFixed(2);

/** Build a printable A4 invoice PDF. Returns the jsPDF doc. */
export function buildInvoice(d: InvoiceData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Brand band
  doc.setFillColor(11, 23, 51);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(201, 168, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("HimalStay", M, 50);
  doc.setTextColor(230, 230, 235);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Curated stays across Nepal", M, 68);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", W - M, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(d.invoiceNumber, W - M, 68, { align: "right" });

  y = 120;
  doc.setTextColor(20, 20, 25);

  // Meta block
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 120);
  doc.text("Issued", M, y);
  doc.text("Booking ID", M + 160, y);
  doc.text("Status", M + 320, y);
  doc.text("Payment", W - M, y, { align: "right" });
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.text(new Date(d.issuedAt).toLocaleDateString(), M, y + 14);
  doc.text(d.bookingId.slice(0, 8).toUpperCase(), M + 160, y + 14);
  doc.text(d.status.toUpperCase(), M + 320, y + 14);
  doc.text(d.paymentStatus.toUpperCase(), W - M, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");

  y += 44;
  doc.setDrawColor(220, 220, 225);
  doc.line(M, y, W - M, y);
  y += 18;

  // Parties
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("BILLED TO", M, y);
  doc.text("PROPERTY", W / 2, y);
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.text(d.guest.name, M, y + 16);
  doc.text(d.hotel.name, W / 2, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(d.guest.email, M, y + 30);
  if (d.guest.phone) doc.text(d.guest.phone, M, y + 42);
  doc.text(`${d.hotel.city}, ${d.hotel.country}`, W / 2, y + 30);
  if (d.hotel.address) doc.text(d.hotel.address, W / 2, y + 42);

  y += 70;
  doc.line(M, y, W - M, y);
  y += 18;

  // Stay details
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("Room", M, y);
  doc.text("Check-in", M + 230, y);
  doc.text("Check-out", M + 330, y);
  doc.text("Nights", M + 430, y);
  doc.text("Guests", W - M, y, { align: "right" });
  doc.setTextColor(20, 20, 25);
  doc.text(`${d.room.name} (${d.room.room_type})`, M, y + 14);
  doc.text(d.checkIn, M + 230, y + 14);
  doc.text(d.checkOut, M + 330, y + 14);
  doc.text(String(d.nights), M + 430, y + 14);
  doc.text(String(d.guests), W - M, y + 14, { align: "right" });

  y += 40;
  doc.line(M, y, W - M, y);
  y += 22;

  // Charges table
  const rows: Array<[string, number]> = [
    [`Room charge (${d.nights} night${d.nights > 1 ? "s" : ""})`, d.subtotal],
    ["Service charge (10%)", d.service],
    ["VAT (13%)", d.tax],
  ];
  doc.setFontSize(11);
  for (const [label, amount] of rows) {
    doc.setTextColor(60, 60, 70);
    doc.text(label, M, y);
    doc.setTextColor(20, 20, 25);
    doc.text(`${npr(amount, d.nprRate)}  (${usd(amount)})`, W - M, y, { align: "right" });
    y += 20;
  }
  y += 6;
  doc.setDrawColor(11, 23, 51);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(11, 23, 51);
  doc.text("Total amount", M, y);
  doc.setTextColor(201, 168, 76);
  doc.text(`${npr(d.total, d.nprRate)}  (${usd(d.total)})`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.5);

  y += 36;

  // Payment block
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("PAYMENT METHOD", M, y);
  doc.text("PAYMENT STATUS", W / 2, y);
  doc.setTextColor(20, 20, 25);
  doc.text((d.paymentMethod || "—").replace(/_/g, " ").toUpperCase(), M, y + 14);
  doc.text(d.paymentStatus.toUpperCase(), W / 2, y + 14);
  if (d.transactionId) {
    y += 30;
    doc.setTextColor(110, 110, 120);
    doc.text("TRANSACTION ID", M, y);
    doc.setTextColor(20, 20, 25);
    doc.text(d.transactionId, M, y + 14);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 150);
  doc.text(
    "Thank you for choosing HimalStay. Show this invoice at check-in. For support: support@himalstay.np",
    W / 2,
    doc.internal.pageSize.getHeight() - 30,
    { align: "center" }
  );

  return doc;
}

export function downloadInvoice(d: InvoiceData) {
  const doc = buildInvoice(d);
  doc.save(`${d.invoiceNumber || d.bookingId.slice(0, 8)}.pdf`);
}

export function printInvoice(d: InvoiceData) {
  const doc = buildInvoice(d);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}
