import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2, DollarSign, BedDouble, CalendarDays,
  Pencil, Save, X, UploadCloud, ImageOff, Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Price } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/")({
  component: OwnerOverview,
});

function OwnerOverview() {
  const { user } = useAuth();
  const [hotel, setHotel] = useState<any>(null);
  const [stats, setStats] = useState({ totalRooms: 0, activeBookings: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", country: "", address: "", description: "", cover_image: "" });
  const [saving, setSaving] = useState(false);

  // New Image Upload States
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function loadDashboardData() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: hotelData, error: hErr } = await supabase
        .from("hotels")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (hErr) throw hErr;
      if (!hotelData) { setHotel(null); setLoading(false); return; }

      setHotel(hotelData);
      setForm({
        name: hotelData.name,
        city: hotelData.city,
        country: hotelData.country,
        address: hotelData.address ?? "",
        description: hotelData.description ?? "",
        cover_image: hotelData.cover_image ?? "",
      });

      const [roomsRes, bookingsRes] = await Promise.all([
        supabase.from("rooms").select("id", { count: "exact" }).eq("hotel_id", hotelData.id),
        supabase.from("bookings").select("*").eq("hotel_id", hotelData.id),
      ]);

      const bookings = bookingsRes.data || [];
      setStats({
        totalRooms: roomsRes.count || 0,
        activeBookings: bookings.filter((b) => b.status === "confirmed" || b.status === "checked_in").length,
        totalEarnings: bookings
          .filter((b) => b.payment_status === "paid" && b.status !== "cancelled")
          .reduce((sum, b) => sum + Number(b.total_price || 0), 0),
      });
      setRecentBookings(bookings.slice(0, 5));
    } catch (err: any) {
      toast.error("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  // Handle local file selection and preview
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    if (selected.size > 5 * 1024 * 1024) {
      return toast.error("Image must be smaller than 5MB");
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function cancelEdit() {
    setEditing(false);
    setFile(null);
    setPreviewUrl(null);
    // Reset form to existing DB values
    setForm({
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      address: hotel.address ?? "",
      description: hotel.description ?? "",
      cover_image: hotel.cover_image ?? "",
    });
  }

  async function saveHotel() {
    if (!hotel) return;
    setSaving(true);
    
    let finalImageUrl = form.cover_image;

    try {
      // 1. If a new file is selected, upload it to the storage bucket first
      if (file) {
        const fileExt = file.name.split('.').pop();
        // Uses hotel.id as the first segment to satisfy RLS policy
        const fileName = `${hotel.id}/hotel/cover-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("hotel_images")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

        // Get the public URL to save to the database
        const { data: publicUrlData } = supabase.storage
          .from("hotel_images")
          .getPublicUrl(fileName);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Update the hotel details in the database
      const { error: dbError } = await supabase
        .from("hotels")
        .update({
          name: form.name,
          city: form.city,
          country: form.country,
          address: form.address || null,
          description: form.description || null,
          cover_image: finalImageUrl || null,
        })
        .eq("id", hotel.id);

      if (dbError) throw dbError;

      toast.success("Hotel details updated successfully.");
      setFile(null);
      setPreviewUrl(null);
      setEditing(false);
      loadDashboardData();
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { loadDashboardData(); }, [user]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading dashboard…</div>;

  if (!hotel) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto border-dashed mt-10">
        <Building2 className="mx-auto h-12 w-12 text-gold mb-4" />
        <h2 className="text-xl font-semibold">Setting Up Your Workspace</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your account has been approved. Contact support if this persists.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* Hotel Details Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Hotel Details</h2>
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 min-w-[80px]" onClick={saveHotel} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Hotel Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
            
            {/* New Clean Image Upload UI */}
            <div className="sm:col-span-2">
              <Label className="mb-2 block">Cover Image</Label>
              <div className="flex items-start gap-5 rounded-lg border border-dashed border-border/60 p-4 bg-muted/20">
                <div className="relative h-28 w-44 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                  {(previewUrl || form.cover_image) ? (
                    <img src={previewUrl || form.cover_image} alt="Cover" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/50">
                      <ImageOff className="h-6 w-6 mb-1" />
                      <span className="text-[10px] uppercase tracking-wider">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-2 py-2">
                  <label
                    htmlFor="cover-upload"
                    className={`cursor-pointer inline-flex w-fit items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 ${saving ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <UploadCloud className="h-4 w-4 mr-2 text-gold" />
                    Select Photo
                    <input
                      id="cover-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      onChange={handleFileChange}
                      disabled={saving}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                    Recommended size: 1200x800px. JPG, PNG, or WebP up to 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {hotel.cover_image ? (
              <img src={hotel.cover_image} alt="" className="h-32 w-48 shrink-0 rounded-lg object-cover border border-border/50 shadow-sm" />
            ) : (
              <div className="h-32 w-48 shrink-0 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                <ImageOff className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-semibold">{hotel.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {hotel.address ? `${hotel.address}, ` : ""}{hotel.city}, {hotel.country}
              </p>
              {hotel.description && <p className="text-sm mt-3 text-muted-foreground leading-relaxed max-w-2xl">{hotel.description}</p>}
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-6 flex items-center gap-4 border-border/60">
          <div className="p-3 bg-gold/10 text-gold rounded-xl"><DollarSign className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross Earnings</p>
            <Price usd={stats.totalEarnings} className="text-2xl font-bold font-display mt-0.5 text-foreground" />
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 border-border/60">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><CalendarDays className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Bookings</p>
            <h3 className="text-2xl font-bold font-display text-foreground mt-0.5">{stats.activeBookings}</h3>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 border-border/60">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><BedDouble className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rooms Listed</p>
            <h3 className="text-2xl font-bold font-display text-foreground mt-0.5">{stats.totalRooms}</h3>
          </div>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card className="p-6 border-border/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Bookings</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/owner/bookings">View All</Link>
          </Button>
        </div>
        {recentBookings.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border/60 rounded-lg bg-muted/20">
            No reservations yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-medium">
                  <th className="py-3 px-2">Guest</th>
                  <th className="py-3 px-2">Stay Dates</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2 font-medium">
                      <div>{b.guest_name}</div>
                      <div className="text-xs font-normal text-muted-foreground">{b.guest_email}</div>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{b.check_in} → {b.check_out}</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="capitalize text-xs">{b.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right font-medium">
                      <Price usd={Number(b.total_price)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}