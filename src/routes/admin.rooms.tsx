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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Hotel = Database["public"]["Tables"]["hotels"]["Row"];

export const Route = createFileRoute("/admin/rooms")({ component: AdminRooms });

const BUCKET = "hotel-images";

const emptyForm = {
  hotel_id: "", name: "", room_type: "Standard", description: "",
  price_per_night: 100, capacity: 2, beds: 1, size_sqm: 0,
  amenities: "", quantity: 1,
};

async function uploadRoomFiles(files: File[], hotelId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${hotelId}/rooms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

function AdminRooms() {
  const [rooms, setRooms] = useState<(Room & { hotels: { name: string } | null })[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ── Image state ────────────────────────────────────────────────────────────
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase
      .from("rooms").select("*, hotels(name)").order("created_at", { ascending: false });
    setRooms((data as any) ?? []);
    const { data: h } = await supabase.from("hotels").select("*").order("name");
    setHotels(h ?? []);
  }
  useEffect(() => { load(); }, []);

  // Cleanup blob URLs
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  // ── Image helpers ──────────────────────────────────────────────────────────
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

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  function startNew() {
    setEditing(null);
    setForm({ ...emptyForm, hotel_id: hotels[0]?.id ?? "" });
    setExistingUrls([]);
    setPendingFiles([]);
    setPreviews([]);
    setOpen(true);
  }

  function startEdit(r: Room) {
    setEditing(r);
    setForm({
      hotel_id: r.hotel_id, name: r.name, room_type: r.room_type,
      description: r.description ?? "", price_per_night: Number(r.price_per_night),
      capacity: r.capacity, beds: r.beds, size_sqm: r.size_sqm ?? 0,
      amenities: (r.amenities ?? []).join(", "), quantity: r.quantity,
    });
    setExistingUrls(r.images ?? []);
    setPendingFiles([]);
    setPreviews([]);
    setOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hotel_id) return toast.error("Pick a hotel");
    setSaving(true);
    try {
      // Upload new files → get public URLs
      const uploadedUrls = await uploadRoomFiles(pendingFiles, form.hotel_id);
      const finalImages = [...existingUrls, ...uploadedUrls];

      const payload = {
        hotel_id: form.hotel_id,
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

      toast.success(editing ? "Room updated" : "Room created");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this room?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const totalImages = existingUrls.length + pendingFiles.length;

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Rooms</h1>
          <p className="text-muted-foreground">{rooms.length} total</p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
          <DialogTrigger asChild>
            <Button onClick={startNew} disabled={hotels.length === 0} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="mr-2 h-4 w-4" /> Add room
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} room</DialogTitle></DialogHeader>

            <form onSubmit={save} className="space-y-4 pt-1">
              {/* Hotel picker */}
              <div>
                <Label>Hotel</Label>
                <Select value={form.hotel_id} onValueChange={v => setForm({ ...form, hotel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a hotel" /></SelectTrigger>
                  <SelectContent>
                    {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Room fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Room type</Label><Input value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })} /></div>
                <div><Label>Price / night ($)</Label><Input type="number" min={0} value={form.price_per_night} onChange={e => setForm({ ...form, price_per_night: Number(e.target.value) })} /></div>
                <div><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                <div><Label>Beds</Label><Input type="number" min={1} value={form.beds} onChange={e => setForm({ ...form, beds: Number(e.target.value) })} /></div>
                <div><Label>Size (m²)</Label><Input type="number" min={0} value={form.size_sqm} onChange={e => setForm({ ...form, size_sqm: Number(e.target.value) })} /></div>
                <div><Label>Quantity</Label><Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              </div>

              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Amenities (comma separated)</Label><Input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} /></div>

              {/* ── Image Upload ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Room Images</Label>
                  <span className="text-xs text-muted-foreground">{totalImages} image{totalImages !== 1 ? "s" : ""}</span>
                </div>

                <div
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer select-none transition-colors ${
                    dragging
                      ? "border-gold bg-gold/5 text-gold"
                      : "border-border/60 hover:border-gold/50 hover:bg-muted/30 text-muted-foreground"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                >
                  <UploadCloud className="h-8 w-8 opacity-60" />
                  <p className="text-sm font-medium">{dragging ? "Drop images here" : "Click or drag & drop images"}</p>
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

                {totalImages > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {existingUrls.map((url, idx) => (
                      <div key={`ex-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-border/60">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 py-0.5 rounded leading-none">saved</span>
                        <button type="button" onClick={() => removeExisting(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {previews.map((src, idx) => (
                      <div key={`pv-${idx}`} className="group relative aspect-square rounded-md overflow-hidden border border-gold/40">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[9px] bg-gold/80 text-white px-1 py-0.5 rounded leading-none">new</span>
                        <button type="button" onClick={() => removePending(idx)}
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
                  className="bg-gold text-gold-foreground hover:bg-gold/90 min-w-[130px]"
                >
                  {saving
                    ? (pendingFiles.length > 0 ? `Uploading ${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""}…` : "Saving…")
                    : (editing ? "Save changes" : "Create room")
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
            Add a hotel first before creating rooms.
          </div>
        )}
        {rooms.map((r) => (
          <Card key={r.id} className="flex items-center gap-4 p-4">
            {r.images?.[0] ? (
              <img src={r.images[0]} alt="" className="h-16 w-24 rounded object-cover shrink-0" />
            ) : (
              <div className="h-16 w-24 rounded bg-muted flex items-center justify-center shrink-0">
                <ImageOff className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.hotels?.name} · {r.room_type} · ${Number(r.price_per_night).toFixed(0)}/night · {r.capacity} guests
              </div>
              {r.images?.length > 0 && (
                <div className="text-xs text-muted-foreground/60 mt-0.5">
                  {r.images.length} image{r.images.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}