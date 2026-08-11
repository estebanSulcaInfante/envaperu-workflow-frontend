import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  SCM_AUTH_MODE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '../config/runtime';
import { getSupabaseClient } from '../auth/supabaseClient';
import { sessionRequiresPasswordSetup } from '../auth/authFlowModel';

const INITIAL_AUTH_ERROR = SCM_AUTH_MODE === 'supabase'
  && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)
  ? 'La autenticación no está configurada para este entorno.'
  : '';

const initialLinkType = () => {
  if (typeof window === 'undefined') return '';
  const hashType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
  const queryType = new URLSearchParams(window.location.search).get('type');
  return hashType || queryType || '';
};

const AuthContext = createContext({
  authMode: SCM_AUTH_MODE,
  error: '',
  loading: SCM_AUTH_MODE === 'supabase',
  passwordSetupRequired: false,
  session: null,
  signIn: async () => {},
  signOut: async () => {},
  updatePassword: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(
    SCM_AUTH_MODE === 'supabase' && !INITIAL_AUTH_ERROR,
  );
  const [error, setError] = useState(INITIAL_AUTH_ERROR);
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(
    () => ['invite', 'recovery'].includes(initialLinkType()),
  );

  useEffect(() => {
    if (SCM_AUTH_MODE !== 'supabase' || INITIAL_AUTH_ERROR) return undefined;

    let mounted = true;
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError('No pudimos recuperar la sesión guardada.');
      let nextSession = data.session || null;
      if (nextSession) {
        const { data: currentUser } = await supabase.auth.getUser();
        if (!mounted) return;
        if (currentUser?.user) nextSession = { ...nextSession, user: currentUser.user };
      }
      setSession(nextSession);
      setPasswordSetupRequired((current) => (
        current || sessionRequiresPasswordSetup(nextSession)
      ));
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY' || sessionRequiresPasswordSetup(nextSession)) {
        setPasswordSetupRequired(true);
      }
      setLoading(false);
      setError('');
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError('');
    const supabase = getSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    if (SCM_AUTH_MODE !== 'supabase') return;
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  }, []);

  const updatePassword = useCallback(async (password) => {
    setError('');
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        password_setup_required: false,
        password_setup_completed_at: new Date().toISOString(),
      },
    });
    if (updateError) {
      setError('No pudimos guardar la contraseña. Inténtalo nuevamente.');
      return false;
    }
    setPasswordSetupRequired(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }
    return true;
  }, []);

  const value = useMemo(() => ({
    authMode: SCM_AUTH_MODE,
    error,
    loading,
    passwordSetupRequired,
    session,
    signIn,
    signOut,
    updatePassword,
  }), [error, loading, passwordSetupRequired, session, signIn, signOut, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
