import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSupabaseClient } from '@/template';
import { UserType, UserProfile, Business, Motoboy } from '@/types';
import {
  registerSession,
  clearSession,
  isSessionValid,
  getCurrentSessionToken,
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
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (data) {
        setProfile(data);
        const uType = data.user_type as UserType;
        setUserType(uType);

        if (uType === 'business') {
          const { data: biz } = await supabase.from('businesses').select('*').eq('user_id', uid).single();
          setBusinessProfile(biz ?? null);
          setMotoboyProfile(null);
        } else if (uType === 'motoboy') {
          const { data: mb } = await supabase.from('motoboys').select('*').eq('user_id', uid).single();
          setMotoboyProfile(mb ?? null);
          setBusinessProfile(null);
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
    }, 30_000); // check every 30 seconds
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

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const uid = session.user.id;
        userIdRef.current = uid;
        setUserId(uid);
        setSessionKicked(false);

        const shouldFetch =
          uid !== lastFetchedUid ||
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          event === 'PASSWORD_RECOVERY';

        if (shouldFetch) {
          lastFetchedUid = uid;
          // Register this device as the active session (overwrites any other device)
          await registerSession(uid);
          await fetchProfile(uid).finally(() => setLoading(false));
          startSessionCheck(uid);
        }
      } else {
        lastFetchedUid = null;
        userIdRef.current = null;
        setUserId(null);
        setUserType(null);
        setProfile(null);
        setBusinessProfile(null);
        setMotoboyProfile(null);
        stopSessionCheck();
        setLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      stopSessionCheck();
    };
  }, [fetchProfile, startSessionCheck, stopSessionCheck]);

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
    if (error) return { error: 'Código inválido ou expirado' };
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
