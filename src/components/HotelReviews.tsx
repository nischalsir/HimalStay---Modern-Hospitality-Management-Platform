import { useEffect, useState } from "react";
import { Star, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface Props {
  hotelId: string;
  /** Called whenever the review list changes so parent can refresh aggregate rating. */
  onChange?: (avg: number, count: number) => void;
}

export function HotelReviews({ hotelId, onChange }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    const rows = (data as ReviewRow[]) ?? [];
    setReviews(rows);
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
    onChange?.(avg, rows.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const mine = user ? reviews.find((r) => r.user_id === user.id) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Please sign in to leave a review");
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from("reviews")
        .update({ rating, comment: comment.trim() || null })
        .eq("id", editingId);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Review updated");
    } else {
      if (mine) {
        setSaving(false);
        return toast.error("You already reviewed this hotel — edit your existing review");
      }
      const { error } = await supabase
        .from("reviews")
        .insert({ user_id: user.id, hotel_id: hotelId, rating, comment: comment.trim() || null });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Review posted");
    }
    setComment("");
    setRating(5);
    setEditingId(null);
    load();
  }

  function startEdit(r: ReviewRow) {
    setEditingId(r.id);
    setRating(r.rating);
    setComment(r.comment ?? "");
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review deleted");
    if (editingId === id) {
      setEditingId(null);
      setComment("");
      setRating(5);
    }
    load();
  }

  return (
    <div className="space-y-6">
      {user && (!mine || editingId) && (
        <Card className="p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className="p-1"
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      n <= (hover || rating) ? "fill-gold text-gold" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
            </div>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience…"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {editingId ? (saving ? "Saving…" : "Save changes") : saving ? "Posting…" : "Post review"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setComment("");
                    setRating(5);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      {reviews.length === 0 ? (
        <p className="text-muted-foreground">No reviews yet. Be the first to write one.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < r.rating ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
                      />
                    ))}
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                    {user?.id === r.user_id && " · You"}
                  </p>
                </div>
                {user?.id === r.user_id && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" onClick={() => startEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
