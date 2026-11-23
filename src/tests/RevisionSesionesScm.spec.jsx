import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryMissingReviewScm from '../components/InventoryMissingReviewScm';

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(), detail: vi.fn(), approve: vi.fn(), legacy: vi.fn(),
}));

vi.mock('../services/scmInventoryC66Api', () => ({
  obtenerSesionesRevision: mocks.sessions,
  obtenerDetalleRevisionSesion: mocks.detail,
  aprobarRevisionSesion: mocks.approve,
  obtenerRevisionFaltantes: mocks.legacy,
}));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (_error, fallback) => fallback }));

const session = {
  id: 'S-2026-11-23', nombre: 'Corte mañana', estado: 'PENDIENTE', zona: 'ALM-PZ',
  piezas: ['Tapa', 'Cuerpo'], esperadas: 3, encontradas: 2, no_habidas: 1,
  solicitada_at: '2026-11-23T10:00:00Z',
};
const detail = {
  sesion: session,
  mangas: [
    { codigo: 'M-001', pieza: 'Tapa', color: 'Azul', estado: 'ENCONTRADA', neto_kg: '4.200', aprobable: true },
    { codigo: 'M-002', pieza: 'Tapa', color: 'Rojo', estado: 'NO_HABIDA', neto_kg: '3.100', aprobable: true },
    { codigo: 'M-003', pieza: 'Cuerpo', color: 'Azul', estado: 'FUERA_DE_AJUSTE', neto_kg: '2.000', aprobable: false, motivo_bloqueo: 'Cambio posterior al corte' },
    { codigo: 'M-004', pieza: 'Cuerpo', color: 'Verde', estado: 'AJUSTADA', neto_kg: '1.500', aprobable: false },
    { codigo: 'M-005', pieza: 'Cuerpo', color: 'Negro', estado: 'PENDIENTE', neto_kg: null, aprobable: false },
  ],
  version_revision: 7, puede_aprobar: true, movimientos_habilitados: true,
};

const renderPage = () => render(<ThemeProvider theme={createTheme()}><InventoryMissingReviewScm /></ThemeProvider>);

describe('Bandeja de sesiones de revisión C66', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions.mockResolvedValue({ sesiones: [session] });
    mocks.detail.mockResolvedValue(detail);
    mocks.approve.mockResolvedValue({ ok: true, comprobante: 'APR-1' });
  });

  it('filtra por nombre/zona/pieza y muestra el detalle con todos los estados', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Solicitudes de revisión' })).toBeVisible();
    expect(screen.getByText('Corte mañana')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Abrir Corte mañana/ }));
    expect(await screen.findByText('Detalle de la solicitud')).toBeVisible();
    for (const status of ['Encontrada (OK)', 'No habida', 'Pendiente', 'Fuera de ajuste', 'Ajustada']) {
      expect(screen.getAllByText(status)[0]).toBeVisible();
    }
    expect(screen.getAllByText(/4\.200 kg/)[0]).toBeVisible();
    expect(screen.getAllByRole('link', { name: /revisión individual/i })[0]).toHaveAttribute('href', expect.stringContaining('/almacen/revision-faltantes'));
  });

  it('aprueba la sesión completa con motivo y evidencias, usando la versión vigente', async () => {
    mocks.detail.mockResolvedValue({ ...detail, mangas: detail.mangas.map((manga) => ({ ...manga, aprobable: true })) });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    await screen.findByText('Detalle de la solicitud');
    fireEvent.change(screen.getByLabelText('Motivo de aprobación'), { target: { value: 'Cobertura validada y movimientos revisados' } });
    fireEvent.click(screen.getByLabelText('Cobertura revisada'));
    fireEvent.click(screen.getByLabelText('Movimientos revisados'));
    fireEvent.click(screen.getByLabelText('Búsqueda y evidencias revisadas'));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('S-2026-11-23', {
      version_revision: 7,
      codigos: ['M-002'],
      motivo: 'Cobertura validada y movimientos revisados',
      cobertura: true,
      movimientos_revisados: true,
      busqueda: true,
    }, expect.stringMatching(/^[0-9a-f-]{36}$/i)));
    expect(await screen.findByText(/Aprobación registrada/)).toBeVisible();
  });

  it('expone el permiso y bloquea aprobación cuando la API lo niega', async () => {
    mocks.detail.mockResolvedValue({ ...detail, puede_aprobar: false, motivo_bloqueo: 'La solicitud fue creada por tu misma cuenta.' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    expect(await screen.findByText(/misma cuenta/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aprobar sesión completa' })).toBeDisabled();
  });
});
