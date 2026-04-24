"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  diagnosis: string | null;
  location: string | null;
};

type ProfileUpdateInput = {
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  diagnosis?: string | null;
  location?: string | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signInWithGoogle: (nextPath?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, date_of_birth, gender, diagnosis, location")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mountedRef.current) {
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          try {
            const nextProfile = await loadProfile(currentSession.user.id);
            if (mountedRef.current) {
              setProfile(nextProfile);
            }
          } catch (error) {
            console.error("Error loading profile", error);
            if (mountedRef.current) {
              setProfile(null);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error initializing auth", error);
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        try {
          const nextProfile = await loadProfile(nextSession.user.id);
          if (mountedRef.current) {
            setProfile(nextProfile);
          }
        } catch (error) {
          console.error("Error loading profile", error);
          if (mountedRef.current) {
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
      }

      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle(nextPath?: string | null) {
    if (nextPath) {
      window.sessionStorage.setItem("auth_next_path", nextPath);
    }

    const redirectTo = `${window.location.origin}/app`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  async function updateProfile(input: ProfileUpdateInput) {
    if (!user) {
      throw new Error("No authenticated user found.");
    }

    const payload: Record<string, string | null> = {
      id: user.id,
    };

    if (input.full_name !== undefined) {
      payload.full_name = input.full_name.trim();
    }

    if (input.date_of_birth !== undefined) {
      payload.date_of_birth = input.date_of_birth;
    }

    if (input.gender !== undefined) {
      payload.gender = input.gender;
    }

    if (input.diagnosis !== undefined) {
      payload.diagnosis = input.diagnosis?.trim() ? input.diagnosis.trim() : null;
    }

    if (input.location !== undefined) {
      payload.location = input.location?.trim() ? input.location.trim() : null;
    }

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      throw error;
    }

    const nextProfile = await loadProfile(user.id);

    if (mountedRef.current) {
      setProfile(nextProfile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user,
        profile,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
