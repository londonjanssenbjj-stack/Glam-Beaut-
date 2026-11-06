import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { AppRole, Profile } from "../types/database";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = useCallback(async (user: User) => {
    const userId = user.id;
    let profileResult = await supabase.from("profiles")
      .select("id,full_name,phone,email").eq("id", userId).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data) {
      const metadata = user.user_metadata ?? {};
      const { error: createProfileError } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: typeof metadata.full_name === "string" ? metadata.full_name : "",
        phone: typeof metadata.phone === "string" ? metadata.phone : null,
        email: user.email ?? null,
      });
      if (createProfileError) throw createProfileError;
      profileResult = await supabase.from("profiles")
        .select("id,full_name,phone,email").eq("id", userId).maybeSingle();
      if (profileResult.error) throw profileResult.error;
    }

    let roleResult = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (roleResult.error) throw roleResult.error;
    if (!(roleResult.data ?? []).some((item) => item.role === "customer")) {
      const { error: roleError } = await supabase.from("user_roles")
        .upsert({ user_id: userId, role: "customer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (roleError) throw roleError;
      roleResult = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (roleResult.error) throw roleResult.error;
    }
    setProfile(profileResult.data as Profile | null);
    setRoles((roleResult.data ?? []).map((item) => item.role as AppRole));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadUserData(session.user);
  }, [loadUserData, session]);

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      try {
        if (data.session?.user) await loadUserData(data.session.user);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil.");
      } finally {
        if (alive) setLoading(false);
      }
    }).catch((cause: unknown) => {
      if (alive) {
        setError(cause instanceof Error ? cause.message : "Falha ao iniciar autenticação.");
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      } else {
        // Evita chamadas Supabase dentro do callback síncrono de auth.
        queueMicrotask(() => {
          loadUserData(nextSession.user).catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : "Falha ao carregar permissões."),
          ).finally(() => setLoading(false));
        });
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
  }, []);

  const signUp = useCallback(async ({ email, password, fullName, phone }: {
    email: string; password: string; fullName: string; phone?: string;
  }) => {
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: phone ?? "" } },
    });
    if (authError) throw authError;
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id, full_name: fullName, phone: phone ?? "", email,
      });
      if (profileError) throw profileError;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = new URL("/redefinir-senha", window.location.origin).toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) throw resetError;
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const value = useMemo<AuthState>(() => ({
    session, user: session?.user ?? null, profile, roles, loading, error,
    signIn, signUp, resetPassword, signOut, refreshProfile,
  }), [session, profile, roles, loading, error, signIn, signUp, resetPassword, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  return context;
}
