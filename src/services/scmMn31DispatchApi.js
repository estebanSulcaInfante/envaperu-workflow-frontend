import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotencyKey) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
});

const body = async (request) => (await request()).data;

export const listarClientesDespachoMn31Scm = () => body(() => api.get(
  '/scm/v1/despachos-mn31/clientes', { headers: headers() },
));

export const resolverMangaDespachoMn31Scm = (codigo, clienteId) => body(() => api.get(
  `/scm/v1/despachos-mn31/resolver/${encodeURIComponent(codigo)}`,
  { params: { cliente_id: clienteId }, headers: headers() },
));

export const confirmarDespachoMn31Scm = (payload, operationId) => body(() => api.post(
  '/scm/v1/despachos-mn31/confirmar', payload, { headers: headers(operationId) },
));

export const obtenerOperacionDespachoMn31Scm = (operationId) => body(() => api.get(
  `/scm/v1/despachos-mn31/operaciones/${encodeURIComponent(operationId)}`,
  { headers: headers() },
));
