import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { HotelCard } from "@/components/HotelCard";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNPR, useCurrency } from "@/lib/currency";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

interface SearchParams {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

export const Route = createFileRoute("/hotels/")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    location: (s.location as string) ?? "",
    checkIn: (s.checkIn as string) ?? "",
    checkOut: (s.checkOut as string) ?? "",
    guests: s.guests ? Number(s.guests) : undefined,
    minPrice: s.minPrice ? Number(s.minPrice) : undefined,
    maxPrice: s.maxPrice ? Number(s.maxPrice) : undefined,
    minRating: s.minRating ? Number(s.minRating) : undefined,
  }),
  component: HotelsList,
});

function HotelsList() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const [location, setLocation] = useState(search.location ?? "");
  const [maxPrice, setMaxPrice] = useState(search.maxPrice ?? 1000);
  const [minRating, setMinRating] = useState(search.minRating ?? 0);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { rate } = useCurrency();

  // Dynamic state for absolute maximum price found in the DB
  const [absoluteMaxPrice, setAbsoluteMaxPrice] = useState(1000);
  const [isPriceInitialized, setIsPriceInitialized] = useState(false);

  // 1. Fetch the maximum available price from the database once on mount
  useEffect(() => {
    async function fetchMaxDatabasePrice() {
      try {
        const { data, error } = await supabase
          .from("hotels")
          .select("price_from")
          .order("price_from", { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const highestPrice = data[0].price_from;
          setAbsoluteMaxPrice(highestPrice);
          
          // If the user didn't arrive via a search with a predefined maxPrice, 
          // default the slider to the absolute maximum price from the database.
          if (!search.maxPrice) {
            setMaxPrice(highestPrice);
          }
        }
      } catch (error: any) {
        console.error("Error fetching max hotel price:", error.message);
      } finally {
        setIsPriceInitialized(true);
      }
    }

    fetchMaxDatabasePrice();
  }, [search.maxPrice]);

  // 2. Load hotel listings when filters change
  useEffect(() => {
    if (isPriceInitialized) {
      load();
    }
  }, [location, maxPrice, minRating, isPriceInitialized]);

  // 3. Load user favorites
  useEffect(() => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("hotel_id")
      .eq("user_id", user.id)
      .then(({ data }) => setFavorites(new Set((data ?? []).map((f) => f.hotel_id))));
  }, [user]);

  async function load() {
    setLoading(true);
    let q = supabase.from("hotels").select("*");
    
    if (location.trim()) {
      q = q.or(`city.ilike.%${location}%,country.ilike.%${location}%,name.ilike.%${location}%`);
    }
    
    // Dynamically filter matching items under or equal to the slider track selection
    if (maxPrice < absoluteMaxPrice) {
      q = q.lte("price_from", maxPrice);
    }
    
    if (minRating > 0) {
      q = q.gte("rating", minRating);
    }
    
    const { data, error } = await q.order("rating", { ascending: false });
    if (error) toast.error(error.message);
    setHotels(data ?? []);
    setLoading(false);
  }

  async function toggleFav(hotelId: string) {
    if (!user) {
      toast.info("Sign in to save favorites");
      return;
    }
    if (favorites.has(hotelId)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("hotel_id", hotelId);
      const next = new Set(favorites);
      next.delete(hotelId);
      setFavorites(next);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, hotel_id: hotelId });
      setFavorites(new Set([...favorites, hotelId]));
    }
  }

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Browse hotels</h1>
          <p className="text-muted-foreground">{hotels.length} stays available</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-6 rounded-xl border border-border/60 bg-card/50 p-5 h-fit lg:sticky lg:top-20">
            <div>
              <label className="mb-2 block text-sm font-medium">Search</label>
              <div className="flex gap-2">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Kathmandu, Pokhara…"
                />
                <Button size="icon" variant="outline" onClick={load}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* DYNAMIC PRICE SLIDER */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Max price: <span className="text-gold">{formatNPR(maxPrice * rate)}</span> <span className="text-xs text-muted-foreground">(${maxPrice})</span>
              </label>
              <Slider
                value={[maxPrice]}
                onValueChange={(v) => setMaxPrice(v[0])}
                min={0} // Allows filtering starting from 0
                max={absoluteMaxPrice} // Explicitly caps upper threshold at absolute database peak
                step={Math.ceil(absoluteMaxPrice / 100) || 10} // Adaptive scaling step granularity
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Minimum rating</label>
              <div className="flex gap-1">
                {[0, 3, 4, 4.5].map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={minRating === r ? "default" : "outline"}
                    onClick={() => setMinRating(r)}
                    className={minRating === r ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}
                  >
                    {r === 0 ? "Any" : `${r}+`}
                  </Button>
                ))}
              </div>
            </div>
          </aside>

          <div>
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : hotels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-16 text-center">
                <p className="text-muted-foreground">No hotels match your filters.</p>
                <Link to="/" className="mt-2 inline-block text-gold hover:underline">
                  Back to home
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {hotels.map((h) => (
                  <HotelCard
                    key={h.id}
                    hotel={h}
                    isFavorite={favorites.has(h.id)}
                    onToggleFavorite={() => toggleFav(h.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}