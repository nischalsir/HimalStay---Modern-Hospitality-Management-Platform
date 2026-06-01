import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVER_FALLBACK_NPR_PER_USD } from "./pricing";
import { sendBookingCancellationEmail } from "./email.server";

const KHALTI_BASE = "https://dev.khalti.com/api/v2"; // sandbox

/**
 * Initiate a Khalti sandbox payment for an existing booking owned by the caller.
 * Returns the hosted payment URL the client must redirect to.
 */
export const initiateKhaltiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        bookingId: z.string().uuid(),
        returnUrl: z.string().url(),
        websiteUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch booking via user-scoped client (RLS guarantees ownership).
    // Included: exchange_rate_at_booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "id, user_id, total_price, exchange_rate_at_booking, guest_name, guest_email, guest_phone, hotel_id, hotels(name)",
      )
      .eq("id", data.bookingId)
      .single();

    if (error || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");

    // CRITICAL: Ensure `.env` is JUST the key, no spaces and no "Key" prefix
    const secret = process.env.KHALTI_SECRET_KEY?.trim(); 
    if (!secret) throw new Error("Khalti is not configured");

    // FINANCIAL SYNC: Use the exact exchange rate the user saw at checkout
    const totalUSD = Number(booking.total_price);
    const exchangeRate = Number(booking.exchange_rate_at_booking) || SERVER_FALLBACK_NPR_PER_USD;
    const amountNPR = Math.round(totalUSD * exchangeRate * 100); // paisa
    
    const hotelName = (booking as any).hotels?.name ?? "HimalStay booking";

    const res = await fetch(`${KHALTI_BASE}/epayment/initiate/`, {
      method: "POST",
      headers: {
        Authorization: `Key ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        return_url: data.returnUrl,
        website_url: data.websiteUrl,
        amount: amountNPR,
        purchase_order_id: booking.id,
        purchase_order_name: `${hotelName} — booking ${booking.id.slice(0, 8)}`,
        customer_info: {
          name: booking.guest_name,
          email: booking.guest_email,
          phone: booking.guest_phone || "9800000000",
        },
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.pidx) {
      console.error("Khalti initiate failed", res.status, body);
      throw new Error(body?.detail || "Failed to initiate payment");
    }

    // Record initiated payment (admin client — clients can't write payments).
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      booking_id: booking.id,
      user_id: userId,
      amount: amountNPR / 100,
      currency: "NPR",
      method: "khalti",
      status: "initiated",
      pidx: body.pidx,
      payment_url: body.payment_url,
      gateway_response: body,
    });

    // FATAL TRAP: Stop the checkout if the database fails to save the row
    if (insertError) {
      console.error("FATAL: Failed to insert payment row:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    return { paymentUrl: body.payment_url as string, pidx: body.pidx as string };
  });

/**
 * Verify a Khalti payment via lookup. Updates booking + payment + assigns
 * an invoice number on success. Safe to call multiple times (idempotent).
 */
export const verifyKhaltiPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pidx: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { verifyKhaltiByPidx } = await import("./payment.server");
    return verifyKhaltiByPidx(data.pidx);
  });

  // Add this to the bottom of src/lib/payment.functions.ts

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Fetch the booking to ensure the user actually owns it
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, hotels(name), rooms(name)")
      .eq("id", data.bookingId)
      .single();

    if (error || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");
    if (booking.status === "cancelled") throw new Error("Already cancelled");

    // 2. Update the status in the database (this frees up the room!)
    await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId);

    // 3. Fire off the cancellation email asynchronously
    await sendBookingCancellationEmail({
      email: booking.guest_email,
      name: booking.guest_name,
      hotelName: (booking as any).hotels?.name || "HimalStay",
      roomName: (booking as any).rooms?.name || "Standard Room",
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      bookingId: booking.id,
    });

    return { success: true };
  });