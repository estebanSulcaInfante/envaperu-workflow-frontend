import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const body = async (request) => (await request()).data;

export const listarOtArmadoScm = (orderId) => body(() => api.get(
  `/scm/v1/ordenes-armado/${encodeURIComponent(orderId)}/ots`, config(),
));

export const crearOtArmadoScm = (orderId, payload) => body(() => api.post(
  `/scm/v1/ordenes-armado/${encodeURIComponent(orderId)}/ots`,
  payload,
  config(true),
));

export const obtenerPlanMangasArmadoScm = (orderId) => body(() => api.get(
  `/scm/v1/ordenes-armado/${encodeURIComponent(orderId)}/plan-mangas`,
  config(),
));

export const recalcularPlanMangasArmadoScm = (orderId) => body(() => api.post(
  `/scm/v1/ordenes-armado/${encodeURIComponent(orderId)}/plan-mangas/recalcular`,
  {},
  config(true),
));

export const asignarMangasSalidaArmadoScm = (ot) => body(() => api.post(
  `/scm/v1/ots/${encodeURIComponent(ot.public_id)}/mangas-salida`,
  { version: ot.version },
  config(true),
));

export const cerrarMangaArmadoScm = (manga, payload) => body(() => api.post(
  `/scm/v1/mangas/${encodeURIComponent(manga.public_id)}/cerrar-armado`,
  { version: manga.version, ...payload },
  config(true),
));

export const obtenerGenealogiaMangaScm = (mangaId) => body(() => api.get(
  `/scm/v1/mangas/${encodeURIComponent(mangaId)}/genealogia`,
  config(),
));

export const crearSolicitudAbastecimientoScm = (otId) => body(() => api.post(
  `/scm/v1/ots/${encodeURIComponent(otId)}/abastecimiento`, {}, config(true),
));

export const listarSolicitudesAbastecimientoScm = (estado = '') => body(() => api.get(
  '/scm/v1/abastecimiento', { ...config(), params: estado ? { estado } : {} },
));

export const asignarMangaAbastecimientoScm = (request, payload) => body(() => api.post(
  `/scm/v1/abastecimiento/${encodeURIComponent(request.id)}/mangas`,
  { version: request.version, ...payload },
  config(true),
));

export const asignarFuenteNoExactaAbastecimientoScm = (request, payload) => body(() => api.post(
  `/scm/v1/abastecimiento/${encodeURIComponent(request.id)}/fuentes-no-exactas`,
  { version: request.version, ...payload },
  config(true),
));

export const solicitarCorreccionMangaArmadoScm = (mangaId, payload) => body(() => api.post(
  `/scm/v1/mangas/${encodeURIComponent(mangaId)}/correcciones-cantidad`, payload, config(true),
));

export const aprobarCorreccionMangaArmadoScm = (correctionId, payload) => body(() => api.post(
  `/scm/v1/correcciones-armado/${encodeURIComponent(correctionId)}/aprobar`, payload, config(true),
));

export const marcarSolicitudListaScm = (request) => body(() => api.post(
  `/scm/v1/abastecimiento/${encodeURIComponent(request.id)}/lista`,
  { version: request.version },
  config(true),
));

export const despacharSolicitudScm = (request) => body(() => api.post(
  `/scm/v1/abastecimiento/${encodeURIComponent(request.id)}/despachar`,
  { version: request.version },
  config(true),
));

export const recibirSolicitudScm = (request) => body(() => api.post(
  `/scm/v1/abastecimiento/${encodeURIComponent(request.id)}/recibir`,
  { version: request.version },
  config(true),
));

export const solicitarRetornoAbastecimientoScm = (assignmentId) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones/${encodeURIComponent(assignmentId)}/retorno`,
  {},
  config(true),
));

export const despacharRetornoAbastecimientoScm = (assignmentId) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones/${encodeURIComponent(assignmentId)}/despachar-retorno`,
  {},
  config(true),
));

export const recibirRetornoAbastecimientoScm = (assignmentId, ubicacionCodigo) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones/${encodeURIComponent(assignmentId)}/recibir-retorno`,
  { ubicacion_codigo: ubicacionCodigo },
  config(true),
));

export const solicitarRetornoPoolAbastecimientoScm = (assignmentId) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones-pool/${encodeURIComponent(assignmentId)}/retorno`, {}, config(true),
));

export const despacharRetornoPoolAbastecimientoScm = (assignmentId) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones-pool/${encodeURIComponent(assignmentId)}/despachar-retorno`, {}, config(true),
));

export const recibirRetornoPoolAbastecimientoScm = (assignmentId, ubicacionCodigo) => body(() => api.post(
  `/scm/v1/abastecimiento/asignaciones-pool/${encodeURIComponent(assignmentId)}/recibir-retorno`,
  { ubicacion_codigo: ubicacionCodigo }, config(true),
));
