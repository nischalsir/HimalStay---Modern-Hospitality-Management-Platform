import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Trash2, Download, Mail, Phone, User, Search } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Price, useCurrency } from "@/lib/currency";
import { downloadInvoice, type InvoiceData } from "@/lib/invoice";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bookings")({ component: AdminBookings });

interface Row {
  id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  nights: number;
  subtotal: number | null;
  service_charge: number | null;
  tax_amount: number | null;
  total_price: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  invoice_number: string | null;
  created_at: string;
  hotels: { name: string; city: string; country: string; address: string | null } | null;
  rooms: { name: string; room_type: string } | null;
  payments: { transaction_id: string | null }[] | null;
  profile?: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
}

function AdminBookings() {
  const { rate } = useCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");

  async function load() {
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, user_id, check_in, check_out, guests, guest_name, guest_email, guest_phone, nights, subtotal, service_charge, tax_amount, total_price, status, payment_status, payment_method, invoice_number, created_at, hotels(name,city,country,address), rooms(name,room_type), payments(transaction_id)",
      )
      .order("created_at", { ascending: false });
    const list = (data as Row[]) ?? [];
    const userIds = Array.from(new Set(list.map((b) => b.user_id))).filter(Boolean);
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((b) => {
        const p = byId.get(b.user_id);
        b.profile = p ? { full_name: p.full_name, avatar_url: p.avatar_url, phone: p.phone } : null;
      });
    }
    setRows(list);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((b) =>
      b.guest_name.toLowerCase().includes(q) ||
      b.guest_email.toLowerCase().includes(q) ||
      (b.guest_phone ?? "").includes(q) ||
      (b.profile?.full_name ?? "").toLowerCase().includes(q) ||
      (b.hotels?.name ?? "").toLowerCase().includes(q) ||
      (b.rooms?.name ?? "").toLowerCase().includes(q) ||
      (b.invoice_number ?? "").toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q) ||
      b.payment_status.toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  async function setPayment(id: string, payment_status: string) {
    const { error } = await supabase.from("bookings").update({ payment_status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this booking?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  function asInvoice(b: Row): InvoiceData {
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

  return (
    <AdminShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Bookings</h1>
          <p className="text-muted-foreground">{filtered.length} of {rows.length} total</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, hotel..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 h-[calc(100vh-180px)] overflow-y-auto space-y-3 pr-1">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
            {query ? "No bookings match your search." : "No bookings yet."}
          </div>
        ) : filtered.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="grid gap-4 lg:grid-cols-[280px_1fr_auto_auto_auto_auto] lg:items-center">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-border/60">
                  <AvatarImage src={b.profile?.avatar_url ?? undefined} alt={b.profile?.full_name ?? b.guest_name} />
                  <AvatarFallback className="bg-gold/15 text-gold">
                    {(b.profile?.full_name ?? b.guest_name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.profile?.full_name || b.guest_name}
                  </div>
                  <a href={`mailto:${b.guest_email}`} className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-gold">
                    <Mail className="h-3 w-3" /> {b.guest_email}
                  </a>
                  {(b.guest_phone || b.profile?.phone) && (
                    <a href={`tel:${b.guest_phone || b.profile?.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold">
                      <Phone className="h-3 w-3" /> {b.guest_phone || b.profile?.phone}
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="font-medium">{b.hotels?.name} — {b.rooms?.name}</div>
                <div className="text-xs text-muted-foreground">{b.guests} guests</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">{b.check_in} → {b.check_out}</Badge>
                  <Badge variant="outline">{b.nights}n</Badge>
                  <Badge variant="outline"><Price usd={Number(b.total_price)} showUsd={false} /></Badge>
                  <Badge variant="outline" className="text-muted-foreground">${Number(b.total_price).toFixed(0)}</Badge>
                  {b.payment_method && <Badge variant="outline" className="capitalize">{b.payment_method.replace("_", " ")}</Badge>}
                  {b.invoice_number && <Badge variant="outline" className="font-mono">{b.invoice_number}</Badge>}
                </div>
              </div>
              <Select value={b.status} onValueChange={(v) => setStatus(b.id, v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked-in</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={b.payment_status} onValueChange={(v) => setPayment(b.id, v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => downloadInvoice(asInvoice(b))} title="Download invoice">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => remove(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}