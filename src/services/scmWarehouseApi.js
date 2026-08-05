import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotent = false) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
});

const body = async (request) => (await request()).data;

export const listarRecepcionMangasScm = () => body(() => api.get(
  '/scm/v1/recepcion-mangas',
  { headers: headers() },
));

export const resolverEtiquetaRecepcionScm = (labelId) => body(() => api.get(
  `/scm/v1/recepcion-mangas/resolver-etiqueta/${encodeURIComponent(labelId)}`,
  { headers: headers() },
));

export const resolverCodigoRecepcionScm = (mangaCode) => body(() => api.get(
  `/scm/v1/recepcion-mangas/resolver-codigo/${encodeURIComponent(mangaCode)}`,
  { headers: headers() },
));

export const abrirSesionRecepcionScm = (puntoIngreso) => body(() => api.post(
  '/scm/v1/recepcion-mangas/sesiones',
  { punto_ingreso: puntoIngreso },
  { headers: headers(true) },
));

export const cerrarSesionRecepcionScm = (sessionId) => body(() => api.post(
  `/scm/v1/recepcion-mangas/sesiones/${encodeURIComponent(sessionId)}/cerrar`,
  {},
  { headers: headers(true) },
));

export const confirmarRecepcionMangaScm = (payload) => body(() => api.post(
  '/scm/v1/recepcion-mangas/confirmar',
  payload,
  { headers: headers(true) },
));

export const rechazarRecepcionMangaScm = (payload) => body(() => api.post(
  '/scm/v1/recepcion-mangas/rechazar',
  payload,
  { headers: headers(true) },
));

export const decidirCalidadMangaScm = (existenceId, payload) => body(() => api.post(
  `/scm/v1/recepcion-mangas/${encodeURIComponent(existenceId)}/calidad`,
  payload,
  { headers: headers(true) },
));

export const solicitarReversionRecepcionScm = (existenceId, payload) => body(() => api.post(
  `/scm/v1/recepcion-mangas/${encodeURIComponent(existenceId)}/reversiones`,
  payload,
  { headers: headers(true) },
));

export const resolverReversionRecepcionScm = (reversalId, payload) => body(() => api.post(
  `/scm/v1/recepcion-mangas/reversiones/${encodeURIComponent(reversalId)}/resolver`,
  payload,
  { headers: headers(true) },
));
