import { describe, expect, it } from 'vitest';
import {
  buildExceptionalDuplicateDraft,
  buildRecipeDuplicateDraft,
  compareMoldComposition,
  duplicateEligibility,
  resolveCurrentApprovedRecipe,
} from '../components/duplicateDraft';

const source = {
  id: 'of-source', codigo: 'OF-000123', estado: 'BORRADOR', version: 7,
  origen_demanda: 'EXCEPCIONAL', motivo: 'Reposición autorizada', molde_id: 'M-1',
  maquina_prevista_id: 3, snapshot_proceso: 'INYECCION', snapshot_tiempo_ciclo_seg: '12.500', snapshot_horas_turno: '7.25',
  snapshot_peso_colada_gr: '1.250',
  corridas: [{ id: 'run-1', codigo: 'OF-000123-C01', color_produccion_id: 9,
    receta_revision_id: 21, operacion_ruta_revision_id: 77, ciclos_objetivo: 8, objetivo_neto_kg: '10.125',
    salidas: [{ id: 'output-1', articulo_scm_id: 44, articulo: { id: 44, pieza_id: 'p1', clase: 'PIEZA_COLOR' },
      cantidad_por_ciclo_snapshot: '2', peso_unitario_snapshot_g: '12.75', kg_estandar_objetivo: '0.204' }] }],
};

