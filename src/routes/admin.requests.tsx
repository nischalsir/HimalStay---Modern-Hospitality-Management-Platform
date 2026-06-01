import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, FileText, Building2, MapPin, Mail, Phone, Hash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminShell } from "@/components/layout/AdminShell";

export const Route = createFileRoute("/admin/requests")({
  component: AdminRequests,
});

type HotelRequest = {
  id: string;
  hotel_name: string;
  owner_name: string;
  email: string;
  phone: string;
  pan_number: string;
  address: string;
  document_url: string;
  status: string;
  created_at: string;
};

function AdminRequests() {
  const [requests, setRequests] = useState<HotelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hotel_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleApprove(id: string) {
    setProcessingId(id);
    const { error } = await supabase.rpc("approve_hotel_request", { request_id: id });
    if (error) {
      toast.error(error.message || "Failed to approve partner.");
    } else {
      toast.success("Partner approved! Their hotel dashboard is ready.");
      loadRequests();
    }
    setProcessingId(null);
  }

  async function handleReject(id: string) {
    if (!window.confirm("Are you sure you want to reject this application?")) return;
    setProcessingId(id);
    const { error } = await supabase
      .from("hotel_requests")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Application rejected and removed.");
      loadRequests();
    }
    setProcessingId(null);
  }

  async function viewDocument(fileName: string) {
    const { data, error } = await supabase.storage
      .from("partner_documents")
      .createSignedUrl(fileName, 60);
    if (error || !data) {
      toast.error("Could not load document.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <AdminShell>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="font-display text-3xl font-semibold">Partner Requests</h1>
        <p className="text-muted-foreground">
          Review and approve new hotel owners to join the platform.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading pending requests...</div>
      ) : requests.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No pending requests</h3>
          <p className="text-sm text-muted-foreground">You are all caught up!</p>
        </Card>
      ) : (
        <div className="h-[calc(100vh-220px)] overflow-y-auto space-y-4 pr-1">
          {requests.map((req) => (
            <Card key={req.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-gold" />
                      {req.hotel_name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Applied by: {req.owner_name}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> {req.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> {req.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {req.address}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-4 w-4" /> PAN:{" "}
                      <span className="font-mono text-foreground">{req.pan_number}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <Button
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={() => viewDocument(req.document_url)}
                  >
                    <FileText className="h-4 w-4 text-blue-500" />
                    View Document
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={processingId === req.id}
                      onClick={() => handleReject(req.id)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={processingId === req.id}
                      onClick={() => handleApprove(req.id)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}