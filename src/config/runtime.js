const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toLowerCase() === 'true';
};

const configuredActorSwitch = parseBoolean(import.meta.env.VITE_SCM_PROFILE_SWITCH_ENABLED);

export const SCM_DEMO_MODE = (
  import.meta.env.VITE_SCM_DEMO_MODE || ''
).trim().toLowerCase();

export const PORTFOLIO_DEMO_ENABLED = SCM_DEMO_MODE === 'portfolio';

export const SCM_AUTH_MODE = (
  import.meta.env.VITE_SCM_AUTH_MODE || (import.meta.env.DEV ? 'local_actor' : 'supabase')
).trim().toLowerCase();

export const SCM_PROFILE_SWITCH_ENABLED = SCM_AUTH_MODE === 'local_actor'
  && (import.meta.env.DEV || PORTFOLIO_DEMO_ENABLED)
  && configuredActorSwitch !== false;

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
).trim();
