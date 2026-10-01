import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
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
  obtenerActorScm: () => 7, listarArticulosScm: vi.fn().mockResolvedValue([]),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true, canAny: () => true, experience: { label: 'Contrato paginado' },
  }),
}));

const summaryOrder = {
  id: 'of-1', codigo: 'OF-000001', estado: 'LIBERADA', molde_id: 'M-1',
  molde: { codigo: 'M-1', nombre: 'Molde 1' }, corridas: [],
};
const theme = createTheme();
const renderOrders = (route) => render(
  <ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[route]}><FabricationOrdersScm /></MemoryRouter>
  </ThemeProvider>,
);

describe('contrato paginado de la bandeja OF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({
      items: [summaryOrder],
      pagination: { page: 1, page_size: 25, total: 101, total_pages: 5 },
    });
    api.detail.mockResolvedValue({ ...summaryOrder, version: 1 });
    api.progress.mockResolvedValue({ items: [], visibilidad: { pesaje: false } });
    api.moldes.mockResolvedValue([]);
    api.maquinas.mockResolvedValue([]);
    api.colores.mockResolvedValue([]);
    api.recetas.mockResolvedValue({ items: [] });
  });

  it('envía filtros al servidor y acota el avance a los IDs de la página', async () => {
    renderOrders('/produccion/ordenes-fabricacion');
    expect(await screen.findByRole('link', { name: 'Abrir OF-000001' })).toBeVisible();
    expect(api.list).toHaveBeenCalledWith({
      vista: 'resumen', q: '', estado: 'SIN_ANULADAS', orden: 'reciente', pagina: 1, tamano: 25,
    });
    await waitFor(() => expect(api.progress).toHaveBeenCalledWith(expect.objectContaining({ ofIds: ['of-1'] })));
    expect(api.moldes).not.toHaveBeenCalled();
    expect(screen.getByText('1 de 101 OF · página 1 de 5')).toBeVisible();
  });

  it('abre detalle solo por ID y no precarga catálogos para una OF de solo lectura', async () => {
    renderOrders('/produccion/ordenes-fabricacion?of=of-1');
    expect(await screen.findByRole('button', { name: 'Volver a bandeja' })).toBeVisible();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.detail).toHaveBeenCalledWith('of-1');
    expect(api.moldes).not.toHaveBeenCalled();
    expect(api.maquinas).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'OF-000001' })).toBeVisible();
  });

  it('conserva la página anterior si la consulta siguiente falla', async () => {
    renderOrders('/produccion/ordenes-fabricacion');
    expect(await screen.findByRole('link', { name: 'Abrir OF-000001' })).toBeVisible();
    api.list.mockRejectedValueOnce(new Error('offline'));
    const refresh = screen.getByRole('button', { name: 'Actualizar' });
    refresh.click();
    expect(await screen.findByText(/Se muestran datos anteriores/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir OF-000001' })).toBeVisible();
  });

  it('aplica el estado restringido cuando el backend devuelve 403 en el resumen', async () => {
    const denied = Object.assign(new Error('forbidden'), { response: { status: 403 } });
    api.list.mockRejectedValueOnce(denied);
    renderOrders('/produccion/ordenes-fabricacion');
    expect(await screen.findByText(/No tienes permiso para consultar la bandeja de OF/)).toBeVisible();
    expect(api.progress).not.toHaveBeenCalled();
  });
});
