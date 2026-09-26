import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

const api = vi.hoisted(() => ({
  list: vi.fn(), detail: vi.fn(), progress: vi.fn(),
  moldes: vi.fn(), maquinas: vi.fn(), colores: vi.fn(), recetas: vi.fn(),
}));

vi.mock('../services/api', () => ({
  obtenerColores: api.colores, obtenerMaquinas: api.maquinas,
  obtenerMoldes: api.moldes, obtenerRecetasColorMaestras: api.recetas,
  obtenerMolde: vi.fn(),
}));
vi.mock('../services/scmOtApi', () => ({
  listarOrdenesFabricacionScm: api.list, obtenerOrdenFabricacionScm: api.detail,
  anularOrdenFabricacionScm: vi.fn(), reemplazarOrdenFabricacionScm: vi.fn(),
  cerrarOrdenFabricacionScm: vi.fn(), configurarOrdenFabricacionScm: vi.fn(),
  crearOrdenFabricacionExcepcionalScm: vi.fn(), liberarOrdenFabricacionScm: vi.fn(),
}));
vi.mock('../services/scmProductionObservabilityApi', () => ({ listarAvanceOfScm: api.progress }));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
  obtenerActorScm: () => 1, listarArticulosScm: vi.fn().mockResolvedValue([]),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability !== 'MANGA_PESAJE_VER',
    canAny: () => true, experience: { label: 'Revisión local' },
  }),
}));

const renderInbox = (route = '/') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[route]}><FabricationOrdersScm /></MemoryRouter>
  </ThemeProvider>,
);

