import { describe, expect, it } from 'vitest';
import {
  colorsAreComplete,
  createMatrix,
  normalizeComponentsData,
  serializeColorsData,
  serializeComponentsData,
  validateColors,
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

  it('valida la cobertura de color por molde y no contra todo el PT', () => {
    const components = normalizeComponentsData({
      moldes: [
        {
          client_id: 'molde-pin-compuerta',
          molde: { modo: 'REUTILIZAR', ref: 'ML-PIN-COMPUERTA' },
          piezas: [
            { client_id: 'pin', modo: 'REUTILIZAR', ref: 1, cavidades: 1, peso_unitario_gr: 10 },
            { client_id: 'compuerta', modo: 'REUTILIZAR', ref: 2, cavidades: 1, peso_unitario_gr: 20 },
          ],
        },
        group('molde-tolva', 'ML-TOLVA', 3),
        group('molde-chasis', 'ML-CHASIS', 4),
      ],
    });
    const colors = [
      { client_id: 'verde-militar', modo: 'REUTILIZAR', color_ref: 10 },
      { client_id: 'amarillo', modo: 'REUTILIZAR', color_ref: 20 },
      { client_id: 'negro', modo: 'REUTILIZAR', color_ref: 30 },
    ];
    const selectedPairs = new Set(['1:10', '2:10', '3:20', '4:30']);
    const value = {
      colores: colors,
      matriz: createMatrix(components.piezas, colors).map((cell) => ({
        ...cell,
        seleccionada: selectedPairs.has(`${cell.pieza_ref}:${cell.color_ref}`),
      })),
      formulaciones: colors.map((color) => ({
        color_ref: color.color_ref,
        color_client_id: color.client_id,
        tipo: 'PENDIENTE',
        motivo_pendiente: 'Receta por confirmar',
      })),
    };

    expect(validateColors(value, components.piezas, components.moldes).matriz).toEqual([]);
    expect(colorsAreComplete(value, components.piezas, components.moldes)).toBe(true);
  });

  it('rechaza un color que cubre solo parte de las piezas de su molde', () => {
    const components = normalizeComponentsData({
      moldes: [{
        client_id: 'molde-pin-compuerta',
        molde: { modo: 'REUTILIZAR', ref: 'ML-PIN-COMPUERTA' },
        piezas: [
          { client_id: 'pin', modo: 'REUTILIZAR', ref: 1, cavidades: 1, peso_unitario_gr: 10 },
          { client_id: 'compuerta', modo: 'REUTILIZAR', ref: 2, cavidades: 1, peso_unitario_gr: 20 },
        ],
      }],
    });
    const colors = [{ client_id: 'verde-militar', modo: 'REUTILIZAR', color_ref: 10 }];
    const value = {
      colores: colors,
      matriz: createMatrix(components.piezas, colors).map((cell) => ({
        ...cell,
        seleccionada: cell.pieza_ref === 1,
      })),
      formulaciones: [{
        color_ref: 10,
        color_client_id: 'verde-militar',
        tipo: 'PENDIENTE',
        motivo_pendiente: 'Receta por confirmar',
      }],
    };

    expect(validateColors(value, components.piezas, components.moldes).matriz)
      .toContain('Cada color del molde debe cubrir todas sus piezas activas.');
  });

  it('conserva tres recetas para el mismo verde militar según la pieza', () => {
    const payload = serializeColorsData({
      colores: [{
        client_id: 'verde-militar', modo: 'REUTILIZAR', color_ref: 10,
      }],
      matriz: [
        { pieza_ref: 1, color_ref: 10, seleccionada: true, receta_ref: 101 },
        { pieza_ref: 2, color_ref: 10, seleccionada: true, receta_ref: 102 },
        { pieza_ref: 3, color_ref: 10, seleccionada: true, receta_ref: 103 },
        { pieza_ref: 4, color_ref: 10, seleccionada: true, receta_ref: 103 },
      ],
      formulaciones: [{
        color_ref: 10,
        color_client_id: 'verde-militar',
        tipo: 'EXISTENTE',
        receta_ref: 101,
      }],
    });

    expect(payload.matriz.map((row) => row.receta_ref)).toEqual([
      101, 102, 103, 103,
    ]);
  });
});
