import api from './api';

const PERSONAL_AGENT_ACCESS_PATH = '/scm/v1/agente/acceso';
const PERSONAL_AGENT_STATE_PATH = '/scm/v1/agente/estado';

export const requestPersonalAgentAccess = async (signal) => {
  const response = await api.post(PERSONAL_AGENT_ACCESS_PATH, undefined, { signal });
  return response.data;
};

export const getPersonalAgentState = async (signal) => {
  const response = await api.get(PERSONAL_AGENT_STATE_PATH, { signal });
  return response.data;
};

