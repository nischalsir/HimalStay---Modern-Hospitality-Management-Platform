import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Search, LogIn, LogOut, ClipboardCheck, Clock, X, PlusCircle, Mail, Printer } from "lucide-react";
import { processCheckIn, processCheckOut, addBookingAddon, emailGuestFolio } from "@/lib/booking.functions";

export const Route = createFileRoute("/owner/checkin")({
  component: OwnerCheckin,
});

function OwnerCheckin() {
  const { user } = useAuth();
  const { rate } = useCurrency(); // Live USD to NPR rate
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [hotelData, setHotelData] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [addonName, setAddonName] = useState("");
  const [addonPriceNPR, setAddonPriceNPR] = useState("");

  // Clean formatting for NPR without decimals
  const formatNPR = (usdAmount: number) => {
    return "Rs. " + Math.round(Number(usdAmount || 0) * rate).toLocaleString("en-NP");
  };

  // ─── FIX: Smart balance calculation ───────────────────────────────────────
  // If payment_status is "paid", treat the full total as paid,
  // even if amount_paid column is 0 or NULL (Khalti sync bug).
  function getBalanceDue(booking: any): number {
    const total = Number(booking.total_price || 0);
    const amountPaid =
      booking.payment_status === "paid"
        ? total
        : Number(booking.amount_paid || 0);
    return Math.max(0, total - amountPaid);
  }
  // ──────────────────────────────────────────────────────────────────────────

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: hotel } = await supabase.from("hotels").select("*").eq("owner_id", user.id).maybeSingle();
    if (!hotel) { setLoading(false); return; }

    setHotelId(hotel.id);
    setHotelData(hotel);

    // ─── FIX: Explicitly select amount_paid and payment_status ──────────────
    const { data, error } = await supabase
      .from("bookings")
      .select("*, amount_paid, payment_status, rooms(name, room_type, price_per_night), payments(transaction_id)")
      .eq("hotel_id", hotel.id)
      .in("status", ["confirmed", "checked_in"])
      .order("check_in", { ascending: true });
    // ────────────────────────────────────────────────────────────────────────

    if (error) { toast.error(error.message); setLoading(false); return; }

    const list = data ?? [];
    const userIds = Array.from(new Set(list.map((b) => b.user_id))).filter(Boolean);
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url, phone").in("id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((b) => { b.profile = byId.get(b.user_id) ?? null; });
    }

    setBookings(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = selectedId ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return bookings;
    return bookings.filter((b) =>
      b.guest_name?.toLowerCase().includes(q) ||
      b.guest_email?.toLowerCase().includes(q) ||
      (b.status ?? "").toLowerCase().includes(q)
    );
  }, [bookings, query]);

  const selectedBooking = useMemo(() => bookings.find(b => b.id === selectedId) || null, [bookings, selectedId]);

  async function handleAction(booking: any) {
    setProcessing(booking.id);
    try {
      if (booking.status === "confirmed") {
        await processCheckIn({ data: { bookingId: booking.id } });
        toast.success("Guest checked in.");
      } else if (booking.status === "checked_in") {
        await processCheckOut({ data: { bookingId: booking.id } });
        toast.success("Guest checked out.");
      }
      load();
      setSelectedId(null);
    } catch (error: any) {
      toast.error(error.message || "Action failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleSendEmail(bookingId: string) {
    setProcessing("email");
    try {
      await emailGuestFolio({ data: { bookingId } });
      toast.success("Folio emailed to guest.");
    } catch (error: any) {
      toast.error("Failed to send email.");
    } finally {
      setProcessing(null);
    }
  }

  // --- Strict Math Conversion ---
  async function handleAddService(bookingId: string, name: string, amountNPR: number) {
    if (!name || amountNPR <= 0) return toast.error("Enter a valid item name and price.");
    setProcessing("addon");

    // Divides NPR by the exchange rate to save raw USD to the database
    const amountUSD = amountNPR / rate;

    try {
      await addBookingAddon({ data: { bookingId, name, amount: amountUSD } });
      toast.success(`${name} added to bill.`);
      setAddonName("");
      setAddonPriceNPR("");
      load();
    } catch (error: any) {
      toast.error("Failed to add item.");
    } finally {
      setProcessing(null);
    }
  }

  // --- Thermal Receipt Generator ---
  function printThermalReceipt(booking: any) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return toast.error("Pop-up blocked. Please allow pop-ups to print.");

    // ─── FIX: Use the same smart balance logic for the printed receipt ───────
    const balanceDueUSD = getBalanceDue(booking);
    const amountPaidUSD =
      booking.payment_status === "paid"
        ? Number(booking.total_price || 0)
        : Number(booking.amount_paid || 0);
    // ────────────────────────────────────────────────────────────────────────

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${booking.guest_name}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              margin: 0 auto; 
              padding: 10px; 
              color: #000; 
              font-size: 12px; 
            }
            .text-center { text-align: center; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .border-bottom { border-bottom: 1px dashed #000; margin: 10px 0; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${hotelData?.name || 'HimalStay'}</div>
            <div>${hotelData?.address || ''}, ${hotelData?.city || ''}</div>
          </div>
          <div class="border-bottom"></div>
          <div>Date: ${new Date().toLocaleDateString()}</div>
          <div>Guest: ${booking.guest_name}</div>
          <div>Room: ${booking.rooms?.name}</div>
          <div>Ref: #${booking.id.slice(0,8).toUpperCase()}</div>
          <div class="border-bottom"></div>
          
          <div class="flex-between">
            <span>Room (${booking.nights}N)</span>
            <span>${formatNPR(booking.subtotal || booking.total_price)}</span>
          </div>
          
          ${(booking.addons || []).map((a: any) => `
            <div class="flex-between">
              <span>${a.name}</span>
              <span>${formatNPR(a.amount)}</span>
            </div>
          `).join('')}
          
          <div class="border-bottom"></div>
          <div class="flex-between bold">
            <span>TOTAL</span>
            <span>${formatNPR(booking.total_price)}</span>
          </div>
          <div class="flex-between">
            <span>PAID</span>
            <span>-${formatNPR(amountPaidUSD)}</span>
          </div>
          <div class="border-bottom"></div>
          <div class="flex-between bold" style="font-size: 14px;">
            <span>BALANCE</span>
            <span>${formatNPR(balanceDueUSD)}</span>
          </div>
          <div class="border-bottom"></div>
          <div class="text-center" style="margin-top: 15px;">Thank you for your stay!</div>
          
          <script>
            window.onload = () => { 
              window.print(); 
              setTimeout(() => window.close(), 500); 
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (loading) return <div className="text-muted-foreground p-10">Loading front desk…</div>;
  if (!hotelId) return <div className="p-12 text-center text-muted-foreground">No hotel linked to your account.</div>;

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Front Desk</h1>
          <p className="text-muted-foreground">{filtered.length} active reservations</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search guest name..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center bg-card/50">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No active check-ins or upcoming arrivals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <Card
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className="p-4 cursor-pointer transition-all hover:border-gold hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-border/60">
                  <AvatarImage src={b.profile?.avatar_url} />
                  <AvatarFallback className="bg-gold/10 text-gold text-xs font-medium">
                    {(b.profile?.full_name ?? b.guest_name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">{b.profile?.full_name || b.guest_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.rooms?.name}</div>
                </div>
                <Badge variant="outline" className={`shrink-0 capitalize text-[10px] ${b.status === "checked_in" ? "text-emerald-500 border-emerald-500/50" : "text-blue-500 border-blue-500/50"}`}>
                  {b.status.replace("_", " ")}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* COMPACT FULL SCREEN MODAL */}
      {selectedBooking && (() => {
        // ─── FIX: Compute smart balance values once for the whole modal ──────
        const balanceDue = getBalanceDue(selectedBooking);
        const amountPaidDisplay =
          selectedBooking.payment_status === "paid"
            ? Number(selectedBooking.total_price || 0)
            : Number(selectedBooking.amount_paid || 0);
        // ────────────────────────────────────────────────────────────────────
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          >
            <div className="bg-background w-full max-w-5xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-card z-10">
                <div>
                  <h2 className="font-semibold text-foreground">Folio: {selectedBooking.guest_name}</h2>
                  <p className="text-xs text-muted-foreground">Ref: #{selectedBooking.id.slice(0,8).toUpperCase()}</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setSelectedId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-[75vh]">

                {/* LEFT SIDE: Compact Bill */}
                <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
                  <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6 text-sm text-zinc-800">

                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="font-semibold text-lg text-zinc-900">{selectedBooking.guest_name}</h3>
                        <p className="text-zinc-500">{selectedBooking.rooms?.name} · {selectedBooking.nights} Nights</p>
                      </div>
                      <div className="text-right font-mono text-xs text-zinc-500">
                        <p>{selectedBooking.check_in} → {selectedBooking.check_out}</p>
                      </div>
                    </div>

                    <table className="w-full text-sm mb-6">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left text-zinc-500">
                          <th className="pb-2 font-medium">Description</th>
                          <th className="pb-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        <tr>
                          <td className="py-3">Room Rate</td>
                          <td className="py-3 text-right font-medium">{formatNPR(selectedBooking.subtotal || selectedBooking.total_price)}</td>
                        </tr>
                        {selectedBooking.addons?.map((addon: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3 text-zinc-600">
                              {addon.name} <span className="text-[10px] text-zinc-400 block">{new Date(addon.timestamp).toLocaleDateString()}</span>
                            </td>
                            <td className="py-3 text-right font-medium">{formatNPR(addon.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end border-t border-zinc-200 pt-4">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-zinc-600">
                          <span>Subtotal</span>
                          <span>{formatNPR(selectedBooking.total_price)}</span>
                        </div>
                        {/* ─── FIX: Show correct paid amount and balance ─── */}
                        <div className="flex justify-between text-emerald-600">
                          <span>Paid Online</span>
                          <span>-{formatNPR(amountPaidDisplay)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-200">
                          <span className="font-semibold text-zinc-900">Balance</span>
                          <span className="text-xl font-bold text-zinc-900">
                            {formatNPR(balanceDue)}
                          </span>
                        </div>
                        {/* ──────────────────────────────────────────────── */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE: Compact Actions */}
                <div className="w-full md:w-[320px] shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-border/40 bg-card p-5 flex flex-col gap-4">

                  <Card className="p-4 border-border/40 shadow-none bg-background">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Add Charge</h4>

                    {selectedBooking.status === "confirmed" && new Date().toISOString().split("T")[0] < selectedBooking.check_in && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mb-3 border-orange-200 text-orange-600 text-xs hover:bg-orange-50"
                        disabled={processing === "addon"}
                        onClick={() => handleAddService(selectedBooking.id, "Early Check-in", Number(selectedBooking.rooms.price_per_night) * rate)}
                      >
                        <Clock className="h-3 w-3 mr-1" /> Early Arrival (+1N)
                      </Button>
                    )}

                    <div className="flex flex-col gap-2">
                      <Input placeholder="Item name" className="text-sm h-8" value={addonName} onChange={e=>setAddonName(e.target.value)} />
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rs.</span>
                          <Input type="number" placeholder="0" className="pl-7 text-sm h-8" value={addonPriceNPR} onChange={e=>setAddonPriceNPR(e.target.value)} />
                        </div>
                        <Button size="sm" className="h-8 bg-zinc-900 text-white hover:bg-zinc-800" disabled={processing === "addon"} onClick={() => handleAddService(selectedBooking.id, addonName, Number(addonPriceNPR))}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button variant="outline" size="sm" className="w-full bg-background" disabled={processing === "email"} onClick={() => handleSendEmail(selectedBooking.id)}>
                      <Mail className="mr-2 h-3.5 w-3.5" /> Email
                    </Button>
                    <Button variant="outline" size="sm" className="w-full bg-background" onClick={() => printThermalReceipt(selectedBooking)}>
                      <Printer className="mr-2 h-3.5 w-3.5" /> Print
                    </Button>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border/40">
                    {selectedBooking.status === "confirmed" && (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full h-10" onClick={() => handleAction(selectedBooking)} disabled={processing === selectedBooking.id}>
                        <LogIn className="mr-2 h-4 w-4" /> Check In
                      </Button>
                    )}
                    {selectedBooking.status === "checked_in" && (
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full h-10" onClick={() => handleAction(selectedBooking)} disabled={processing === selectedBooking.id}>
                        <LogOut className="mr-2 h-4 w-4" /> Check Out
                      </Button>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}