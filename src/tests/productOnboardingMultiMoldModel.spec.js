import { describe, expect, it } from 'vitest';
import {
  normalizeComponentsData,
  serializeComponentsData,
} from '../components/productOnboarding/technicalStepModel';

const group = (clientId, moldRef, pieceRef) => ({
  client_id: clientId,
  molde: { modo: 'REUTILIZAR', ref: moldRef },
  piezas: [{
    client_id: `pieza-${clientId}`,
    modo: 'REUTILIZAR',
    ref: pieceRef,
    cavidades: '1',
    peso_unitario_gr: '100',
  }],
});

describe('modelo multi-molde del alta integral', () => {
  it('mantiene el contrato histórico cuando existe un solo molde', () => {
    const payload = serializeComponentsData({
      molde: { modo: 'REUTILIZAR', ref: 'ML-000004' },
      piezas: [{
        client_id: 'pieza-tapa', modo: 'REUTILIZAR', ref: 4,
        cavidades: 1, peso_unitario_gr: 380,
      }],
    });

    expect(payload).toEqual({
      molde: { modo: 'REUTILIZAR', ref: 'ML-000004' },
      piezas: [{
        client_id: 'pieza-tapa', modo: 'REUTILIZAR', ref: 4,
        cavidades: 1, peso_unitario_gr: 380,
      }],
    });
  });

  it('serializa varios grupos y entrega una lista plana de piezas a Colores', () => {
    const value = {
      moldes: [
        group('molde-tapa', 'ML-000004', 4),
        group('molde-base', 'ML-000007', 6),
      ],
    };
    const normalized = normalizeComponentsData(value);
    const payload = serializeComponentsData(value);

    expect(normalized.piezas.map((piece) => piece.ref)).toEqual([4, 6]);
    expect(payload.moldes).toHaveLength(2);
    expect(payload.moldes.map((item) => item.molde.ref)).toEqual([
      'ML-000004', 'ML-000007',
    ]);
  });

  it('rehidrata una sesión histórica dentro del primer grupo', () => {
    const normalized = normalizeComponentsData({
      molde: { modo: 'REUTILIZAR', ref: 'ML-000004' },
      piezas: [{
        client_id: 'pieza-tapa', modo: 'REUTILIZAR', ref: 4,
        cavidades: 1, peso_unitario_gr: 380,
      }],
    }, {
      molde_ref: 'ML-000004',
      piezas: [{
        client_id: 'pieza-tapa', pieza_ref: 4, molde_pieza_ref: 44,
      }],
    });

    expect(normalized.moldes).toHaveLength(1);
    expect(normalized.moldes[0].molde.ref).toBe('ML-000004');
    expect(normalized.moldes[0].piezas[0].molde_pieza_ref).toBe(44);
  });
});