describe('duplicate draft contracts', () => {
  it('permits only exceptional, active, processable sources and explains excluded origins', () => {
    expect(duplicateEligibility(source)).toEqual({ eligible: true, reason: '' });
    expect(duplicateEligibility({ ...source, plan_produccion_id: 'plan-1' }).eligible).toBe(false);
    expect(duplicateEligibility({ ...source, origen_demanda: 'REEMPLAZO_OF' }).reason).toMatch(/reemplazo/i);
    expect(duplicateEligibility({ ...source, origen_demanda: 'ANULADA', estado: 'ANULADA' }).reason).toMatch(/anulada/i);
    expect(duplicateEligibility({ ...source, snapshot_proceso: '' }).reason).toMatch(/proceso/i);
  });

  it('copies source values without identity, assignments, or operational activity', () => {
    const draft = buildExceptionalDuplicateDraft(source);
    expect(draft).toMatchObject({
      molde_id: 'M-1',
      motivo: expect.stringContaining('OF-000123'),
    });
    expect(draft).not.toHaveProperty('maquina_prevista_id');
    expect(draft).not.toHaveProperty('snapshot_tiempo_ciclo_seg');
    expect(draft).not.toHaveProperty('snapshot_horas_turno');
    expect(draft).not.toHaveProperty('snapshot_peso_colada_gr');
    expect(draft).not.toHaveProperty('proceso');
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('version');
    expect(draft).not.toHaveProperty('plan_produccion_id');
    expect(draft.corridas[0]).not.toHaveProperty('id');
    expect(draft.corridas[0].salidas[0]).not.toHaveProperty('id');
    expect(draft.corridas[0].objetivo_neto_kg).toBe('10.125');
    expect(draft.corridas[0].salidas[0].articulo_scm_id).toBe(44);
    expect(draft.corridas[0]).not.toHaveProperty('operacion_ruta_revision_id');
    expect(draft.corridas[0].source_ruta).toEqual({ operacion_ruta_revision_id: 77 });
  });

  it('resolves only the latest approved recipe with the same color, scope and variant', () => {
    const sourceRun = {
      color_produccion_id: 9,
      receta_revision_id: 21,
      receta: { color_produccion_id: 9, producto_sku: null, nombre_variante: 'Jarra verde botella', revision: 1 },
    };
    const recipes = [
      { id: 21, color_produccion_id: 9, producto_sku: null, nombre_variante: 'Jarra verde botella', revision: 1, estado: 'INACTIVA' },
      { id: 22, color_produccion_id: 9, producto_sku: null, nombre_variante: 'Jarra verde botella', revision: 2, estado: 'APROBADA' },
      { id: 23, color_produccion_id: 9, producto_sku: 'PT-OTRA', nombre_variante: 'Jarra verde botella', revision: 9, estado: 'APROBADA' },
      { id: 24, color_produccion_id: 9, producto_sku: null, nombre_variante: 'Otra variante', revision: 9, estado: 'APROBADA' },
    ];
    expect(resolveCurrentApprovedRecipe(recipes, sourceRun)).toMatchObject({ status: 'resolved', recipe: { id: 22 } });
    expect(resolveCurrentApprovedRecipe(recipes, { ...sourceRun, receta: { ...sourceRun.receta, nombre_variante: 'No existe' } }).status).toBe('missing');
    expect(resolveCurrentApprovedRecipe([
      ...recipes,
      { id: 25, color_produccion_id: 9, producto_sku: null, nombre_variante: 'Jarra verde botella', revision: 2, estado: 'APROBADA' },
    ], sourceRun).status).toBe('ambiguous');
    expect(resolveCurrentApprovedRecipe([
      { id: 26, color_produccion_id: 9, producto_sku: null, nombre_variante: 'JARRA VERDE BOTELLA', revision: 9, estado: 'APROBADA' },
    ], sourceRun).status).toBe('missing');
  });

  it('allows executed or closed sources but rejects WIP even when it carries a piece reference', () => {
    for (const estado of ['LIBERADA', 'EN_EJECUCION', 'CERRADA']) {
      const executed = { ...source, estado, released_at: '2026-09-01', trabajos: [{ id: 'work' }], pesajes: [{ kg: 10 }] };
      expect(duplicateEligibility(executed).eligible).toBe(true);
      const copy = buildExceptionalDuplicateDraft(executed);
      expect(copy).not.toHaveProperty('released_at');
      expect(copy).not.toHaveProperty('trabajos');
      expect(copy).not.toHaveProperty('pesajes');
    }
    const wip = { ...source, corridas: [{ ...source.corridas[0], salidas: [{ articulo: { clase: 'WIP', pieza_id: 'p1' } }] }] };
    expect(duplicateEligibility(wip).eligible).toBe(false);
  });

  it('flags composition, cavities and weights that changed in the current mold', () => {
    const current = { codigo: 'M-1', formas: [{ activo: true, pieza_id: 'p1', cavidades: 3, peso_unitario_gr: 13 }] };
    const comparison = compareMoldComposition(source, current);
    expect(comparison.changed).toBe(true);
    expect(comparison.messages.join(' ')).toMatch(/cavidad|peso/i);
  });

  it('does not treat repeated identical outputs from two colors as extra mold pieces', () => {
    const current = { codigo: 'M-1', formas: [{ activo: true, pieza_id: 'p1', cavidades: 2, peso_unitario_gr: 12.75 }] };
    const twoColors = { ...source, corridas: [source.corridas[0], { ...source.corridas[0], id: 'run-2', color_produccion_id: 10 }] };
    expect(compareMoldComposition(twoColors, current).changed).toBe(false);
  });

  it('duplicates a recipe as a new editable draft with exact doses and collision-free name', () => {
    const recipe = { id: 21, revision: 4, color_produccion_id: 9, nombre_variante: 'Jarra verde',
      producto_sku: 'PT-1', estado: 'APROBADA', es_default: true, base_virgen_kg: '25', notas: 'original',
      lineas: [{ id: 1, material_id: 5, tipo_componente: 'MATERIA_PRIMA', cantidad: '0.8', base_kg: null },
        { id: 2, material_id: 6, tipo_componente: 'COLORANTE', cantidad: '125.500', base_kg: '25' }] };
    const draft = buildRecipeDuplicateDraft(recipe, [recipe, { nombre_variante: 'Jarra verde (copia)' }], 'OF-000123');
    expect(draft).toMatchObject({ color_produccion_id: 9, producto_sku: 'PT-1', estado: 'BORRADOR', es_default: false,
      base_virgen_kg: 25, nombre_variante: 'Jarra verde (copia 2)' });
    expect(draft.notas).toMatch(/OF-000123.*rev\.? 4/i);
    expect(draft.lineas).toEqual([
      { material_id: 5, tipo_componente: 'MATERIA_PRIMA', cantidad: 0.8, base_kg: null },
      { material_id: 6, tipo_componente: 'COLORANTE', cantidad: 125.5, base_kg: 25 },
    ]);
    expect(draft.lineas[0]).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('revision');
  });
});
