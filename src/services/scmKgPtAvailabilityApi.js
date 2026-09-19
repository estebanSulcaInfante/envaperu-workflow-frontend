import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (operationId) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(operationId ? { 'Idempotency-Key': operationId } : {}),
  },
});

const data = async (request) => (await request()).data;

export const consultarDisponibilidadPiezasKg = (params = {}) => data(
  () => api.get('/scm/v1/disponibilidad/piezas', { ...headers(), params }),
);

export const consultarDisponibilidadPt = (params = {}) => data(
  () => api.get('/scm/v1/disponibilidad/productos-terminados', { ...headers(), params }),
);

export const listarKardexPtManual = (params = {}) => data(
  () => api.get('/scm/v1/inventario/pt', { ...headers(), params }),
);

export const listarMovimientosPtManual = (balanceId, params = {}) => data(
  () => api.get(balanceId
    ? `/scm/v1/inventario/pt/movimientos/${balanceId}`
    : '/scm/v1/inventario/pt/movimientos', { ...headers(), params }),
);

export const registrarMovimientoPtManual = (payload, operationId = crypto.randomUUID()) => data(
  () => api.post('/scm/v1/inventario/pt/movimientos', payload, headers(operationId)),
);
