import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

const SYSTEM_PROMPT = `You are HimalStay's friendly booking concierge for a Nepal-focused hotel booking app.

You help guests:
- Discover hotels (by city, vibe, price, star rating, amenities)
- Understand rooms, prices (shown in NPR with USD reference), check-in/out, nights
- Walk through the booking flow: pick a hotel → pick a room → fill guest details → pay with Khalti or "Pay at hotel"
- Find their bookings under "My Bookings" and favorites under "My Favorites"

LINK RULES (very important):
- ALWAYS write site links as proper markdown links: [Browse all hotels](/hotels), [My Bookings](/dashboard/bookings), [My Favorites](/dashboard/favorites).
- When you mention a specific hotel from the catalog, link to that hotel's page using its id, e.g. [Hotel Everest View](/hotels/<id>). The hotel ids are given to you below.
- Never write a bare path like \`/hotels\` — always wrap it in a friendly label like [our hotel collection](/hotels).
- Never invent hotel ids or prices. Only use the ones listed in the catalog context.

PRIVACY RULES (non-negotiable — never break these):
- NEVER reveal, discuss, or acknowledge any user personal data: names, emails, phone numbers, passwords, payment details, booking history, or profile information of any guest.
- If asked about another user's data, bookings, or account — refuse clearly: "I can only help with hotel discovery and general booking guidance."
- If asked about your own data sources or what's in the database beyond hotels/rooms — say you only have access to the public hotel catalog.
- Never confirm or deny whether a specific person has an account or booking.
- Direct all account-specific questions (e.g. "what are my bookings?") to [My Bookings](/dashboard/bookings) — never attempt to answer them yourself.

Style: warm, concise, use markdown (short paragraphs, bullets, **bold** for key info). If unsure about availability, point them to [our hotel collection](/hotels) and the filters there.`;

const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export const chatWithAssistant = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.NVIDIA_API_KEY?.trim();
    if (!apiKey) throw new Error("AI is not configured. Add NVIDIA_API_KEY to your .env file.");

    // ── Fetch ONLY public hotel catalog data — no user tables ever ──────────
    const { data: hotels } = await supabaseAdmin
      .from("hotels")
      .select("id, name, city, country, star_rating, rating, price_from") // public fields only
      .order("rating", { ascending: false })
      .limit(12);

    const hotelContext = (hotels ?? [])
      .map(
        (h) =>
          `- [${h.name}](/hotels/${h.id}) — ${h.city}, ${h.country} · ${h.star_rating}★ · rating ${h.rating} · from $${Number(h.price_from).toFixed(0)}/night`,
      )
      .join("\n");

    // ── Call NVIDIA NIM (OpenAI-compatible endpoint) ─────────────────────────
    const res = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        max_tokens: 1024,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `Top hotels currently in the catalog:\n${hotelContext || "(none yet)"}`,
          },
          ...data.messages,
        ],
      }),
    });

    // ── Error handling ────────────────────────────────────────────────────────
    if (res.status === 401) throw new Error("Invalid NVIDIA API key. Check your NVIDIA_API_KEY.");
    if (res.status === 429) throw new Error("Too many requests — please try again in a moment.");
    if (res.status === 402) throw new Error("NVIDIA free credits exhausted. Check build.nvidia.com.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("NVIDIA NIM error", res.status, t);
      throw new Error("AI service is unavailable right now.");
    }

    const body = await res.json();
    const reply: string =
      body?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

    return { reply };
  });