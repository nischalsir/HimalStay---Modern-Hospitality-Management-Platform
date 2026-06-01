import { Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Bed, CalendarCheck, LogOut, Hotel, Moon, Sun } from "lucide-react";
import { ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner")({
  component: OwnerShell,
});

const navigationItems = [
  { to: "/owner", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/owner/rooms", label: "Manage Rooms", icon: Bed },
  { to: "/owner/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/owner/checkin", label: "Check-in / Out", icon: ClipboardCheck },
];

function OwnerShell() {
  const { user, isHotelOwner, isAdmin, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [hotelName, setHotelName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("hotels")
      .select("name")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHotelName(data?.name ?? null));
  }, [user]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Verifying permissions…
    </div>
  );

  if (!user || (!isHotelOwner && !isAdmin)) return <Navigate to="/auth/login" replace />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">

      {/* Top Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background px-6">
        <div className="flex items-center gap-2">
          <Hotel className="h-5 w-5 text-gold" />
          <span className="font-display font-semibold text-lg truncate max-w-xs">
            {hotelName ?? "Property Dashboard"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[200px]">
            {user.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border/60 bg-background px-3 py-6">
          <p className="px-3 pb-3 text-xs uppercase font-semibold tracking-wider text-muted-foreground/80">
            Property Dashboard
          </p>
          <nav className="flex-1 space-y-1">
            {navigationItems.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? location.pathname === to : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-gold/15 text-gold font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}