import api from './api';

const ASSISTANT_ROOT = '/scm/v1/asistente';

/**
 * Returns the server-authoritative availability and identity state.
 * Authentication stays in the shared API client's bearer interceptor.
 */
export const getScmAssistantStatus = async () => {
  const response = await api.get(`${ASSISTANT_ROOT}/estado`);
  return response.data;
};

export const consultarScmAssistant = async ({
  query,
  dateLima,
  refresh = false,
}) => {
  const response = await api.post(`${ASSISTANT_ROOT}/consulta`, {
    query,
    date_lima: dateLima,
    intent: 'production_daily_summary',
    refresh,
  });
  return response.data;
};

