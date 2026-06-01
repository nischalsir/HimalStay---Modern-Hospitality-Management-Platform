import { Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LayoutDashboard, Hotel, Bed, CalendarCheck, Building2, LogOut, ShieldCheck, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/requests", label: "Partner Requests", icon: Building2 },
  { to: "/admin/hotels", label: "Hotels", icon: Hotel },
  { to: "/admin/rooms", label: "Rooms", icon: Bed },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Loading…
    </div>
  );

  if (!user || !isAdmin) return <Navigate to="/auth/login" replace />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">

      {/* Top Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <span className="font-display font-semibold text-lg">Admin Panel</span>
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
          <p className="px-3 pb-3 text-xs uppercase tracking-wider text-muted-foreground">Admin</p>
          <nav className="flex-1 space-y-1">
            {items.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? location.pathname === to : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    active ? "bg-gold/15 text-gold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}