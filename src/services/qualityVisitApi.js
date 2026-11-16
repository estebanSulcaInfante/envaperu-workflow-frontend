import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const collection = otId => `/scm/v1/ots/${encodeURIComponent(otId)}/calidad-visitas`;
const configuration = otId => `/scm/v1/ots/${encodeURIComponent(otId)}/calidad-configuracion`;
const headers = key => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(key ? { 'Idempotency-Key': key } : {}),
});

export const qualityVisitApi = {
  async loadVisits(otId, { signal } = {}) {
    return (await api.get(collection(otId), { headers: headers(), signal })).data;
  },
  async saveDraft(otId, payload, { idempotencyKey, signal } = {}) {
    const data = (await api.patch(collection(otId), payload, { headers: headers(idempotencyKey), ...(signal ? { signal } : {}) })).data;
    return data?.visit ?? data;
  },
  async confirmVisit(otId, visitId, payload, { idempotencyKey, signal } = {}) {
    const path = `${collection(otId)}/${encodeURIComponent(visitId)}/confirmar`;
    const data = (await api.put(path, payload, { headers: headers(idempotencyKey), ...(signal ? { signal } : {}) })).data;
    return data?.visit ?? data;
  },
  async updateConfiguration(otId, payload, { idempotencyKey, signal } = {}) {
    return (await api.patch(configuration(otId), payload, { headers: headers(idempotencyKey), ...(signal ? { signal } : {}) })).data;
  },
};
