import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const createUuid = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

const headers = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? {
      'Idempotency-Key': createUuid(),
    } : {}),
  },
});

const data = async (request) => (await request()).data;

export const listarAltasProducto = (params = {}) => data(
  () => api.get('/scm/v1/altas-producto', { ...headers(), params }),
);

export const crearAltaProducto = (payload = {}) => data(
  () => api.post('/scm/v1/altas-producto', payload, headers(true)),
);

export const obtenerAltaProducto = (draftId) => data(
  () => api.get(`/scm/v1/altas-producto/${encodeURIComponent(draftId)}`, headers()),
);

export const guardarPasoAltaProducto = (draftId, stepCode, payload) => data(
  () => api.put(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/pasos/${encodeURIComponent(stepCode)}`,
    payload,
    headers(true),
  ),
);

export const aplicarPasoAltaProducto = (draftId, stepCode, payload) => data(
  () => api.post(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/pasos/${encodeURIComponent(stepCode)}/aplicar`,
    payload,
    headers(true),
  ),
);

export const restaurarColoresDesdeEstructura = (draftId, expectedVersion) => data(
  () => api.post(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/pasos/COLORES/restaurar-desde-estructura`,
    { expected_version: expectedVersion },
    headers(true),
  ),
);

export const subirImagenAltaProducto = (
  draftId,
  entityType,
  entityId,
  { file, expectedVersion, applicationKey },
) => {
  const body = new FormData();
  body.append('imagen', file);
  body.append('expected_version', String(expectedVersion));
  body.append('application_key', applicationKey);
  return data(() => api.post(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/imagenes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    body,
    headers(true),
  ));
};

export const validarAltaProducto = (draftId, expectedVersion) => data(
  () => api.post(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/validar`,
    { expected_version: expectedVersion },
    headers(true),
  ),
);

export const finalizarAltaProducto = (draftId, expectedVersion) => data(
  () => api.post(
    `/scm/v1/altas-producto/${encodeURIComponent(draftId)}/finalizar`,
    { expected_version: expectedVersion },
    headers(true),
  ),
);

export const obtenerSesionActualDeConflicto = (error) => {
  if (Number(error?.response?.status) !== 409) return null;
  const payload = error.response?.data;
  return payload?.error?.details?.current_session
    || payload?.current_session
    || payload?.detail?.current
    || null;
};

export const obtenerSesionActualDeAplicacion = (error) => (
  error?.response?.data?.error?.details?.current_session
  || error?.response?.data?.details?.current_session
  || null
);

export const obtenerResultadosDeAplicacion = (payloadOrError) => (
  payloadOrError?.application_results
  || payloadOrError?.response?.data?.error?.details?.application_results
  || payloadOrError?.response?.data?.details?.application_results
  || null
);
