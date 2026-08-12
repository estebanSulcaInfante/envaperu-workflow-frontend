import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryScm from '../components/InventoryScm';

const warehouseApi = vi.hoisted(() => ({ obtenerAlcanceAlmacenScm: vi.fn() }));
vi.mock('../services/scmWarehouseOperationsApi', () => warehouseApi);
vi.mock('../services/scmInventoryApi', () => ({
  listarSaldosInventarioScm: vi.fn().mockResolvedValue({ items: [], materiales: [] }),
  listarMovimientosInventarioScm: vi.fn().mockResolvedValue({ items: [] }),
  registrarMovimientoInventarioScm: vi.fn(),
}));
vi.mock('../services/scmEngineeringApi', () => ({
  listarArticulosScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: vi.fn((_error, fallback) => fallback),
}));
vi.mock('../services/scmCatalogApi', () => ({ listarMaterialesScm: vi.fn().mockResolvedValue([]) }));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: () => false }),
}));
vi.mock('../components/InventoryOpeningScm', () => ({ default: () => null }));

const renderView = () => render(<ThemeProvider theme={createTheme()}><InventoryScm /></ThemeProvider>);

describe('Kardex según alcance de almacén', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('explica el almacén y clases efectivas del trabajador', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'] }],
    });
    renderView();
    expect(await screen.findByRole('heading', { name: 'Kardex de mi almacén' })).toBeVisible();
    expect(await screen.findByText(/ALM-PZ \(PIEZA COLOR, SUBENSAMBLE WIP\)/i)).toBeVisible();
  });

  it('no presenta un Kardex vacío como normal cuando falta asignación', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true, control_transversal: false, almacenes: [],
    });
    renderView();
    expect(await screen.findByText(/No tienes un almacén asignado/i)).toBeVisible();
  });
});
