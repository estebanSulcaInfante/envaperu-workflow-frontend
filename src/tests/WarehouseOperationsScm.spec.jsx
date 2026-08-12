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

vi.mock('../services/scmWarehouseOperationsApi', () => api);
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actor: { id: 7, nombre_corto: 'Almacenera' },
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
});
