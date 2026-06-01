import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth/register")({
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
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

    // 1. Strict Email Validation
    if (!email.includes("@") || !email.endsWith(".com")) {
      return setErrorMessage("Please enter a valid email address ending in .com");
    }

    // 2. Strict Phone Length Validation (Nepal Only)
    if (!phone) {
      return setErrorMessage("Phone number is required");
    }
    if (phone.length !== 10) {
      return setErrorMessage("Nepal phone numbers must be exactly 10 digits.");
    }

    // 3. Password Validation
    if (password.length < 6) {
      return setErrorMessage("Password must be at least 6 characters");
    }

    setLoading(true);
    
    // Hardcode the +977 country code for the database
    const fullPhoneNumber = `+977 ${phone}`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { 
          full_name: fullName,
          phone: fullPhoneNumber,
        },
      },
    });
    
    setLoading(false);
    
    if (error) {
      return setErrorMessage(error.message);
    }
    
    toast.success("Account created. You're signed in.");
    navigate({ to: "/" });
  }

  return (
    <SiteLayout>
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md p-8 shadow-sm">
          <div className="mb-6 text-center">
            <img src="/logo2.png" alt="HimalStay Logo" className="mx-auto h-12 w-auto object-contain" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start booking exceptional stays across Nepal</p>
          </div>

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input 
                id="name" 
                required 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="name@example.com"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Phone number</Label>
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
            
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
            </div>
            
            <Button type="submit" disabled={loading} className="mt-4 w-full bg-gold text-gold-foreground hover:bg-gold/90">
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-gold hover:underline font-medium">Sign in</Link>
          </p>
        </Card>
      </div>
    </SiteLayout>
  );
}