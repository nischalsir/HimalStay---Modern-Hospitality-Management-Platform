import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, CreditCard, Hotel as HotelIcon, AlertCircle } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Price, formatNPR, useCurrency } from "@/lib/currency";
import { breakdown } from "@/lib/pricing";
import { initiateKhaltiPayment } from "@/lib/payment.functions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

export const Route = createFileRoute("/booking/$roomId")({
  component: BookingPage,
});

// Helper to get local date strings for calendar min values
function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function BookingPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const { rate } = useCurrency();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  
  const [checkIn, setCheckIn] = useState(todayISO(1));
  const [checkOut, setCheckOut] = useState(todayISO(3));
  const [guests, setGuests] = useState(2);
  
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState(user?.email ?? "");
  const [guestPhone, setGuestPhone] = useState("");
  const [requests, setRequests] = useState("");
  
  const [paymentMethod, setPaymentMethod] = useState<"khalti" | "pay_at_hotel">("khalti");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Availability state
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      setRoom(r);
      if (r) {
        const { data: h } = await supabase.from("hotels").select("*").eq("id", r.hotel_id).maybeSingle();
        setHotel(h);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    if (user) setGuestEmail((e) => e || user.email || "");
  }, [user]);

  // Availability check effect
  useEffect(() => {
    if (!room || !checkIn || !checkOut) return;
    
    // Ensure check-out isn't accidentally set before check-in when user changes dates
    if (new Date(checkOut) <= new Date(checkIn)) {
      setIsAvailable(false);
      return;
    }
    
    const checkAvailability = async () => {
      setIsChecking(true);
      const { data, error } = await supabase.rpc('is_room_available', {
        p_room_id: room.id,
        p_check_in: checkIn,
        p_check_out: checkOut
      });
      
      if (error) {
        console.error('Error checking availability:', error);
        setIsAvailable(false);
      } else {
        setIsAvailable(data);
      }
      setIsChecking(false);
    };

    checkAvailability();
  }, [room?.id, checkIn, checkOut]);

  // Restrict typing beyond max length and remove letters for Nepal format
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, "");
    if (numericValue.length <= 10) {
      setGuestPhone(numericValue);
    }
  };

  const nights = Math.max(
    1,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
  );
  const subtotalUSD = room ? Number(room.price_per_night) * nights : 0;
  const b = breakdown(subtotalUSD);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null); // Clear previous errors

    if (!user) return navigate({ to: "/auth/login" });
    if (!room) return;

    // 1. Date Validation (Backend Fallback)
    if (new Date(checkOut) <= new Date(checkIn)) {
      return setErrorMessage("Check-out date must be after check-in date.");
    }

    // 2. Email Validation
    if (!guestEmail.includes("@") || !guestEmail.endsWith(".com")) {
      return setErrorMessage("Please enter a valid email address ending in .com");
    }

    // 3. Phone Validation (Nepal strictly 10 digits)
    if (!guestPhone || guestPhone.length !== 10) {
      return setErrorMessage("Nepal phone numbers must be exactly 10 digits.");
    }
    
    // 4. Availability Validation
    if (isAvailable === false) {
      return setErrorMessage("Room is no longer available for these dates. Please adjust your dates.");
    }
    
    setSaving(true);

    const initialStatus = paymentMethod === "pay_at_hotel" ? "confirmed" : "pending";
    const initialPayment = "pending";
    const fullPhoneNumber = `+977 ${guestPhone}`;

    const { data: created, error } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        room_id: room.id,
        hotel_id: room.hotel_id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: fullPhoneNumber,
        special_requests: requests || null,
        nights,
        subtotal: b.subtotal,
        service_charge: b.service,
        tax_amount: b.tax,
        total_price: b.total,
        currency: "USD",
        exchange_rate_at_booking: rate,
        payment_method: paymentMethod,
        status: initialStatus,
        payment_status: initialPayment,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      return setErrorMessage(error.message);
    }

    if (paymentMethod === "pay_at_hotel") {
      setSaving(false);
      navigate({ to: "/payment/callback", search: { bookingId: created.id, offline: "1" } as any });
      return;
    }

    // Kick off Khalti sandbox checkout
    try {
      const origin = window.location.origin;
      const { paymentUrl } = await initiateKhaltiPayment({
        data: {
          bookingId: created.id,
          returnUrl: `${origin}/payment/callback`,
          websiteUrl: origin,
        },
      });
      window.location.href = paymentUrl;
    } catch (err: any) {
      setSaving(false);
      setErrorMessage(err?.message ?? "Could not start payment. Please try again.");
    }
  }

  if (!room || !hotel) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading room details…</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">Complete your booking</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" /> {hotel.name} — {hotel.city}, {hotel.country}
        </p>

        {/* Global Error Message Display */}
        {errorMessage && (
          <div className="mt-6 mb-2 flex items-start gap-2 rounded-md bg-destructive/15 p-4 text-sm text-destructive max-w-[800px]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            
            <Card className="p-6">
              <h2 className="mb-4 font-display text-xl font-semibold">Trip details</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="ci">Check-in</Label>
                  <Input 
                    id="ci" 
                    type="date" 
                    min={todayISO()} 
                    value={checkIn} 
                    onChange={(e) => setCheckIn(e.target.value)} 
                    required 
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <Label htmlFor="co">Check-out</Label>
                  <Input 
                    id="co" 
                    type="date" 
                    min={checkIn} // Dynamic minimum based on checkIn
                    value={checkOut} 
                    onChange={(e) => setCheckOut(e.target.value)} 
                    required 
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <Label htmlFor="g">Guests</Label>
                  <Input 
                    id="g" 
                    type="number" 
                    min={1} 
                    max={room.capacity} 
                    value={guests} 
                    onChange={(e) => setGuests(Number(e.target.value))} 
                    required 
                  />
                </div>
              </div>
              
              {/* Availability Indicator */}
              <div className="mt-4 flex items-center h-6">
                {isChecking && <span className="text-sm text-muted-foreground animate-pulse">Checking availability...</span>}
                {!isChecking && isAvailable === true && (
                  <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Room is available for these dates
                  </span>
                )}
                {!isChecking && isAvailable === false && (
                  <span className="text-sm font-medium text-destructive flex items-center gap-1.5">
                    ✗ Sold out for these dates
                  </span>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 font-display text-xl font-semibold">Guest information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="n">Full name</Label>
                  <Input id="n" required value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e">Email</Label>
                  <Input id="e" type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="name@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="p">Phone Number</Label>
                  <div className="flex mt-1">
                    {/* Fixed Nepal Prefix */}
                    <div className="flex items-center justify-center rounded-l-md border border-r-0 border-input bg-muted/50 px-3 text-sm text-muted-foreground shrink-0 select-none">
                      🇳🇵 +977
                    </div>
                    {/* Dynamically restricted Phone Input */}
                    <div className="relative flex-1">
                      <Input 
                        id="p" 
                        type="tel" 
                        className="w-full rounded-l-none"
                        value={guestPhone} 
                        maxLength={10} 
                        onChange={handlePhoneChange} 
                        placeholder="98XXXXXXXX" 
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">
                        {guestPhone.length}/10
                      </span>
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="r">Special requests (Optional)</Label>
                  <Textarea id="r" rows={3} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="Early check-in, extra blanket, etc." />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 font-display text-xl font-semibold">Payment method</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("khalti")}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                    paymentMethod === "khalti" ? "border-gold ring-1 ring-gold bg-gold/5" : "border-border hover:border-gold/60"
                  }`}
                >
                  <CreditCard className="mt-0.5 h-5 w-5 text-gold" />
                  <div>
                    <div className="font-medium">Khalti Wallet</div>
                    <div className="text-xs text-muted-foreground mt-1">Pay now securely via Khalti. Instant confirmation & invoice.</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pay_at_hotel")}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                    paymentMethod === "pay_at_hotel" ? "border-gold ring-1 ring-gold bg-gold/5" : "border-border hover:border-gold/60"
                  }`}
                >
                  <HotelIcon className="mt-0.5 h-5 w-5 text-gold" />
                  <div>
                    <div className="font-medium">Pay at hotel</div>
                    <div className="text-xs text-muted-foreground mt-1">Reserve now, settle your bill at check-in.</div>
                  </div>
                </button>
              </div>
            </Card>
            
          </div>

          <aside>
            <Card className="sticky top-20 p-6 shadow-md border-border/60">
              <h3 className="mb-4 font-display text-lg font-semibold">Price summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{room.name} × {nights}n</span>
                  <span className="font-medium">${b.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Charge (10%)</span>
                  <span>${b.service.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT (13%)</span>
                  <span>${b.tax.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-5 border-t border-border/60 pt-5">
                <div className="flex flex-col gap-1 font-display">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Total</span>
                    <span className="text-gold">{formatNPR(b.total * rate)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-normal text-muted-foreground mt-1">
                    <span>Equivalent in USD</span>
                    <span>${b.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={saving || !user || !isAvailable || isChecking} 
                className="mt-6 w-full h-12 text-base font-semibold bg-gold text-gold-foreground hover:bg-gold/90 shadow-sm"
              >
                {!user
                  ? "Sign in to book"
                  : saving
                    ? "Processing Booking…"
                    : paymentMethod === "khalti"
                      ? "Pay securely with Khalti"
                      : "Confirm Reservation"}
              </Button>
              
              {!user && (
                <Button asChild variant="outline" className="mt-3 w-full h-10">
                  <Link to="/auth/login">Sign in</Link>
                </Button>
              )}
              
              <p className="mt-4 text-center text-xs text-muted-foreground">
                <Price usd={Number(room.price_per_night)} showUsd={false} /> per night ·
                Free cancellation up to 24h before check-in.
              </p>
            </Card>
          </aside>
        </form>
      </div>
    </SiteLayout>
  );
}