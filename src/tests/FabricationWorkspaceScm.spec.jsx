import { ThemeProvider, createTheme } from '@mui/material';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FabricationWorkspaceScm from '../components/FabricationWorkspaceScm';

const api = vi.hoisted(() => ({ progress: vi.fn(), list: vi.fn(), detail: vi.fn(), catalog: vi.fn() }));
const actor = vi.hoisted(() => ({ can: vi.fn(), actorId: 7, experience: { label: 'OT' } }));

vi.mock('../services/scmProductionObservabilityApi', () => ({ listarAvanceOfScm: api.progress }));
vi.mock('../services/scmOtApi', () => ({ listarOrdenesFabricacionScm: api.list, obtenerOrdenFabricacionScm: api.detail }));
vi.mock('../services/api', () => ({
  obtenerColores: api.catalog, obtenerMaquinas: api.catalog, obtenerMoldes: api.catalog,
  obtenerRecetasColorMaestras: api.catalog,
}));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (error, fallback) => error?.message || fallback, obtenerActorScm: () => 7 }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => actor }));

const renderView = () => render(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationWorkspaceScm /></MemoryRouter></ThemeProvider>);

describe('workspace de fabricación CTL-02', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.progress.mockReset();
    actor.actorId = 7;
    actor.can.mockImplementation((capability) => capability === 'OT_VER');
    api.progress.mockResolvedValue({ as_of: '2026-09-29', visibilidad: { pesaje: true }, items: [
      { corrida_id: 'r1', of: 'OF-01', corrida: 'C01', color: 'Rojo', color_hex: '#ab12cd', objetivo_neto_kg: '10', kg_finalizados_efectivos: '4', kg_medidos_en_abiertas: '2', coverage: { estado: 'COMPLETA' }, mangas: { total: 1 } },
      { corrida_id: 'r2', of: 'OF-01', corrida: 'C02', color: 'Verde', objetivo_neto_kg: null, kg_finalizados_efectivos: null, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0 } },
      { corrida_id: 'r3', of: 'OF-02', corrida: 'C01', color: 'Azul', objetivo_neto_kg: '20', kg_finalizados_efectivos: '10', coverage: { estado: 'INCOMPLETA' }, mangas: { total: 2 } },
    ] });
  });

  it('OT-only consulta avance, agrupa varias OF y expande todos conservando abiertas', async () => {
    const user = userEvent.setup();
    renderView();
    expect(await screen.findByText('Comparación de objetivos')).toBeVisible();
    expect(api.progress).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(api.list).not.toHaveBeenCalled();
    expect(api.catalog).not.toHaveBeenCalled();
    expect(screen.getByText('OF-01')).toBeVisible();
    expect(screen.getByText('OF-02')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Expandir objetivos OF-01' }));
    expect(screen.getByText(/2[,.]00 kg/)).toBeVisible();
    expect(screen.getByText('Meta no registrada')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mostrar todos los objetivos' }));
    expect(screen.getAllByRole('button', { name: /Ocultar objetivos OF-/ })).toHaveLength(2);
    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
  });

  it('OT-only no revela cifras cuando la respuesta restringe pesaje', async () => {
    api.progress.mockResolvedValueOnce({ items: [{ corrida_id: 'r1', of: 'OF-01', color: 'Rojo', objetivo_neto_kg: '10', kg_finalizados_efectivos: '4', kg_medidos_en_abiertas: '2' }], visibilidad: { pesaje: false, restriccion: 'MANGA_PESAJE_VER requerido' } });
    renderView();
    expect(await screen.findByRole('button', { name: 'Expandir objetivos OF-01' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir objetivos OF-01' }));
    expect((await screen.findAllByText('Avance restringido')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/10[,.]00 kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4[,.]00 kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2[,.]00 kg/)).not.toBeInTheDocument();
  });

  it('no calcula cero como avance cuando no existen pesajes', async () => {
    api.progress.mockResolvedValueOnce({ items: [{ corrida_id: 'r0', of: 'OF-0', color: 'Gris', objetivo_neto_kg: '10', kg_finalizados_efectivos: 0, kg_medidos_en_abiertas: 0, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0 } }], visibilidad: { pesaje: true } });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Expandir objetivos OF-0' }));
    expect((await screen.findAllByText('Sin pesajes')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('0.00 kg')).not.toBeInTheDocument();
  });

  it('respuesta 403 limpia cualquier tabla previa y deja reintento accionable', async () => {
    const user = userEvent.setup();
    api.progress.mockResolvedValueOnce({ items: [{ corrida_id: 'r1', of: 'OF-OLD', color: 'Rojo', objetivo_neto_kg: '10', kg_finalizados_efectivos: '4', coverage: { estado: 'COMPLETA' } }], visibilidad: { pesaje: true } });
    const view = renderView();
    expect(await screen.findByText('OF-OLD')).toBeVisible();
    api.progress.mockRejectedValueOnce({ response: { status: 403 } });
    actor.actorId = 8;
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationWorkspaceScm /></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(screen.queryByText('OF-OLD')).not.toBeInTheDocument());
    expect(screen.getByText(/No tienes permiso/)).toBeVisible();
    api.progress.mockResolvedValueOnce({ items: [{ corrida_id: 'r2', of: 'OF-NEW', color: 'Verde', objetivo_neto_kg: '8', kg_finalizados_efectivos: '8', coverage: { estado: 'COMPLETA' } }], visibilidad: { pesaje: true } });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('OF-NEW')).toBeVisible();
  });

  it('filtra color localmente y conserva todos los objetivos de la OF', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('OF-01');
    const search = screen.getByLabelText('Buscar OF, objetivo de color u OT');
    await user.type(search, 'Rojo');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByText('OF-01')).toBeVisible();
    expect(screen.getByText('2 objetivos')).toBeVisible();
    expect(api.progress.mock.calls.every(([params]) => !('q' in params))).toBe(true);
  });

  it('descarta respuestas tardías al revocar OT_VER al mismo actor', async () => {
    let resolveOld;
    api.progress.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = renderView();
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    actor.can.mockReturnValue(false);
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationWorkspaceScm /></MemoryRouter></ThemeProvider>);
    await act(async () => resolveOld({ visibilidad: { pesaje: true }, items: [{ of: 'OF-RETIRADA', corrida_id: 'r1', kg_finalizados_efectivos: 99 }] }));
    expect(screen.queryByText('OF-RETIRADA')).not.toBeInTheDocument();
    expect(screen.getByText(/No tienes permiso para consultar el avance/)).toBeVisible();
  });
});
