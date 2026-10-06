import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(), postMock: vi.fn(), patchMock: vi.fn(),
}));

vi.mock('../services/api', () => ({ default: { get: getMock, post: postMock, patch: patchMock } }));

import {
  createScmAssistantProposal,
  decideScmAssistantProposal,
  getScmAssistantV2Catalog,
  sendScmAssistantV2Chat,
  updateScmAssistantProposal,
} from '../services/scmAssistantV2Api';

describe('contrato frontend del asistente SCM v2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta catálogo y chat con el contrato analítico exacto', async () => {
    getMock.mockResolvedValue({ data: { suggestions: [] } });
    postMock.mockResolvedValue({ data: { status: 'answered', results: [] } });
    await getScmAssistantV2Catalog();
    await sendScmAssistantV2Chat({ query: 'avance de ayer' });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/asistente/catalogo');
    expect(postMock).toHaveBeenCalledWith('/scm/v1/asistente/chat', { query: 'avance de ayer' });
  });

  it('envía refresh solo cuando se solicita y conserva la huella de propuestas', async () => {
    postMock.mockResolvedValue({ data: {} });
    patchMock.mockResolvedValue({ data: {} });
    await sendScmAssistantV2Chat({ query: 'actualiza', refresh: true });
    await createScmAssistantProposal('necesitamos una vista');
    await updateScmAssistantProposal('p-1', { expected_version: 2, diff: 'diff', summary: 'resumen' });
    await decideScmAssistantProposal('p-1', { expected_version: 2, diff_sha256: 'sha', decision: 'approve' });
    expect(postMock).toHaveBeenNthCalledWith(1, '/scm/v1/asistente/chat', { query: 'actualiza', refresh: true });
    expect(postMock).toHaveBeenNthCalledWith(2, '/scm/v1/asistente/propuestas', { need: 'necesitamos una vista' });
    expect(patchMock).toHaveBeenCalledWith('/scm/v1/asistente/propuestas/p-1', { expected_version: 2, diff: 'diff', summary: 'resumen' });
    expect(postMock).toHaveBeenNthCalledWith(3, '/scm/v1/asistente/propuestas/p-1/decision', { expected_version: 2, diff_sha256: 'sha', decision: 'approve' });
  });
});

