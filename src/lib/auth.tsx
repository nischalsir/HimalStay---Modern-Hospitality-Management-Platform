import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "customer" | "hotel_owner";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  isAdmin: boolean;
  isHotelOwner: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRoles(uid: string) {
      try {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        if (error) throw error;
        
        if (mounted) {
          setRoles((data ?? []).map((r) => r.role as Role));
        }
      } catch (err) {
        console.error("Failed to load user roles:", err);
      } finally {
        // CRITICAL FIX: Always stop loading, even if the database errors out
        if (mounted) setLoading(false);
      }
    }

    // 1. Initial check when the app first loads or refreshes
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("Session error:", error.message);
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      
      setSession(s);
      setUser(s?.user ?? null);
      
      if (s?.user) {
        // Only trigger loading on fresh sign-ins to avoid screen flashing
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setLoading(true);
          loadRoles(s.user.id);
        }
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error", err);
    } finally {
      // BRUTE FORCE LOGOUT: Clear local storage manually if Supabase hangs
      for (const key in localStorage) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      }
      window.location.href = "/auth/login";
    }
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        isAdmin: roles.includes("admin"),
        isHotelOwner: roles.includes("hotel_owner"),
        loading,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}