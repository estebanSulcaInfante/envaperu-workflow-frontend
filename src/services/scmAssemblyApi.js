import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotent = false) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
});

const body = async (request) => (await request()).data;

export const listarOrdenesArmadoScm = (params = {}) => body(() => api.get(
  '/scm/v1/ordenes-armado',
  { headers: headers(), params },
));

export const obtenerOrdenArmadoScm = (orderId) => body(() => api.get(
  `/scm/v1/ordenes-armado/${encodeURIComponent(orderId)}`,
  { headers: headers() },
));

export const crearOrdenArmadoExcepcionalScm = (payload) => body(() => api.post(
  '/scm/v1/ordenes-armado/excepcionales',
  payload,
  { headers: headers(true) },
));

export const transicionarOrdenArmadoScm = (
  order, action, extra = {},
) => body(() => api.post(
  `/scm/v1/ordenes-armado/${encodeURIComponent(order.id)}/${action}`,
  { version: order.version, ...extra },
  { headers: headers(true) },
));
