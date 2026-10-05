import api from './api';
import { API_BASE_URL } from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (key) => ({ 'X-Actor-Id': String(obtenerActorScm()), ...(key ? { 'Idempotency-Key': key } : {}) });
export const resolveKgUnit = async (code) => (await api.get(`/scm/v1/unidades-kg/resolver-identidad/${encodeURIComponent(code)}`, { headers: headers() })).data;
export const resolveKgOutgoingUnit = async (code) => (await api.get(`/scm/v1/unidades-kg/resolver-salida/${encodeURIComponent(code)}`, { headers: headers() })).data;
export const listKgWithdrawals = async () => (await api.get('/scm/v1/retiros-armado-kg', { headers: headers() })).data;
export const commandKgCustody = async ({ path, data, key }) => (await api.post(`/scm/v1/${path}`, data, { headers: headers(key) })).data;

/**
 * Direct, one-transaction withdrawal of verified KG units for Armado.
 * The caller owns the idempotency key so an ambiguous response can be
 * replayed with the exact same request body.
 */
export const crearRetiroArmadoKgLote = async (payload, idempotencyKey) => (
  await api.post('/scm/v1/retiros-armado-kg/lotes', payload, {
    headers: headers(idempotencyKey),
  })
).data;

export const obtenerOperacionRetiroArmadoKgLote = async (operationId) => (
  await api.get(`/scm/v1/retiros-armado-kg/lotes/${encodeURIComponent(operationId)}`, {
    headers: headers(),
  })
).data;

export const directKgStorageNamespace = (actorId) => (
  `scm-kg-direct-batch:${API_BASE_URL}:${String(actorId)}`
);
