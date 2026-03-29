import { getSupabaseClient } from '@/template';
import { Platform } from 'react-native';

// Generate a unique session token for this app instance
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
}

let currentSessionToken: string | null = null;

export function getCurrentSessionToken(): string {
  if (!currentSessionToken) {
    currentSessionToken = generateSessionToken();
  }
  return currentSessionToken;
}

/**
 * Register or update this device's active session.
 * On login, upserts the session row — any previous session for
 * the same user_id (another device) is overwritten.
 */
export async function registerSession(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const token = getCurrentSessionToken();
  const deviceInfo = `${Platform.OS} ${Platform.Version}`;

  await supabase.from('active_sessions').upsert(
    {
      user_id: userId,
      session_token: token,
      device_info: deviceInfo,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

/**
 * Update last_seen_at heartbeat — called periodically so we can detect stale sessions.
 * Returns the current active token for this user so the caller can compare.
 */
export async function updateSessionHeartbeat(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const token = getCurrentSessionToken();

  await supabase
    .from('active_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_token', token);

  // Read back the stored token to detect if another device took over
  const { data } = await supabase
    .from('active_sessions')
    .select('session_token')
    .eq('user_id', userId)
    .single();

  return data?.session_token ?? null;
}

/**
 * Check if this device's session is still the active one.
 * Returns false if another device has logged in with the same account.
 */
export async function isSessionValid(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const token = getCurrentSessionToken();

  const { data } = await supabase
    .from('active_sessions')
    .select('session_token')
    .eq('user_id', userId)
    .single();

  if (!data) return false;
  return data.session_token === token;
}

/**
 * Remove the session on logout.
 */
export async function clearSession(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const token = getCurrentSessionToken();

  await supabase
    .from('active_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('session_token', token);

  currentSessionToken = null;
}
