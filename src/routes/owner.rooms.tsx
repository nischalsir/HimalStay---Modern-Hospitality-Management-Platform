import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, UploadCloud, X, ImageOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/rooms")({ component: OwnerRooms });

const BUCKET = "hotel-images";

const emptyForm = {
  name: "", room_type: "Standard", description: "",
  price_per_night: 100, capacity: 2, beds: 1, size_sqm: 0,
  amenities: "", quantity: 1,
};

// ─── Image Upload State ───────────────────────────────────────────────────────
// existingUrls  → already saved in DB (shown when editing)
// pendingFiles  → new files selected by the user, not yet uploaded
// previews      → local blob URLs for instant preview of pendingFiles
// ─────────────────────────────────────────────────────────────────────────────

function OwnerRooms() {
  const { user } = useAuth();
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Image state
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load ─────────────────────────────────────────────────────────────────
  async function loadHotelAndRooms() {
    if (!user) return;
    const { data: hotel } = await supabase
      .from("hotels").select("id").eq("owner_id", user.id).maybeSingle();
    if (!hotel) { setHotelId(null); return; }
    setHotelId(hotel.id);
    const { data } = await supabase
      .from("rooms").select("*").eq("hotel_id", hotel.id)
      .order("created_at", { ascending: false });
    setRooms(data ?? []);
  }

  useEffect(() => { loadHotelAndRooms(); }, [user]);

  // ─── Cleanup blob URLs on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  // ─── Image helpers ────────────────────────────────────────────────────────
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    const newPreviews = arr.map(f => URL.createObjectURL(f));
    setPendingFiles(prev => [...prev, ...arr]);
    setPreviews(prev => [...prev, ...newPreviews]);
  }

  function removePending(idx: number) {
    URL.revokeObjectURL(previews[idx]);
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  function removeExisting(idx: number) {
    setExistingUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadPendingFiles(hId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of pendingFiles) {
      const ext = file.name.split(".").pop();
      const path = `${hId}/rooms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    return urls;
  }

  // ─── Dialog open helpers ──────────────────────────────────────────────────
  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setExistingUrls([]);
    setPendingFiles([]);
    setPreviews([]);
    setOpen(true);
  }

  function startEdit(r: any) {
    setEditing(r);
    setForm({
      name: r.name,
      room_type: r.room_type,
      description: r.description ?? "",
      price_per_night: Number(r.price_per_night),
      capacity: r.capacity,
      beds: r.beds,
      size_sqm: r.size_sqm ?? 0,
      amenities: (r.amenities ?? []).join(", "),
      quantity: r.quantity,
    });
    setExistingUrls(r.images ?? []);
    setPendingFiles([]);
    setPreviews([]);
    setOpen(true);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!hotelId) return toast.error("No hotel found for your account.");
    setSaving(true);

    try {
      // 1. Upload any new files → get their public URLs
      const uploadedUrls = await uploadPendingFiles(hotelId);

      // 2. Merge existing (kept) + newly uploaded
      const finalImages = [...existingUrls, ...uploadedUrls];

      const payload = {
        hotel_id: hotelId,
        name: form.name,
        room_type: form.room_type,
        description: form.description || null,
        price_per_night: Number(form.price_per_night),
        capacity: Number(form.capacity),
        beds: Number(form.beds),
        size_sqm: form.size_sqm ? Number(form.size_sqm) : null,
        images: finalImages,
        amenities: form.amenities.split(",").map(s => s.trim()).filter(Boolean),
        quantity: Number(form.quantity),
      };

      const { error } = editing
        ? await supabase.from("rooms").update(payload).eq("id", editing.id)
        : await supabase.from("rooms").insert(payload);

      if (error) return toast.error(error.message);

      toast.success(editing ? "Room updated." : "Room created.");
      setOpen(false);
      loadHotelAndRooms();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this room?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadHotelAndRooms();
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  // ─── Total image count for display ───────────────────────────────────────
  const totalImages = existingUrls.length + pendingFiles.length;

  if (!hotelId) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
        No hotel linked to your account yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Manage Rooms</h1>
          <p className="text-muted-foreground">{rooms.length} total</p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
          <DialogTrigger asChild>
            <Button onClick={startNew} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="mr-2 h-4 w-4" /> Add Room
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "New"} Room</DialogTitle>
            </DialogHeader>

            <form onSubmit={save} className="space-y-4 pt-1">
              {/* ── Room fields ── */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Room Type</Label><Input value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })} /></div>
                <div><Label>Price / night ($)</Label><Input type="number" min={0} value={form.price_per_night} onChange={e => setForm({ ...form, price_per_night: Number(e.target.value) })} /></div>
                <div><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                <div><Label>Beds</Label><Input type="number" min={1} value={form.beds} onChange={e => setForm({ ...form, beds: Number(e.target.value) })} /></div>
                <div><Label>Size (m²)</Label><Input type="number" min={0} value={form.size_sqm} onChange={e => setForm({ ...form, size_sqm: Number(e.target.value) })} /></div>
                <div className="sm:col-span-2"><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              </div>

              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Amenities (comma separated)</Label><Input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} /></div>

              {/* ── Image Upload Section ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Room Images</Label>
                  <span className="text-xs text-muted-foreground">{totalImages} image{totalImages !== 1 ? "s" : ""}</span>
                </div>

                {/* Drop zone */}
                <div
                  className={`
                    relative flex flex-col items-center justify-center gap-2
                    rounded-lg border-2 border-dashed p-6 text-center
                    transition-colors cursor-pointer select-none
                    ${dragging
                      ? "border-gold bg-gold/5 text-gold"
                      : "border-border/60 hover:border-gold/50 hover:bg-muted/30 text-muted-foreground"
                    }
                  `}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <UploadCloud className="h-8 w-8 opacity-60" />
                  <p className="text-sm font-medium">
                    {dragging ? "Drop images here" : "Click or drag & drop images"}
                  </p>
                  <p className="text-xs opacity-60">JPG, PNG, WEBP · Max 5 MB each</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                  />
                </div>

                {/* Image grid — existing + pending previews */}
                {totalImages > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* Existing saved images */}
                    {existingUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-border/60">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        {/* Saved badge */}
                        <span className="absolute bottom-1 left-1 rounded text-[9px] bg-black/50 text-white px-1 py-0.5 leading-none">
                          saved
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExisting(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Pending new files */}
                    {previews.map((src, idx) => (
                      <div key={`pending-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-gold/40">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {/* New badge */}
                        <span className="absolute bottom-1 left-1 rounded text-[9px] bg-gold/80 text-white px-1 py-0.5 leading-none">
                          new
                        </span>
                        <button
                          type="button"
                          onClick={() => removePending(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
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
                  className="bg-gold text-gold-foreground hover:bg-gold/90 min-w-[130px]"
                >
                  {saving
                    ? (pendingFiles.length > 0 ? `Uploading ${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""}…` : "Saving…")
                    : (editing ? "Save Changes" : "Create Room")
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Room list ── */}
      <div className="h-[calc(100vh-220px)] overflow-y-auto space-y-3 pr-1">
        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
            No rooms yet. Click "Add Room" to create one.
          </div>
        ) : rooms.map((r) => (
          <Card key={r.id} className="flex items-center gap-4 p-4">
            {r.images?.[0] ? (
              <img
                src={r.images[0]}
                alt=""
                className="h-16 w-24 rounded-md object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-24 rounded-md bg-muted flex items-center justify-center shrink-0">
                <ImageOff className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.room_type} · ${Number(r.price_per_night).toFixed(0)}/night · {r.capacity} guests · {r.quantity} units
              </div>
              {r.images?.length > 0 && (
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  {r.images.length} image{r.images.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => startEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}