import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Printer, ArrowLeft, MapPin, Calendar, Users, CreditCard } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrency, formatNPR } from "@/lib/currency";
import { downloadInvoice, printInvoice, type InvoiceData } from "@/lib/invoice";

export const Route = createFileRoute("/dashboard/bookings/$bookingId")({
  component: BookingDetails,
});

function BookingDetails() {
  const { bookingId } = useParams({ from: "/dashboard/bookings/$bookingId" });
  const { user } = useAuth();
  const { rate } = useCurrency();
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "*, hotels(id,name,city,country,address,cover_image), rooms(id,name,room_type), payments(transaction_id,method,status,amount,currency)",
        )
        .eq("id", bookingId)
        .maybeSingle();
      setBooking(data);
      setLoading(false);
    })();
  }, [user, bookingId]);

  function makeInvoice(): InvoiceData | null {
    if (!booking) return null;
    return {
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
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
      room: { name: booking.rooms?.name ?? "—", room_type: booking.rooms?.room_type ?? "Standard" },
      guest: { name: booking.guest_name, email: booking.guest_email, phone: booking.guest_phone },
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guests: booking.guests,
      subtotal: Number(booking.subtotal ?? booking.total_price),
      service: Number(booking.service_charge ?? 0),
      tax: Number(booking.tax_amount ?? 0),
      total: Number(booking.total_price),
      nprRate: rate,
      transactionId: booking.payments?.[0]?.transaction_id ?? null,
    };
  }

  if (loading) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          Loading booking…
        </div>
      </SiteLayout>
    );
  }

  if (!booking) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Booking not found.</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/bookings">Back to my bookings</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/dashboard/bookings"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> All bookings
        </Link>

        <Card className="overflow-hidden">
          {booking.hotels?.cover_image && (
            <div
              className="h-48 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${booking.hotels.cover_image})` }}
            />
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold">{booking.hotels?.name}</h1>
                <p className="mt-1 flex items-center text-sm text-muted-foreground">
                  <MapPin className="mr-1 h-4 w-4" />
                  {booking.hotels?.city}, {booking.hotels?.country}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className="capitalize">{booking.status}</Badge>
                <Badge variant="outline" className="capitalize">{booking.payment_status}</Badge>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Info icon={<Calendar className="h-4 w-4" />} label="Check-in">{booking.check_in}</Info>
              <Info icon={<Calendar className="h-4 w-4" />} label="Check-out">{booking.check_out}</Info>
              <Info icon={<Users className="h-4 w-4" />} label="Guests">{booking.guests}</Info>
              <Info icon={<CreditCard className="h-4 w-4" />} label="Nights">{booking.nights}</Info>
              <Info label="Room">{booking.rooms?.name} · {booking.rooms?.room_type}</Info>
              <Info label="Reference">
                <span className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</span>
              </Info>
              {booking.invoice_number && <Info label="Invoice">{booking.invoice_number}</Info>}
              {booking.payments?.[0]?.transaction_id && (
                <Info label="Transaction">
                  <span className="font-mono">{booking.payments[0].transaction_id}</span>
                </Info>
              )}
            </div>

            <Separator className="my-6" />

            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={`${formatNPR(Number(booking.subtotal ?? booking.total_price) * rate)}`} />
              {Number(booking.service_charge) > 0 && (
                <Row label="Service" value={`${formatNPR(Number(booking.service_charge) * rate)}`} />
              )}
              {Number(booking.tax_amount) > 0 && (
                <Row label="Tax" value={`${formatNPR(Number(booking.tax_amount) * rate)}`} />
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-gold">
                  {formatNPR(Number(booking.total_price) * rate)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (${Number(booking.total_price).toFixed(2)})
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { const inv = makeInvoice(); if (inv) downloadInvoice(inv); }}>
                <Download className="mr-2 h-4 w-4" /> Download invoice
              </Button>
              <Button variant="outline" onClick={() => { const inv = makeInvoice(); if (inv) printInvoice(inv); }}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              {booking.hotels?.id && (
                <Button asChild variant="ghost">
                  <Link to="/hotels/$hotelId" params={{ hotelId: booking.hotels.id }}>View hotel</Link>
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </SiteLayout>
  );
}

function Info({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
