import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantV2Orb from '../components/assistantV2/AssistantV2Orb';

vi.mock('../services/scmAssistantV2Api', () => ({
  getScmAssistantV2Catalog: vi.fn().mockResolvedValue({ suggestions: [] }),
  sendScmAssistantV2Chat: vi.fn(),
  listScmAssistantProposals: vi.fn(),
  decideScmAssistantProposal: vi.fn(),
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
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
    expect(document.activeElement).toBe(orb);
    fireEvent.keyDown(orb, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Asistente SCM v2' })).not.toBeInTheDocument();
    rerender(<AssistantV2Orb actorId={8} />);
    expect(window.localStorage.getItem('scm-assistant-v2-position:8:test-device')).toBeNull();
  });

  it('no consume Enter ni Escape de un campo externo y limpia pointercancel', () => {
    render(<><input aria-label="Campo externo" /><AssistantV2Orb actorId={9} /></>);
    const orb = screen.getByTestId('scm-assistant-v2-orb');
    fireEvent.click(orb);
    const external = screen.getByRole('textbox', { name: 'Campo externo' });
    fireEvent.keyDown(external, { key: 'Enter' });
    fireEvent.keyDown(external, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar asistente' }));
    fireEvent.pointerDown(orb, { pointerId: 2, clientX: 900, clientY: 600, button: 0 });
    fireEvent.pointerMove(orb, { pointerId: 2, clientX: 100, clientY: 200 });
    fireEvent.pointerCancel(orb, { pointerId: 2, clientX: 100, clientY: 200 });
    fireEvent.click(orb);
    expect(screen.getByRole('dialog', { name: 'Asistente SCM v2' })).toBeVisible();
  });
});
