import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const data = async (request) => (await request()).data;

export const explorarSaldosInventarioScm = (params = {}) => data(
  () => api.get('/scm/v1/inventario/explorador', { ...config(), params }),
);

// Compatibilidad para consumidores ajenos al explorador. La vista principal
// usa exclusivamente el contrato paginado anterior.
export const listarSaldosInventarioScm = () => data(
  () => api.get('/scm/v1/inventario/saldos', config()),
);

export const listarMovimientosInventarioScm = () => data(
  () => api.get('/scm/v1/inventario/movimientos?limite=100', config()),
);

export const registrarMovimientoInventarioScm = (payload) => data(
  () => api.post('/scm/v1/inventario/movimientos', payload, config(true)),
);

export const listarAperturasInventarioScm = () => data(
  () => api.get('/scm/v1/inventario/aperturas', config()),
);

export const crearAperturaInventarioScm = (payload) => data(
  () => api.post('/scm/v1/inventario/aperturas', payload, config(true)),
);

export const actualizarAperturaInventarioScm = (id, payload) => data(
  () => api.put(`/scm/v1/inventario/aperturas/${id}`, payload, config(true)),
);

export const enviarAperturaInventarioScm = (id, version) => data(
  () => api.post(`/scm/v1/inventario/aperturas/${id}/enviar`, { version }, config(true)),
);

export const resolverAperturaInventarioScm = (id, payload) => data(
  () => api.post(`/scm/v1/inventario/aperturas/${id}/resolver`, payload, config(true)),
);
