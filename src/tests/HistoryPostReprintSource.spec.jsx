import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({ stations: vi.fn() }));
vi.mock('../services/scmPostWeighingReprintApi', () => ({
  listWeighingStations: apiMocks.stations,
  previewPostWeighingReprint: vi.fn(),
  confirmPostWeighingReprint: vi.fn(),
  getPostWeighingReprintRequest: vi.fn(),
}));

import { historyPesajeForLabel } from '../components/ui/postWeighingReprintModel';
import PostWeighingLabelVisualization from '../components/ui/PostWeighingLabelVisualization';

describe('fuente POSTPESAJE vigente de histórico', () => {
  beforeEach(() => {
    apiMocks.stations.mockResolvedValue({ items: [] });
  });

  it('usa label.pesaje con UUID y estado real para mostrar la acción', () => {
    const label = {
      public_id: '11111111-1111-4111-8111-111111111111',
      tipo: 'POSTPESAJE',
      estado: 'IMPRESA',
      printed_at: '2026-10-07T15:00:00Z',
      pesaje: {
        public_id: '22222222-2222-4222-8222-222222222222',
        estado: 'VIGENTE',
      },
    };
    const pesaje = historyPesajeForLabel(label);
    expect(pesaje).toEqual(label.pesaje);
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint />);
    expect(screen.getByRole('button', { name: /Solicitar reimpresi/ })).toBeEnabled();
  });
});
