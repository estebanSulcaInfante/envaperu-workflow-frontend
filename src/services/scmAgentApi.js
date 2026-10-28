import api from './api';

export const SCM_AGENT_STATE_PATH = '/scm/v1/asistente/agente/estado';
export const SCM_AGENT_CHAT_PATH = '/scm/v1/asistente/agente/chat';
export const SCM_AGENT_HTTP_TIMEOUT = 55000;
export const SCM_AGENT_UI_TIMEOUT = 60000;
export const SCM_AGENT_MAX_HISTORY_BYTES = 16000;
export const SCM_AGENT_MAX_TOTAL_BYTES = 24000;
export const SCM_AGENT_MAX_HISTORY_MESSAGES = 12;
export const SCM_AGENT_MAX_MESSAGE_CHARS = 4000;

const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder();
const byteLength = (value) => encoder ? encoder.encode(value).length : new Blob([value]).size;

export const createClientRequestId = () => globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const nibble = character === 'x' ? random : ((random & 0x3) | 0x8);
    return nibble.toString(16);
  });

const validHistory = (history) => (Array.isArray(history) ? history : [])
  .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string')
  .map(({ role, content }) => ({ role, content }));

/** Build a bounded payload without cutting individual messages. */
export const buildScmAgentChatPayload = ({ query, history = [], clientRequestId = createClientRequestId() }) => {
  const cleanQuery = String(query ?? '').trim();
  if (cleanQuery.length < 1 || cleanQuery.length > 4000) {
    throw new Error('La consulta debe tener entre 1 y 4000 caracteres.');
  }
  let messages = validHistory(history);
  const duplicated = messages.length && messages[messages.length - 1].role === 'user'
    && messages[messages.length - 1].content.trim() === cleanQuery;
  if (duplicated) messages = messages.slice(0, -1);
  messages = messages.slice(-SCM_AGENT_MAX_HISTORY_MESSAGES);
  const pairs = [];
  for (let index = 0; index < messages.length; index += 2) {
    const pair = messages.slice(index, index + 2);
    if (pair.length === 2 && pair[0].role === 'user' && pair[1].role === 'assistant'
      && pair.every((message) => message.content.length <= SCM_AGENT_MAX_MESSAGE_CHARS)) pairs.push(pair);
  }
  const base = { query: cleanQuery, history: [], client_request_id: clientRequestId };
  const selected = [];
  for (let index = pairs.length - 1; index >= 0; index -= 1) {
    const candidate = [
      ...pairs.slice(index).flat(),
    ];
    if (byteLength(JSON.stringify(candidate)) > SCM_AGENT_MAX_HISTORY_BYTES) break;
    selected.unshift(pairs[index]);
  }
  const boundedHistory = selected.flat();
  const omitted = boundedHistory.length < messages.length;
  const payload = { ...base, history: boundedHistory };
  while (byteLength(JSON.stringify(payload)) > SCM_AGENT_MAX_TOTAL_BYTES && payload.history.length >= 2) {
    payload.history = payload.history.slice(2);
  }
  return { payload, historyOmitted: omitted || payload.history.length < boundedHistory.length };
};

export async function getScmAgentState({ signal } = {}) {
  const response = await api.get(SCM_AGENT_STATE_PATH, { signal, timeout: SCM_AGENT_HTTP_TIMEOUT });
  return response.data;
}

export async function sendScmAgentChat({ query, history = [], clientRequestId, signal }) {
  const { payload } = buildScmAgentChatPayload({ query, history, clientRequestId });
  const response = await api.post(SCM_AGENT_CHAT_PATH, payload, { signal, timeout: SCM_AGENT_HTTP_TIMEOUT });
  const data = response.data;
  if (data?.status !== 'answered' || typeof data.answer !== 'string' || !data.answer.trim()) {
    throw new Error('El agente devolvió una respuesta inválida.');
  }
  if (data.client_request_id !== payload.client_request_id) {
    throw new Error('La respuesta del agente no corresponde a esta consulta.');
  }
  return data;
}
