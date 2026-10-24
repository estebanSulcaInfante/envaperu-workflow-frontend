import { ThemeProvider, createTheme } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExecutionControlDialog from '../components/ExecutionControlDialog';

const api = vi.hoisted(() => ({ impact: vi.fn(), execute: vi.fn() }));

vi.mock('../services/scmOtApi', () => ({
  obtenerImpactoEjecucionOfScm: api.impact,
  ejecutarControlOfScm: api.execute,
}));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const order = { id: 'of-1', codigo: 'OF-000001', estado: 'EN_EJECUCION', version: 7 };
const renderDialog = (onCompleted = vi.fn(), onClose = vi.fn(), options = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <ExecutionControlDialog
      open
      order={options.order || order}
      canPause={options.canPause ?? true}
      canCancel={options.canCancel ?? true}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  </ThemeProvider>,
);

describe('control de ejecución de OF', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.impact.mockResolvedValue({
      action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 2 }, mangas_abiertas: 0, reservas_activas: 0, blockers: [],
    });
    api.execute.mockResolvedValue({ idempotent_replay: false });
  });

  it('consulta impacto y confirma sin éxito optimista, conservando la clave de reintento', async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    renderDialog(onCompleted);
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    expect((await screen.findByRole('alert')).textContent).toContain('2 trabajos afectados');
    expect(screen.getByText(/La OF conserva producido e histórico/)).not.toHaveTextContent(/cancela pendientes propios|libera el compromiso residual/);
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Parada segura');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await waitFor(() => expect(api.execute).toHaveBeenCalledTimes(1));
    expect(api.execute.mock.calls[0][0]).toEqual(order);
    expect(api.execute.mock.calls[0][1]).toBe('PAUSAR');
    expect(api.execute.mock.calls[0][2]).toEqual({
      version: 7, impact_hash: 'a'.repeat(64), motivo: 'Parada segura',
    });
    const firstKey = api.execute.mock.calls[0][3];
    expect(firstKey).toMatch(/[0-9a-f-]{36}/);
    expect(onCompleted).toHaveBeenCalledWith({ idempotent_replay: false });
  });

  it.each(['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION', 'PAUSADA'])(
    'expone cancelar en estado %s con la capacidad OF_CANCELAR_EJECUCION', async (estado) => {
      const user = userEvent.setup();
      api.impact.mockResolvedValue({
        action: 'CANCELAR', can_execute: true, version: 7, impact_hash: 'c'.repeat(64),
        trabajos: { afectados: 0 }, mangas_abiertas: 0, reservas_activas: 0, blockers: [],
      });
      renderDialog(vi.fn(), vi.fn(), { order: { ...order, estado } });
      await user.click(screen.getByRole('button', { name: 'Cancelar ejecución', exact: true }));
      expect((await screen.findByRole('alert')).textContent).toContain('0 trabajos afectados');
      expect(screen.getByText(/libera el compromiso residual de demanda/)).toBeVisible();
    },
  );

  it('no expone cancelar a un Supervisor pause-only en pre-ejecución', () => {
    renderDialog(vi.fn(), vi.fn(), {
      order: { ...order, estado: 'LIBERADA' }, canPause: true, canCancel: false,
    });
    expect(screen.queryByRole('button', { name: 'Cancelar ejecución', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausar ejecución', exact: true })).not.toBeInTheDocument();
  });

  it('expone el error incierto y permite reintentar con la misma clave', async () => {
    const user = userEvent.setup();
    api.execute.mockRejectedValueOnce(new Error('Red incierta')).mockResolvedValueOnce({ ok: true });
    const onCompleted = vi.fn();
    renderDialog(onCompleted);
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    expect((await screen.findByRole('alert')).textContent).toContain('2 trabajos afectados');
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Reintento');
    const confirm = screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1);
    await user.click(confirm);
    expect(await screen.findByText(/No se pudo confirmar si se aplicó/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Motivo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar ejecución', exact: true })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await waitFor(() => expect(api.execute).toHaveBeenCalledTimes(2));
    expect(api.execute.mock.calls[1][3]).toBe(api.execute.mock.calls[0][3]);
    expect(api.execute.mock.calls[1][0]).toEqual(api.execute.mock.calls[0][0]);
    expect(api.execute.mock.calls[1][1]).toBe(api.execute.mock.calls[0][1]);
    expect(api.execute.mock.calls[1][2]).toEqual(api.execute.mock.calls[0][2]);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('conserva la intención incierta si falla la relectura y bloquea cierre, acción y motivo', async () => {
    const user = userEvent.setup();
    let rejectResolution;
    api.execute.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ ok: true });
    api.impact.mockResolvedValueOnce({
      action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 2 }, blockers: [], of: { estado: 'EN_EJECUCION' },
    }).mockImplementationOnce(() => new Promise((_, reject) => { rejectResolution = reject; }));
    const onClose = vi.fn();
    renderDialog(vi.fn(), onClose);

    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    await screen.findByRole('alert');
    const reasonField = screen.getByRole('textbox', { name: 'Motivo' });
    await user.type(reasonField, 'Parada incierta');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await screen.findByText(/No se pudo confirmar si se aplicó/);
    const firstCall = api.execute.mock.calls[0];
    const resolution = screen.getByRole('button', { name: 'Revisar estado autoritativo' });
    await user.click(resolution);

    expect(screen.getByRole('button', { name: 'Cancelar ejecución', exact: true })).toBeDisabled();
    expect(reasonField).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    await user.keyboard('{Escape}');
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    rejectResolution(new Error('GET caído'));
    expect(await screen.findByText(/No se pudo confirmar si se aplicó/)).toBeVisible();
    expect(screen.getByText(/GET caído/)).toBeVisible();
    expect(reasonField).toHaveValue('Parada incierta');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await waitFor(() => expect(api.execute).toHaveBeenCalledTimes(2));
    expect(api.execute.mock.calls[1][3]).toBe(firstCall[3]);
    expect(api.execute.mock.calls[1][2]).toEqual(firstCall[2]);
  });

  it('ignora impactos que regresan fuera de orden al cambiar de acción', async () => {
    const user = userEvent.setup();
    let resolvePause;
    let resolveCancel;
    api.impact
      .mockReturnValueOnce(new Promise((resolve) => { resolvePause = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCancel = resolve; }));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar ejecución' }));
    resolveCancel({ action: 'CANCELAR', can_execute: true, version: 7, impact_hash: 'c'.repeat(64), trabajos: { afectados: 1 }, blockers: [] });
    expect((await screen.findByRole('alert')).textContent).toContain('1 trabajos afectados');
    resolvePause({ action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'p'.repeat(64), trabajos: { afectados: 9 }, blockers: [] });
    await waitFor(() => expect(screen.queryByText('9 trabajos afectados')).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Cancelar ejecución', exact: true })[0]).toHaveAttribute('type', 'button');
  });

  it('reinicia motivo e intención cuando cambia la acción', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    await screen.findByRole('alert');
    const reasonField = screen.getByRole('textbox', { name: 'Motivo' });
    await user.type(reasonField, 'Sólo pausa');
    await user.click(screen.getAllByRole('button', { name: 'Cancelar ejecución', exact: true })[0]);
    await waitFor(() => expect(reasonField).toHaveValue(''));
  });

  it('refresca impacto y rota la clave ante conflicto stale sin confirmar con impacto viejo', async () => {
    const user = userEvent.setup();
    let resolveImpact;
    api.execute.mockRejectedValueOnce({ response: { data: { error: { code: 'STALE_IMPACT' } } } }).mockResolvedValueOnce({ ok: true });
    api.impact.mockResolvedValueOnce({ action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64), trabajos: { afectados: 2 }, blockers: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveImpact = resolve; }));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    expect((await screen.findByRole('alert')).textContent).toContain('2 trabajos afectados');
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Stale control');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await waitFor(() => expect(api.impact).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/La OF cambió mientras confirmabas/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveValue('Stale control');
    const staleKey = api.execute.mock.calls[0][3];
    resolveImpact({ action: 'PAUSAR', can_execute: true, version: 8, impact_hash: 'b'.repeat(64), trabajos: { afectados: 2 }, blockers: [] });
    await waitFor(() => expect(screen.getByText(/La OF cambió mientras confirmabas/)).toBeVisible());
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await waitFor(() => expect(api.execute).toHaveBeenCalledTimes(2));
    expect(api.execute.mock.calls[1][3]).not.toBe(staleKey);
    expect(api.execute.mock.calls[1][2].impact_hash).toBe('b'.repeat(64));
  });

  it('bloquea editar el motivo después de una respuesta incierta', async () => {
    const user = userEvent.setup();
    api.execute.mockRejectedValueOnce(new Error('timeout'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    expect((await screen.findByRole('alert')).textContent).toContain('2 trabajos afectados');
    const reasonField = screen.getByRole('textbox', { name: 'Motivo' });
    await user.type(reasonField, 'Motivo original');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await screen.findByText(/No se pudo confirmar si se aplicó/);
    expect(reasonField).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar ejecución', exact: true })).toBeDisabled();
  });

  it('mantiene el diálogo montado en éxito y muestra el dato nulo como no confirmado', async () => {
    const user = userEvent.setup();
    api.impact.mockResolvedValue({
      action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 1 }, mangas_abiertas: 0, reservas_activas: 0, blockers: [],
      producido: [{ cantidad_real: null, unidad: 'UN' }],
    });
    api.execute.mockResolvedValue({ action: 'PAUSAR', estado: 'PAUSADA', codigo: 'OF-000001' });
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    expect(await screen.findByText(/dato no confirmado/)).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Parada');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    expect(await screen.findByText(/Cambio confirmado por Central/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmado' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeVisible();
  });

  it('no presenta como pendiente el residual del preflight después de confirmar', async () => {
    const user = userEvent.setup();
    api.impact.mockResolvedValue({
      action: 'CANCELAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 1 }, mangas_abiertas: 0, reservas_activas: 0, blockers: [],
      compromisos_residuales: [{ cantidad: '67.000', unidad: 'UN' }],
    });
    api.execute.mockResolvedValue({
      action: 'CANCELAR', estado: 'CANCELADA', codigo: 'OF-000001',
      impact: { of: { estado: 'EN_EJECUCION' }, compromisos_residuales: [{ cantidad: '67.000', unidad: 'UN' }] },
    });
    renderDialog();
    await user.click(screen.getAllByRole('button', { name: 'Cancelar ejecución', exact: true }).at(0));
    await screen.findByText(/Compromiso residual: 67\.000 UN/);
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Cierre operativo');
    await user.click(screen.getAllByRole('button', { name: 'Cancelar ejecución', exact: true }).at(-1));
    await screen.findByText(/Cambio confirmado por Central/);
    expect(screen.queryByText(/Compromiso residual: 67\.000 UN/)).not.toBeInTheDocument();
    expect(screen.getByText(/Estado confirmado: CANCELADA/)).toBeVisible();
  });

  it('muestra éxito si el GET autoritativo falla y el replay devuelve ack anidado', async () => {
    const user = userEvent.setup();
    api.execute.mockRejectedValueOnce(new Error('POST incierto')).mockResolvedValueOnce({
      action: 'PAUSAR',
      estado: 'PAUSADA',
      impact: { of: { estado: 'EN_EJECUCION' }, compromisos_residuales: [{ cantidad: '67.000', unidad: 'UN' }] },
    });
    api.impact.mockResolvedValueOnce({
      action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 1 }, blockers: [], of: { estado: 'EN_EJECUCION' },
    }).mockRejectedValueOnce(new Error('GET caído'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    await screen.findByRole('alert');
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Pausa confirmada');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await screen.findByText(/No se pudo confirmar si se aplicó/);
    await user.click(screen.getByRole('button', { name: 'Revisar estado autoritativo' }));
    await screen.findByText(/GET caído/);
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await screen.findByText(/Estado confirmado: PAUSADA/);
    expect(screen.getByRole('button', { name: 'Confirmado' })).toBeDisabled();
  });

  it('resuelve una respuesta incierta con relectura autoritativa usando la misma clave', async () => {
    const user = userEvent.setup();
    api.execute.mockRejectedValueOnce(new Error('Network Error'));
    api.impact.mockResolvedValueOnce({
      action: 'PAUSAR', can_execute: true, version: 7, impact_hash: 'a'.repeat(64),
      trabajos: { afectados: 1 }, blockers: [], of: { estado: 'EN_EJECUCION' },
    }).mockResolvedValueOnce({
      action: 'PAUSAR', can_execute: false, version: 8, impact_hash: 'b'.repeat(64),
      trabajos: { afectados: 0 }, blockers: [], of: { estado: 'PAUSADA' },
    });
    const onCompleted = vi.fn();
    renderDialog(onCompleted);
    await user.click(screen.getByRole('button', { name: 'Pausar ejecución' }));
    await screen.findByRole('alert');
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Parada incierta');
    await user.click(screen.getAllByRole('button', { name: 'Pausar ejecución', exact: true }).at(-1));
    await screen.findByText(/No se pudo confirmar si se aplicó/);
    const key = api.execute.mock.calls[0][3];
    await user.click(screen.getByRole('button', { name: 'Revisar estado autoritativo' }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(api.execute).toHaveBeenCalledTimes(1);
    expect(api.impact).toHaveBeenCalledTimes(2);
    expect(onCompleted.mock.calls[0][0]).not.toHaveProperty('idempotent_replay');
    expect(await screen.findByText('Estado actual confirmado por Central: PAUSADA.')).toBeVisible();
    expect(key).toBeTruthy();
  });
});
