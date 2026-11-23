import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegacyInventoryMissingReviewScm as InventoryMissingReviewScm } from '../components/InventoryMissingReviewScm';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), review: vi.fn(), missing: vi.fn(),
}));

vi.mock('../services/scmInventoryC66Api', () => ({
  obtenerRevisionFaltantes: mocks.get,
  registrarRevisionFaltante: mocks.review,
  confirmarFaltanteInventario: mocks.missing,
  obtenerSesionesRevision: undefined,
  obtenerDetalleRevisionSesion: undefined,
  aprobarRevisionSesion: undefined,
}));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (_error, fallback) => fallback }));

const candidate = {
  codigo: 'C66-001', pieza: 'Tapa', color: 'Azul', zona: 'ALM-PZ', neto: '12.300', estado: 'DISPONIBLE', cobertura_pieza: { completa: true, zonas_faltantes: [] },
};

const renderPage = () => render(<ThemeProvider theme={createTheme()}><InventoryMissingReviewScm /></ThemeProvider>);

describe('Revisión de faltantes SCM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ revision: { ajuste_habilitado: true, movimientos_habilitados: true, puede_ajustar: true, candidatas: [candidate], activas: {} }, movimientos: [] });
    mocks.review.mockResolvedValue({ token: 'REV-1', neto: '12.300', cobertura_confirmada: true });
    mocks.missing.mockResolvedValue({ comprobante: 'AJ-001' });
  });

  it('permite revisar evidencia y confirmar un faltante con motivo', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Revisión de faltantes' })).toBeVisible();
    expect(screen.getByText('C66-001')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar C66-001/ }));
    fireEvent.click(screen.getByLabelText('Cobertura revisada'));
    fireEvent.click(screen.getByLabelText('Revisé los ajustes locales y el acceso a Kardex'));
    fireEvent.click(screen.getByLabelText('Búsqueda dirigida completada'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisión' }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith({
      codigo: 'C66-001', cobertura: true, movimientos_revisados: true, busqueda: true,
    }, expect.stringMatching(/^[0-9a-f-]{36}$/i)));
    expect(await screen.findByText(/Neto a descontar: 12\.300 kg/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('Ej. búsqueda física completada sin hallazgo'), { target: { value: 'Búsqueda física completada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar faltante' }));
    await waitFor(() => expect(mocks.missing).toHaveBeenCalledWith({
      codigo: 'C66-001', token: 'REV-1', motivo: 'Búsqueda física completada', clave: expect.any(String),
    }, expect.stringMatching(/^[0-9a-f-]{36}$/i)));
    expect(await screen.findByText(/Ajuste registrado: AJ-001/)).toBeVisible();
  });

  it('mantiene el ajuste bloqueado hasta completar las tres comprobaciones', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    expect(screen.getByRole('button', { name: 'Registrar revisión' })).toBeDisabled();
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('muestra recuperación cuando la cola no está disponible', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    renderPage();
    expect(await screen.findByText(/No pudimos cargar la revisión/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  it('reintenta el mismo ajuste con la misma clave de idempotencia', async () => {
    mocks.missing.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ comprobante: 'AJ-002' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    fireEvent.click(screen.getByLabelText('Cobertura revisada'));
    fireEvent.click(screen.getByLabelText('Revisé los ajustes locales y el acceso a Kardex'));
    fireEvent.click(screen.getByLabelText('Búsqueda dirigida completada'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisión' }));
    await screen.findByText(/Neto a descontar/);
    fireEvent.change(screen.getByPlaceholderText('Ej. búsqueda física completada sin hallazgo'), { target: { value: 'Revisión repetida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar faltante' }));
    await screen.findByText(/No se pudo confirmar el faltante/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar faltante' }));
    await waitFor(() => expect(mocks.missing).toHaveBeenCalledTimes(2));
    expect(mocks.missing.mock.calls[0][0].clave).toBe(mocks.missing.mock.calls[1][0].clave);
    expect(mocks.missing.mock.calls[0][1]).toBe(mocks.missing.mock.calls[1][1]);
  });

  it('respeta la capacidad de ajuste devuelta por el servidor', async () => {
    mocks.get.mockResolvedValue({ revision: { ajuste_habilitado: false, movimientos_habilitados: true, puede_ajustar: false, candidatas: [{ ...candidate, revision: { token: 'REV-1', neto: '12.300', cobertura_confirmada: true } }] }, movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    expect(await screen.findByText(/no tiene permiso para ajustar/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar faltante' })).toBeDisabled();
  });

  it('no atribuye el bloqueo al perfil cuando la puerta operativa está cerrada', async () => {
    mocks.get.mockResolvedValue({ revision: { ajuste_habilitado: false, movimientos_habilitados: false, puede_ajustar: true, candidatas: [{ ...candidate, revision: { token: 'REV-1', neto: '12.300', cobertura_confirmada: true } }] }, movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    expect(await screen.findByText(/confirmación de faltantes está cerrada en este entorno/)).toBeVisible();
    expect(screen.queryByText(/no tiene permiso para ajustar/i)).not.toBeInTheDocument();
  });

  it('mantiene bloqueada la confirmación si falta cualquier flag del contrato', async () => {
    mocks.get.mockResolvedValue({ revision: { ajuste_habilitado: true, movimientos_habilitados: true, candidatas: [{ ...candidate, revision: { token: 'REV-1', neto: '12.300', cobertura_confirmada: true } }] }, movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    expect(await screen.findByText(/API todavía no habilitó la confirmación/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar faltante' })).toBeDisabled();
  });

  it('muestra solo la evidencia vinculada a la manga seleccionada', async () => {
    mocks.get.mockResolvedValue({
      revision: { ajuste_habilitado: true, movimientos_habilitados: true, puede_ajustar: true, candidatas: [{ ...candidate, conteos: [{ id: 'S-1', nombre: 'Conteo almacén', zona: 'PZ-GEN' }] }] },
      sesiones: [{ id: 'S-OTHER', nombre: 'Otro conteo', zona: 'OTRA', lecturas: [{ codigo: 'C66-099' }] }],
      movimientos: [{ id: 'M-1', codigo: 'C66-001', tipo: 'ENTRADA', delta: '12.300' }, { id: 'M-2', codigo: 'C66-099', tipo: 'SALIDA', delta: '-1.000' }],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    expect(screen.getByText(/Conteo almacén · PZ-GEN/)).toBeVisible();
    expect(screen.getByText(/ENTRADA · 12\.300 kg/)).toBeVisible();
    expect(screen.queryByText('Otro conteo · OTRA')).not.toBeInTheDocument();
    expect(screen.queryByText('SALIDA · -1.000 kg')).not.toBeInTheDocument();
  });

  it('retira de la cola una manga que dejó de estar vigente al actualizar', async () => {
    mocks.get.mockResolvedValueOnce({ revision: { ajuste_habilitado: true, candidatas: [candidate] }, movimientos: [] })
      .mockResolvedValueOnce({ revision: { ajuste_habilitado: true, candidatas: [] }, movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Seleccionar C66-001/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Seleccionar C66-001/ })).not.toBeInTheDocument());
  });
});
