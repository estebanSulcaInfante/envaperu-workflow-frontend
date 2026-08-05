import api from './api';

const ACTOR_STORAGE_KEY = 'envaperu_scm_actor_id';

export const obtenerActorScm = () => {
  const stored = globalThis.localStorage?.getItem(ACTOR_STORAGE_KEY);
  return Number(import.meta.env.VITE_SCM_ACTOR_ID || stored || 1);
};

export const guardarActorScm = (actorId) => {
  const parsed = Number(actorId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('El actor SCM debe ser un entero positivo.');
  }
  globalThis.localStorage?.setItem(ACTOR_STORAGE_KEY, String(parsed));
  return parsed;
};

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const items = async (request) => (await request()).data?.items || [];
const data = async (request) => (await request()).data;

export const mensajeErrorScm = (error, fallback = 'No se pudo completar la operación.') => {
  const payload = error?.response?.data;
  const apiError = payload?.error;
  if (typeof apiError === 'string') return apiError;
  if (apiError && typeof apiError.message === 'string') return apiError.message;
  return payload?.message || error?.message || fallback;
};

export const listarArticulosScm = () => items(
  () => api.get('/scm/v1/articulos', config()),
);
export const crearArticuloWipScm = (payload) => data(
  () => api.post('/scm/v1/articulos/wip', payload, config()),
);
export const actualizarArticuloWipScm = (articleId, payload) => data(
  () => api.patch(`/scm/v1/articulos/wip/${articleId}`, payload, config()),
);

export const listarEstructurasScm = (articleId) => items(
  () => api.get(`/scm/v1/articulos/${articleId}/estructuras`, config()),
);
export const crearEstructuraScm = (articleId, payload) => data(
  () => api.post(`/scm/v1/articulos/${articleId}/estructuras`, payload, config()),
);
export const actualizarEstructuraScm = (structureId, payload) => data(
  () => api.put(`/scm/v1/estructuras/${structureId}`, payload, config()),
);
export const enviarEstructuraScm = (revision) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/enviar`,
    { version: revision.version },
    config(true),
  ),
);
export const aprobarEstructuraScm = (revision) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/aprobar`,
    { version: revision.version },
    config(true),
  ),
);
export const publicarEstructuraScm = (revision) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/publicar`,
    { version: revision.version },
    config(true),
  ),
);
export const rechazarEstructuraScm = (revision, motivo) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/rechazar`,
    { version: revision.version, motivo },
    config(true),
  ),
);
export const descartarEstructuraScm = (revision, motivo) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/descartar`,
    { version: revision.version, motivo },
    config(true),
  ),
);
export const retirarEstructuraScm = (revision) => data(
  () => api.post(
    `/scm/v1/estructuras/${revision.id}/retirar`,
    { version: revision.version },
    config(true),
  ),
);

export const listarCentrosTrabajoScm = () => items(
  () => api.get('/scm/v1/centros-trabajo', config()),
);
export const crearCentroTrabajoScm = (payload) => data(
  () => api.post('/scm/v1/centros-trabajo', payload, config()),
);
export const actualizarCentroTrabajoScm = (centerId, payload) => data(
  () => api.patch(`/scm/v1/centros-trabajo/${centerId}`, payload, config()),
);

export const listarRutasScm = (productId) => items(
  () => api.get(`/scm/v1/productos/${encodeURIComponent(productId)}/rutas`, config()),
);
export const crearRutaScm = (productId, payload) => data(
  () => api.post(
    `/scm/v1/productos/${encodeURIComponent(productId)}/rutas`,
    payload,
    config(),
  ),
);
export const actualizarRutaScm = (routeId, payload) => data(
  () => api.put(`/scm/v1/rutas/${routeId}`, payload, config()),
);
export const aprobarRutaScm = (revision) => data(
  () => api.post(
    `/scm/v1/rutas/${revision.id}/aprobar`,
    { version: revision.version },
    config(true),
  ),
);
export const publicarRutaScm = (revision) => data(
  () => api.post(
    `/scm/v1/rutas/${revision.id}/publicar`,
    { version: revision.version },
    config(true),
  ),
);
export const retirarRutaScm = (revision) => data(
  () => api.post(
    `/scm/v1/rutas/${revision.id}/retirar`,
    { version: revision.version },
    config(true),
  ),
);

export const listarTiposContenedorScm = () => items(
  () => api.get('/scm/v1/tipos-contenedor', config()),
);
export const crearTipoContenedorScm = (payload) => data(
  () => api.post('/scm/v1/tipos-contenedor', payload, config()),
);
export const actualizarTipoContenedorScm = (containerId, payload) => data(
  () => api.put(`/scm/v1/tipos-contenedor/${containerId}`, payload, config()),
);

export const listarPerfilesEmpacablesScm = () => items(
  () => api.get('/scm/v1/perfiles-empacables', config()),
);
export const crearPerfilEmpacableScm = (payload) => data(
  () => api.post('/scm/v1/perfiles-empacables', payload, config()),
);
export const actualizarPerfilEmpacableScm = (profileId, payload) => data(
  () => api.put(`/scm/v1/perfiles-empacables/${profileId}`, payload, config()),
);
export const obtenerPerfilesArticuloScm = (articleId) => data(
  () => api.get(`/scm/v1/articulos/${articleId}/perfiles-empaque`, config()),
);
export const asignarPerfilesArticuloScm = (article, profiles) => data(
  () => api.put(
    `/scm/v1/articulos/${article.id}/perfiles-empaque`,
    { version: article.version, perfiles: profiles },
    config(),
  ),
);

export const listarReglasEmpaqueScm = () => items(
  () => api.get('/scm/v1/reglas-empaque', config()),
);
export const crearReglaEmpaqueScm = (payload) => data(
  () => api.post('/scm/v1/reglas-empaque', payload, config()),
);
export const actualizarReglaEmpaqueScm = (revisionId, payload) => data(
  () => api.put(`/scm/v1/reglas-empaque/${revisionId}`, payload, config()),
);
export const aprobarReglaEmpaqueScm = (revision) => data(
  () => api.post(
    `/scm/v1/reglas-empaque/${revision.revision_id}/aprobar`,
    { version: revision.version },
    config(true),
  ),
);
export const publicarReglaEmpaqueScm = (revision) => data(
  () => api.post(
    `/scm/v1/reglas-empaque/${revision.revision_id}/publicar`,
    { version: revision.version },
    config(true),
  ),
);
export const calcularEmpaqueScm = (payload) => data(
  () => api.post('/scm/v1/reglas-empaque/calcular', payload, config()),
);
