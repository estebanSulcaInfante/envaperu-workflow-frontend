import { describe, expect, it } from 'vitest';
import { getAttributionNotice, getProgressState } from '../components/productionOrderProgressModel';

const tramoNotice = {
  objetivo_neto_kg: 100,
  kg_finalizados_efectivos: 40,
  kg_medidos_en_abiertas: 5,
  kg_medidos_efectivos: 45,
  motivos_atribucion: ['TRAMO_INICIO_NO_REGISTRADO'],
  coverage: { estado: 'COMPLETA', motivos: [] },
  mangas: { total: 2, conocidas: 2 },
};

describe('avisos de avance de tramo', () => {
  it('expone el historial incompleto como aviso auxiliar sin invalidar el cálculo', () => {
    const notice = getAttributionNotice(tramoNotice, 45);
    const progress = getProgressState(tramoNotice, { pesaje: true });

    expect(notice).toMatchObject({ kind: 'AUXILIARY', auxiliaryReasons: ['TRAMO_INICIO_NO_REGISTRADO'] });
    expect(notice.text).toBe('Historial del tramo incompleto: peso incluido; inicio del tramo sin registrar.');
    expect(progress.key).toBe('CALCULABLE');
    expect(progress.measured).toBe(45);
    expect(progress.percent).toBe(45);
    expect(progress.final).toBe(40);
    expect(progress.opened).toBe(5);
  });

  it('prioriza la atribución real y conserva la traza auxiliar cuando coexisten', () => {
    const notice = getAttributionNotice({
      ...tramoNotice,
      motivos_atribucion: ['ATRIBUCION_INCOMPLETA', 'TRAMO_INICIO_NO_REGISTRADO'],
      peso_fisico_kg: 60,
    }, 45);

    expect(notice.kind).toBe('ATTRIBUTION');
    expect(notice.text).toContain('Atribución incompleta');
    expect(notice.text).toContain('Historial del tramo incompleto');
    expect(notice.neutral).toBe(false);
  });
});
