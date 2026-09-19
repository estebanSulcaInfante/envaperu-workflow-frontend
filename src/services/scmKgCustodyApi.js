import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (key) => ({ 'X-Actor-Id': String(obtenerActorScm()), ...(key ? { 'Idempotency-Key': key } : {}) });
export const resolveKgUnit = async (code) => (await api.get(`/scm/v1/unidades-kg/resolver-identidad/${encodeURIComponent(code)}`, { headers: headers() })).data;
export const listKgWithdrawals = async () => (await api.get('/scm/v1/retiros-armado-kg', { headers: headers() })).data;
export const commandKgCustody = async ({ path, data, key }) => (await api.post(`/scm/v1/${path}`, data, { headers: headers(key) })).data;
