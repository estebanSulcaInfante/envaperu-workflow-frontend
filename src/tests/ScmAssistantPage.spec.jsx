import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScmAssistantPage from '../components/ScmAssistantPage';
import { consultarScmAssistant, getScmAssistantStatus } from '../services/scmAssistantApi';

vi.mock('../services/scmAssistantApi', () => ({
  consultarScmAssistant: vi.fn(),
  getScmAssistantStatus: vi.fn(),
}));

const readyStatus = {
  available: true,
  auth_state: 'READY',
  message: 'Listo',
  provider: 'deterministic',
};

const result = {
  intent: 'production_daily_summary',
  date_lima: '2026-10-05',
  timezone: 'America/Lima',
  groups: [{
    of: 'OF-001',
    color: 'Azul',
    weighings: 3,
    net_kg: 18.25,
    cancelled_weighings: 1,
    cancelled_kg: 2.5,
    weighing_ids: ['pesaje-1', 'pesaje-2'],
    manga_ids: ['manga-1'],
    cancelled_weighing_ids: ['pesaje-cancelado-1'],
    cancelled_manga_ids: ['manga-cancelada-1'],
  }],
  totals: {
    effective_weighings: 3,
    effective_kg: 18.25,
    cancelled_weighings: 1,
    cancelled_kg: 2.5,
  },
  as_of_utc: '2026-10-06T01:00:00Z',
  trace_id: 'trace-1',
  cache: { hit: false, ttl_seconds: 60 },
  provider: { mode: 'deterministic', status: 'READY', text: 'Se avanzó con respaldo de pesajes.' },
  limitations: ['Pesajes no equivalen a toda la fabricación.'],
  excluded: { count: 1, reasons: ['sin manga atribuible'] },
};

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}><ScmAssistantPage /></ThemeProvider>,
);

describe('Control > Asistente de producción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScmAssistantStatus.mockResolvedValue(readyStatus);
    consultarScmAssistant.mockResolvedValue(result);
  });

  it('bloquea la consulta cuando la identidad está pendiente', async () => {
    getScmAssistantStatus.mockResolvedValue({
      available: true,
      auth_state: 'AUTH_PENDING',
      message: 'Completa la identidad SCM.',
      provider: 'deterministic',
    });
    renderPage();

    expect(await screen.findByText('Pendiente de conexión')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Consultar avance' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toBeDisabled();
    expect(consultarScmAssistant).not.toHaveBeenCalled();
  });

  it('envía únicamente el contrato de consulta y muestra tabla autoritativa separada de la narración', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Consultar avance' });
    await user.click(screen.getByRole('button', { name: 'Consultar avance' }));

    expect(consultarScmAssistant).toHaveBeenCalledWith({
      query: '¿Qué tal fue el avance de producción ayer?',
      dateLima: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      refresh: false,
    });
    expect(consultarScmAssistant.mock.calls[0][0]).not.toHaveProperty('actor_id');
    expect(await screen.findByRole('table', { name: 'Avance de producción por grupo' })).toBeVisible();
    const row = screen.getByRole('row', { name: /OF-001 Azul/ });
    expect(within(row).getByText(/18\.250 kg|18,250 kg/)).toBeVisible();
    expect(within(row).getByText(/2\.500 kg|2,500 kg/)).toBeVisible();
    expect(screen.getByText('Narración generada')).toBeVisible();
    expect(screen.getByText(/no sustituye la tabla numérica autoritativa/i)).toBeVisible();
    expect(screen.getByText(/Los pesajes no equivalen a toda la producción fabricada/i)).toBeVisible();
    expect(screen.getByText(/no se muestra una meta diaria/i)).toBeVisible();
  });

  it('expone el corte y las fuentes cuando se abre el detalle de un grupo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Consultar avance' });
    await user.click(screen.getByRole('button', { name: 'Consultar avance' }));
    await screen.findByRole('table', { name: 'Avance de producción por grupo' });
    await user.click(screen.getByRole('button', { name: 'Ver detalle de OF-001' }));

    expect(screen.getByText(/Ver fuentes de OF-001/)).toBeVisible();
    expect(screen.getByText(/pesaje-1, pesaje-2/)).not.toBeVisible();
    await user.click(screen.getByText(/Ver fuentes de OF-001/));
    expect(screen.getByText(/pesaje-1, pesaje-2/)).toBeVisible();
    expect(screen.getByText(/manga-1/)).toBeVisible();
    expect(screen.getByText(/pesaje-cancelado-1/)).toBeVisible();
    expect(screen.getByText(/manga-cancelada-1/)).toBeVisible();
    await user.click(screen.getByText(/Ver trazabilidad y limitaciones/));
    expect(screen.getByText(/Corte de lectura:/)).toBeVisible();
    expect(screen.getByText(/Trace ID: trace-1/)).toBeVisible();
    expect(screen.getByText(/Se excluyeron 1 registros.*sin manga atribuible/i)).toBeVisible();
  });

  it('permite consulta determinística con proveedor narrativo pendiente', async () => {
    getScmAssistantStatus.mockResolvedValue({
      ...readyStatus,
      provider_state: 'CONFIGURED_NOT_VERIFIED',
      message: 'OpenClaw pendiente de verificación.',
    });
    renderPage();

    expect(await screen.findByText(/OpenClaw pendiente de verificación/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Consultar avance' })).toBeEnabled();
  });

  it('explica proveedor no vinculado sin bloquear el resumen determinístico', async () => {
    getScmAssistantStatus.mockResolvedValue({
      ...readyStatus,
      provider_state: 'PROVIDER_NOT_LINKED',
    });
    renderPage();

    expect(await screen.findByText(/Acceso al asistente habilitado por tu rol/i)).toBeVisible();
    expect(screen.getByText(/proveedor narrativo no está vinculado/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Consultar avance' })).toBeEnabled();
  });
});
