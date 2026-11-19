import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const BASE = '/scm/v1/inventario-c66';

const headers = (idempotencyKey) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
});

const data = async (request) => (await request()).data;

export const obtenerEstadoInventarioC66 = (sessionId) => data(() => api.get(
  `${BASE}/estado${sessionId ? `?sesion_id=${encodeURIComponent(sessionId)}` : ''}`, { headers: headers() },
));

export const abrirSesionInventarioC66 = (payload, idempotencyKey) => data(() => api.post(
  `${BASE}/sesiones`, payload, { headers: headers(idempotencyKey) },
));

export const registrarLecturaInventarioC66 = (sessionId, payload, idempotencyKey) => data(() => api.post(
  `${BASE}/sesiones/${encodeURIComponent(sessionId)}/lecturas`,
  payload,
  { headers: headers(idempotencyKey) },
));

export const retirarLecturaInventarioC66 = (sessionId, code, idempotencyKey) => data(() => api.delete(
  `${BASE}/sesiones/${encodeURIComponent(sessionId)}/lecturas/${encodeURIComponent(code)}`,
  { headers: headers(idempotencyKey) },
));

export const cerrarSesionInventarioC66 = (sessionId, payload, idempotencyKey) => data(() => api.post(
  `${BASE}/sesiones/${encodeURIComponent(sessionId)}/cerrar`,
  payload,
  { headers: headers(idempotencyKey) },
));
