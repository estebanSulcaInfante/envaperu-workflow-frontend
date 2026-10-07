import { describe, expect, it } from 'vitest';
import { selectCurrentPostLabel } from '../components/ui/postWeighingReprintModel';

describe('fuente POSTPESAJE vigente de OT', () => {
  it('consume current_source y no rescata una etiqueta histórica', () => {
    const vigente = { tipo: 'POSTPESAJE', public_id: '11111111-1111-4111-8111-111111111111', estado: 'IMPRESA', printed_at: '2026-10-07T15:00:00Z' };
    const historica = { tipo: 'POSTPESAJE', public_id: '22222222-2222-4222-8222-222222222222' };
    expect(selectCurrentPostLabel({ current_source: { label: vigente }, original: { etiqueta: historica } }, null)).toBe(vigente);
  });
});
