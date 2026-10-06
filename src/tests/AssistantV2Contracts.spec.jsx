import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantV2Panel from '../components/assistantV2/AssistantV2Panel';
import AssistantV2Results from '../components/assistantV2/AssistantV2Results';
import { getScmAssistantV2Catalog, listScmAssistantProposals } from '../services/scmAssistantV2Api';

vi.mock('../services/scmAssistantV2Api', () => ({
  getScmAssistantV2Catalog: vi.fn(),
  listScmAssistantProposals: vi.fn(),
  sendScmAssistantV2Chat: vi.fn(),
}));

describe('contratos canónicos visibles del asistente v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScmAssistantV2Catalog.mockResolvedValue({
      suggestions: [{ label: 'Avance de ayer', query: 'daily_summary date=2026-10-05' }],
    });
    listScmAssistantProposals.mockResolvedValue({ can_review: false, items: [] });
  });

  it('conserva query separado del label al elegir una sugerencia del catálogo', async () => {
    const user = userEvent.setup();
    render(<AssistantV2Panel onClose={vi.fn()} onMinimize={vi.fn()} />);
    const suggestion = await screen.findByRole('button', { name: 'Avance de ayer' });
    await user.click(suggestion);
    expect(screen.getByRole('textbox', { name: 'Pregunta' })).toHaveValue('daily_summary date=2026-10-05');
  });

  it('renderiza métricas de progreso y secciones de manga sin ocultarlas como objeto', async () => {
    const user = userEvent.setup();
    render(<AssistantV2Results response={{
      status: 'answered',
      results: [
        {
          intent: 'daily_summary',
          data: { date_lima: '2026-10-05', target_policy: 'list_production_progress', timezone: 'America/Lima', trace_id: 'trace-daily', totals: { effective_kg: 88.2, cancelled_kg: 4.1 }, groups: [{ of: 'OF-70', net_kg: 88.2 }] },
          source: 'scm.daily_summary',
          as_of_utc: '2026-10-06T12:00:00Z',
        },
        {
          intent: 'production_order_progress',
          data: { items: [{ of_id: 'of-74', corrida_id: 'run-1', corrida: 1, of: 'OF-74', ot: 'OT-9', color: 'Azul', color_hex: '#08f', molde: 'M-1', objetivo_neto_kg: 100, kg_finalizados_efectivos: 42.5, porcentaje: 42.5 }] },
          source: 'scm.production_order_progress',
          as_of_utc: '2026-10-06T12:00:00Z',
        },
        {
          intent: 'weighing_period',
          data: { fecha_desde: '2026-10-01', fecha_hasta: '2026-10-05', days: [{ fecha: '2026-10-05', readings: 4, groups: [{ of: 'OF-70', kg: 5 }] }], totals: { readings: 4 } },
          source: 'scm.weighing_period',
          as_of_utc: '2026-10-06T12:00:00Z',
        },
        {
          intent: 'manga_trace',
          data: { id: 'manga-100', as_of: '2026-10-06T12:00:00Z', secciones: { identidad: { codigo: 'M-100', estado: 'RECIBIDA' }, documentos: { orden: 'OF-74' }, pesajes: { efectivos: 2 } } },
          source: 'scm.manga_trace',
          as_of_utc: '2026-10-06T12:00:00Z',
        },
      ],
    }} />);

    expect(screen.getAllByText('Objetivo neto (kg)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kg finalizados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42.5').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Porcentaje').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OF-74').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('OT-9').length).toBeGreaterThan(0);
    expect(screen.getByText('Identidad')).toBeVisible();
    expect(screen.getByText('Documentos')).toBeVisible();
    expect(screen.getAllByText('Pesajes').length).toBeGreaterThan(0);
    expect(screen.getByText('M-100')).toBeVisible();
    expect(screen.getAllByText('2026-10-05').length).toBeGreaterThanOrEqual(2);
    for (const summary of screen.getAllByText('Ver fuente y corte')) await user.click(summary);
    expect(screen.getByText('Fuente: scm.daily_summary')).toBeVisible();
    expect(screen.getByText('Kg efectivos')).toBeVisible();
    expect(screen.getByText('Kg anulados')).toBeVisible();
    expect(screen.getByText('Fuente: scm.weighing_period')).toBeVisible();
    expect(screen.getAllByText('Lecturas').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('OF-70').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Fuente: scm.manga_trace')).toBeVisible();
  });
});

