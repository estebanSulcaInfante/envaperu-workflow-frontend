import { describe, expect, it } from 'vitest';
import { buildQualityOtInspectionSummary } from '../components/qualityOtInspectionSummary';

const ot = { id: 'ot-275', trabajos_color: [
  { id: 'lila', estado: 'PAUSADO' }, { id: 'azure', estado: 'EN_EJECUCION' },
] };
const confirmed = { visita_id: 'v2', trabajo_id: 'lila', tipo: 'PERIODICA', numero: 2, confirmado_at: '2026-10-27T16:00:00Z' };

describe('Historial compartido de Calidad en el tablero y en la OT', () => {
  it('muestra una visita de otra tablet, cuenta el trabajo correcto y conserva pendiente al otro', () => {
    const summary = buildQualityOtInspectionSummary({ ot: { ...ot, visitas_calidad_confirmadas: [confirmed] } });
    expect(summary.header.periodicConfirmed).toBe(1);
    expect(summary.pendingWorks.map(work => work.workId)).toEqual(['azure']);
    expect(summary.periodicVisits[0]).toMatchObject({ id: 'v2', number: 2, workIds: ['lila'] });
  });
  it('conserva el historial local anterior, cuenta una sola vez la copia central de una visita y excluye borradores', () => {
    const central = { ...confirmed, id: confirmed.visita_id, estado: 'CONFIRMED' };
    const local = { id: 'v2', kind: 'PERIODICA', status: 'CONFIRMED', otId: ot.id, workId: 'lila', number: 2 };
    const summary = buildQualityOtInspectionSummary({
      ot: { ...ot, visitas_calidad: [central, { ...central, id: 'draft', numero: 4, estado: 'DRAFT' }] },
      localState: { visits: [local, { ...local, id: 'otra', workId: 'azure', number: 3 }] },
    });
    expect(summary.periodicVisits.map(v => [v.number, v.id])).toEqual([[2, 'v2'], [3, 'otra']]);
    expect(summary.works.map(work => work.inspectionCount)).toEqual([1, 1]);
  });
});
