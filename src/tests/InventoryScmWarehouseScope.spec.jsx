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
const actorApi = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock('../services/scmWarehouseOperationsApi', () => warehouseApi);
vi.mock('../services/scmInventoryApi', () => inventoryApi);
vi.mock('../services/scmEngineeringApi', () => ({
  listarArticulosScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: vi.fn((_error, fallback) => fallback),
}));
vi.mock('../services/scmCatalogApi', () => ({ listarMaterialesScm: vi.fn().mockResolvedValue([]) }));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: actorApi.can }),
}));
vi.mock('../components/InventoryOpeningScm', () => ({
  default: ({ onClose }) => onClose && <button type="button" onClick={onClose}>Cerrar apertura</button>,
}));

const renderView = () => render(<ThemeProvider theme={createTheme()}><InventoryScm /></ThemeProvider>);

describe('Kardex según alcance de almacén', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorApi.can.mockImplementation((code) => code === 'INVENTARIO_AJUSTAR');
    inventoryApi.explorarSaldosInventarioScm.mockResolvedValue({
      items: [], page: { total: 0, has_more: false, next_cursor: null, limit: 25 },
    });
    inventoryApi.listarSaldosInventarioScm.mockResolvedValue({ items: [], materiales: [] });
    inventoryApi.listarMovimientosInventarioScm.mockResolvedValue({ items: [] });
    warehouseApi.obtenerResumenInventarioScm.mockResolvedValue({ items: [], materiales: [] });
  });

  it('expone solo las familias funcionales y conserva PT visible aunque esté vacío', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [
        { codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'] },
        { codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] },
      ],
    });
    renderView();
    expect(await screen.findByRole('heading', { name: 'Kardex y existencias' })).toBeVisible();
    expect(await screen.findByText(/ALM-PZ \(PIEZA COLOR, SUBENSAMBLE WIP\)/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Explorador de Kardex' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Piezas y WIP · 0' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Tienes acceso a Piezas y WIP, pero todavía no hay saldo/i)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Producto terminado' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: /Materias primas/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: /Piezas y WIP KG/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Movimientos UN/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Movimientos KG/i })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Producto terminado' }));
    expect(await screen.findByText(/Todavía no hay producto terminado registrado\. Este Kardex se usará en la siguiente etapa del piloto.*movimientos manuales/i)).toBeVisible();
    expect(inventoryApi.explorarSaldosInventarioScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ kardex: 'PRODUCTO_TERMINADO' }),
    );
  });

  it('relega apertura y movimiento manual a Más acciones', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] }],
    });
    renderView();
    expect(await screen.findByRole('heading', { name: 'Kardex y existencias' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Más acciones/i })).toBeVisible();
    expect(screen.queryByText('Apertura inicial')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar movimiento/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Más acciones/i }));
    expect(await screen.findByText('Apertura inicial')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /Registrar movimiento/i })).toBeVisible();
  });

  it('permite cerrar Apertura inicial desde la pantalla secundaria', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true, control_transversal: false, almacenes: [{ codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] }],
    });
    renderView();
    await screen.findByRole('heading', { name: 'Kardex y existencias' });
    await userEvent.click(screen.getByRole('button', { name: /Más acciones/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Apertura inicial' }));
    expect(screen.getByRole('button', { name: 'Cerrar apertura' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar apertura' }));
    expect(screen.queryByRole('button', { name: 'Cerrar apertura' })).not.toBeInTheDocument();
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
          articulo: { codigo: 'PC-ASA-AZUL', nombre: 'Asa azul', clase: 'PIEZA_COLOR', unidad: 'KG' },
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
    expect(inventoryApi.explorarSaldosInventarioScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ kardex: 'PIEZAS_WIP', unidad: 'KG' }),
    );
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
            nombre: `Pieza ${index}`, clase: 'PIEZA_COLOR', unidad: 'KG',
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

  it('consulta Piezas y WIP en KG sin exponer la unidad técnica en la tab', async () => {
    const user = userEvent.setup();
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'] }],
    });
    inventoryApi.explorarSaldosInventarioScm.mockImplementation(({ unidad }) => Promise.resolve({
      items: unidad === 'KG' ? [{
        id: 'kg-1', unidad: 'KG', cantidad_fisica: '12.000', cantidad_reservada: '0.000',
        cantidad_no_disponible: '12.000', cantidad_libre: '0.000',
        articulo: { codigo: 'PC-KG', nombre: 'Pieza KG', clase: 'PIEZA_COLOR', unidad: 'UN' },
        ubicacion: { codigo: 'PZ-A1', nombre: 'Piezas A1' },
      }] : [],
      page: { total: unidad === 'KG' ? 1 : 0, has_more: false, next_cursor: null, limit: 25 },
    }));

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Piezas y WIP · 0' }));
    expect(await screen.findByText('Pieza KG')).toBeVisible();
    expect(inventoryApi.explorarSaldosInventarioScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ kardex: 'PIEZAS_WIP', unidad: 'KG' }),
    );
    expect(screen.getAllByText('12.000 KG')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: /Piezas y WIP KG/i })).not.toBeInTheDocument();
  });

  it('combina movimientos UN y KG, deduplica por unidad e id y muestra la unidad por fila', async () => {
    const user = userEvent.setup();
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR'] }],
    });
    inventoryApi.listarMovimientosInventarioScm.mockImplementation((params) => (
      Promise.resolve({
        items: params.unidad === 'KG'
          ? [
            {
              id: 'shared-1', unidad: 'KG', created_at: '2026-09-21T10:00:00Z',
              articulo_codigo: 'PC-KG', articulo_nombre: 'Pieza medida', ubicacion_codigo: 'PZ-A1',
              tipo: 'INGRESO', cantidad_delta: '12.000', saldo_fisico_resultante: '12.000', motivo: 'Pesaje',
            },
            {
              id: 'shared-1', unidad: 'KG', created_at: '2026-09-21T09:00:00Z',
              articulo_codigo: 'PC-KG', articulo_nombre: 'Pieza medida duplicada', ubicacion_codigo: 'PZ-A1',
              tipo: 'INGRESO', cantidad_delta: '12.000', saldo_fisico_resultante: '12.000', motivo: 'Reintento',
            },
          ]
          : [{
            id: 'shared-1', unidad: 'UN', created_at: '2026-09-21T11:00:00Z',
            articulo_codigo: 'PT-UN', articulo_nombre: 'Producto unitario', ubicacion_codigo: 'PT-A1',
            tipo: 'INGRESO', cantidad_delta: '3.000', saldo_fisico_resultante: '3.000', motivo: 'Recepción',
          }],
      })
    ));

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Movimientos' }));
    await waitFor(() => expect(inventoryApi.listarMovimientosInventarioScm)
      .toHaveBeenCalledWith({}));
    await waitFor(() => expect(inventoryApi.listarMovimientosInventarioScm)
      .toHaveBeenCalledWith({ unidad: 'KG' }));
    expect(await screen.findByText('Producto unitario')).toBeVisible();
    expect(await screen.findByText('Pieza medida')).toBeVisible();
    expect(screen.queryByText('Pieza medida duplicada')).not.toBeInTheDocument();
    expect(screen.getAllByText('3.000 UN')).toHaveLength(2);
    expect(screen.getAllByText('12.000 KG')).toHaveLength(2);
  });

  it('resume cada familia en su propia tarjeta y mantiene Materias primas en KG', async () => {
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{
        codigo: 'ALM-GENERAL',
        clases_articulo: ['MATERIA_PRIMA', 'PIEZA_COLOR', 'PRODUCTO_TERMINADO'],
      }],
    });
    warehouseApi.obtenerResumenInventarioScm.mockResolvedValue({
      items: [],
      piezas_kg: [{ fisico: '10.000', reservado: '2.000', no_disponible: '1.000' }, { fisico: '5.000', reservado: '0.000', no_disponible: '0.000' }],
      materiales: [{ fisico: '7.000', reservado: '1.000', no_disponible: '1.000' }, { fisico: '3.000', reservado: '0.000', no_disponible: '0.000' }],
      producto_terminado: [{ fisico: '4.000', reservado: '1.000', no_disponible: '0.000' }],
    });

    renderView();
    expect(await screen.findByText('Materias primas · KG')).toBeVisible();
    expect(screen.getByText('Piezas y WIP · KG')).toBeVisible();
    expect(screen.getByText('Producto terminado · UN')).toBeVisible();
    await waitFor(() => expect(
      screen.getAllByText(/Físico:/).map((element) => element.parentElement?.textContent),
    ).toEqual(expect.arrayContaining(['Físico: 15 KG', 'Físico: 4 UN', 'Físico: 10 KG'])));
  });

  it('no consulta ni muestra movimientos KG para un alcance solo PT', async () => {
    const user = userEvent.setup();
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PT', clases_articulo: ['PRODUCTO_TERMINADO'] }],
    });
    inventoryApi.listarMovimientosInventarioScm.mockImplementation((params) => Promise.resolve({
      items: params.unidad === 'KG' ? [] : [
        {
          id: 'un-visible', unidad: 'UN', articulo_codigo: 'PT-OK', articulo_nombre: 'PT visible',
          ubicacion_codigo: 'PT-A1', tipo: 'INGRESO', cantidad_delta: '1.000', saldo_fisico_resultante: '1.000', motivo: 'Mostrar',
        },
        {
          id: 'kg-hidden', unidad: 'KG', articulo_codigo: 'PC-HIDDEN', articulo_nombre: 'KG fuera de alcance',
          ubicacion_codigo: 'PZ-A1', tipo: 'INGRESO', cantidad_delta: '9.000', saldo_fisico_resultante: '9.000', motivo: 'No mostrar',
        },
      ],
    }));

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Movimientos' }));
    await waitFor(() => expect(inventoryApi.listarMovimientosInventarioScm).toHaveBeenCalledWith({}));
    expect(inventoryApi.listarMovimientosInventarioScm).not.toHaveBeenCalledWith({ unidad: 'KG' });
    expect(await screen.findByText('PT visible')).toBeVisible();
    expect(screen.queryByText('KG fuera de alcance')).not.toBeInTheDocument();
  });

  it('muestra error total y no conserva filas cuando fallan todas las fuentes', async () => {
    const user = userEvent.setup();
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR'] }],
    });
    inventoryApi.listarMovimientosInventarioScm.mockRejectedValue(new Error('Fuentes no disponibles'));

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Movimientos' }));
    expect(await screen.findByText(/No se pudo cargar esta página del Kardex/i)).toBeVisible();
    expect(screen.getByText(/No hay movimientos que coincidan con los filtros/i)).toBeVisible();
  });

  it('muestra advertencia recuperable ante fallo parcial y reintenta con Actualizar', async () => {
    const user = userEvent.setup();
    let kgAvailable = false;
    warehouseApi.obtenerAlcanceAlmacenScm.mockResolvedValue({
      configurado: true,
      control_transversal: false,
      almacenes: [{ codigo: 'ALM-PZ', clases_articulo: ['PIEZA_COLOR'] }],
    });
    inventoryApi.listarMovimientosInventarioScm.mockImplementation((params) => {
      if (params.unidad === 'KG' && !kgAvailable) return Promise.reject(new Error('KG no disponible'));
      return Promise.resolve({ items: params.unidad === 'KG' ? [{
        id: 'kg-retry', unidad: 'KG', articulo_codigo: 'PC-RETRY', articulo_nombre: 'Pieza recuperada',
        ubicacion_codigo: 'PZ-A1', tipo: 'INGRESO', cantidad_delta: '2.000', saldo_fisico_resultante: '2.000', motivo: 'Reintento',
      }] : [{
        id: 'un-ok', unidad: 'UN', articulo_codigo: 'PT-OK', articulo_nombre: 'Movimiento UN disponible',
        ubicacion_codigo: 'PT-A1', tipo: 'INGRESO', cantidad_delta: '1.000', saldo_fisico_resultante: '1.000', motivo: 'Parcial',
      }] });
    });

    renderView();
    await user.click(await screen.findByRole('tab', { name: 'Movimientos' }));
    expect(await screen.findByText('Movimiento UN disponible')).toBeVisible();
    expect(await screen.findByText(/No se cargaron todas las fuentes de movimientos/i)).toBeVisible();

    kgAvailable = true;
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText('Pieza recuperada')).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/No se cargaron todas las fuentes/i)).not.toBeInTheDocument());
  });
});
