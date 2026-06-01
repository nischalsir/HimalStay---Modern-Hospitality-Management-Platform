import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Price } from "@/lib/currency";
import { toast } from "sonner";
import { CalendarCheck, Search } from "lucide-react";

export const Route = createFileRoute("/owner/bookings")({
  component: OwnerBookings,
});

function OwnerBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: hotel } = await supabase
      .from("hotels")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!hotel) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("bookings")
      .select("*, rooms(name, room_type)")
      .eq("hotel_id", hotel.id)
      .order("created_at", { ascending: false });

    if (error) { toast.error(error.message); setLoading(false); return; }

    const list = data ?? [];

    // Load profiles for all bookers
    const userIds = Array.from(new Set(list.map((b) => b.user_id))).filter(Boolean);
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((b) => { b.profile = byId.get(b.user_id) ?? null; });
    }

    setBookings(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return bookings;
    return bookings.filter((b) =>
      b.guest_name?.toLowerCase().includes(q) ||
      b.guest_email?.toLowerCase().includes(q) ||
      (b.guest_phone ?? "").includes(q) ||
      (b.profile?.full_name ?? "").toLowerCase().includes(q) ||
      (b.rooms?.name ?? "").toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) ||
      b.payment_status?.toLowerCase().includes(q)
    );
  }, [bookings, query]);

  if (loading) return <div className="text-muted-foreground">Loading bookings…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Bookings</h1>
          <p className="text-muted-foreground">{filtered.length} of {bookings.length} total</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guest, room, status..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
          <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {query ? "No bookings match your search." : "No bookings yet for your property."}
          </p>
        </div>
      ) : (
        <div className="h-[calc(100vh-180px)] overflow-y-auto space-y-3 pr-1">
          {filtered.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                
                {/* Avatar + Guest Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 border border-border/60 shrink-0">
                    <AvatarImage
                      src={b.profile?.avatar_url ?? undefined}
                      alt={b.profile?.full_name ?? b.guest_name}
                    />
                    <AvatarFallback className="bg-gold/15 text-gold text-sm">
                      {(b.profile?.full_name ?? b.guest_name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{b.profile?.full_name || b.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{b.guest_email}</div>
                    {(b.guest_phone || b.profile?.phone) && (
                      <div className="text-xs text-muted-foreground">
                        {b.guest_phone || b.profile?.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Room + Dates */}
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{b.rooms?.name} — {b.rooms?.room_type}</div>
                  <div className="font-mono text-xs">{b.check_in} → {b.check_out}</div>
                  <div className="text-xs">{b.nights} nights · {b.guests} guests</div>
                </div>

                {/* Price + Status */}
                <div className="flex flex-col items-end gap-2">
                  <Price usd={Number(b.total_price)} className="font-semibold" />
                  <div className="flex gap-2">
                    <Badge variant="outline" className="capitalize text-xs">
                      {b.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="capitalize text-xs">
                      {b.payment_status}
                    </Badge>
                  </div>
                </div>

              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}