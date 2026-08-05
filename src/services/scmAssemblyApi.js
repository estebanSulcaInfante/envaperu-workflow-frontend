import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotent = false) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
});

const body = async (request) => (await request()).data;

export const listarOrdenesEnsambleScm = () => body(() => api.get(
  '/scm/v1/ordenes-ensamble',
  { headers: headers() },
));

export const transicionarOrdenEnsambleScm = (
  order, action, extra = {},
) => body(() => api.post(
  `/scm/v1/ordenes-ensamble/${encodeURIComponent(order.id)}/${action}`,
  { version: order.version, ...extra },
  { headers: headers(true) },
));
