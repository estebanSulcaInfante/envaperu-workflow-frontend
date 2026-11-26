import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryC66Scm from '../components/InventoryC66Scm';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(), open: vi.fn(), read: vi.fn(), remove: vi.fn(), close: vi.fn(),
}));

vi.mock('../services/scmInventoryC66Api', () => ({
  obtenerEstadoInventarioC66: mocks.getState,
  abrirSesionInventarioC66: mocks.open,
  registrarLecturaInventarioC66: mocks.read,
  retirarLecturaInventarioC66: mocks.remove,
  cerrarSesionInventarioC66: mocks.close,
}));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (_error, fallback) => fallback }));

const state = {
  conteo_por_pieza: true,
  zonas: [{ id: 'Z1', nombre: 'C66' }],
  articulos: [{ id: 'A1', nombre: 'Tapa', color: 'Azul' }, { id: 'A2', nombre: 'Cuerpo', color: 'Rojo' }],
  sesiones: [],
};

const renderPage = () => render(<ThemeProvider theme={createTheme()}><InventoryC66Scm /></ThemeProvider>);

describe('Conteo C66 web', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockResolvedValue(state);
    mocks.open.mockResolvedValue({ id: 'S-C66-1' });
    mocks.read.mockResolvedValue({ mensaje: 'Lectura registrada' });
    mocks.close.mockResolvedValue({ cantidad: 1 });
  });

  it('declara la información primaria, crea el conteo y conserva clave de operación', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Nuevo conteo' })).toBeVisible();
    expect(screen.getByText(/No hay sesiones para retomar/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nombre del conteo'), { target: { value: 'Turno mañana' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Zona' }));
    fireEvent.click(await screen.findByRole('option', { name: 'C66' }));
    fireEvent.focus(screen.getByPlaceholderText('Buscar pieza'));
    fireEvent.click(await screen.findByRole('option', { name: 'Tapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar conteo' }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(
      { zona: 'Z1', nombre: 'Turno mañana', piezas: ['Tapa'] },
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
  });

  it('hidrata el resumen al reanudar y deja reintentar si falla el detalle', async () => {
    const summary = { id: 'S-C66-RESUMEN', estado: 'ABIERTA', zona: 'Z1', nombre: 'Turno resumido', piezas: ['Tapa'], resumen: true };
    const detail = { ...summary, resumen: false, lecturas: [] };
    let scopedAttempts = 0;
    mocks.getState.mockImplementation((requestedSessionId) => {
      if (!requestedSessionId) return Promise.resolve({ ...state, sesiones: [summary] });
      scopedAttempts += 1;
      return scopedAttempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ...state, sesiones: [detail] });
    });
    renderPage();
    const sessionButton = await screen.findByRole('button', { name: /Turno resumido/ });
    fireEvent.click(sessionButton);
    expect(await screen.findByText(/No pudimos cargar el detalle/)).toBeVisible();
    expect(screen.queryByLabelText('Escanear QR de manga')).not.toBeInTheDocument();
    fireEvent.click(sessionButton);
    expect(await screen.findByLabelText('Escanear QR de manga')).toBeVisible();
    expect(scopedAttempts).toBe(2);
  });

  it('conserva el QR opaco, permite cambiar zona y usa details.zona_anterior en la recuperación', async () => {
    const activeState = {
      ...state,
      zonas: [{ id: 'Z1', nombre: 'C66' }, { id: 'Z2', nombre: 'Bodega' }],
      sesiones: [{ id: 'S-C66-1', estado: 'ABIERTA', zona: 'Z1', nombre: 'Turno mañana', piezas: ['Tapa'], lecturas: [] }],
    };
    mocks.getState.mockResolvedValue(activeState);
    mocks.read.mockRejectedValueOnce({ response: {
      status: 409,
      data: { error: { code: 'ZONE_CONFLICT', message: 'La zona del QR no coincide.', details: { zona_anterior: 'Z1' } } },
    } }).mockResolvedValueOnce({ mensaje: 'Lectura registrada' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Turno mañana/ }));
    expect(await screen.findByRole('heading', { name: 'Turno mañana' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(mocks.getState).toHaveBeenLastCalledWith('S-C66-1'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Zona' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Bodega' }));
    const scan = screen.getByLabelText('Escanear QR de manga');
    const opaqueCode = 'L1|label, {"codigo":"C66-001"}';
    fireEvent.change(scan, { target: { value: opaqueCode } });
    fireEvent.submit(scan.closest('form'));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(
      'S-C66-1', { codigo: opaqueCode, zona: 'Z2' }, expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
    expect(mocks.getState).toHaveBeenLastCalledWith('S-C66-1');
    expect(await screen.findByText(/La zona del QR no coincide/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar zona' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(
      'S-C66-1', { codigo: opaqueCode, zona: 'Z2', confirmar_zona: true, zona_anterior: 'Z1' }, expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
    expect(mocks.read.mock.calls[0][2]).not.toBe(mocks.read.mock.calls[1][2]);
  });

  it('consulta una sesión cerrada con lecturas enriquecidas y mangas no habidas', async () => {
    mocks.getState.mockResolvedValue({
      ...state,
      sesiones: [{
        id: 'S-C66-HIST', estado: 'CERRADA', zona: 'Z1', nombre: 'Inventario histórico',
        piezas: ['Tapa'], lecturas: [{ codigo: 'L1|label', articulo_id: 'A1', articulo: 'SKU-TAPA-AZUL', zona: 'Z1' }], pendientes_conteo: ['C66-010'], no_habidas: ['C66-009'],
      }],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Inventario histórico/ }));
    expect(await screen.findByText('L1|label')).toBeVisible();
    expect(screen.getByText('Tapa · Azul · C66')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Pendientes al cerrar' })).toBeVisible();
    expect(screen.getByText('C66-010')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mangas no habidas' })).toBeVisible();
    expect(screen.getByText('C66-009')).toBeVisible();
  });

  it('cierra un conteo por piezas sin cobertura cuando la casilla queda sin marcar', async () => {
    const activeState = {
      ...state,
      sesiones: [{ id: 'S-C66-CLOSE', estado: 'ABIERTA', zona: 'Z1', nombre: 'Conteo parcial', piezas: ['Tapa'], lecturas: [], pendientes_conteo: ['C66-010'] }],
    };
    mocks.getState.mockResolvedValue(activeState);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Conteo parcial/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Mangas pendientes de localizar')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar solo lo contado' }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(
      'S-C66-CLOSE', {}, expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
  });

  it('solicita revisión explícita y conserva el cierre parcial aun sin faltantes', async () => {
    const activeState = {
      ...state,
      sesiones: [{ id: 'S-C66-REVIEW', estado: 'ABIERTA', zona: 'Z1', nombre: 'Conteo sin faltantes', piezas: ['Tapa'], lecturas: [{ codigo: 'C66-001' }], pendientes_conteo: [] }],
    };
    mocks.getState.mockResolvedValue(activeState);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Conteo sin faltantes/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText(/No quedan mangas pendientes/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión' }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(
      'S-C66-REVIEW', { solicitar_revision: true }, expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
    expect(await screen.findByText(/Solicitud enviada/)).toBeVisible();
  });

  it('solicita revisión con las no habidas pendientes y envía cobertura confirmada', async () => {
    const activeState = {
      ...state,
      zonas: [{ id: 'Z1', nombre: 'Almacén de piezas general' }, { id: 'Z2', nombre: 'Almacén de armado 3er piso' }],
      sesiones: [{ id: 'S-C66-COVER', estado: 'ABIERTA', zona: 'Z1', nombre: 'Conteo completo', piezas: ['Tapa'], lecturas: [], pendientes_conteo: ['C66-010'] }],
    };
    mocks.getState.mockResolvedValue(activeState);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Conteo completo/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Zona' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Almacén de armado 3er piso' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByLabelText('Recorrí por completo Almacén de piezas general para las piezas seleccionadas')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Recorrí por completo Almacén de piezas general para las piezas seleccionadas'));
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar revisión' }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(
      'S-C66-COVER', { marcar_no_habidas: true, no_habidas: ['C66-010'], cobertura: true, solicitar_revision: true }, expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
    expect(await screen.findByText(/Solicitud enviada/)).toBeVisible();
  });
});
