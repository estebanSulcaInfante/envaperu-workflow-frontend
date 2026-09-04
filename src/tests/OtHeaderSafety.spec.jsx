import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { OtAnnulmentAction, OtCreationReview } from '../components/OtHeaderSafety';
import { anularOtScm } from '../services/scmOtApi';

vi.mock('../services/scmOtApi', () => ({ anularOtScm: vi.fn() }));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (_error, fallback) => fallback }));
const ot = { public_id: 'ot-test', codigo_ot: 'OT-000099', estado: 'PLANIFICADA', version: 1,
  maquina_codigo: 'INY-01', fecha_operativa: '2026-09-02', turno: 'DIA', trabajos_color: [], mangas: [] };

describe('M4 seguridad de cabecera OT', () => {
  beforeEach(() => vi.clearAllMocks());
  it('M4-03/04/10 exige motivo y permite volver sin mutar', async () => {
    const user = userEvent.setup();
    const done = vi.fn();
    anularOtScm.mockResolvedValue({ ot: { ...ot, estado: 'ANULADA' } });
    render(<OtAnnulmentAction ot={ot} allowed onSuccess={done} onRefresh={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Anular OT' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Anular OT' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));
    expect(anularOtScm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(await screen.findByRole('button', { name: 'Anular OT' }));
    dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Motivo de anulación/), 'Error de fecha');
    await user.dblClick(within(dialog).getByRole('button', { name: 'Anular OT' }));
    expect(anularOtScm).toHaveBeenCalledTimes(1);
    expect(anularOtScm).toHaveBeenCalledWith('ot-test', { version: 1, motivo: 'Error de fecha' }, expect.any(String));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  });
  it('M4-05/06 oculta sin permiso y bloquea con vínculos', () => {
    const { rerender } = render(<OtAnnulmentAction ot={ot} allowed={false} />);
    expect(screen.queryByRole('button', { name: 'Anular OT' })).toBeNull();
    rerender(<OtAnnulmentAction ot={{ ...ot, trabajos_color: [{ id: 1 }] }} allowed />);
    expect(screen.getByRole('button', { name: 'Anular OT' })).toBeDisabled();
    expect(screen.getByText(/No se puede anular/)).toBeVisible();
  });
  it('M4-08 respuesta perdida conserva intención y clave', async () => {
    const user = userEvent.setup();
    anularOtScm.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ot: { ...ot, estado: 'ANULADA' } });
    const done = vi.fn();
    render(<OtAnnulmentAction ot={ot} allowed onSuccess={done} onRefresh={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Anular OT' }));
    await user.type(screen.getByLabelText(/Motivo de anulación/), 'Error');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular OT' }));
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Motivo de anulación/)).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: 'Reintentar anulación' }));
    expect(anularOtScm.mock.calls[0]).toEqual(anularOtScm.mock.calls[1]);
  });
  it('M4-07 conflicto requiere consultar antes de decidir', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue();
    anularOtScm.mockRejectedValue({ response: { status: 409 } });
    render(<OtAnnulmentAction ot={ot} allowed onSuccess={vi.fn()} onRefresh={refresh} />);
    await user.click(screen.getByRole('button', { name: 'Anular OT' }));
    await user.type(screen.getByLabelText(/Motivo de anulación/), 'Error');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anular OT' }));
    await user.click(await screen.findByRole('button', { name: 'Consultar estado' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('M4-09 conserva motivo e identidad anulada', () => {
    render(<OtAnnulmentAction allowed ot={{ ...ot, estado: 'ANULADA', anulacion: { motivo: 'Fecha errada', actor: { nombre: 'Said' }, fecha: '2026-09-02' } }} />);
    expect(screen.getByText(/OT-000099 anulada/)).toBeVisible();
    expect(screen.getByText(/Fecha errada/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Anular OT' })).toBeNull();
  });
  it('M4-02 reintenta creación con la misma clave sin duplicar', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce();
    render(<OtCreationReview form={{ maquina_id: 1, fecha_operativa: '2026-09-02', turno: 'DIA' }} machine="INY-01" onConfirm={confirm} />);
    await user.click(screen.getByRole('button', { name: 'Crear OT de máquina' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar creación' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar creación' }));
    expect(confirm.mock.calls[0]).toEqual(confirm.mock.calls[1]);
  });
});
