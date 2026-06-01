import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Star, Heart, Users, Bed, Maximize, Wifi, Coffee, Car } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HotelReviews } from "@/components/HotelReviews";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Price } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

export const Route = createFileRoute("/hotels/$hotelId")({
  component: HotelDetail,
});

function HotelDetail() {
  const { hotelId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: h }, { data: r }] = await Promise.all([
        supabase.from("hotels").select("*").eq("id", hotelId).maybeSingle(),
        supabase.from("rooms").select("*").eq("hotel_id", hotelId).order("price_per_night"),
      ]);
      setHotel(h);
      setRooms(r ?? []);
      setLoading(false);
    })();
  }, [hotelId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("hotel_id", hotelId)
      .maybeSingle()
      .then(({ data }) => setIsFav(!!data));
  }, [user, hotelId]);

  async function toggleFav() {
    if (!user) return navigate({ to: "/auth/login" });
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("hotel_id", hotelId);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, hotel_id: hotelId });
    }
    setIsFav(!isFav);
  }

  if (loading) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="aspect-[16/7] w-full rounded-xl" />
          <Skeleton className="mt-4 h-8 w-1/2" />
        </div>
      </SiteLayout>
    );
  }

  if (!hotel) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Hotel not found</h1>
          <Button asChild className="mt-4"><Link to="/hotels">Back to hotels</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  const allImages = hotel.cover_image
    ? [hotel.cover_image, ...(hotel.images ?? [])]
    : (hotel.images ?? []);
  const main = allImages[0] || "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1600&q=80";
  const thumbs = allImages.slice(1, 5);

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Gallery */}
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
          <div className="md:col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto overflow-hidden rounded-xl">
            <img src={main} alt={hotel.name} className="h-full w-full object-cover" />
          </div>
          {thumbs.length > 0
            ? thumbs.map((src, i) => (
                <div key={i} className="hidden aspect-[4/3] overflow-hidden rounded-xl md:block">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="hidden aspect-[4/3] overflow-hidden rounded-xl bg-muted md:block" />
              ))}
        </div>

        {/* Header */}
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {hotel.city}, {hotel.country}
              <span className="ml-3">{"★".repeat(hotel.star_rating)}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{hotel.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-gold text-gold" />
              <span className="font-medium">{(reviewStats.avg || Number(hotel.rating)).toFixed(1)}</span>
              <span className="text-muted-foreground">· {reviewStats.count} reviews</span>
            </div>
          </div>
          <Button variant="outline" onClick={toggleFav}>
            <Heart className={`mr-2 h-4 w-4 ${isFav ? "fill-gold text-gold" : ""}`} />
            {isFav ? "Saved" : "Save"}
          </Button>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <section>
              <h2 className="mb-3 font-display text-2xl font-semibold">About this hotel</h2>
              <p className="leading-relaxed text-muted-foreground">
                {hotel.description || "An exceptional property awaits you. Detailed description coming soon."}
              </p>
            </section>

            {hotel.amenities?.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-2xl font-semibold">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a) => (
                    <Badge key={a} variant="outline" className="border-gold/40 text-foreground">
                      {a}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 font-display text-2xl font-semibold">Choose your room</h2>
              {rooms.length === 0 ? (
                <p className="text-muted-foreground">No rooms available yet.</p>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <Card key={room.id} className="overflow-hidden p-0">
                      <div className="grid gap-4 md:grid-cols-[240px_1fr_auto] md:items-center">
                        <div className="aspect-[4/3] md:aspect-auto md:h-full overflow-hidden">
                          <img
                            src={room.images?.[0] || "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80"}
                            alt={room.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="font-display text-lg font-semibold">{room.name}</h3>
                          <p className="text-xs uppercase tracking-wider text-gold">{room.room_type}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {room.capacity} guests</span>
                            <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {room.beds} bed(s)</span>
                            {room.size_sqm && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" /> {room.size_sqm}m²</span>}
                          </div>
                          {room.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 p-4">
                          <div className="text-right">
                            <Price usd={Number(room.price_per_night)} className="font-display text-xl font-semibold text-gold" size="md" />
                            <div className="text-xs text-muted-foreground">per night</div>
                          </div>
                          <Button
                            className="bg-gold text-gold-foreground hover:bg-gold/90"
                            onClick={() =>
                              navigate({ to: "/booking/$roomId", params: { roomId: room.id } })
                            }
                          >
                            Book now
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 font-display text-2xl font-semibold">Ratings & reviews</h2>
              <HotelReviews
                hotelId={hotelId}
                onChange={(avg, count) => setReviewStats({ avg, count })}
              />
            </section>
          </div>

          <aside className="lg:sticky lg:top-20 h-fit">
            <Card className="p-6">
              <div className="mb-4">
                <span className="text-sm text-muted-foreground">From</span>
                <div className="mt-1">
                  <Price usd={Number(hotel.price_from)} className="font-display text-2xl font-semibold text-gold" size="md" />
                </div>
                <span className="text-xs text-muted-foreground">per night</span>
              </div>
              <Button
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => {
                  const el = document.querySelector("section h2:nth-of-type(1)");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See available rooms
              </Button>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Wifi className="h-3 w-3" /> Free WiFi</div>
                <div className="flex items-center gap-2"><Coffee className="h-3 w-3" /> Breakfast available</div>
                <div className="flex items-center gap-2"><Car className="h-3 w-3" /> Parking included</div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