describe('bandeja local de OF', () => {
  beforeEach(() => {
    api.list.mockResolvedValue({ items: [
      { id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', created_at: '2026-09-01', molde_id: 'M-1', procedencia: { tipo: 'OP', op_codigo: 'OP-7' }, corridas: [{ id: 'r1', objetivo_neto_kg: '10', color_nombre: 'Rojo' }, { id: 'r2', objetivo_neto_kg: '20', color_nombre: 'Verde' }] },
      { id: 'of-2', codigo: 'OF-000002', estado: 'ANULADA', created_at: '2026-09-02', molde_id: 'M-2', corridas: [] },
    ] });
    api.detail.mockResolvedValue({ id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', version: 1, corridas: [] });
    api.progress.mockResolvedValue({ items: [] });
    api.moldes.mockResolvedValue([]);
    api.maquinas.mockResolvedValue([]);
    api.colores.mockResolvedValue([]);
    api.recetas.mockResolvedValue({ items: [] });
  });

  it('entra a la bandeja sin seleccionar la primera OF', async () => {
    renderInbox();
    expect(await screen.findByTestId('of-inbox')).toBeVisible();
    expect(screen.getByText('Rojo · Verde')).toBeVisible();
    expect(screen.queryByText('Configuración del recurso')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' })).not.toBeInTheDocument();
    expect(api.detail).not.toHaveBeenCalled();
  });

  it('abre el UUID exacto y no sustituye un detalle no disponible', async () => {
    const first = renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByRole('button', { name: 'Volver a bandeja' })).toBeVisible();
    expect(api.detail).toHaveBeenCalledWith('of-1');
    expect(screen.queryByRole('button', { name: 'Nueva OF de reposición' })).not.toBeInTheDocument();

    first.unmount();
    api.detail.mockRejectedValueOnce(new Error('OF no encontrada'));
    renderInbox('/produccion/ordenes-fabricacion?of=missing');
    expect(await screen.findByText('OF no encontrada')).toBeVisible();
    expect(screen.queryByText('Configuración del recurso')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a bandeja' })).toBeVisible();
  });

  it('abre detalle exacto aunque falle el listado de bandeja', async () => {
    api.list.mockRejectedValueOnce(new Error('Listado temporalmente no disponible'));
    api.detail.mockResolvedValueOnce({ id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', version: 1, corridas: [] });
    renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByRole('button', { name: 'Volver a bandeja' })).toBeVisible();
    expect(screen.getByText('Configuración del recurso')).toBeVisible();
  });

  it('mantiene todos los objetivos visibles y no inventa avance con cero pesajes', async () => {
    api.detail.mockResolvedValueOnce({
      id: 'of-1', codigo: 'OF-000001', estado: 'BORRADOR', version: 1, molde_id: 'M-1',
      corridas: [
        { id: 'r1', codigo: 'C01', objetivo_neto_kg: '10', color_nombre: 'Rojo', salidas: [] },
        { id: 'r2', codigo: 'C02', objetivo_neto_kg: '20', color_nombre: 'Verde', salidas: [] },
      ],
    });
    api.progress.mockResolvedValue({ items: [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: null, kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' }, mangas: { total: 0 } },
      { corrida_id: 'r2', objetivo_neto_kg: '20', kg_medidos_efectivos: null, kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' }, mangas: { total: 0 } },
    ] });
    renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByRole('spinbutton', { name: 'Objetivo neto (kg) · 1' })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Objetivo neto (kg) · 2' })).toBeVisible();
    expect(screen.getByText(/Avance global: restringido por permisos/)).toBeVisible();
    expect(screen.queryByText(/0\.00 \/ 10\.00 kg/)).not.toBeInTheDocument();

    const expanders = screen.getAllByRole('button', { name: /Mostrar composición/ });
    await userEvent.click(expanders[0]);
    await userEvent.click(expanders[1]);
    expect(expanders[0]).toHaveAttribute('aria-expanded', 'true');
    expect(expanders[0]).toHaveAttribute('aria-controls', 'run-detail-r1');
    expect(expanders[1]).toHaveAttribute('aria-expanded', 'true');
  });

  it('conserva el mismo conjunto al cambiar a Kanban y separa pesos sin permiso', async () => {
    const user = userEvent.setup();
    renderInbox();
    await screen.findByText('OF-000001');
    await user.click(screen.getByRole('button', { name: 'Vista kanban' }));
    expect(screen.getByText('OF-000001')).toBeVisible();
    expect(screen.getByText('Avance restringido')).toBeVisible();
  });

  it('retira datos previos si se revoca OF_VER al actualizar', async () => {
    const user = userEvent.setup();
    api.list
      .mockResolvedValueOnce({ items: [
        { id: 'old', codigo: 'OF-ANTERIOR', estado: 'LIBERADA', corridas: [] },
      ] })
      .mockRejectedValueOnce({ response: { status: 403 } });
    renderInbox();
    expect(await screen.findByText('OF-ANTERIOR')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText(/No tienes permiso para consultar la bandeja/)).toBeVisible();
    expect(screen.queryByText('OF-ANTERIOR')).not.toBeInTheDocument();
  });

  it('conserva la bandeja si moldes falla y permite reintentar solo ese catálogo', async () => {
    const user = userEvent.setup();
    const callsBefore = api.moldes.mock.calls.length;
    api.moldes.mockResolvedValueOnce([
      { codigo: 'M-1', nombre: 'Molde 1', activo: true },
    ]).mockRejectedValueOnce(new Error('moldes 500')).mockResolvedValueOnce([
      { codigo: 'M-1', nombre: 'Molde 1', activo: true },
    ]);
    renderInbox();
    expect(await screen.findByText('OF-000001')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText(/No se pudo cargar moldes: moldes 500/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar moldes' }));
    await waitFor(() => expect(api.moldes.mock.calls.length).toBeGreaterThan(callsBefore + 1));
    expect(screen.queryByText(/No se pudo cargar moldes/)).not.toBeInTheDocument();
    expect(screen.getByText('OF-000001')).toBeVisible();
  });

  it('no deja que una respuesta vieja de moldes sobrescriba un retry nuevo', async () => {
    const user = userEvent.setup();
    let resolveOld;
    let resolveNew;
    const callsBefore = api.moldes.mock.calls.length;
    api.moldes
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    renderInbox();
    await screen.findByText('OF-000001');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(api.moldes.mock.calls.length).toBeGreaterThan(callsBefore + 1));
    resolveNew([{ codigo: 'M-NUEVO', nombre: 'Molde NUEVO', activo: true }]);
    await waitFor(() => expect(api.moldes.mock.calls.length).toBeGreaterThan(callsBefore + 1));
    resolveOld([{ codigo: 'M-VIEJO', nombre: 'Molde VIEJO', activo: true }]);
    await user.click(screen.getByRole('button', { name: 'Nueva OF de reposición' }));
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    expect(screen.getByRole('option', { name: /Molde NUEVO/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Molde VIEJO/ })).not.toBeInTheDocument();
  });

  it('domina el lote si listado o detalle devuelve 401/403', async () => {
    api.list.mockRejectedValueOnce({ response: { status: 403 } });
    api.detail.mockResolvedValueOnce({
      id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', version: 1, corridas: [],
    });
    const first = renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByText(/No tienes permiso para consultar la bandeja/)).toBeVisible();
    expect(screen.queryByText('Configuración del recurso')).not.toBeInTheDocument();
    first.unmount();

    api.list.mockResolvedValueOnce({ items: [{ id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', corridas: [] }] });
    api.detail.mockRejectedValueOnce({ response: { status: 401 } });
    renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByText(/No tienes permiso para consultar la bandeja/)).toBeVisible();
    expect(screen.queryByText('Configuración del recurso')).not.toBeInTheDocument();
  });

  it('protege cambios del borrador al volver y permite descartar de forma explícita', async () => {
    const user = userEvent.setup();
    api.detail.mockResolvedValue({
      id: 'of-1', codigo: 'OF-000001', estado: 'BORRADOR', version: 1, molde_id: 'M-1',
      corridas: [{ id: 'r1', codigo: 'C01', objetivo_neto_kg: '10', salidas: [] }],
    });
    renderInbox('/produccion/ordenes-fabricacion?of=of-1');
    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '12');
    await user.click(screen.getByRole('button', { name: 'Volver a bandeja' }));
    expect(screen.getByRole('dialog', { name: 'Cambios sin guardar' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByText('Configuración del recurso')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Volver a bandeja' }));
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(await screen.findByTestId('of-inbox')).toBeVisible();
  });

});
