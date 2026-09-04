import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryScm from '../components/InventoryScm';

const warehouseApi = vi.hoisted(() => ({
  obtenerAlcanceAlmacenScm: vi.fn(),
  obtenerResumenInventarioScm: vi.fn(),
}));
const inventoryApi = vi.hoisted(() => ({
  explorarSaldosInventarioScm: vi.fn(),
  listarSaldosInventarioScm: vi.fn(),
  listarMovimientosInventarioScm: vi.fn(),
  registrarMovimientoInventarioScm: vi.fn(),
}));
vi.mock('../services/scmWarehouseOperationsApi', () => warehouseApi);
vi.mock('../services/scmInventoryApi', () => inventoryApi);
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
  beforeEach(() => {
    vi.clearAllMocks();
    inventoryApi.explorarSaldosInventarioScm.mockResolvedValue({
      items: [], page: { total: 0, has_more: false, next_cursor: null, limit: 25 },
    });
    inventoryApi.listarSaldosInventarioScm.mockResolvedValue({ items: [], materiales: [] });
    inventoryApi.listarMovimientosInventarioScm.mockResolvedValue({ items: [] });
    warehouseApi.obtenerResumenInventarioScm.mockResolvedValue({ items: [], materiales: [] });
  });

  it('explica el almacén y clases efectivas del trabajador', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [
        { codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'] },
        { codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] },
      ],
    });
    renderView();
    expect(await screen.findByRole('heading', { name: 'Kardex de mi almacén' })).toBeVisible();
    expect(await screen.findByText(/ALM-PZ \(PIEZA COLOR, SUBENSAMBLE WIP\)/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Explorador de Kardex' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Piezas y WIP · 0' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Tienes acceso a Piezas y WIP, pero todavía no hay saldo/i)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Producto terminado' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: /Materias primas/i })).not.toBeInTheDocument();
  });

  it('no presenta un Kardex vacío como normal cuando falta asignación', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true, control_transversal: false, almacenes: [],
    });
    renderView();
    expect(await screen.findByText(/No tienes un almacén asignado/i)).toBeVisible();
  });

  it('explora un solo Kardex a la vez y aplica la búsqueda a la pestaña activa', async () => {
    const user = userEvent.setup();
    const balances = [
        {
          id: 'piece-1', cantidad_fisica: '12.000', cantidad_reservada: '2.000',
          cantidad_no_disponible: '0.000', cantidad_libre: '10.000', updated_at: null,
          articulo: { codigo: 'PC-ASA-AZUL', nombre: 'Asa azul', clase: 'PIEZA_COLOR', unidad: 'UN' },
          ubicacion: { codigo: 'PZ-A1', nombre: 'Piezas A1' },
        },
        {
          id: 'pt-1', cantidad_fisica: '4.000', cantidad_reservada: '0.000',
          cantidad_no_disponible: '0.000', cantidad_libre: '4.000', updated_at: null,
          articulo: { codigo: 'PT-BALDE', nombre: 'Balde terminado', clase: 'PRODUCTO_TERMINADO', unidad: 'UN' },
          ubicacion: { codigo: 'PT-A1', nombre: 'Terminados A1' },
        },
      ];
    inventoryApi.explorarSaldosInventarioScm.mockImplementation(({ kardex, q }) => {
      const ledgerItems = kardex === 'PIEZAS_WIP'
        ? balances.filter((item) => item.articulo.clase === 'PIEZA_COLOR')
        : balances.filter((item) => item.articulo.clase === 'PRODUCTO_TERMINADO');
      const items = q
        ? ledgerItems.filter((item) => item.articulo.nombre.toLowerCase().includes(q.toLowerCase()))
        : ledgerItems;
      return Promise.resolve({
        items, page: { total: items.length, has_more: false, next_cursor: null, limit: 25 },
      });
    });
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [
        { codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'] },
        { codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] },
      ],
    });

    renderView();
    expect(await screen.findByText('Asa azul')).toBeVisible();
    expect(screen.queryByText('Balde terminado')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Producto terminado' }));
    expect(await screen.findByText('Balde terminado')).toBeVisible();
    expect(screen.queryByText('Asa azul')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /Buscar en Producto terminado/i }), 'asa');
    expect(await screen.findByText(/No hay saldos que coincidan/i)).toBeVisible();
    expect(screen.queryByText('Balde terminado')).not.toBeInTheDocument();
  });

  it('solicita la siguiente página con el cursor del servidor', async () => {
    const user = userEvent.setup();
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: false, control_transversal: true, almacenes: [],
    });
    inventoryApi.explorarSaldosInventarioScm.mockImplementation(({ cursor }) => {
      const index = cursor ? 26 : 1;
      return Promise.resolve({
        items: [{
          id: `piece-${index}`, cantidad_fisica: '1.000', cantidad_reservada: '0.000',
          cantidad_no_disponible: '0.000', cantidad_libre: '1.000', updated_at: null,
          articulo: {
            codigo: `PC-${String(index).padStart(4, '0')}`,
            nombre: `Pieza ${index}`, clase: 'PIEZA_COLOR', unidad: 'UN',
          },
          ubicacion: { codigo: 'PZ-A1', nombre: 'Piezas A1' },
        }],
        page: {
          total: 26, limit: 25,
          has_more: !cursor, next_cursor: cursor ? null : 'cursor-page-2',
        },
      });
    });

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Piezas y WIP' }));
    expect(await screen.findByText('Pieza 1')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => expect(inventoryApi.explorarSaldosInventarioScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-page-2', limite: 25 }),
    ));
    expect(await screen.findByText('Pieza 26')).toBeVisible();
  });
});
