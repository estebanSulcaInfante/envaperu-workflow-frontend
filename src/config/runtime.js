const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toLowerCase() === 'true';
};

const configuredActorSwitch = parseBoolean(import.meta.env.VITE_SCM_PROFILE_SWITCH_ENABLED);

// El selector es una ayuda de desarrollo/UAT local. El chequeo de DEV hace
// imposible incorporarlo a un build de produccion incluso por configuracion.
export const SCM_PROFILE_SWITCH_ENABLED = import.meta.env.DEV
  && configuredActorSwitch !== false;
