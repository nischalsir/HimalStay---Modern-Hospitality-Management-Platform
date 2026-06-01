import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CheckCircle2, XCircle, Loader2, Download, Printer } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { verifyKhaltiPayment } from "@/lib/payment.functions";
import { useCurrency, formatNPR } from "@/lib/currency";
import { downloadInvoice, printInvoice, type InvoiceData } from "@/lib/invoice";

const searchSchema = z
  .object({
    pidx: z.string().optional(),
    bookingId: z.string().optional(),
    offline: z.string().optional(),
    status: z.string().optional(),
    purchase_order_id: z.string().optional(),
    transaction_id: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    total_amount: z.union([z.string(), z.number()]).optional(),
    mobile: z.union([z.string(), z.number()]).optional(),
    tidx: z.string().optional(),
    txnId: z.string().optional(),
    purchase_order_name: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PaymentCallback,
});

type State =
  | { kind: "loading" }
  | { kind: "success"; bookingId: string }
  | { kind: "pending"; bookingId: string }
  | { kind: "failed"; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function PaymentCallback() {
  const search = useSearch({ from: "/payment/callback" });
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [booking, setBooking] = useState<any | null>(null);
  const [redirectIn, setRedirectIn] = useState(5);
  const { rate: liveRate } = useCurrency(); // Renamed to clearly differentiate from the locked rate

  // Auto-redirect to the booking details page shortly after success.
  useEffect(() => {
    if (state.kind !== "success") return;
    setRedirectIn(4);
    const tick = setInterval(() => setRedirectIn((n) => Math.max(0, n - 1)), 1000);
    const t = setTimeout(() => {
      navigate({ to: "/dashboard/bookings/$bookingId", params: { bookingId: state.bookingId } });
    }, 4000);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
  }, [state, navigate]);

  // Auto-redirect to the failure page (with pidx + bookingId) so users land
  // on the retry / restart-checkout UI instead of staying on the callback.
  useEffect(() => {
    if (state.kind !== "failed") return;
    const t = setTimeout(() => {
      navigate({
        to: "/payment/failed",
        search: { pidx: search.pidx, bookingId: search.bookingId, reason: state.message } as any,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state, navigate, search.pidx, search.bookingId]);

  useEffect(() => {
    (async () => {
      try {
        if (search.offline === "1" && search.bookingId) {
          setState({ kind: "success", bookingId: search.bookingId });
          return;
        }
        if (!search.pidx) {
          setState({ kind: "failed", message: "Missing payment reference." });
          return;
        }

        // Retry verify up to 4 times — Khalti's lookup can briefly report
        // "Pending" right after the user returns from the gateway.
        let lastErr: string | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const res = await verifyKhaltiPayment({ data: { pidx: search.pidx } });
            if (res.status === "completed") {
              setState({ kind: "success", bookingId: res.bookingId });
              return;
            }
            if (res.status === "failed") {
              setState({ kind: "failed", message: "Payment was not completed." });
              return;
            }
            // still pending → wait and retry
            lastErr = null;
            if (attempt < 3) await sleep(1500);
            else setState({ kind: "pending", bookingId: res.bookingId });
          } catch (err: any) {
            lastErr = err?.message ?? "Verification failed";
            if (attempt < 3) await sleep(1500);
          }
        }
        if (lastErr) setState({ kind: "failed", message: lastErr });
      } catch (err: any) {
        setState({ kind: "failed", message: err?.message ?? "Verification failed" });
      }
    })();
  }, [search.pidx, search.offline, search.bookingId]);

  useEffect(() => {
    if (state.kind !== "success" && state.kind !== "pending") return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "*, hotels(name,city,country,address), rooms(name,room_type), payments(transaction_id,method,status)",
        )
        .eq("id", state.bookingId)
        .maybeSingle();
      setBooking(data);
    })();
  }, [state]);

  // Determine which exchange rate to use: prefer the historically locked row value
  const activeRate = booking?.exchange_rate_at_booking ? Number(booking.exchange_rate_at_booking) : liveRate;

  function makeInvoice(): InvoiceData | null {
    if (!booking) return null;
    return {
      invoiceNumber: booking.invoice_number || `INV-${String(booking.id).slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      paymentMethod: booking.payment_method,
      issuedAt: booking.created_at,
      hotel: {
        name: booking.hotels?.name ?? "—",
        city: booking.hotels?.city ?? "",
        country: booking.hotels?.country ?? "",
        address: booking.hotels?.address,
      },
      room: {
        name: booking.rooms?.name ?? "—",
        room_type: booking.rooms?.room_type ?? "Standard",
      },
      guest: {
        name: booking.guest_name,
        email: booking.guest_email,
        phone: booking.guest_phone,
      },
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guests: booking.guests,
      subtotal: Number(booking.subtotal ?? booking.total_price),
      service: Number(booking.service_charge ?? 0),
      tax: Number(booking.tax_amount ?? 0),
      total: Number(booking.total_price),
      nprRate: activeRate, // FIXED: Now uses the locked booking rate
      transactionId: booking.payments?.[0]?.transaction_id ?? null,
    };
  }

  return (
    <SiteLayout>
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl p-8 text-center">
          {state.kind === "loading" && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Verifying your payment…</h1>
            </>
          )}
          {state.kind === "failed" && (
            <>
              <XCircle className="mx-auto h-14 w-14 text-destructive" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Payment not completed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
              <Button asChild className="mt-6"><Link to="/hotels">Back to hotels</Link></Button>
            </>
          )}
          {state.kind === "pending" && (
            <>
              <Loader2 className="mx-auto h-12 w-12 text-gold" />
              <h1 className="mt-4 font-display text-2xl font-semibold">Payment pending</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your payment is still processing. You'll get a confirmation once it clears.
              </p>
              <Button asChild className="mt-6"><Link to="/dashboard/bookings">View my bookings</Link></Button>
            </>
          )}
          {state.kind === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-gold" />
              <h1 className="mt-4 font-display text-3xl font-semibold">
                {search.offline === "1" ? "Reservation confirmed" : "Payment successful"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Booking reference: <span className="font-mono text-foreground">{state.bookingId.slice(0, 8).toUpperCase()}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Redirecting to <Link to="/dashboard/bookings/$bookingId" params={{ bookingId: state.bookingId }} className="underline">your booking</Link> in {redirectIn}s…
              </p>

              {booking && (
                <div className="mt-6 grid gap-2 rounded-lg bg-muted/40 p-4 text-left text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Hotel</span><span>{booking.hotels?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span>{booking.rooms?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-in → Check-out</span><span>{booking.check_in} → {booking.check_out}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nights</span><span>{booking.nights}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Payment</span>
                    <Badge variant="outline" className="capitalize">{booking.payment_status}</Badge>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    {/* FIXED: Multiplying by activeRate ensures accuracy with what Khalti actually drew */}
                    <span className="text-gold">{formatNPR(Number(booking.total_price) * activeRate)} <span className="text-xs font-normal text-muted-foreground">(${Number(booking.total_price).toFixed(2)})</span></span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  disabled={!booking}
                  onClick={() => {
                    const inv = makeInvoice();
                    if (inv) downloadInvoice(inv);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download invoice
                </Button>
                <Button
                  variant="outline"
                  disabled={!booking}
                  onClick={() => {
                    const inv = makeInvoice();
                    if (inv) printInvoice(inv);
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
                  <Link to="/dashboard/bookings">My bookings</Link>
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </SiteLayout>
  );
}