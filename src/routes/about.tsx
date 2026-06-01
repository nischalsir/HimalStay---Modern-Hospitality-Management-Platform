import { createFileRoute } from "@tanstack/react-router";
import {
  MapPin,
  Mountain,
  Hotel,
  ShieldCheck,
  Globe2,
  HeartHandshake,
} from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <div className="bg-background">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-background" />

          <div className="container relative mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-gold">
                नेपालको आत्मा · Discover Nepal
              </p>

              <h1 className="font-display text-5xl font-semibold tracking-tight md:text-6xl">
                About HimalStay
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                HimalStay is a location-first hotel booking platform designed to
                help travellers experience the real beauty of Nepal — from Himalayan
                mountain towns and peaceful lakesides to cultural heritage cities
                and jungle escapes.
              </p>
            </div>
          </div>
        </section>

        {/* Main Story */}
        <section className="container mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-gold">
                Our Story
              </p>

              <h2 className="font-display text-3xl font-semibold">
                Built for travelers who want more than just a room
              </h2>

              <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground">
                <p>
                  Nepal is more than a destination — it is a collection of
                  unforgettable places, cultures, landscapes, and people. HimalStay
                  was created to connect travellers with authentic stays across the
                  country while making hotel discovery simple, modern, and reliable.
                </p>

                <p>
                  Whether you are exploring the busy streets of Kathmandu,
                  watching the sunrise over the Annapurna range in Pokhara,
                  visiting the wildlife of Chitwan, or trekking through remote
                  Himalayan villages, HimalStay helps you find accommodations
                  that match both your journey and your location.
                </p>

                <p>
                  Our platform focuses on verified hotels, transparent pricing,
                  accurate location details, and a smooth booking experience for
                  both local and international travellers.
                </p>
              </div>
            </div>

            {/* Stats / Highlights */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <Mountain className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  Himalayan Destinations
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Discover stays near trekking routes, mountain viewpoints,
                  and scenic Himalayan regions across Nepal.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <MapPin className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  Location-Focused Search
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Search hotels by city, tourist destination, landmarks,
                  trekking regions, and nearby attractions.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  Verified Properties
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Every listed property includes detailed information,
                  real photos, and accurate location data.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <Globe2 className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  Local & International
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Built for Nepali travelers and visitors from around the world
                  with transparent pricing and easy booking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                <HeartHandshake className="h-7 w-7" />
              </div>

              <h2 className="mt-6 font-display text-3xl font-semibold">
                Our Mission
              </h2>

              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                We aim to make discovering Nepal easier through a modern,
                trustworthy, and location-driven hotel platform that supports
                local hospitality businesses while helping travelers explore the
                country with confidence.
              </p>
            </div>
          </div>
        </section>

        {/* Closing Section */}
        <section className="container mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <Hotel className="h-7 w-7" />
          </div>

          <h2 className="mt-6 font-display text-3xl font-semibold">
            Explore Nepal with HimalStay
          </h2>

          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            From hidden mountain lodges to luxury city hotels, HimalStay helps
            you discover stays based on where your journey takes you.
          </p>
        </section>
      </div>
    </SiteLayout>
  );
}