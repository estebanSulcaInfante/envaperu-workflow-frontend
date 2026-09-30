import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WarehouseOperationsScm from '../components/WarehouseOperationsScm';

const api = vi.hoisted(() => ({
  listarAlmacenesScm: vi.fn(),
  obtenerAlcanceAlmacenScm: vi.fn(),
  abrirSesionOperacionAlmacenScm: vi.fn(),
  escanearSesionOperacionAlmacenScm: vi.fn(),
  confirmarSesionOperacionAlmacenScm: vi.fn(),
  quitarItemSesionOperacionAlmacenScm: vi.fn(),
  listarTransferenciasScm: vi.fn(),
  obtenerResumenInventarioScm: vi.fn(),
  obtenerTrazabilidadUnidadScm: vi.fn(),
  prepararRetornoTransferenciaScm: vi.fn(),
}));
const actorState = vi.hoisted(() => ({ id: 7 }));

vi.mock('../services/scmWarehouseOperationsApi', () => api);
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actor: { id: 7, nombre_corto: 'Almacenera' },
    actorId: actorState.id,
    can: (code) => ['INVENTARIO_VER', 'INVENTARIO_MOVILIZAR'].includes(code),
  }),
}));

const renderView = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter><WarehouseOperationsScm {...props} /></MemoryRouter>
  </ThemeProvider>,
);

