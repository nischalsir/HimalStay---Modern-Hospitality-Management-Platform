import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { HotelCard } from "@/components/HotelCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

export const Route = createFileRoute("/dashboard/favorites")({
  component: Favorites,
});

function Favorites() {
  const { user, loading } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("hotel_id, hotels(*)")
      .eq("user_id", user.id)
      .then(({ data }) => setHotels(((data as any) ?? []).map((d: any) => d.hotels).filter(Boolean)));
  }, [user]);

  async function remove(hotelId: string) {
    if (!user) return;
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("hotel_id", hotelId);
    setHotels((h) => h.filter((x) => x.id !== hotelId));
  }

  if (!loading && !user) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Sign in to view your favorites.</p>
          <Button asChild className="mt-4"><Link to="/auth/login">Sign in</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold">Your favorites</h1>
        <p className="text-muted-foreground">{hotels.length} saved</p>
        <div className="mt-8">
          {hotels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
              No favorites yet. <Link to="/hotels" className="text-gold hover:underline">Find one you love</Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {hotels.map((h) => (
                <HotelCard key={h.id} hotel={h} isFavorite onToggleFavorite={() => remove(h.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
