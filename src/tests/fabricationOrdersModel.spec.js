import { describe, expect, it } from 'vitest';
import {
  displayProvenance, filterAndSortOrders, paginateOrders, projectOrderProgress,
} from '../components/fabricationOrdersModel';

const orders = [
  { id: '2', codigo: 'OF-2', estado: 'ANULADA', created_at: '2026-09-02', molde_id: 'M-Ámbar', corridas: [] },
  { id: '1', codigo: 'OF-1', estado: 'LIBERADA', created_at: '2026-09-03', molde_id: 'M-Azul', corridas: [{ color_nombre: 'Rojo' }] },
];

describe('modelo de bandeja OF', () => {
  it('normaliza acentos, excluye anuladas por defecto y ordena de forma estable', () => {
    expect(filterAndSortOrders(orders, { query: 'ambar' })).toEqual([]);
    expect(filterAndSortOrders(orders, { query: 'azul' }).map((item) => item.id)).toEqual(['1']);
    expect(filterAndSortOrders(orders, { status: 'TODOS' }).map((item) => item.id)).toEqual(['1', '2']);
  });

  it('proyecta procedencia objeto sin renderizarlo como hijo React', () => {
    expect(displayProvenance({ op_codigo: 'OP-7', tipo: 'OP', plan_id: 'p1' })).toBe('OP-7 · OP · p1');
    expect(filterAndSortOrders([{
      id: 'real', estado: 'LIBERADA', procedencia: { op_codigo: 'OP-7', tipo: 'OP' },
    }], { query: 'op-7' })).toHaveLength(1);
  });

  it('pagina después de filtrar sin duplicar ni omitir', () => {
    const result = paginateOrders([...orders, { ...orders[1], id: '3', codigo: 'OF-3' }], 2, 25);
    expect(result.items).toHaveLength(3);
    expect(result.page).toBe(1);
    expect(result.total).toBe(3);
  });

  it('suma kg ponderados y deja incompleto un objetivo sin cobertura', () => {
    const order = {
      corridas: [
        { id: 'r1', objetivo_neto_kg: '100' },
        { id: 'r2', objetivo_neto_kg: '50' },
      ],
    };
    const ready = projectOrderProgress(order, [
      { corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: '95', kg_finalizados_efectivos: '95', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
      { corrida_id: 'r2', objetivo_neto_kg: '50', kg_medidos_efectivos: '40', kg_finalizados_efectivos: '40', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(ready.percentage).toBeCloseTo(90);
    expect(ready.kgFinalizados).toBe(135);
    const incomplete = projectOrderProgress(order, [
      { corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: '95', kg_finalizados_efectivos: '95', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(incomplete.state).toBe('incomplete');
    expect(incomplete.percentage).toBeUndefined();
  });

  it('ignora duplicados de otras OF, pero exige evidencia de peso y meta coherente', () => {
    const order = { corridas: [{ id: 'r1', objetivo_neto_kg: '10' }] };
    const ready = projectOrderProgress(order, [
      { corrida_id: 'other', kg_finalizados_efectivos: '999', coverage: { estado: 'COMPLETA' } },
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(ready.percentage).toBe(50);
    const noWeighings = projectOrderProgress(order, [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: null, kg_finalizados_efectivos: null, coverage: { estado: 'COMPLETA' }, mangas: { total: 0 } },
    ]);
    expect(noWeighings.label).toBe('Sin pesajes');
    const mismatch = projectOrderProgress(order, [
      { corrida_id: 'r1', objetivo_neto_kg: '11', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(mismatch.state).toBe('incomplete');
    const duplicate = projectOrderProgress({ corridas: [{ id: 'r1', objetivo_neto_kg: '10' }, { id: 'r1', objetivo_neto_kg: '10' }] }, [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(duplicate.state).toBe('incomplete');
    const missingFinal = projectOrderProgress({ corridas: [{ id: 'r1', objetivo_neto_kg: '100' }, { id: 'r2', objetivo_neto_kg: '50' }] }, [
      { corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: '5', kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
      { corrida_id: 'r2', objetivo_neto_kg: '50', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', kg_medidos_en_abiertas: '0', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(missingFinal.state).toBe('incomplete');
    const invalidWeights = projectOrderProgress({ corridas: [{ id: 'r1', objetivo_neto_kg: '10' }] }, [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: '-1', kg_finalizados_efectivos: '1', kg_medidos_en_abiertas: null, coverage: { estado: 'COMPLETA' } },
    ]);
    expect(invalidWeights.state).toBe('incomplete');
    const invalidOpenWeight = projectOrderProgress({ corridas: [{ id: 'r1', objetivo_neto_kg: '10' }] }, [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', kg_medidos_en_abiertas: '-1', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(invalidOpenWeight.state).toBe('incomplete');
    const missingOpenWeight = projectOrderProgress({ corridas: [{ id: 'r1', objetivo_neto_kg: '10' }] }, [
      { corrida_id: 'r1', objetivo_neto_kg: '10', kg_medidos_efectivos: '5', kg_finalizados_efectivos: '5', coverage: { estado: 'COMPLETA' } },
    ]);
    expect(missingOpenWeight.state).toBe('incomplete');
  });
});
