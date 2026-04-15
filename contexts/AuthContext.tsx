import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { getSupabaseClient } from '@/template';
import { UserType, UserProfile, Business, Motoboy } from '@/types';
import {
  registerSession,
  clearSession,
  isSessionValid,
} from '@/services/sessionService';

interface AuthContextType {
  userId: string | null;
  userType: UserType | null;
  profile: UserProfile | null;
  businessProfile: Business | null;
  motoboyProfile: Motoboy | null;
  loading: boolean;
  sessionKicked: boolean; // true when another device took over
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, userType: UserType) => Promise<{ error: string | null; userId: string | null }>;
  signUpAndSendOTP: (email: string, password: string, userType: UserType) => Promise<{ error: string | null; userId: string | null }>;
  resendSignupOTP: (email: string) => Promise<{ error: string | null }>;
  verifyRegistrationOTP: (email: string, otp: string, userType?: UserType) => Promise<{ error: string | null; userId: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordResetOTP: (email: string) => Promise<{ error: string | null }>;
  resetPasswordWithOTP: (email: string, otp: string, newPassword: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Business | null>(null);
  const [motoboyProfile, setMotoboyProfile] = useState<Motoboy | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionKicked, setSessionKicked] = useState(false);

  // Refs for session validation
  const userIdRef = useRef<string | null>(null);
  const sessionCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSigningInRef = useRef(false); // prevents duplicate fetchProfile during signIn

  // ── Profile fetch ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    try {
      const { data } = await withTimeout(
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', uid)
          .single(),
        12_000,
        'fetch user_profiles'
      );

      if (data) {
        setProfile(data);
        const uType = data.user_type as UserType;
        setUserType(uType);

        if (uType === 'business') {
          const { data: biz } = await withTimeout(
            supabase.from('businesses').select('*').eq('user_id', uid).single(),
            12_000,
            'fetch businesses'
          );
          setBusinessProfile(biz ?? null);
          setMotoboyProfile(null);
        } else if (uType === 'motoboy') {
          const { data: mb } = await withTimeout(
            supabase.from('motoboys').select('*').eq('user_id', uid).single(),
            12_000,
            'fetch motoboys'
          );
          setMotoboyProfile(mb ?? null);
          setBusinessProfile(null);
        } else if (uType === 'customer') {
          setBusinessProfile(null);
          setMotoboyProfile(null);
        } else {
          setBusinessProfile(null);
          setMotoboyProfile(null);
        }
      } else {
        setProfile(null);
        setUserType(null);
        setBusinessProfile(null);
        setMotoboyProfile(null);
      }
    } catch (e) {
      console.error('fetchProfile error:', e);
      setProfile(null);
      setUserType(null);
      setBusinessProfile(null);
      setMotoboyProfile(null);
    }
  }, []);

  // ── Session validation loop ───────────────────────────────────────────────
  const startSessionCheck = useCallback((uid: string) => {
    if (sessionCheckTimerRef.current) {
      clearInterval(sessionCheckTimerRef.current);
    }
    sessionCheckTimerRef.current = setInterval(async () => {
      const valid = await isSessionValid(uid);
      if (!valid) {
        // Another device has taken over this account
        setSessionKicked(true);
        clearInterval(sessionCheckTimerRef.current!);
        sessionCheckTimerRef.current = null;
        // Force logout
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
    }, 10_000); // check every 10 seconds
  }, []);

  const stopSessionCheck = useCallback(() => {
    if (sessionCheckTimerRef.current) {
      clearInterval(sessionCheckTimerRef.current);
      sessionCheckTimerRef.current = null;
    }
  }, []);

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseClient();
    let lastFetchedUid: string | null = null;

    const applySession = async (event: string, session: any) => {
      try {
        if (session?.user) {
          const uid = session.user.id;
          userIdRef.current = uid;
          setUserId(uid);
          setSessionKicked(false);

          // Libera o loading ANTES de rede (registerSession/fetchProfile).
          // Se await travar ao voltar do background, o app não fica preso no spinner.
          setLoading(false);

          const shouldFetch =
            uid !== lastFetchedUid ||
            event === 'SIGNED_IN' ||
            event === 'INITIAL_SESSION' ||
            event === 'USER_UPDATED' ||
            event === 'PASSWORD_RECOVERY' ||
            event === 'TOKEN_REFRESHED';

          if (shouldFetch) {
            lastFetchedUid = uid;
            void (async () => {
              try {
                await registerSession(uid);
                await fetchProfile(uid);
                startSessionCheck(uid);
              } catch (e) {
                console.error('applySession background sync:', e);
              }
            })();
          } else {
            startSessionCheck(uid);
          }
          return;
        }

        lastFetchedUid = null;
        userIdRef.current = null;
        setUserId(null);
        setUserType(null);
        setProfile(null);
        setBusinessProfile(null);
        setMotoboyProfile(null);
        stopSessionCheck();
        setLoading(false);
      } catch (e) {
        console.error('applySession error:', e);
        setLoading(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      await applySession(event, session);
    });

    // Fallback: sometimes INITIAL_SESSION doesn't fire reliably on some Android
    // process-restores. Timeout evita loading infinito se getSession travar.
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          'getSession bootstrap'
        );
        await applySession('GET_SESSION', data?.session);
      } catch (e) {
        console.warn('getSession bootstrap failed:', e);
        setLoading(false);
      }
    })();

    return () => {
      listener.subscription.unsubscribe();
      stopSessionCheck();
    };
  }, [fetchProfile, startSessionCheck, stopSessionCheck]);

  // ── Token auto-refresh on AppState; ao voltar, garante que loading não trave ─
  useEffect(() => {
    const supabase = getSupabaseClient();
    const sub = AppState.addEventListener('change', (state) => {
      try {
        if (state === 'active') {
          (
            supabase.auth as typeof supabase.auth & {
              startAutoRefresh?: () => void;
              stopAutoRefresh?: () => void;
            }
          ).startAutoRefresh?.();
          void (async () => {
            try {
              await withTimeout(supabase.auth.getSession(), 10_000, 'getSession on resume');
            } catch {
              // ignore — só não deixar loading preso
            }
            setLoading(false);
          })();
        } else {
          (
            supabase.auth as typeof supabase.auth & {
              startAutoRefresh?: () => void;
              stopAutoRefresh?: () => void;
            }
          ).stopAutoRefresh?.();
        }
      } catch {
        // ignore
      }
    });
    return () => sub.remove();
  }, []);

  // ── Auth methods ──────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    uType: UserType
  ): Promise<{ error: string | null; userId: string | null }> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, userId: null };
    if (!data.user) return { error: 'Erro ao criar usuário', userId: null };
    await supabase.from('user_profiles').update({ user_type: uType, email }).eq('id', data.user.id);
    return { error: null, userId: data.user.id };
  };

  const signUpAndSendOTP = async (
    email: string,
    password: string,
    uType: UserType
  ): Promise<{ error: string | null; userId: string | null }> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, userId: null };
    if (!data.user) return { error: 'Erro ao criar usuário', userId: null };
    const uid = data.user.id;
    await supabase.from('user_profiles').update({ user_type: uType, email }).eq('id', uid);
    return { error: null, userId: uid };
  };

  const resendSignupOTP = async (email: string): Promise<{ error: string | null }> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { error: error.message };
    return { error: null };
  };

  const verifyRegistrationOTP = async (
    email: string,
    otp: string,
    uType?: UserType
  ): Promise<{ error: string | null; userId: string | null }> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
    if (error) return { error: 'Código inválido ou expirado', userId: null };
    const uid = data.user?.id ?? null;
    if (uid && uType) {
      await supabase.from('user_profiles').update({ user_type: uType, email }).eq('id', uid);
    }
    return { error: null, userId: uid };
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (userIdRef.current) {
      await clearSession(userIdRef.current);
    }
    stopSessionCheck();
    await supabase.auth.signOut();
  };

  const sendPasswordResetOTP = async (email: string): Promise<{ error: string | null }> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return { error: error.message };
    return { error: null };
  };

  const resetPasswordWithOTP = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ error: string | null }> => {
    const supabase = getSupabaseClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (verifyError) return { error: 'Código inválido ou expirado' };
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { error: updateError.message };
    return { error: null };
  };

  const refreshProfile = async () => {
    if (userIdRef.current) {
      await fetchProfile(userIdRef.current);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        userType,
        profile,
        businessProfile,
        motoboyProfile,
        loading,
        sessionKicked,
        signIn,
        signUp,
        signUpAndSendOTP,
        resendSignupOTP,
        verifyRegistrationOTP,
        signOut,
        refreshProfile,
        sendPasswordResetOTP,
        resetPasswordWithOTP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
