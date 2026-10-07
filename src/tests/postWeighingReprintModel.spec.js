import { describe, expect, it } from 'vitest';
import {
  buildPostWeighingReprintItem,
  isPostWeighingLabel,
} from '../components/ui/postWeighingReprintModel';

describe('modelo de etiqueta POSTPESAJE', () => {
  it('reconoce solo etiquetas POST y conserva ids de backend', () => {
    const label = { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE', estado: 'IMPRESA', printed_at: '2026-10-07T15:00:00Z' };
    expect(isPostWeighingLabel(label)).toBe(true);
    expect(buildPostWeighingReprintItem({
      label,
      pesaje: { public_id: '22222222-2222-4222-8222-222222222222', estado: 'VIGENTE' },
      copias: 3,
    })).toEqual({ pesaje_id: '22222222-2222-4222-8222-222222222222', source_label_id: '11111111-1111-4111-8111-111111111111', copias: 3 });
  });

  it('excluye PRE y fuentes sin ids para evitar solicitudes ambiguas', () => {
    expect(isPostWeighingLabel({ public_id: 'pre-1', tipo: 'PREPESAJE' })).toBe(false);
    expect(buildPostWeighingReprintItem({
      label: { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE' },
      pesaje: null,
      copias: 1,
    })).toBeNull();
  });

  it('solo habilita el pesaje vigente y la etiqueta POSTPESAJE no anulada', () => {
    const label = { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE', estado: 'IMPRESA', printed_at: '2026-10-07T15:00:00Z' };
    const pesaje = { public_id: '22222222-2222-4222-8222-222222222222', estado: 'CORREGIDO' };
    expect(buildPostWeighingReprintItem({ label, pesaje, copias: 1 })).toBeNull();
    expect(buildPostWeighingReprintItem({ label: { ...label, estado: 'ANULADA' }, pesaje: { ...pesaje, estado: 'VIGENTE' }, copias: 1 })).toBeNull();
    expect(buildPostWeighingReprintItem({ label, pesaje: { ...pesaje, estado: 'VIGENTE' }, copias: 1 })).not.toBeNull();
  });

  it.each(['GENERADA', 'FALLIDA', 'INCIERTA', 'PENDIENTE_IMPRESION'])('rechaza etiqueta POST no impresa (%s)', (estado) => {
    expect(buildPostWeighingReprintItem({
      label: { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE', estado, printed_at: '2026-10-07T15:00:00Z' },
      pesaje: { public_id: '22222222-2222-4222-8222-222222222222', estado: 'VIGENTE' },
      copias: 1,
    })).toBeNull();
  });

  it('rechaza etiqueta IMPRESA sin marca de impresión confirmada', () => {
    expect(buildPostWeighingReprintItem({
      label: { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE', estado: 'IMPRESA' },
      pesaje: { public_id: '22222222-2222-4222-8222-222222222222', estado: 'VIGENTE' },
      copias: 1,
    })).toBeNull();
  });
});
