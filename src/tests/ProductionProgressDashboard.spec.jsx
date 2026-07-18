import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import ProductionProgressDashboard from '../components/ProductionProgressDashboard';
import { getProductionProgress } from '../services/productionProgress';


vi.mock('../services/productionProgress', () => ({
  getProductionProgress: vi.fn(),
}));

const response = {
  source: 'LOCAL_REPORTED_LEGACY',
  operational_date: '2026-07-17',
  generated_at_utc: '2026-07-17T15:02:03+00:00',
  summary: {
    bags: 3,
    production_orders: 2,
    stations_reporting: 1,
    weight_kg: '75.150',
  },
  monthly_summary: {
    average_daily_weight_kg: '50.075',
    bags: 4,
    month: '2026-07',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    production_days: 2,
    production_orders: 2,
    weight_kg: '100.150',
  },
  items: [
    {
      op: 'OP-1401',
      product: 'Tapa 38 mm',
      bags: 2,
      weight_kg: '50.250',
      target_kg: '100.000',
      target_status: 'AVAILABLE',
      progress_percent: 50.3,
      communication_status: 'RECIENTE',
      last_capture_at_utc: '2026-07-17T14:05:00+00:00',
      last_report_received_at_utc: '2026-07-17T15:02:03+00:00',
      stations: [
        {
          station_id: 'station-1',
          code: 'PESAJE-01',
          name: 'Balanza principal',
          communication_status: 'RECIENTE',
        },
      ],
      details: [
        {
          station_id: 'station-1',
          station_code: 'PESAJE-01',
          ot: 'OT-0041',
          mold: 'TAPA 38 MM',
          color: 'ROJO SOLIDO',
          machine_code: 'HT-250B',
          shift: 'DIURNO',
          bags: 2,
          weight_kg: '50.250',
          first_capture_at_utc: '2026-07-17T13:10:00+00:00',
          last_capture_at_utc: '2026-07-17T14:05:00+00:00',
        },
      ],
    },
    {
      op: 'OP-1402',
      product: null,
      bags: 1,
      weight_kg: '24.900',
      target_kg: null,
      target_status: 'OP_NOT_FOUND',
      progress_percent: null,
      communication_status: 'ATRASADA',
      last_capture_at_utc: '2026-07-17T15:02:00+00:00',
      last_report_received_at_utc: '2026-07-17T15:02:03+00:00',
      stations: [
        {
          station_id: 'station-1',
          code: 'PESAJE-01',
          name: 'Balanza principal',
          communication_status: 'ATRASADA',
        },
      ],
      details: [
        {
          station_id: 'station-1',
          station_code: 'PESAJE-01',
          ot: 'OT-0042',
          mold: 'BOTELLA 1 L',
          color: 'NATURAL',
          machine_code: 'SOP-01',
          shift: 'DIURNO',
          bags: 1,
          weight_kg: '24.900',
          first_capture_at_utc: '2026-07-17T15:02:00+00:00',
          last_capture_at_utc: '2026-07-17T15:02:00+00:00',
        },
      ],
    },
  ],
};

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <ProductionProgressDashboard initialDate="2026-07-17" />
  </ThemeProvider>,
);

describe('US-011A: Dashboard gerencial temporal por pesajes', () => {
  beforeEach(() => {
    getProductionProgress.mockReset();
    getProductionProgress.mockResolvedValue(response);
  });

  it('separa las OP, declara la fuente legacy y no inventa una meta', async () => {
    renderPage();

    expect(await screen.findByRole('heading', {
      name: 'Avance de producción por pesajes',
    })).toBeInTheDocument();
    expect(screen.getByTestId('progress-total-weight')).toHaveTextContent('75.150 kg');
    expect(screen.getByTestId('progress-total-bags')).toHaveTextContent('3');
    expect(screen.getByRole('heading', { name: 'Resumen mensual · julio de 2026' })).toBeInTheDocument();
    expect(screen.getByTestId('monthly-total-weight')).toHaveTextContent('100.150 kg');
    expect(screen.getByTestId('monthly-total-bags')).toHaveTextContent('4');
    expect(screen.getByTestId('monthly-production-orders')).toHaveTextContent('2');
    expect(screen.getByTestId('monthly-daily-average')).toHaveTextContent('50.075 kg');
    expect(screen.getByText('2 días con producción')).toBeInTheDocument();
    expect(screen.getByText('Reporte local legacy')).toBeInTheDocument();
    expect(screen.getByText(/no confirma inventario SCM/i)).toBeInTheDocument();

    const op1401 = screen.getByTestId('progress-row-OP-1401');
    const op1402 = screen.getByTestId('progress-row-OP-1402');
    expect(within(op1401).getByText('50.3%')).toBeInTheDocument();
    expect(within(op1402).getByText('Sin meta')).toBeInTheDocument();
    expect(within(op1402).queryByText('0%')).not.toBeInTheDocument();
  });

  it('consulta nuevamente al cambiar el filtro de máquina', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OP-1401');

    await user.click(screen.getByLabelText('Máquina'));
    await user.click(await screen.findByRole('option', { name: 'HT-250B' }));

    await waitFor(() => {
      expect(getProductionProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          date: '2026-07-17',
          machine_code: 'HT-250B',
        }),
      );
    });
  });

  it('muestra el detalle dimensional sin confundirlo con otra OP', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OP-1401');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OP-1401' }));

    const detail = screen.getByTestId('progress-detail-OP-1401');
    expect(within(detail).getByText('OT-0041')).toBeInTheDocument();
    expect(within(detail).getByText('TAPA 38 MM')).toBeInTheDocument();
    expect(within(detail).getByText('ROJO SOLIDO')).toBeInTheDocument();
    expect(within(detail).queryByText('OT-0042')).not.toBeInTheDocument();
  });

  it('conserva un estado de error reintentable', async () => {
    getProductionProgress.mockRejectedValueOnce(new Error('central no disponible'));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/No se pudo consultar el avance/i)).toBeInTheDocument();
    getProductionProgress.mockResolvedValueOnce(response);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByTestId('progress-total-weight')).toHaveTextContent('75.150 kg');
  });
});
