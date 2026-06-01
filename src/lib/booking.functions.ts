// src/lib/booking.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendCheckInEmail, sendCheckOutEmail } from "./email.server";

// --- CHECK IN FUNCTION ---
export const processCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify Owner owns this hotel/booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, hotels(name, owner_id), rooms(name)")
      .eq("id", data.bookingId)
      .single();

    if (!booking || (booking as any).hotels?.owner_id !== userId) throw new Error("Forbidden");

    await supabaseAdmin
      .from("bookings")
      .update({ status: "checked_in" })
      .eq("id", data.bookingId);

    // Fire Email
    await sendCheckInEmail({
      email: booking.guest_email,
      name: booking.guest_name,
      hotelName: (booking as any).hotels?.name,
      roomName: (booking as any).rooms?.name,
    });

    return { success: true };
  });

// --- CHECK OUT FUNCTION ---
export const processCheckOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking } = await supabase
      .from("bookings")
      .select("*, hotels(name, owner_id)")
      .eq("id", data.bookingId)
      .single();

    if (!booking || (booking as any).hotels?.owner_id !== userId) throw new Error("Forbidden");

    await supabaseAdmin
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", data.bookingId);

    // Fire Email
    await sendCheckOutEmail({
      email: booking.guest_email,
      name: booking.guest_name,
      hotelName: (booking as any).hotels?.name,
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
    });

    return { success: true };
  });
  // Add to the bottom of src/lib/booking.functions.ts

export const addBookingAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ 
    bookingId: z.string().uuid(), 
    name: z.string().min(1), 
    amount: z.number().positive() 
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, hotels(owner_id)")
      .eq("id", data.bookingId)
      .single();

    if (error || (booking as any).hotels?.owner_id !== userId) {
      throw new Error("Forbidden");
    }

    // Append new item to the addons array
    const currentAddons = booking.addons || [];
    const newAddon = { name: data.name, amount: data.amount, timestamp: new Date().toISOString() };
    const updatedAddons = [...currentAddons, newAddon];
    
    // Recalculate Grand Total
    const newTotal = Number(booking.total_price || 0) + data.amount;

    await supabaseAdmin
      .from("bookings")
      .update({ 
        addons: updatedAddons, 
        total_price: newTotal 
      })
      .eq("id", data.bookingId);

    return { success: true };
  });
  
// Update this in src/lib/booking.functions.ts
// Add to the bottom of src/lib/booking.functions.ts
import { sendFolioEmail } from "./email.server";

export const emailGuestFolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, hotels(name, owner_id)")
      .eq("id", data.bookingId)
      .single();

    if (error || (booking as any).hotels?.owner_id !== userId) throw new Error("Forbidden");

    const balanceDue = Math.max(0, Number(booking.total_price || 0) - Number(booking.amount_paid || 0));

    await sendFolioEmail({
      email: booking.guest_email,
      name: booking.guest_name,
      hotelName: (booking as any).hotels?.name || "HimalStay",
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      balanceDue: balanceDue,
    });

    return { success: true };
  });