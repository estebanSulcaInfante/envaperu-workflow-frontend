import { createClient } from '@supabase/supabase-js';
import {
  SCM_AUTH_MODE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '../config/runtime';

let client;

export const getSupabaseClient = () => {
  if (SCM_AUTH_MODE !== 'supabase') return null;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('La autenticación no está configurada para este entorno.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
};

export const getAccessToken = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
};

