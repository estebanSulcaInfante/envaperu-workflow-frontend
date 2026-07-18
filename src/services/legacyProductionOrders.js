import api from './api';


export const getLegacyProductionOrders = async ({
  page = 1,
  perPage = 50,
  query,
  status,
  signal,
} = {}) => {
  const params = { page, per_page: perPage };
  if (query) params.q = query;
  if (status) params.status = status;
  const response = await api.get('/monitoring/v1/legacy-production-orders', {
    params,
    signal,
  });
  return response.data;
};


export const getLegacyProductionOrderDetail = async ({
  stationId,
  op,
  page = 1,
  perPage = 100,
  signal,
}) => {
  const response = await api.get('/monitoring/v1/legacy-production-orders/detail', {
    params: {
      station_id: stationId,
      op,
      page,
      per_page: perPage,
    },
    signal,
  });
  return response.data;
};


export const createPilotCommand = async ({
  stationId,
  action,
  legacyPesajeId,
  op,
  requestedBy,
  reason,
}) => {
  const commandId = crypto.randomUUID();
  const response = await api.post('/monitoring/v1/pilot-commands', {
    command_id: commandId,
    station_id: stationId,
    action,
    requested_by: requestedBy,
    reason,
    ...(legacyPesajeId ? { legacy_pesaje_id: legacyPesajeId } : {}),
    ...(op ? { op } : {}),
  });
  return response.data;
};
