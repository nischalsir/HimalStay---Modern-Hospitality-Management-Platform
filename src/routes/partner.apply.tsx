import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/apply")({
  component: PartnerApply,
});

function PartnerApply() {
  const { user, loading } = useAuth();
  
  // Form State
  const [hotelName, setHotelName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Strictly enforce numeric input and 10-digit limit for Nepal
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, ""); // Strip non-numeric characters
    if (numericValue.length <= 10) {
      setPhone(numericValue);
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null); // Clear previous errors

    if (!user) return setErrorMessage("You must be logged in to apply.");

    // 1. Strict Email Validation
    if (!email.includes("@") || !email.endsWith(".com")) {
      return setErrorMessage("Please enter a valid business email address ending in .com");
    }

    // 2. Strict Phone Length Validation (Nepal Only)
    if (!phone || phone.length !== 10) {
      return setErrorMessage("Nepal phone numbers must be exactly 10 digits.");
    }

    // 3. Document Validation
    if (!file) return setErrorMessage("Please upload your PAN or registration document.");
    if (file.size > 5 * 1024 * 1024) return setErrorMessage("File must be less than 5MB.");

    setIsSubmitting(true);

    try {
      // 1. Upload the document securely to the 'partner_documents' bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `partner_${user.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("partner_documents")
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 2. Insert the request into the database
      const fullPhoneNumber = `+977 ${phone}`;
      
      const { error: dbError } = await supabase
        .from("hotel_requests")
        .insert({
          user_id: user.id,
          hotel_name: hotelName,
          owner_name: ownerName,
          email: email,
          phone: fullPhoneNumber, // Save the combined phone number
          pan_number: panNumber,
          address: address,
          document_url: fileName, // Store the reference to the file
        });

      if (dbError) throw new Error(dbError.message);

      setIsSuccess(true);
      toast.success("Application submitted successfully!");
      
    } catch (error: any) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // State 1: User is not logged in
  if (!loading && !user) {
    return (
      <SiteLayout>
        <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md p-10 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gold" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Partner with us</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please create a standard account or sign in before applying to list your hotel.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Link to="/auth/register">Create Account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth/login">Sign In</Link>
              </Button>
            </div>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  // State 2: Successful submission
  if (isSuccess) {
    return (
      <SiteLayout>
        <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-16">
          <Card className="w-full max-w-lg p-10 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="mt-6 font-display text-2xl font-semibold">Application Received</h1>
            <p className="mt-3 text-muted-foreground">
              Thank you for applying to list <strong>{hotelName}</strong> on HimalStay. Our administrative team will review your PAN and registration documents shortly.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              We will contact you at {email} once your account has been upgraded to a Hotel Owner profile.
            </p>
            <Button asChild className="mt-8 bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/dashboard/bookings">Return to Dashboard</Link>
            </Button>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  // State 3: The Application Form
  return (
    <SiteLayout>
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold">List Your Hotel</h1>
          <p className="mt-2 text-muted-foreground">
            Fill out the details below to request a partner account. All fields are required for verification.
          </p>
        </div>

        <Card className="p-6 md:p-8">
          {/* Inline Error Message */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            
            {/* Business Details Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel / Property Name</Label>
                <Input id="hotelName" required value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="e.g. HimalStay Resort" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner's Full Name</Label>
                <Input id="ownerName" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex mt-1">
                  {/* Fixed Nepal Prefix */}
                  <div className="flex items-center justify-center rounded-l-md border border-r-0 border-input bg-muted/50 px-3 text-sm text-muted-foreground shrink-0 select-none">
                    🇳🇵 +977
                  </div>
                  {/* Dynamically restricted Phone Input */}
                  <div className="relative flex-1">
                    <Input 
                      id="phone" 
                      type="tel" 
                      className="w-full rounded-l-none"
                      value={phone} 
                      maxLength={10} 
                      onChange={handlePhoneChange} 
                      placeholder="98XXXXXXXX" 
                      required
                    />
                    {/* Subtle digit counter indicator */}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">
                      {phone.length}/10
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="panNumber">PAN / VAT Number</Label>
                <Input id="panNumber" required value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Full Address</Label>
                <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. KMC-04, Kathmandu" />
              </div>
            </div>

            {/* Document Upload Area */}
            <div className="pt-4">
              <Label className="mb-2 block">Registration Document (PAN Card or Company Registration)</Label>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-border/60 px-6 py-8">
                <div className="text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                  <div className="mt-4 flex text-sm leading-6 text-muted-foreground justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md bg-background font-semibold text-gold focus-within:outline-none focus-within:ring-2 focus-within:ring-gold hover:text-gold/80"
                    >
                      <span>Upload a file</span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="sr-only" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">PDF, PNG, JPG up to 5MB</p>
                </div>
              </div>
              {/* Show selected file name */}
              {file && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-foreground">
                  <FileText className="h-4 w-4 text-gold" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground ml-auto">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
              {isSubmitting ? "Submitting Application..." : "Submit Partner Application"}
            </Button>
            
          </form>
        </Card>
      </div>
    </SiteLayout>
  );
}