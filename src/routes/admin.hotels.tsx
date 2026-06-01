import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Plus, UploadCloud, X, ImageOff } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

export const Route = createFileRoute("/admin/hotels")({ component: AdminHotels });

const BUCKET = "hotel-images";

const emptyForm = {
  name: "", description: "", city: "Kathmandu", country: "Nepal",
  address: "", star_rating: 4, price_from: 100, amenities: "",
};

// ─── Shared uploader ──────────────────────────────────────────────────────────
async function uploadFiles(
  files: File[],
  hotelId: string,
  folder: "hotel" | "rooms"
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${hotelId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

function AdminHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ── Cover image ────────────────────────────────────────────────────────────
  const [existingCover, setExistingCover] = useState<string>("");
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Gallery images ─────────────────────────────────────────────────────────
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [pendingGallery, setPendingGallery] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [galleryDragging, setGalleryDragging] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("hotels").select("*").order("created_at", { ascending: false });
    setHotels(data ?? []);
  }
  useEffect(() => { load(); }, []);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      galleryPreviews.forEach(URL.revokeObjectURL);
    };
  }, [coverPreview, galleryPreviews]);

  // ── Cover helpers ──────────────────────────────────────────────────────────
  function selectCover(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setPendingCover(file);
    setCoverPreview(URL.createObjectURL(file));
  }
  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setPendingCover(null);
    setCoverPreview("");
    setExistingCover("");
  }

  // ── Gallery helpers ────────────────────────────────────────────────────────
  function addGalleryFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    const newPreviews = arr.map(f => URL.createObjectURL(f));
    setPendingGallery(prev => [...prev, ...arr]);
    setGalleryPreviews(prev => [...prev, ...newPreviews]);
  }
  function removePendingGallery(idx: number) {
    URL.revokeObjectURL(galleryPreviews[idx]);
    setPendingGallery(prev => prev.filter((_, i) => i !== idx));
    setGalleryPreviews(prev => prev.filter((_, i) => i !== idx));
  }
  function removeExistingGallery(idx: number) {
    setExistingGallery(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Dialog open helpers ────────────────────────────────────────────────────
  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setExistingCover("");
    setPendingCover(null);
    setCoverPreview("");
    setExistingGallery([]);
    setPendingGallery([]);
    setGalleryPreviews([]);
    setOpen(true);
  }

  function startEdit(h: Hotel) {
    setEditing(h);
    setForm({
      name: h.name, description: h.description ?? "",
      city: h.city, country: h.country, address: h.address ?? "",
      star_rating: h.star_rating, price_from: Number(h.price_from),
      amenities: (h.amenities ?? []).join(", "),
    });
    setExistingCover(h.cover_image ?? "");
    setPendingCover(null);
    setCoverPreview("");
    setExistingGallery(h.images ?? []);
    setPendingGallery([]);
    setGalleryPreviews([]);
    setOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const basePayload = {
        name: form.name,
        description: form.description || null,
        city: form.city,
        country: form.country,
        address: form.address || null,
        amenities: form.amenities.split(",").map(s => s.trim()).filter(Boolean),
        star_rating: Number(form.star_rating),
        price_from: Number(form.price_from),
      };

      let hotelId = editing?.id ?? "";

      // ── For new hotels: INSERT first to get the ID ─────────────────────────
      if (!editing) {
        const { data: created, error: insertErr } = await supabase
          .from("hotels")
          .insert({ ...basePayload, cover_image: null, images: [] })
          .select("id")
          .single();
        if (insertErr || !created) { toast.error(insertErr?.message ?? "Failed to create hotel"); return; }
        hotelId = created.id;
      }

      // ── Upload cover ───────────────────────────────────────────────────────
      let finalCover = existingCover;
      if (pendingCover) {
        const [url] = await uploadFiles([pendingCover], hotelId, "hotel");
        if (url) finalCover = url;
      }

      // ── Upload gallery ─────────────────────────────────────────────────────
      const uploadedGallery = await uploadFiles(pendingGallery, hotelId, "hotel");
      const finalGallery = [...existingGallery, ...uploadedGallery];

      // ── Update hotel with image URLs ───────────────────────────────────────
      const { error: updateErr } = await supabase
        .from("hotels")
        .update({ ...basePayload, cover_image: finalCover || null, images: finalGallery })
        .eq("id", hotelId);

      if (updateErr) { toast.error(updateErr.message); return; }

      toast.success(editing ? "Hotel updated" : "Hotel created");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this hotel? Rooms will also be deleted.")) return;
    const { error } = await supabase.from("hotels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hotel deleted");
    load();
  }

  const totalGallery = existingGallery.length + pendingGallery.length;
  const pendingCount = (pendingCover ? 1 : 0) + pendingGallery.length;

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Hotels</h1>
          <p className="text-muted-foreground">{hotels.length} total</p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
          <DialogTrigger asChild>
            <Button onClick={startNew} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="mr-2 h-4 w-4" /> Add hotel
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} hotel</DialogTitle></DialogHeader>

            <form onSubmit={save} className="space-y-4 pt-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Star rating (1–5)</Label><Input type="number" min={1} max={5} value={form.star_rating} onChange={e => setForm({ ...form, star_rating: Number(e.target.value) })} /></div>
                <div><Label>City</Label><Input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Country</Label><Input required value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Starting price ($/night)</Label><Input type="number" min={0} value={form.price_from} onChange={e => setForm({ ...form, price_from: Number(e.target.value) })} /></div>
                <div><Label>Amenities (comma separated)</Label><Input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} placeholder="Pool, Spa, Gym, Free WiFi" /></div>
              </div>

              {/* ── Cover Image ── */}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                {coverPreview || existingCover ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border/60 group">
                    <img src={coverPreview || existingCover} alt="Cover" className="w-full h-full object-cover" />
                    {!coverPreview && (
                      <span className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">saved</span>
                    )}
                    {coverPreview && (
                      <span className="absolute bottom-2 left-2 text-[10px] bg-gold/80 text-white px-1.5 py-0.5 rounded">new</span>
                    )}
                    <button
                      type="button"
                      onClick={removeCover}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 p-6 text-center text-muted-foreground cursor-pointer hover:border-gold/50 hover:bg-muted/30 transition-colors"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <UploadCloud className="h-7 w-7 opacity-60" />
                    <p className="text-sm font-medium">Click to upload cover image</p>
                    <p className="text-xs opacity-60">JPG, PNG, WEBP · Max 5 MB</p>
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) selectCover(e.target.files[0]); e.target.value = ""; }}
                />
                {(coverPreview || existingCover) && (
                  <Button
                    type="button" variant="outline" size="sm"
                    className="text-xs h-7"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Replace cover
                  </Button>
                )}
              </div>

              {/* ── Gallery Images ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Gallery Images</Label>
                  <span className="text-xs text-muted-foreground">{totalGallery} image{totalGallery !== 1 ? "s" : ""}</span>
                </div>

                <div
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center cursor-pointer select-none transition-colors ${
                    galleryDragging
                      ? "border-gold bg-gold/5 text-gold"
                      : "border-border/60 hover:border-gold/50 hover:bg-muted/30 text-muted-foreground"
                  }`}
                  onClick={() => galleryInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setGalleryDragging(true); }}
                  onDragLeave={() => setGalleryDragging(false)}
                  onDrop={e => { e.preventDefault(); setGalleryDragging(false); addGalleryFiles(e.dataTransfer.files); }}
                >
                  <UploadCloud className="h-7 w-7 opacity-60" />
                  <p className="text-sm font-medium">{galleryDragging ? "Drop here" : "Click or drag & drop gallery images"}</p>
                  <p className="text-xs opacity-60">JPG, PNG, WEBP · Max 5 MB each</p>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) addGalleryFiles(e.target.files); e.target.value = ""; }}
                  />
                </div>

                {totalGallery > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {existingGallery.map((url, idx) => (
                      <div key={`eg-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-border/60">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 py-0.5 rounded leading-none">saved</span>
                        <button type="button" onClick={() => removeExistingGallery(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {galleryPreviews.map((src, idx) => (
                      <div key={`pg-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-gold/40">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[9px] bg-gold/80 text-white px-1 py-0.5 rounded leading-none">new</span>
                        <button type="button" onClick={() => removePendingGallery(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gold text-gold-foreground hover:bg-gold/90 min-w-[140px]"
                >
                  {saving
                    ? (pendingCount > 0 ? `Uploading ${pendingCount} image${pendingCount > 1 ? "s" : ""}…` : "Saving…")
                    : (editing ? "Save changes" : "Create hotel")
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-3">
        {hotels.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
            No hotels yet. Click "Add hotel" to create one.
          </div>
        )}
        {hotels.map((h) => (
          <Card key={h.id} className="flex items-center gap-4 p-4">
            {h.cover_image || h.images?.[0] ? (
              <img
                src={h.cover_image || h.images?.[0]}
                alt=""
                className="h-16 w-24 rounded object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-24 rounded bg-muted flex items-center justify-center shrink-0">
                <ImageOff className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{h.name}</div>
              <div className="text-xs text-muted-foreground">
                {h.city}, {h.country} · {h.star_rating}★ · from ${Number(h.price_from).toFixed(0)}
              </div>
              {(h.images?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  {h.images.length} gallery image{h.images.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => startEdit(h)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}