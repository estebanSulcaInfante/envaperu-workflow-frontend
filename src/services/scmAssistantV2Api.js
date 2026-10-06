import api from './api';

const ROOT = '/scm/v1/asistente';

export const getScmAssistantV2Catalog = async () => {
  const response = await api.get(`${ROOT}/catalogo`);
  return response.data;
};

export const sendScmAssistantV2Chat = async ({ query, refresh = false }) => {
  const body = { query: query.trim() };
  if (refresh) body.refresh = true;
  const response = await api.post(`${ROOT}/chat`, body);
  return response.data;
};

export const listScmAssistantProposals = async () => {
  const response = await api.get(`${ROOT}/propuestas`);
  return response.data;
};

export const createScmAssistantProposal = async (need) => {
  const response = await api.post(`${ROOT}/propuestas`, { need: need.trim() });
  return response.data;
};

export const updateScmAssistantProposal = async (id, payload) => {
  const response = await api.patch(`${ROOT}/propuestas/${encodeURIComponent(id)}`, payload);
  return response.data;
};

export const decideScmAssistantProposal = async (id, payload) => {
  const response = await api.post(
    `${ROOT}/propuestas/${encodeURIComponent(id)}/decision`,
    payload,
  );
  return response.data;
};

