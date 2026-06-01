import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { XCircle, RotateCw, CreditCard, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initiateKhaltiPayment, verifyKhaltiPayment } from "@/lib/payment.functions";

const searchSchema = z
  .object({
    pidx: z.string().optional(),
    bookingId: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/payment/failed")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PaymentFailed,
});

function PaymentFailed() {
  const search = useSearch({ from: "/payment/failed" });
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"retry" | "restart" | null>(null);

  async function retryVerify() {
    if (!search.pidx) return toast.error("Missing payment reference.");
    setBusy("retry");
    try {
      const res = await verifyKhaltiPayment({ data: { pidx: search.pidx } });
      if (res.status === "completed") {
        toast.success("Payment confirmed!");
        navigate({ to: "/dashboard/bookings/$bookingId", params: { bookingId: res.bookingId } });
      } else if (res.status === "pending") {
        toast.info("Still pending. Try again in a moment.");
      } else {
        toast.error("Payment is marked as failed by Khalti.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  async function restartCheckout() {
    if (!search.bookingId) return toast.error("Missing booking reference.");
    setBusy("restart");
    try {
      const origin = window.location.origin;
      const { paymentUrl } = await initiateKhaltiPayment({
        data: {
          bookingId: search.bookingId,
          returnUrl: `${origin}/payment/callback`,
          websiteUrl: origin,
        },
      });
      window.location.href = paymentUrl;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not restart payment");
      setBusy(null);
    }
  }

  return (
    <SiteLayout>
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl p-8 text-center">
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Payment not completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {search.reason || "Khalti could not confirm your payment. You can retry verification or start a new checkout for the same booking."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {search.pidx && (
              <Button onClick={retryVerify} disabled={busy !== null} variant="outline">
                {busy === "retry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                Retry verification
              </Button>
            )}
            {search.bookingId && (
              <Button onClick={restartCheckout} disabled={busy !== null} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {busy === "restart" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Restart checkout
              </Button>
            )}
            <Button asChild variant="ghost"><Link to="/dashboard/bookings">My bookings</Link></Button>
          </div>
        </Card>
      </div>
    </SiteLayout>
  );
}
