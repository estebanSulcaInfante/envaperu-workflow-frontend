import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantV2Proposals from '../components/assistantV2/AssistantV2Proposals';
import { decideScmAssistantProposal, listScmAssistantProposals } from '../services/scmAssistantV2Api';

vi.mock('../services/scmAssistantV2Api', () => ({
  listScmAssistantProposals: vi.fn(),
  decideScmAssistantProposal: vi.fn(),
}));

describe('revisión de propuestas del asistente v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listScmAssistantProposals.mockResolvedValue({
      execution_supported: false,
      can_review: true,
      items: [
        { id: 'pending', need: 'pendiente', status: 'PENDIENTE', version: 1, diff_sha256: 'old' },
        { id: 'ready', need: 'lista', status: 'LISTA_REVISION', version: 3, diff_sha256: 'exact' },
      ],
    });
    decideScmAssistantProposal.mockResolvedValue({});
  });

  it('solo permite decidir propuestas listas para revisión y envía versión/huella exactas', async () => {
    const user = userEvent.setup();
    render(<AssistantV2Proposals />);
    expect(await screen.findByText('pendiente')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Revisar' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Aprobar versión' }));
    expect(decideScmAssistantProposal).toHaveBeenCalledWith('ready', {
      expected_version: 3,
      diff_sha256: 'exact',
      decision: 'approve',
    });
  });
});