describe('workspace de almacenes y custodia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.id = 7;
    api.listarAlmacenesScm.mockResolvedValue({ items: [{
      id: 'alm-1', codigo: 'ALM-PZ', nombre: 'Piezas', tipo: 'PIEZAS_WIP',
      ubicaciones: [
        { id: 1, codigo: 'PICK', nombre: 'Picking', tipo: 'POSICION' },
        { id: 2, codigo: 'MESA', nombre: 'Mesa', tipo: 'PUNTO_PRODUCCION' },
      ],
    }] });
    api.obtenerAlcanceAlmacenScm.mockResolvedValue({ configurado: true, almacenes: [] });
    api.listarTransferenciasScm.mockResolvedValue({ items: [] });
    api.obtenerResumenInventarioScm.mockResolvedValue({ items: [], as_of: '2026-08-11T12:00:00Z' });
  });

  it('mantiene contexto visible y lector QR antes de confirmar', async () => {
    api.abrirSesionOperacionAlmacenScm.mockResolvedValue({
      id: 'ses-1', version: 1, estado: 'ABIERTA', items: [],
      origen: { id: 1, nombre: 'Picking' }, destino: { id: 2, nombre: 'Mesa' },
    });
    api.escanearSesionOperacionAlmacenScm.mockResolvedValue({
      id: 'ses-1', version: 2, estado: 'LISTA',
      origen: { id: 1, nombre: 'Picking' }, destino: { id: 2, nombre: 'Mesa' },
      items: [{ id: 'i-1', codigo: 'MANGA-001', estado: 'VALIDA', cantidad: '20.000' }],
    });
    renderView();
    expect(await screen.findByRole('heading', { name: /operaciones de almacén/i })).toBeVisible();
    fireEvent.mouseDown(screen.getByLabelText('Ubicación origen'));
    fireEvent.click(await screen.findByText('PICK · Picking'));
    fireEvent.mouseDown(screen.getByLabelText('Ubicación destino'));
    fireEvent.click(await screen.findByText('MESA · Mesa'));
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión qr/i }));
    await waitFor(() => expect(api.abrirSesionOperacionAlmacenScm).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Escanear QR o código'), { target: { value: 'MANGA-001' } });
    fireEvent.keyDown(screen.getByLabelText('Escanear QR o código'), { key: 'Enter' });
    expect(await screen.findByText(/MANGA-001/)).toBeVisible();
    expect(screen.getByRole('button', { name: /confirmar pickup de 1 unidad/i })).toBeEnabled();
  });

  it('Control es explícitamente de solo lectura', async () => {
    renderView({ control: true });
    expect(await screen.findByRole('heading', { name: /control de inventario/i })).toBeVisible();
    expect(screen.getByText(/solo lectura/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /iniciar sesión qr/i })).not.toBeInTheDocument();
  });

  it('busca una manga por código sin habilitar mutaciones en Control', async () => {
    api.obtenerTrazabilidadUnidadScm.mockResolvedValue({
      codigo: 'MANGA-001', estado_logistico: 'EN_TRANSITO_PRODUCCION', cantidad: '20.000',
      ubicacion: { codigo: 'TRANSITO', nombre: 'En tránsito' },
      transferencias: [{ id: 'trf-1' }], movimientos: [{ id: 'mov-1' }, { id: 'mov-2' }],
    });
    renderView({ control: true });
    const input = await screen.findByLabelText(/código o uuid del qr/i);
    fireEvent.change(input, { target: { value: 'MANGA-001' } });
    fireEvent.click(screen.getByRole('button', { name: /ver trazabilidad/i }));
    expect(await screen.findByText(/EN TRANSITO PRODUCCION/i)).toBeVisible();
    expect(screen.getByText(/Transferencias: 1 · Movimientos: 2/i)).toBeVisible();
  });

  it('mantiene la sesión multi-QR en Transferencias entre ubicaciones', async () => {
    renderView({ transfersOnly: true });
    expect(await screen.findByRole('heading', { name: /transferencias entre ubicaciones/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /iniciar sesión qr/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Ver custodia de piezas y WIP/i })).not.toBeInTheDocument();
  });

  it('separa piezas y WIP KG del ledger UN, resuelve almacén y enlaza al Kardex', async () => {
    api.obtenerResumenInventarioScm.mockResolvedValue({
      items: [{ fisico: '3', reservado: '1', no_disponible: '0', unidad: 'UN' }],
      materiales: [{ fisico: '4', reservado: '0', no_disponible: '0', unidad: 'KG' }],
      piezas_kg: [{
        almacen_id: 'alm-1', posiciones: 1,
        fisico: '12.345', reservado: '2.100', no_disponible: '1.005', libre: '9.240',
      }],
      as_of: '2026-08-11T12:00:00Z',
    });
    renderView({ control: true });
    expect(await screen.findByText('Piezas')).toBeVisible();
    expect(screen.getByText(/Código: ALM-PZ/)).toBeVisible();
    expect(screen.getByText('12.35 KG')).toBeVisible();
    expect(screen.getByText('9.24 KG')).toBeVisible();
    expect(screen.getByRole('link', { name: /abrir kardex de piezas y wip/i })).toHaveAttribute('href', '/almacen/kardex');
    expect(screen.getByText('4 KG')).toBeVisible();
  });

  it('descarta el resumen de un actor cuando llega tarde después de cambiar identidad', async () => {
    let resolveNew;
    api.obtenerResumenInventarioScm
      .mockResolvedValueOnce({ piezas_kg: [{ almacen_id: 'alm-1', fisico: '99', reservado: '0', no_disponible: '0', libre: '99' }] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    const view = renderView({ control: true });
    expect((await screen.findAllByText('99.00 KG')).length).toBeGreaterThan(0);
    actorState.id = 8;
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><WarehouseOperationsScm control /></MemoryRouter></ThemeProvider>);
    expect(screen.queryByText('99.00 KG')).not.toBeInTheDocument();
    resolveNew({ piezas_kg: [{ almacen_id: 'alm-1', fisico: '2', reservado: '0', no_disponible: '0', libre: '2' }] });
    expect((await screen.findAllByText('2.00 KG')).length).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('respeta la granularidad real agregada por almacén cuando KG no trae artículo', async () => {
    api.obtenerResumenInventarioScm.mockResolvedValue({
      piezas_kg: [{ almacen_id: null, posiciones: 2, fisico: '3.200', reservado: '0.000', no_disponible: '0.000', libre: '3.200' }],
    });
    renderView({ control: true });
    expect(await screen.findByText('Sin almacén asignado')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Almacén' })).toBeVisible();
    expect(screen.queryByText('Piezas/WIP medido')).not.toBeInTheDocument();
  });

  it('descarta una trazabilidad tardía después de cambiar actor', async () => {
    let resolveTrace;
    api.obtenerTrazabilidadUnidadScm.mockImplementation(() => new Promise((resolve) => { resolveTrace = resolve; }));
    const view = renderView({ control: true });
    const input = await screen.findByLabelText(/código o uuid del qr/i);
    fireEvent.change(input, { target: { value: 'MANGA-OLD' } });
    fireEvent.click(screen.getByRole('button', { name: /ver trazabilidad/i }));
    actorState.id = 8;
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><WarehouseOperationsScm control /></MemoryRouter></ThemeProvider>);
    resolveTrace({ codigo: 'MANGA-OLD', estado_logistico: 'EN_TRANSITO', cantidad: '20', ubicacion: null, transferencias: [], movimientos: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/MANGA-OLD/)).not.toBeInTheDocument();
  });
});
