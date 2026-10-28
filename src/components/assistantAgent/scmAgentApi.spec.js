import { describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get, post } }));

import { getScmAgentState, sendScmAgentChat } from '../../services/scmAgentApi';

describe('scmAgentApi', () => {
  it('uses the read-only state endpoint and fixed HTTP timeout', async () => {
    get.mockResolvedValueOnce({ data: { available: true, status: 'READY', provider: 'openclaw', read_only: true, attachments_supported: false } });
    const signal = new AbortController().signal;
    await getScmAgentState({ signal });
    expect(get).toHaveBeenCalledWith('/scm/v1/asistente/agente/estado', { signal, timeout: 155000 });
  });

  it('posts only the contract fields and passes the AbortSignal', async () => {
    post.mockResolvedValueOnce({ data: { status: 'answered', answer: 'respuesta', client_request_id: '7b1c5c26-2ae6-4ef2-898b-9b70ed8f4a3a', read_only: true } });
    const signal = new AbortController().signal;
    await sendScmAgentChat({
      query: 'consulta',
      history: [{ role: 'user', content: 'anterior' }, { role: 'assistant', content: 'respuesta anterior' }],
      clientRequestId: '7b1c5c26-2ae6-4ef2-898b-9b70ed8f4a3a',
      signal,
    });
    expect(post).toHaveBeenCalledWith('/scm/v1/asistente/agente/chat', {
      query: 'consulta',
      history: [{ role: 'user', content: 'anterior' }, { role: 'assistant', content: 'respuesta anterior' }],
      client_request_id: '7b1c5c26-2ae6-4ef2-898b-9b70ed8f4a3a',
    }, { signal, timeout: 155000 });
    expect(post.mock.calls[0][1]).not.toHaveProperty('model');
    expect(post.mock.calls[0][1]).not.toHaveProperty('tools');
    expect(post.mock.calls[0][1]).not.toHaveProperty('urls');
  });
});
