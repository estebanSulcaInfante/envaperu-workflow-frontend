const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toLowerCase() === 'true';
};

const configuredActorSwitch = parseBoolean(import.meta.env.VITE_SCM_PROFILE_SWITCH_ENABLED);

export const SCM_AUTH_MODE = (
  import.meta.env.VITE_SCM_AUTH_MODE || (import.meta.env.DEV ? 'local_actor' : 'supabase')
).trim().toLowerCase();

// El selector es una ayuda de desarrollo/UAT local. El chequeo de DEV hace
// imposible incorporarlo a un build de produccion incluso por configuracion.
export const SCM_PROFILE_SWITCH_ENABLED = SCM_AUTH_MODE === 'local_actor'
  && import.meta.env.DEV
  && configuredActorSwitch !== false;

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
).trim();
