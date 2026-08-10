import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const compact = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
);

export const listarTrabajosImpresionControlScm = async (filters = {}) => (
  await api.get('/scm/v1/observabilidad/trabajos-impresion', {
    headers: { 'X-Actor-Id': String(obtenerActorScm()) },
    params: compact({
      status: filters.status,
      tipo: filters.tipo,
      q: filters.q,
      limit: filters.limit || 50,
    }),
    signal: filters.signal,
  })
).data;
