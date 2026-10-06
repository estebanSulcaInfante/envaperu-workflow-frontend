import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: getMock, post: postMock },
}));

import { consultarScmAssistant, getScmAssistantStatus } from '../services/scmAssistantApi';

describe('contrato frontend del asistente SCM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { available: true, auth_state: 'READY' } });
    postMock.mockResolvedValue({ data: { groups: [] } });
  });

  it('consulta estado sin añadir identificadores internos', async () => {
    await getScmAssistantStatus();
    expect(getMock).toHaveBeenCalledWith('/scm/v1/asistente/estado');
  });

  it('envía la consulta exacta con fecha Lima e intent fijo', async () => {
    await consultarScmAssistant({
      query: '¿Qué tal fue el avance?',
      dateLima: '2026-10-05',
      refresh: true,
    });
    expect(postMock).toHaveBeenCalledWith('/scm/v1/asistente/consulta', {
      query: '¿Qué tal fue el avance?',
      date_lima: '2026-10-05',
      intent: 'production_daily_summary',
      refresh: true,
    });
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('actor_id');
  });
});

