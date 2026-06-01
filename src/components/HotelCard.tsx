import { Link } from "@tanstack/react-router";
import { Heart, MapPin, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Price } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

interface Props {
  hotel: Hotel;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function HotelCard({ hotel, isFavorite, onToggleFavorite }: Props) {
  const img =
    hotel.cover_image ||
    hotel.images?.[0] ||
    `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80`;

  return (
    <Card className="hover-lift group overflow-hidden border-border/60 p-0">
      <Link to="/hotels/$hotelId" params={{ hotelId: hotel.id }}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={img}
            alt={hotel.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {onToggleFavorite && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur"
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite();
              }}
              aria-label="Toggle favorite"
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-gold text-gold" : ""}`} />
            </Button>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
            {"★".repeat(hotel.star_rating)}
          </div>
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{hotel.city}, {hotel.country}</span>
          </div>
          <h3 className="font-display text-lg font-semibold leading-tight">{hotel.name}</h3>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              <span className="font-medium">{Number(hotel.rating).toFixed(1)}</span>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">from / night</div>
              <Price usd={Number(hotel.price_from)} className="font-display text-base font-semibold text-gold" size="sm" />
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
