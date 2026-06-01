import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Hotel,
  Bed,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Users,
  Star,
  Clock,
  ArrowRight,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatNPR, formatUSD, useCurrency } from "@/lib/currency";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

type Booking = {
  id: string;
  total_price: number;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  guest_name: string;
  hotel_id: string;
  nights: number;
  guests: number;
  check_in: string;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "var(--gold)",
  pending: "#f59e0b",
  cancelled: "#ef4444",
  completed: "#10b981",
};

function AdminHome() {
  const { rate } = useCurrency();
  const [stats, setStats] = useState({
    hotels: 0,
    rooms: 0,
    bookings: 0,
    revenue: 0,
    users: 0,
    avgRating: 0,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hotelsMap, setHotelsMap] = useState<Record<string, { name: string; city: string }>>({});

  useEffect(() => {
    (async () => {
      const [h, r, b, p, hAll] = await Promise.all([
        supabase.from("hotels").select("id, name, city, rating", { count: "exact" }),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
        supabase
          .from("bookings")
          .select(
            "id,total_price,created_at,status,payment_status,payment_method,guest_name,hotel_id,nights,guests,check_in",
          )
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("hotels").select("id, name, city, rating"),
      ]);

      const allBookings = (b.data ?? []) as Booking[];
      const revenue = allBookings
        .filter((x) => x.status !== "cancelled")
        .reduce((s, x) => s + Number(x.total_price), 0);

      const ratings = (hAll.data ?? []).map((x: any) => Number(x.rating) || 0).filter((n) => n > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const map: Record<string, { name: string; city: string }> = {};
      (hAll.data ?? []).forEach((x: any) => {
        map[x.id] = { name: x.name, city: x.city };
      });
      setHotelsMap(map);

      setStats({
        hotels: h.count ?? 0,
        rooms: r.count ?? 0,
        bookings: allBookings.length,
        revenue,
        users: p.count ?? 0,
        avgRating,
      });
      setBookings(allBookings);
    })();
  }, []);

  // Revenue area chart (30 days)
  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    bookings.forEach((x) => {
      if (x.status === "cancelled") return;
      const day = x.created_at.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + Number(x.total_price));
    });
    return [...byDay.entries()].map(([day, revenue]) => ({ day: day.slice(5), revenue }));
  }, [bookings]);

  // Status breakdown for pie chart
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  // Top hotels by bookings/revenue
  const topHotels = useMemo(() => {
    const agg: Record<string, { bookings: number; revenue: number }> = {};
    bookings.forEach((b) => {
      if (b.status === "cancelled") return;
      agg[b.hotel_id] ??= { bookings: 0, revenue: 0 };
      agg[b.hotel_id].bookings += 1;
      agg[b.hotel_id].revenue += Number(b.total_price);
    });
    return Object.entries(agg)
      .map(([id, v]) => ({ id, ...v, name: hotelsMap[id]?.name ?? "—", city: hotelsMap[id]?.city ?? "" }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [bookings, hotelsMap]);

  // Upcoming check-ins (next 7 days)
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const limit = in7.toISOString().slice(0, 10);
    return bookings
      .filter((b) => b.status !== "cancelled" && b.check_in >= today && b.check_in <= limit)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
      .slice(0, 6);
  }, [bookings]);

  const recent = bookings.slice(0, 6);

  // 7-day momentum
  const momentum = useMemo(() => {
    const now = Date.now();
    const last7 = bookings.filter(
      (b) => b.status !== "cancelled" && now - new Date(b.created_at).getTime() < 7 * 86400_000,
    );
    const prev7 = bookings.filter((b) => {
      const t = new Date(b.created_at).getTime();
      return b.status !== "cancelled" && now - t >= 7 * 86400_000 && now - t < 14 * 86400_000;
    });
    const cur = last7.reduce((s, b) => s + Number(b.total_price), 0);
    const prev = prev7.reduce((s, b) => s + Number(b.total_price), 0);
    const delta = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
    return { cur, count: last7.length, delta };
  }, [bookings]);

  const avgBookingValue = stats.bookings > 0 ? stats.revenue / stats.bookings : 0;

  const cards = [
    {
      label: "Revenue",
      value: formatNPR(stats.revenue * rate),
      sub: formatUSD(stats.revenue),
      Icon: DollarSign,
      tint: "from-gold/20 to-transparent",
    },
    {
      label: "Bookings",
      value: String(stats.bookings),
      sub: `Avg ${formatNPR(avgBookingValue * rate)}`,
      Icon: CalendarCheck,
      tint: "from-emerald-500/20 to-transparent",
    },
    {
      label: "Hotels",
      value: String(stats.hotels),
      sub: `${stats.rooms} rooms total`,
      Icon: Hotel,
      tint: "from-blue-500/20 to-transparent",
    },
    {
      label: "Guests",
      value: String(stats.users),
      sub: `${stats.avgRating.toFixed(1)}★ avg rating`,
      Icon: Users,
      tint: "from-purple-500/20 to-transparent",
    },
  ];

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Live overview of HimalStay performance</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <TrendingUp className={`h-4 w-4 ${momentum.delta >= 0 ? "text-emerald-500" : "text-red-500"}`} />
          <span className="text-muted-foreground">7d revenue</span>
          <span className="font-semibold">{formatNPR(momentum.cur * rate)}</span>
          <span className={momentum.delta >= 0 ? "text-emerald-500" : "text-red-500"}>
            {momentum.delta >= 0 ? "+" : ""}
            {momentum.delta.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, sub, Icon, tint }) => (
          <Card key={label} className={`relative overflow-hidden p-5 bg-gradient-to-br ${tint}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Revenue + Status row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Revenue · last 30 days</h2>
            <span className="text-xs text-muted-foreground">NPR</span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [formatNPR(Number(v) * rate), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--gold)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Booking status</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {statusBreakdown.map((s) => (
                    <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? "var(--muted-foreground)"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top hotels + Upcoming row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Top hotels by revenue</h2>
            <Star className="h-4 w-4 text-gold" />
          </div>
          {topHotels.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topHotels.map((h, idx) => {
                const max = topHotels[0].revenue || 1;
                const pct = (h.revenue / max) * 100;
                return (
                  <li key={h.id}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
                          {idx + 1}
                        </span>
                        <Link to="/hotels/$hotelId" params={{ hotelId: h.id }} className="font-medium hover:text-gold">
                          {h.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">· {h.city}</span>
                      </div>
                      <span className="font-semibold">{formatNPR(h.revenue * rate)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{h.bookings} bookings</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upcoming check-ins (7 days)</h2>
            <Clock className="h-4 w-4 text-gold" />
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nothing on the horizon.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.guest_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {hotelsMap[b.hotel_id]?.name ?? "—"} · {b.guests} guest{b.guests > 1 ? "s" : ""} · {b.nights}n
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs">{b.check_in}</div>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {b.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent bookings */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent bookings</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/bookings">
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3 pr-3">Guest</th>
                  <th className="pb-3 pr-3">Hotel</th>
                  <th className="pb-3 pr-3">Check-in</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Payment</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 pr-3 font-medium">{b.guest_name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{hotelsMap[b.hotel_id]?.name ?? "—"}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{b.check_in}</td>
                    <td className="py-3 pr-3">
                      <Badge variant="outline" className="capitalize">
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <Badge
                        variant="outline"
                        className={`capitalize ${b.payment_status === "paid" ? "border-emerald-500/40 text-emerald-500" : ""}`}
                      >
                        {b.payment_status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-semibold text-gold">
                      {formatNPR(Number(b.total_price) * rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
