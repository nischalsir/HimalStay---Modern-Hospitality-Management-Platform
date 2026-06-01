import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Price, useCurrency } from "@/lib/currency";
import { downloadInvoice, printInvoice, type InvoiceData } from "@/lib/invoice";
import { toast } from "sonner";
import { cancelBooking } from "@/lib/payment.functions"; // Added import

export const Route = createFileRoute("/dashboard/bookings")({
  component: MyBookings,
});

interface BookingRow {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  subtotal: number | null;
  service_charge: number | null;
  tax_amount: number | null;
  total_price: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  invoice_number: string | null;
  created_at: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  hotels: { id: string; name: string; city: string; country: string; address: string | null; cover_image: string | null } | null;
  rooms: { id: string; name: string; room_type: string } | null;
  payments: { transaction_id: string | null }[] | null;
}

const statusStyle: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-gold text-gold-foreground",
  checked_in: "bg-primary text-primary-foreground",
  completed: "bg-emerald-600 text-white",
  cancelled: "bg-destructive text-destructive-foreground",
};

function MyBookings() {
  const { user, loading } = useAuth();
  const { rate } = useCurrency();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null); // Added loading state

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, check_in, check_out, nights, guests, subtotal, service_charge, tax_amount, total_price, status, payment_status, payment_method, invoice_number, created_at, guest_name, guest_email, guest_phone, hotels(id,name,city,country,address,cover_image), rooms(id,name,room_type), payments(transaction_id)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }
  
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Updated to use the secure server function and a confirmation dialog
  async function handleCancel(id: string) {
    const isConfirmed = window.confirm(
      "Are you sure you want to cancel this reservation? If you pre-paid, please contact support for a refund."
    );
    
    if (!isConfirmed) return;

    setCancellingId(id);
    try {
      await cancelBooking({ data: { bookingId: id } });
      toast.success("Booking cancelled successfully.");
      load(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking.");
    } finally {
      setCancellingId(null);
    }
  }

  function asInvoice(b: BookingRow): InvoiceData {
    return {
      invoiceNumber: b.invoice_number || `INV-${b.id.slice(0, 8).toUpperCase()}`,
      bookingId: b.id,
      status: b.status,
      paymentStatus: b.payment_status,
      paymentMethod: b.payment_method,
      issuedAt: b.created_at,
      hotel: {
        name: b.hotels?.name ?? "—",
        city: b.hotels?.city ?? "",
        country: b.hotels?.country ?? "",
        address: b.hotels?.address,
      },
      room: { name: b.rooms?.name ?? "—", room_type: b.rooms?.room_type ?? "Standard" },
      guest: { name: b.guest_name, email: b.guest_email, phone: b.guest_phone },
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guests: b.guests,
      subtotal: Number(b.subtotal ?? b.total_price),
      service: Number(b.service_charge ?? 0),
      tax: Number(b.tax_amount ?? 0),
      total: Number(b.total_price),
      nprRate: rate,
      transactionId: b.payments?.[0]?.transaction_id ?? null,
    };
  }

  if (!loading && !user) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Please sign in to view your bookings.</p>
          <Button asChild className="mt-4"><Link to="/auth/login">Sign in</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">My bookings</h1>
        <p className="text-muted-foreground">{rows.length} total</p>

        <div className="mt-8 space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
              No bookings yet.{" "}
              <Link to="/hotels" className="text-gold hover:underline">Browse hotels</Link>
            </div>
          ) : (
            rows.map((b) => (
              <Card key={b.id} className="overflow-hidden p-0">
                <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-center">
                  <img
                    src={b.hotels?.cover_image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80"}
                    alt=""
                    className="h-40 w-full object-cover md:h-full"
                  />
                  <div className="p-4">
                    <h3 className="font-display text-lg font-semibold">{b.hotels?.name}</h3>
                    <p className="text-xs text-muted-foreground">{b.hotels?.city}, {b.hotels?.country} · {b.rooms?.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{b.check_in} → {b.check_out}</Badge>
                      <Badge variant="outline">{b.nights} night(s)</Badge>
                      <Badge variant="outline">{b.guests} guests</Badge>
                      <Badge className={statusStyle[b.status] ?? "bg-muted"}>{b.status.replace("_", " ")}</Badge>
                      <Badge variant="outline" className="capitalize">payment: {b.payment_status}</Badge>
                      {b.invoice_number && <Badge variant="outline" className="font-mono">{b.invoice_number}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 p-4">
                    <Price usd={Number(b.total_price)} className="font-display text-xl font-semibold text-gold" size="md" />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadInvoice(asInvoice(b))}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Invoice
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => printInvoice(asInvoice(b))}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                      </Button>
                      {(b.status === "confirmed" || b.status === "pending") && (
                        <Button 
                          variant="destructive" // Makes the button red
                          size="sm" 
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          {cancellingId === b.id ? "Cancelling..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </SiteLayout>
  );
}