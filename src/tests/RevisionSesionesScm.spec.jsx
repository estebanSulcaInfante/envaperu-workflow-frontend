import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryMissingReviewScm from '../components/InventoryMissingReviewScm';

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(), detail: vi.fn(), approve: vi.fn(), legacy: vi.fn(), legacyReview: vi.fn(), legacyMissing: vi.fn(),
}));

vi.mock('../services/scmInventoryC66Api', () => ({
  obtenerSesionesRevision: mocks.sessions,
  obtenerDetalleRevisionSesion: mocks.detail,
  aprobarRevisionSesion: mocks.approve,
  obtenerRevisionFaltantes: mocks.legacy,
  registrarRevisionFaltante: mocks.legacyReview,
  confirmarFaltanteInventario: mocks.legacyMissing,
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
    { codigo: 'M-001', pieza: 'Tapa', color: 'Azul', estado: 'ENCONTRADA', neto_kg: '4.200', bruto_kg: '5.100', aprobable: true },
    { codigo: 'M-002', pieza: 'Tapa', color: 'Rojo', estado: 'NO_HABIDA', neto_kg: '3.100', bruto_kg: null, aprobable: true },
    { codigo: 'M-003', pieza: 'Cuerpo', color: 'Azul', estado: 'FUERA_DE_AJUSTE', neto_kg: '2.000', bruto_kg: '2.500', aprobable: false, motivo_bloqueo: 'Cambio posterior al corte' },
    { codigo: 'M-004', pieza: 'Cuerpo', color: 'Verde', estado: 'AJUSTADA', neto_kg: '1.500', bruto_kg: '1.900', aprobable: false },
    { codigo: 'M-005', pieza: 'Cuerpo', color: 'Negro', estado: 'PENDIENTE', neto_kg: null, bruto_kg: null, aprobable: false },
  ],
  version_revision: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', puede_aprobar: true, movimientos_habilitados: true,
};

const renderPage = () => render(<ThemeProvider theme={createTheme()}><InventoryMissingReviewScm /></ThemeProvider>);

describe('Bandeja de sesiones de revisión C66', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions.mockResolvedValue({ sesiones: [session] });
    mocks.detail.mockResolvedValue(detail);
    mocks.approve.mockResolvedValue({ ok: true, comprobante: 'REV-1', movimientos: [{ delta_kg: '-3.100' }] });
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
    expect(screen.getByText(/5\.100 kg/)).toBeVisible();
    expect(screen.getAllByText('Sin registro')[0]).toBeVisible();
    expect(screen.queryByRole('link', { name: 'M-001' })).not.toBeInTheDocument();
    expect(screen.getAllByText('M-001')[0]).toBeVisible();
    expect(screen.getByText('Tapa')).toBeVisible();
    expect(screen.getByText('Cuerpo')).toBeVisible();
  });

  it('aprueba la sesión completa con motivo y evidencias, usando la versión vigente', async () => {
    mocks.detail.mockResolvedValue({ ...detail, mangas: detail.mangas.map((manga) => ({ ...manga, aprobable: true })) });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    await screen.findByText('Detalle de la solicitud');
    fireEvent.change(screen.getByLabelText('Motivo de aprobación'), { target: { value: 'Cobertura validada y movimientos revisados' } });
    expect(screen.queryByLabelText('Cobertura revisada')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nota')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('S-2026-11-23', {
      version_revision: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      codigos: ['M-002'],
      motivo: 'Cobertura validada y movimientos revisados',
    }, expect.stringMatching(/^[0-9a-f-]{36}$/i)));
    expect(await screen.findByText(/Aprobación registrada: REV-1/)).toBeVisible();
    expect(await screen.findByText(/kilos ajustados 3\.100 kg/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Aprobar sesión completa' })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(2));
  });

  it('expone el permiso y bloquea aprobación cuando la API lo niega', async () => {
    mocks.detail.mockResolvedValue({ ...detail, puede_aprobar: false, motivo_bloqueo: 'La solicitud fue creada por tu misma cuenta.' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    expect(await screen.findByText(/misma cuenta/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aprobar sesión completa' })).toBeDisabled();
  });

  it('mantiene aprobación autorizada a 0 kg cuando no hay faltantes vigentes', async () => {
    const completeSession = { ...session, no_habidas: 0, encontradas: 1 };
    mocks.sessions.mockResolvedValue({ sesiones: [completeSession] });
    mocks.detail.mockResolvedValue({
      ...detail,
      sesion: completeSession,
      mangas: [{ ...detail.mangas[0], estado: 'ENCONTRADA', aprobable: false }],
      puede_aprobar: true,
      movimientos_habilitados: false,
    });
    mocks.approve.mockResolvedValue({ comprobante: 'REV-0', aprobada_at: '2026-11-23T11:00:00Z', movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    expect(await screen.findByText('Detalle de la solicitud')).toBeVisible();
    expect(screen.queryByLabelText('Movimientos revisados')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Motivo de aprobación')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Aprobar sesión completa' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('S-2026-11-23', expect.objectContaining({ codigos: [], motivo: '' }), expect.any(String)));
    expect(await screen.findByText(/kilos ajustados 0.000 kg/)).toBeVisible();
  });

  it('recarga y conserva el mensaje ante revisión obsoleta, limpiando checks', async () => {
    mocks.approve.mockRejectedValueOnce({ response: { status: 409 } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    await screen.findByText('Detalle de la solicitud');
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    expect(await screen.findByText(/No se pudo aprobar la sesión/)).toBeVisible();
    expect(screen.getByLabelText('Motivo de aprobación')).toHaveValue('');
    await waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(2));
  });

  it('reutiliza la misma clave idempotente al reintentar la misma aprobación', async () => {
    mocks.approve.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ comprobante: 'REV-RETRY', movimientos: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Abrir Corte mañana/ }));
    await screen.findByText('Detalle de la solicitud');
    fireEvent.change(screen.getByLabelText('Motivo de aprobación'), { target: { value: 'Reintento seguro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar sesión completa' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(2));
    expect(mocks.approve.mock.calls[0][2]).toBe(mocks.approve.mock.calls[1][2]);
  });

  it('ignora una respuesta fuera de orden al cambiar de sesión', async () => {
    let resolveFirst;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const sessionB = { ...session, id: 'S-2', nombre: 'Corte tarde', piezas: ['Cuerpo'] };
    const detailB = { ...detail, sesion: sessionB, mangas: [{ ...detail.mangas[0], codigo: 'B-001', pieza: 'Cuerpo' }] };
    mocks.sessions.mockResolvedValue({ sesiones: [session, sessionB] });
    mocks.detail.mockReset().mockImplementationOnce(() => first).mockResolvedValueOnce(detailB);
    renderPage();
    const firstTrigger = await screen.findByRole('button', { name: /Abrir Corte mañana/ });
    fireEvent.click(firstTrigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar detalle' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Abrir Corte tarde/ }));
    expect(await screen.findByText('B-001')).toBeVisible();
    resolveFirst(detail);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('B-001')).toBeVisible();
    expect(screen.queryByText('M-001')).not.toBeInTheDocument();
  });

  it('entra a la revisión histórica explícita aunque la bandeja no tenga sesiones', async () => {
    window.history.pushState({}, '', '/almacen/revision-faltantes?codigo=CENTRAL-TAPA-AZUL');
    mocks.sessions.mockResolvedValue({ sesiones: [] });
    mocks.legacy.mockResolvedValue({ revision: { ajuste_habilitado: false, movimientos_habilitados: false, candidatas: [], historial: [{ codigo: 'CENTRAL-TAPA-AZUL', pieza: 'Tapa', color: 'Azul', zona: 'ALM-PZ', neto: '1.000', cobertura_pieza: { completa: true } }] }, movimientos: [] });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Revisión de faltantes' })).toBeVisible();
    expect((await screen.findAllByText('CENTRAL-TAPA-AZUL'))[0]).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirmar faltante' })).not.toBeInTheDocument();
    window.history.pushState({}, '', '/almacen/revision-faltantes');
  });

  it('mantiene en solo lectura el expediente histórico de una manga vinculada a una solicitud', async () => {
    window.history.pushState({}, '', '/almacen/revision-faltantes?codigo=CENTRAL-TAPA-AZUL&historico=1');
    mocks.sessions.mockResolvedValue({ sesiones: [session] });
    mocks.legacy.mockResolvedValue({
      revision: {
        ajuste_habilitado: true,
        movimientos_habilitados: true,
        puede_ajustar: true,
        candidatas: [{ codigo: 'CENTRAL-TAPA-AZUL', pieza: 'Tapa', color: 'Azul', conteo: { id: session.id }, revision: { token: 'REV-OLD', neto: '1.000', cobertura_confirmada: true } }],
      },
      movimientos: [],
    });
    renderPage();
    expect(await screen.findByText(/consulta es solo de lectura/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Registrar revisión' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar faltante' })).not.toBeInTheDocument();
    window.history.pushState({}, '', '/almacen/revision-faltantes');
  });

  it('resuelve un código de sesión al mismo detalle modal sin desviar al checklist', async () => {
    window.history.pushState({}, '', '/almacen/revision-faltantes?codigo=CENTRAL-TAPA-AZUL');
    mocks.sessions.mockResolvedValue({ sesiones: [session] });
    mocks.legacy.mockResolvedValue({ revision: { candidatas: [{ codigo: 'CENTRAL-TAPA-AZUL', conteo: { id: session.id } }] }, movimientos: [] });
    renderPage();
    expect(await screen.findByRole('dialog', { name: /Detalle de la solicitud/ })).toBeVisible();
    expect(mocks.detail).toHaveBeenCalledWith(session.id);
    expect(screen.queryByRole('heading', { name: 'Revisión de faltantes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
    window.history.pushState({}, '', '/almacen/revision-faltantes');
  });

  it('cierra el detalle con Escape y devuelve el foco a la sesión de origen', async () => {
    renderPage();
    const trigger = await screen.findByRole('button', { name: /Abrir Corte mañana/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: /Detalle de la solicitud/ });
    expect(dialog).toBeVisible();
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
