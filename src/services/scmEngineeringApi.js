import api from './api';

const ACTOR_STORAGE_KEY = 'envaperu_scm_actor_id';

export const resolveActorScmId = ({ storedActorId, configuredActorId } = {}) => (
  Number(storedActorId || configuredActorId || 1)
);

export const obtenerActorScm = () => {
  const stored = globalThis.localStorage?.getItem(ACTOR_STORAGE_KEY);
  // VITE_SCM_ACTOR_ID es solamente el perfil inicial del entorno local. Una
  // selección explícita debe prevalecer para que cabecera y API no diverjan.
  return resolveActorScmId({
    storedActorId: stored,
    configuredActorId: import.meta.env.VITE_SCM_ACTOR_ID,
  });
};

export const guardarActorScm = (actorId) => {
  const parsed = Number(actorId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('El actor SCM debe ser un entero positivo.');
  }
  globalThis.localStorage?.setItem(ACTOR_STORAGE_KEY, String(parsed));
  return parsed;
};

const configForActor = (actorId, idempotent = false, signal) => ({
  headers: {
    'X-Actor-Id': String(actorId ?? obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
  ...(signal ? { signal } : {}),
});

const config = (idempotent = false, signal) => configForActor(
  undefined,
  idempotent,
  signal,
);

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

export const listarEstructurasScm = (articleId, actorId, signal) => items(
  () => api.get(`/scm/v1/articulos/${articleId}/estructuras`, configForActor(actorId, false, signal)),
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

export const listarCentrosTrabajoScm = (actorId, signal) => items(
  () => api.get('/scm/v1/centros-trabajo', configForActor(actorId, false, signal)),
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
export const listarRutasArticuloScm = (articleId, actorId, signal) => items(
  () => api.get(`/scm/v1/articulos/${encodeURIComponent(articleId)}/rutas`, configForActor(actorId, false, signal)),
);
export const crearRutaArticuloScm = (articleId, payload) => data(
  () => api.post(
    `/scm/v1/articulos/${encodeURIComponent(articleId)}/rutas`,
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

export const listarTiposContenedorScm = (actorId, signal) => items(
  () => api.get('/scm/v1/tipos-contenedor', configForActor(actorId, false, signal)),
);
export const crearTipoContenedorScm = (payload) => data(
  () => api.post('/scm/v1/tipos-contenedor', payload, config()),
);
export const actualizarTipoContenedorScm = (containerId, payload) => data(
  () => api.put(`/scm/v1/tipos-contenedor/${containerId}`, payload, config()),
);

export const listarPerfilesEmpacablesScm = (actorId, signal) => items(
  () => api.get('/scm/v1/perfiles-empacables', configForActor(actorId, false, signal)),
);
export const crearPerfilEmpacableScm = (payload) => data(
  () => api.post('/scm/v1/perfiles-empacables', payload, config()),
);
export const actualizarPerfilEmpacableScm = (profileId, payload) => data(
  () => api.put(`/scm/v1/perfiles-empacables/${profileId}`, payload, config()),
);
export const listarAsignacionesEmpaqueScm = (params = {}) => data(
  () => api.get('/scm/v1/empaque/asignaciones', { ...config(), params }),
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

// Lectores paginados aditivos. A diferencia de los wrappers legacy, estos
// reciben siempre el actor de la vista y el AbortSignal de la solicitud para
// que un cambio de actor no pueda reutilizar cabecera ni datos tardíos.
const pageParams = ({ limit, limite, cursor, q, ...rest } = {}) => ({
  ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.join(',') : value,
  ])),
  ...(q ? { q } : {}),
  ...(limit || limite ? { limite: limit || limite } : {}),
  ...(cursor ? { cursor } : {}),
});

export const listarArticulosPaginaScm = (actorId, params = {}, signal) => data(
  () => api.get('/scm/v1/articulos/pagina', {
    ...configForActor(actorId, false, signal),
    params: pageParams(params),
  }),
);

export const resolverArticulosScm = (actorId, ids, signal) => data(
  () => api.get('/scm/v1/articulos/resolver', {
    ...configForActor(actorId, false, signal),
    params: { ids: Array.isArray(ids) ? ids.join(',') : ids },
  }),
);

export const hidratarEstructurasScm = (actorId, { articuloIds, revisionIds, articulo_ids, revision_ids } = {}, signal) => data(
  () => api.get('/scm/v1/estructuras/hidratacion', {
    ...configForActor(actorId, false, signal),
    params: {
      ...(articuloIds || articulo_ids ? { articulo_ids: (articuloIds || articulo_ids).join?.(',') || articuloIds || articulo_ids } : {}),
      ...(revisionIds || revision_ids ? { revision_ids: (revisionIds || revision_ids).join?.(',') || revisionIds || revision_ids } : {}),
    },
  }),
);

export const listarAprobacionesIngenieriaScm = (actorId, params = {}, signal) => data(
  () => api.get('/scm/v1/ingenieria/aprobaciones', {
    ...configForActor(actorId, false, signal),
    params: pageParams(params),
  }),
);

export const listarReglasEmpaquePaginaScm = (actorId, params = {}, signal) => data(
  () => api.get('/scm/v1/reglas-empaque/pagina', {
    ...configForActor(actorId, false, signal),
    params: pageParams(params),
  }),
);

export const obtenerReglaEmpaqueScm = (revisionId, actorId, signal) => data(
  () => api.get(`/scm/v1/reglas-empaque/${revisionId}`, configForActor(actorId, false, signal)),
);
