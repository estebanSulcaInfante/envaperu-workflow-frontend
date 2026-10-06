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

// Explicit opt-in for the assistant pilot. The default is false so a build
// cannot expose the route before identity/provider validation is complete.
export const SCM_ASSISTANT_ENABLED = String(
  import.meta.env.VITE_SCM_ASSISTANT_ENABLED || '',
).trim().toLowerCase() === 'true';

// Assistant v2 is deliberately opt-in while the analytical chat contract is
// validated with the SCM API. Keep the orb out of every build by default.
export const SCM_ASSISTANT_V2_ENABLED = String(
  import.meta.env.VITE_SCM_ASSISTANT_V2_ENABLED || '',
).trim().toLowerCase() === 'true';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
).trim();
