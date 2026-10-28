import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantV2Orb from '../components/assistantV2/AssistantV2Orb';
import { getScmAgentState } from '../services/scmAgentApi';

vi.mock('../services/scmAssistantV2Api', () => ({
  getScmAssistantV2Catalog: vi.fn().mockResolvedValue({ suggestions: [] }),
  sendScmAssistantV2Chat: vi.fn(),
  listScmAssistantProposals: vi.fn(),
  decideScmAssistantProposal: vi.fn(),
}));

vi.mock('../services/scmAgentApi', () => ({
  getScmAgentState: vi.fn().mockResolvedValue({ available: true, status: 'READY', message: 'Disponible', provider: 'openclaw', read_only: true, attachments_supported: false }),
  sendScmAgentChat: vi.fn(({ clientRequestId }) => Promise.resolve({ status: 'answered', answer: 'Respuesta del agente', client_request_id: clientRequestId, read_only: true })),
  SCM_AGENT_UI_TIMEOUT: 60000,
  buildScmAgentChatPayload: vi.fn(() => ({ payload: {}, historyOmitted: false })),
  createClientRequestId: vi.fn(() => '7b1c5c26-2ae6-4ef2-898b-9b70ed8f4a3a'),
}));

describe('orb del asistente SCM v2', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('scm-assistant-v2-device-id', 'test-device');
  });

  it('abre con click y no abre cuando el gesto supera el umbral de arrastre', () => {
    const { unmount } = render(<AssistantV2Orb actorId={7} />);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.click(orb);
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
    unmount();

    render(<AssistantV2Orb actorId={7} />);
    const draggable = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.pointerDown(draggable, { pointerId: 1, clientX: 900, clientY: 600, button: 0 });
    fireEvent.pointerMove(draggable, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerUp(draggable, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.click(draggable);
    expect(screen.queryByRole('dialog', { name: 'Asistente SCM v2' })).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('scm-assistant-v2-position:7:test-device'));
    expect(stored.x).toBe(14);
  });

  it('mantiene el estado por actor y soporta teclado local sin robar foco', () => {
    const { rerender } = render(<AssistantV2Orb actorId={7} />);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    orb.focus();
    fireEvent.keyDown(orb, { key: 'Enter' });
    const dialog = screen.getByRole('dialog', { name: 'Asistente SCM v2' });
    expect(dialog).toBeVisible();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(orb, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Asistente SCM v2' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(orb);
    rerender(<AssistantV2Orb actorId={8} />);
    expect(window.localStorage.getItem('scm-assistant-v2-position:8:test-device')).toBeNull();
  });

  it('no consume Enter ni Escape de un campo externo y limpia pointercancel', () => {
    render(<><input aria-label="Campo externo" /><AssistantV2Orb actorId={9} /></>);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.click(orb);
    const external = document.querySelector('input[aria-label="Campo externo"]');
    expect(external.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.keyDown(external, { key: 'Enter' });
    fireEvent.keyDown(external, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar agente SCM' }));
    fireEvent.pointerDown(orb, { pointerId: 2, clientX: 900, clientY: 600, button: 0 });
    fireEvent.pointerMove(orb, { pointerId: 2, clientX: 100, clientY: 200 });
    fireEvent.pointerCancel(orb, { pointerId: 2, clientX: 100, clientY: 200 });
    fireEvent.click(orb);
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
  });

  it('propaga al orb el estado success de una respuesta antes de cerrar el Drawer', async () => {
    render(<AssistantV2Orb actorId={10} />);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.click(orb);
    const input = await screen.findByRole('textbox', { name: 'Pregunta al agente SCM' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: 'Consulta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await screen.findByText('Respuesta del agente');
    await waitFor(() => expect(orb.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'Agente completó la tarea'));
  });

  it('muestra orb rojo cuando la disponibilidad del agente requiere autenticación', async () => {
    getScmAgentState.mockRejectedValueOnce(new Error('Sesión requerida'));
    render(<AssistantV2Orb actorId={11} />);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.click(orb);
    expect(await screen.findByText('Sesión requerida')).toBeInTheDocument();
    await waitFor(() => expect(orb.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'Agente requiere atención'));
  });
});
