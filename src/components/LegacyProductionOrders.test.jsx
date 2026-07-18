import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import LegacyProductionOrders from './LegacyProductionOrders';
import {
  createPilotCommand,
  getLegacyProductionOrderDetail,
  getLegacyProductionOrders,
} from '../services/legacyProductionOrders';


vi.mock('../services/legacyProductionOrders', () => ({
  createPilotCommand: vi.fn(),
  getLegacyProductionOrders: vi.fn(),
  getLegacyProductionOrderDetail: vi.fn(),
}));


beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});


beforeEach(() => {
  getLegacyProductionOrders.mockResolvedValue({
    items: [
      {
        station_id: '7f99acdd-63e6-4385-bc16-b904d5d8d5ee',
        op_raw: 'OP-213',
        status: 'ABIERTA_PILOTO',
        mapping_status: 'PENDIENTE_MAPEO',
        active_bags: 0,
        deleted_bags: 1,
        active_weight_kg: '0.000',
        last_capture_at_utc: '2026-07-18T14:00:00+00:00',
        molds: ['FLORERO AMERICANO'],
        colors: ['NARAMJA'],
        machines: ['SOPLADORA-2B'],
      },
      {
        station_id: '7f99acdd-63e6-4385-bc16-b904d5d8d5ee',
        op_raw: 'OP-0213',
        status: 'ABIERTA_PILOTO',
        mapping_status: 'MAPEADA',
        active_bags: 48,
        deleted_bags: 0,
        active_weight_kg: '565.500',
        last_capture_at_utc: '2026-07-18T15:00:00+00:00',
        molds: ['EMBUDO N1'],
        colors: ['ROJO'],
        machines: ['HT-160B'],
      },
    ],
    pagination: { page: 1, per_page: 50, total: 2, pages: 1 },
    summary: {
      raw_orders: 2,
      active_bags: 48,
      active_weight_kg: '565.500',
      closed_orders: 0,
      pending_mapping_orders: 1,
    },
  });
  getLegacyProductionOrderDetail.mockResolvedValue({
    captures: [
      {
        legacy_id: 1002,
        weight_kg: '10.000',
        captured_at_utc: '2026-07-18T14:00:00+00:00',
        is_deleted: true,
        ot: '025639',
        color: 'NARAMJA',
        machine_code: 'SOPLADORA-2B',
        shift: 'DIA',
      },
    ],
  });
  createPilotCommand.mockResolvedValue({ status: 'PENDING' });
});


test('keeps ambiguous OPs separate and exposes deleted legacy evidence', async () => {
  const user = userEvent.setup();
  render(<LegacyProductionOrders />);

  expect(await screen.findByTestId('legacy-order-OP-213')).toBeInTheDocument();
  expect(screen.getByTestId('legacy-order-OP-0213')).toBeInTheDocument();
  expect(screen.getByText('Código pendiente de mapeo')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Ver pesajes de OP-213' }));

  await waitFor(() => expect(getLegacyProductionOrderDetail).toHaveBeenCalledWith({
    stationId: '7f99acdd-63e6-4385-bc16-b904d5d8d5ee',
    op: 'OP-213',
  }));
  expect(await screen.findByText('Anulado')).toBeInTheDocument();
});


test('queues an audited close command from the pilot order list', async () => {
  const user = userEvent.setup();
  render(<LegacyProductionOrders />);

  await screen.findByRole('button', { name: 'Cerrar OP-0213' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar historial' })).toBeEnabled());
  const closeButton = screen.getByRole('button', { name: 'Cerrar OP-0213' });
  expect(closeButton).toBeEnabled();
  await user.click(closeButton);
  const dialog = await screen.findByRole('dialog', { name: 'Cerrar OP-0213' });
  await user.type(within(dialog).getByRole('textbox', { name: 'Responsable' }), 'Jefe de planta');
  await user.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'Producción completada');
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

  await waitFor(() => expect(createPilotCommand).toHaveBeenCalledWith(expect.objectContaining({
    action: 'CLOSE_OP',
    op: 'OP-0213',
    requestedBy: 'Jefe de planta',
    reason: 'Producción completada',
  })));
});
