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

export const Route = createFileRoute("/auth/login")({
  component: Login,
});

type AuthView = "login" | "forgot_password" | "verify_otp";

function Login() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // New state for UI improvements
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to change views and clear errors
  const switchView = (newView: AuthView) => {
    setView(newView);
    setErrorMessage(null);
  };

  async function routeUser(userId: string) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const list = (roles ?? []).map((r) => r.role);
    if (list.includes("admin")) return navigate({ to: "/admin" });
    if (list.includes("hotel_owner")) return navigate({ to: "/owner" });
    navigate({ to: "/" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setErrorMessage(error.message);
    }
    if (data.user?.id) {
      toast.success("Welcome back!");
      await routeUser(data.user.id);
    }
    setLoading(false);
  }

  async function handleSendResetCode(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!email) return setErrorMessage("Please enter your email address");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) return setErrorMessage(error.message);
    toast.success("Reset code sent to your email!");
    switchView("verify_otp");
  }

  async function handleVerifyAndUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (newPassword.length < 6) return setErrorMessage("Password must be at least 6 characters");
    if (otp.length !== 6) return setErrorMessage("Please enter the 6-digit code");
    setLoading(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });
    if (verifyError) {
      setLoading(false);
      return setErrorMessage("Invalid or expired code. Please try again.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setLoading(false);
      return setErrorMessage(updateError.message);
    }
    toast.success("Password updated successfully!");
    if (data.user?.id) await routeUser(data.user.id);
    setLoading(false);
  }

  return (
    <SiteLayout>
      <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md p-8">
          <div className="mb-6 text-center">
            <img src="/logo2.png" alt="HimalStay Logo" className="mx-auto h-12 w-auto object-contain" />

            {view === "login" && (
              <>
                <h1 className="mt-4 font-display text-2xl font-semibold">Welcome back</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in as a guest, partner, or admin
                </p>
              </>
            )}
            {view === "forgot_password" && (
              <>
                <h1 className="mt-4 font-display text-2xl font-semibold">Reset Password</h1>
                <p className="mt-1 text-sm text-muted-foreground">We'll send a 6-digit code to your email</p>
              </>
            )}
            {view === "verify_otp" && (
              <>
                <h1 className="mt-4 font-display text-2xl font-semibold">Enter Code</h1>
                <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code sent to {email}</p>
              </>
            )}
          </div>

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {view === "login" && (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => switchView("forgot_password")}
                    className="text-xs text-gold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
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
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-center text-xs text-muted-foreground pt-1">
                Hotel partner?{" "}
                <Link to="/partner/apply" className="text-gold hover:underline">Apply here</Link>
              </p>
            </form>
          )}

          {view === "forgot_password" && (
            <form className="space-y-4" onSubmit={handleSendResetCode}>
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {loading ? "Sending..." : "Send Reset Code"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => switchView("login")}>
                Back to sign in
              </Button>
            </form>
          )}

          {view === "verify_otp" && (
            <form className="space-y-4" onSubmit={handleVerifyAndUpdate}>
              <div>
                <Label htmlFor="otp">6-Digit Code</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input 
                    id="new-password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
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
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {loading ? "Updating..." : "Reset & Sign In"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => switchView("forgot_password")}>
                Try a different email
              </Button>
            </form>
          )}

          {view === "login" && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/auth/register" className="text-gold hover:underline">Create one</Link>
            </p>
          )}
        </Card>
      </div>
    </SiteLayout>
  );
}