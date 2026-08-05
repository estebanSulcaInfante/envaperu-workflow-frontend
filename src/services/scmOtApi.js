import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotent = false) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
});
const body = async (request) => (await request()).data;

export const listarOrdenesFabricacionScm = () => body(() => api.get(
  '/scm/v1/ordenes-fabricacion',
  { headers: headers() },
));
export const configurarOrdenFabricacionScm = (ofId, payload) => body(
  () => api.patch(
    `/scm/v1/ordenes-fabricacion/${encodeURIComponent(ofId)}`,
    payload,
    { headers: headers(true) },
  ),
);
export const liberarOrdenFabricacionScm = (ofId, version) => body(
  () => api.post(
    `/scm/v1/ordenes-fabricacion/${encodeURIComponent(ofId)}/liberar`,
    { version },
    { headers: headers(true) },
  ),
);
export const obtenerPlanMangas = (ofId) => body(() => api.get(
  `/scm/v1/ordenes-fabricacion/${encodeURIComponent(ofId)}/plan-mangas`,
  { headers: headers() },
));
export const recalcularPlanMangas = (ofId) => body(() => api.post(
  `/scm/v1/ordenes-fabricacion/${encodeURIComponent(ofId)}/plan-mangas/recalcular`,
  {},
  { headers: headers(true) },
));
export const listarOtScm = (ofId, tipoOt) => body(() => api.get('/scm/v1/ots', {
  params: {
    ...(ofId ? { orden_operacion_id: ofId } : {}),
    ...(tipoOt ? { tipo_ot: tipoOt } : {}),
  },
  headers: headers(),
}));
export const crearOtScm = (ofId, payload) => body(() => api.post(
  `/scm/v1/ordenes-fabricacion/${encodeURIComponent(ofId)}/ots`,
  payload,
  { headers: headers(true) },
));
export const generarEtiquetasPrepesaje = (mangaIds) => body(() => api.post(
  `/scm/v1/mangas/${mangaIds[0]}/etiquetas-prepesaje`,
  { manga_ids: mangaIds },
  { headers: headers(true) },
));
export const cambiarEstadoOtScm = (otId, action, version) => body(() => api.post(
  `/scm/v1/ots/${otId}/${action}`,
  { version },
  { headers: headers(true) },
));
export const agregarMangasNormalesScm = (otId, payload) => body(() => api.post(
  `/scm/v1/ots/${otId}/mangas`,
  payload,
  { headers: headers(true) },
));
export const solicitarMangaExtraScm = (otId, payload) => body(() => api.post(
  `/scm/v1/ots/${otId}/mangas-extra/solicitudes`,
  payload,
  { headers: headers(true) },
));
export const listarSolicitudesMangaExtraScm = (ofId, estado) => body(
  () => api.get('/scm/v1/mangas-extra/solicitudes', {
    params: {
      ...(ofId ? { orden_operacion_id: ofId } : {}),
      ...(estado ? { estado } : {}),
    },
    headers: headers(),
  }),
);
export const aprobarMangaExtraScm = (requestId) => body(() => api.post(
  `/scm/v1/mangas-extra/solicitudes/${requestId}/aprobar`,
  {},
  { headers: headers(true) },
));
export const anularMangaScm = (mangaId, motivo) => body(() => api.post(
  `/scm/v1/mangas/${mangaId}/anular`,
  { motivo },
  { headers: headers(true) },
));
export const reemplazarEtiquetaScm = (labelId, motivo) => body(() => api.post(
  `/scm/v1/etiquetas/${labelId}/reemplazos`,
  { motivo },
  { headers: headers(true) },
));
export const obtenerPesajeMangaScm = (mangaId) => body(() => api.get(
  `/scm/v1/mangas/${mangaId}/pesaje`,
  { headers: headers() },
));
export const solicitarCorreccionPesajeScm = (
  weighingId, payload,
) => body(() => api.post(
  `/scm/v1/pesajes/${weighingId}/correcciones`,
  payload,
  { headers: headers(true) },
));
export const anularPesajeScm = (weighingId, payload) => body(() => api.post(
  `/scm/v1/pesajes/${weighingId}/anular`, payload,
  { headers: headers(true) },
));

export const aprobarCorreccionPesajeScm = (
  correctionId, payload = {},
) => body(() => api.post(
  `/scm/v1/correcciones-pesaje/${correctionId}/aprobar`,
  payload,
  { headers: headers(true) },
));
