import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const basePath = '/scm/v1/reimpresiones-postpesaje';

const headers = (operationId = '') => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(operationId ? { 'Idempotency-Key': operationId } : {}),
});

const body = async (request) => (await request()).data;

export const previewPostWeighingReprint = (payload, options = {}) => body(() => api.post(
  `${basePath}/preview`,
  payload,
  { headers: headers(), ...(options.signal ? { signal: options.signal } : {}) },
));

export const confirmPostWeighingReprint = (payload, operationId, options = {}) => body(() => api.post(
  `${basePath}/confirmar`,
  payload,
  {
    headers: headers(operationId),
    ...(options.signal ? { signal: options.signal } : {}),
  },
));

export const getPostWeighingReprintRequest = (requestId, options = {}) => body(() => api.get(
  `${basePath}/solicitudes/${encodeURIComponent(requestId)}`,
  { headers: headers(), ...(options.signal ? { signal: options.signal } : {}) },
));

export const listWeighingStations = (options = {}) => body(() => api.get(
  '/monitoring/v1/weighing-stations',
  { headers: headers(), ...(options.signal ? { signal: options.signal } : {}) },
));
