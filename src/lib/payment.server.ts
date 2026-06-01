import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendBookingConfirmationEmail } from "./email.server";

const KHALTI_BASE = "https://dev.khalti.com/api/v2";

export type VerifyResult = {
  status: "completed" | "pending" | "failed";
  bookingId: string;
  transactionId: string | null;
};

/**
 * Verify a Khalti payment by pidx and reconcile booking + payment rows.
 * Idempotent — safe to call multiple times. Shared between the user-facing
 * callback server fn and the background reconciliation cron.
 */
export async function verifyKhaltiByPidx(pidx: string): Promise<VerifyResult> {
  // 1. ADDED .trim() to ensure no accidental whitespace breaks the Auth header
  const secret = process.env.KHALTI_SECRET_KEY?.trim();
  if (!secret) throw new Error("Khalti is not configured");

  const { data: payment, error: pErr } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("pidx", pidx)
    .maybeSingle();
  if (pErr || !payment) throw new Error("Payment not found");

  const res = await fetch(`${KHALTI_BASE}/epayment/lookup/`, {
    method: "POST",
    headers: {
      Authorization: `Key ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pidx }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[verifyByPidx] khalti lookup failed", res.status, body);
    throw new Error(body?.detail || "Failed to verify payment");
  }

  const khaltiStatus = String(body?.status || "").toLowerCase();
  let paymentStatus: "completed" | "pending" | "failed" = "pending";
  if (khaltiStatus === "completed") paymentStatus = "completed";
  else if (["expired", "user canceled", "failed", "refunded"].includes(khaltiStatus))
    paymentStatus = "failed";

  await supabaseAdmin
    .from("payments")
    .update({
      status: paymentStatus,
      transaction_id: body?.transaction_id ?? null,
      gateway_response: body,
    })
    .eq("id", payment.id);

  if (paymentStatus === "completed") {
    // EXPANDED SELECT: Grab the full booking + relational names for the email
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("*, hotels(name), rooms(name)")
      .eq("id", payment.booking_id)
      .single();

    let invoiceNumber = existing?.invoice_number ?? null;
    if (!invoiceNumber) {
      const { data: inv } = await supabaseAdmin.rpc("generate_invoice_number");
      invoiceNumber = (inv as unknown as string) ?? `INV-${Date.now()}`;
    }

    await supabaseAdmin
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: "paid",
        invoice_number: invoiceNumber,
      })
      .eq("id", payment.booking_id);
      
    // ADDED: Trigger the Mailjet Confirmation Email asynchronously
    if (existing) {
      sendBookingConfirmationEmail({
        email: existing.guest_email,
        name: existing.guest_name,
        hotelName: (existing as any).hotels?.name || "HimalStay",
        roomName: (existing as any).rooms?.name || "Standard Room",
        checkIn: existing.check_in,
        checkOut: existing.check_out,
        invoiceNumber: invoiceNumber,
        totalAmount: Number(existing.total_price),
      });
    }

  } else if (paymentStatus === "failed") {
    // 2. ADDED: Instant Room Release
    // If Khalti fails or user cancels, release the room immediately
    await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled", 
        payment_status: "failed",
      })
      .eq("id", payment.booking_id);
  }

  return {
    status: paymentStatus,
    bookingId: payment.booking_id as string,
    transactionId: (body?.transaction_id as string) || null,
  };
}