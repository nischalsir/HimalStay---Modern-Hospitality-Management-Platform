import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Clock3,
  Globe2,
} from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: Contact,
});

function Contact() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const name = formData.get("name");
    const email = formData.get("email");
    const subject = formData.get("subject");
    const message = formData.get("message");

    setLoading(true);

    try {
      // Opens user's email app with prefilled email
      window.location.href = `mailto:bistbibek04@gmail.com?subject=${encodeURIComponent(
        `[HimalStay Contact] ${subject}`
      )}&body=${encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
      )}`;

      setSent(true);
      toast.success("Message prepared successfully");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <div className="bg-background">
        {/* Hero Section */}
        <section className="border-b bg-gradient-to-br from-gold/10 via-background to-background">
          <div className="container mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-gold">
                Contact HimalStay
              </p>

              <h1 className="font-display text-5xl font-semibold tracking-tight md:text-6xl">
                We’re here to help
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Have questions about bookings, hotel listings, partnerships,
                or travel in Nepal? Reach out to the HimalStay team and
                we’ll get back to you as soon as possible.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Content */}
        <section className="container mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Contact Info */}
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-gold">
                Contact Information
              </p>

              <h2 className="font-display text-3xl font-semibold">
                Let’s connect
              </h2>

              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Whether you’re planning a trip to Nepal or managing a hotel
                property, our team is ready to assist you.
              </p>

              <div className="mt-10 space-y-6">
                <Card className="rounded-3xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                      <Mail className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold">Email</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        bistbibek04@gmail.com
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                      <MapPin className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold">Location</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Nepal
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                      <Clock3 className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold">Support Hours</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Sunday – Friday · 9:00 AM – 6:00 PM (NPT)
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                      <Globe2 className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold">Platform</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Nepal-focused hotel discovery and booking platform
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="rounded-3xl border p-8 shadow-sm">
              {sent ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 text-gold">
                    <Send className="h-7 w-7" />
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-semibold">
                    Message Ready
                  </h3>

                  <p className="mt-3 max-w-md text-muted-foreground">
                    Your email app should now open with your message prepared
                    for sending to the HimalStay team.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="font-display text-3xl font-semibold">
                      Send us a message
                    </h2>

                    <p className="mt-3 text-muted-foreground">
                      Fill out the form below and your email application will
                      open automatically.
                    </p>
                  </div>

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>

                      <Input
                        id="name"
                        name="name"
                        placeholder="Enter your full name"
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>

                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>

                      <Input
                        id="subject"
                        name="subject"
                        placeholder="Booking inquiry, partnership, support..."
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>

                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Write your message here..."
                        rows={6}
                        required
                        className="resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-11 w-full bg-gold text-gold-foreground hover:bg-gold/90"
                    >
                      {loading ? "Preparing Message..." : "Send Message"}
                    </Button>
                  </form>
                </>
              )}
            </Card>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}