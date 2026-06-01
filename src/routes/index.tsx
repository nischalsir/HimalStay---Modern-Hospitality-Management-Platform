import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  Shield,
  Award,
  Mountain,
  ArrowRight,
  Star,
  Compass,
  Building2,
  Quote,
  User as UserIcon,
} from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatNPR, useCurrency } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { rate } = useCurrency();

  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  
  const [featured, setFeatured] = useState<Hotel[]>([]);
  const [reviews, setReviews] = useState<any[]>([]); 
  
  const [hotelCount, setHotelCount] = useState(0);
  const [destinationCount, setDestinationCount] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function loadData() {
      // 1. Fetch Featured Hotels
      const { data: featuredData } = await supabase
        .from("hotels")
        .select("*")
        .order("rating", { ascending: false })
        .limit(5); // 5 looks great for the new large layout (1 large full-width + 4 standard)
      
      setFeatured(featuredData ?? []);

      // 2. Fetch Latest Top Reviews with Avatar URL
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, profiles(full_name, avatar_url), hotels(name)")
        .order("created_at", { ascending: false })
        .limit(8); // Increased limit for the slider
      
      setReviews(reviewsData ?? []);

      // 3. Fetch Total Hotel Count
      const { count: hCount } = await supabase
        .from("hotels")
        .select("id", { count: "exact", head: true });
      
      setHotelCount(hCount ?? 0);

      // 4. Fetch Unique Destinations
      const { data: citiesData } = await supabase
        .from("hotels")
        .select("city");
      
      if (citiesData) {
        const uniqueCities = new Set(
          citiesData
            .map((h) => h.city?.trim().toLowerCase())
            .filter(Boolean)
        );
        setDestinationCount(uniqueCities.size);
      }
    }

    loadData();
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      to: "/hotels",
      search: { location, checkIn, checkOut, guests },
    });
  }

  const destinations = [
    {
      name: "Pokhara",
      image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop",
      desc: "Lakeside escapes & Annapurna views",
    },
    {
      name: "Kathmandu",
      image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1200&auto=format&fit=crop",
      desc: "Culture, temples & heritage stays",
    },
    {
      name: "Chitwan",
      image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=1200&auto=format&fit=crop",
      desc: "Jungle safari & nature resorts",
    },
  ];

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-20">
          <img
            src="https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?q=80&w=2000&auto=format&fit=crop"
            alt="Nepal mountains"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 -z-10 bg-black/60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-transparent to-background" />

        <div className="container mx-auto px-4 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white backdrop-blur-md border border-white/20">
              <Mountain className="h-4 w-4 text-gold" />
              Explore Nepal
            </div>

            {/* Heading */}
            <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Find your perfect stay in <span className="text-gold">Nepal</span>
            </h1>

            {/* Description */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              Discover handpicked hotels, mountain lodges, lakeside resorts,
              and boutique stays with seamless booking.
            </p>

            {/* DYNAMIC DATABASE STATS */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-white/90">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gold" />
                {hotelCount > 1 ? `${hotelCount - 1}+ Hotels` : `${hotelCount} Hotel`}
              </div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-gold" />
                {destinationCount > 1 ? `${destinationCount - 1}+ Destinations` : `${destinationCount} Destination`}
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-gold" />
                Trusted by travelers
              </div>
            </div>
          </div>

          {/* REDESIGNED SLEEK SEARCH BAR */}
          <div className="mx-auto mt-12 max-w-5xl">
            <form
              onSubmit={search}
              className="flex flex-col md:flex-row items-center gap-2 rounded-3xl md:rounded-full bg-background p-3 shadow-2xl border border-border/40"
            >
              {/* Location */}
              <div className="flex w-full md:w-1/3 flex-col px-4 py-2 hover:bg-accent/50 rounded-full transition-colors cursor-text" onClick={() => document.getElementById('location-input')?.focus()}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 cursor-pointer">Where</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gold shrink-0" />
                  <Input
                    id="location-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Search destinations..."
                    className="border-0 bg-transparent p-0 h-auto text-base font-medium shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="hidden h-10 w-[1px] bg-border md:block" />

              {/* Check In */}
              <div className="flex w-full md:w-1/4 flex-col px-4 py-2 hover:bg-accent/50 rounded-full transition-colors cursor-text" onClick={() => document.getElementById('checkin-input')?.focus()}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 cursor-pointer">Check in</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold shrink-0" />
                  <Input
                    id="checkin-input"
                    type="date"
                    min={today}
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto text-base font-medium shadow-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>

              <div className="hidden h-10 w-[1px] bg-border md:block" />

              {/* Check Out */}
              <div className="flex w-full md:w-1/4 flex-col px-4 py-2 hover:bg-accent/50 rounded-full transition-colors cursor-text" onClick={() => document.getElementById('checkout-input')?.focus()}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 cursor-pointer">Check out</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold shrink-0" />
                  <Input
                    id="checkout-input"
                    type="date"
                    min={checkIn || today}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto text-base font-medium shadow-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>

              <div className="hidden h-10 w-[1px] bg-border md:block" />

              {/* Guests */}
              <div className="flex w-full md:w-[130px] flex-col px-4 py-2 hover:bg-accent/50 rounded-full transition-colors cursor-text" onClick={() => document.getElementById('guests-input')?.focus()}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 cursor-pointer">Guests</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gold shrink-0" />
                  <Input
                    id="guests-input"
                    type="number"
                    min={1}
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="border-0 bg-transparent p-0 h-auto text-base font-medium shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* Search Button */}
              <Button
                type="submit"
                className="w-full md:w-auto h-14 rounded-2xl md:rounded-full bg-gold px-8 text-base font-bold tracking-wide text-gold-foreground hover:bg-gold/90 shrink-0"
              >
                <Search className="h-5 w-5 mr-2 md:mr-0 lg:mr-2" />
                <span className="md:hidden lg:inline">Search</span>
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gold">
              Popular destinations
            </p>
            <h2 className="font-display text-4xl font-semibold">
              Explore Nepal
            </h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {destinations.map((d) => (
            <div
              key={d.name}
              className="group relative overflow-hidden rounded-3xl"
            >
              <img
                src={d.image}
                alt={d.name}
                className="h-[400px] w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 p-6">
                <h3 className="font-display text-3xl font-semibold text-white">
                  {d.name}
                </h3>
                <p className="mt-2 text-sm text-white/70">{d.desc}</p>
                <Button
                  asChild
                  size="sm"
                  className="mt-5 rounded-full bg-white text-black hover:bg-white/90 font-medium"
                >
                  <Link to="/hotels">
                    Explore <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BIG SPACE FEATURED HOTELS */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mb-14 flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gold">
                Featured stays
              </p>
              <h2 className="font-display text-5xl font-semibold">
                Top rated hotels
              </h2>
            </div>
            <Button asChild variant="ghost" className="font-medium hover:text-gold hidden md:flex">
              <Link to="/hotels">
                View all hotels <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {featured.length === 0 ? (
            <Card className="rounded-3xl border-dashed p-16 text-center">
              <h3 className="text-xl font-semibold">No hotels available yet</h3>
              <p className="mt-2 text-muted-foreground">
                Add hotels from the admin dashboard.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {featured.map((hotel, index) => {
                const isFirst = index === 0;
                return (
                  <Link
                    key={hotel.id}
                    to="/hotels/$hotelId"
                    params={{ hotelId: hotel.id }}
                    className={`group relative block overflow-hidden rounded-3xl border border-border/50 bg-background shadow-sm ${
                      isFirst ? "md:col-span-2" : ""
                    }`}
                  >
                    <div className={`relative w-full overflow-hidden ${isFirst ? "aspect-[21/9] h-[500px]" : "aspect-[16/9] h-[350px]"}`}>
                      <img
                        src={hotel.cover_image || "https://images.unsplash.com/photo-1542314831-c6a4d1424869"}
                        alt={hotel.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      
                      {/* Rating Badge */}
                      <div className="absolute top-6 right-6 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                        <Star className="h-4 w-4 fill-gold text-gold" />
                        {hotel.rating?.toFixed(1) || "New"}
                      </div>

                      {/* Content Overlay */}
                      <div className="absolute bottom-0 left-0 p-8 md:p-10 w-full">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                          <div>
                            <div className="mb-3 flex items-center gap-2 text-white/80 text-sm font-medium">
                              <MapPin className="h-4 w-4 text-gold" />
                              {hotel.city}, {hotel.country}
                            </div>
                            <h3 className={`text-white font-display font-semibold ${isFirst ? "text-4xl md:text-5xl" : "text-3xl"}`}>
                              {hotel.name}
                            </h3>
                          </div>
                          <div className="md:text-right shrink-0">
                            <p className="text-white/70 text-sm mb-1">Starting from</p>
                            <div className="text-3xl font-display font-bold text-gold">
                              {formatNPR(Number(hotel.price_from) * rate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          
          <Button asChild variant="ghost" className="font-medium hover:text-gold mt-8 w-full md:hidden">
            <Link to="/hotels">
              View all hotels <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* SLIDING GUEST REVIEWS SECTION */}
      {reviews.length > 0 && (
        <section className="container mx-auto px-4 py-24 overflow-hidden">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gold">
              Guest Testimonials
            </p>
            <h2 className="font-display text-4xl font-semibold">
              Real stays, real stories
            </h2>
          </div>

          <div className="relative -mx-4 px-4">
            <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {reviews.map((review) => (
                <Card 
                  key={review.id} 
                  className="relative w-[340px] md:w-[400px] shrink-0 snap-center rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <Quote className="h-8 w-8 text-gold/20 mb-5" />
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < review.rating ? "fill-gold text-gold" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      "{review.comment || "Great experience, highly recommended!"}"
                    </p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border/60 flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                      {review.profiles?.avatar_url ? (
                        <img 
                          src={review.profiles.avatar_url} 
                          alt={review.profiles.full_name || "Guest"} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserIcon className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{review.profiles?.full_name || "Verified Guest"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stayed at <span className="font-medium text-foreground/80">{review.hotels?.name || "HimalStay Partner"}</span>
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {/* Gradient fading edges to indicate scrolling */}
            <div className="pointer-events-none absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-background to-transparent md:w-24" />
            <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent md:w-24" />
          </div>
        </section>
      )}

      {/* WHY US */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gold">
              Why HimalStay
            </p>
            <h2 className="font-display text-4xl font-semibold">
              Travel Nepal with confidence
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                Icon: Sparkles,
                title: "Handpicked Hotels",
                body: "Every property is carefully selected for comfort, quality, and authentic experience.",
              },
              {
                Icon: Shield,
                title: "Secure Booking",
                body: "Simple and secure booking experience with transparent pricing and trusted stays.",
              },
              {
                Icon: Award,
                title: "Local Experience",
                body: "Discover local culture, mountain hospitality, and unforgettable destinations.",
              },
            ].map(({ Icon, title, body }) => (
              <Card
                key={title}
                className="rounded-3xl border border-border/50 bg-background p-8 text-center shadow-sm"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground text-sm">
                  {body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}