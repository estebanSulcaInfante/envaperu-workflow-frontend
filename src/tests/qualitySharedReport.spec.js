import { expect, it } from 'vitest';
import { sharedReportRows } from '../components/qualitySharedReport';

it('reconstruye el informe multipieza para otra tablet usando solo visitas confirmadas', () => {
  const visit = {
    id: 'visita2', trabajo_id: 'lila', tipo: 'PERIODICA', estado: 'CONFIRMED',
    payload: { outputIds: ['base', 'tapa'], checks: {
      outputChecks: { base: { netGrams: 90, quantity: 3, classification: 'ALTO' },
        tapa: { netGrams: 20, quantity: 2, classification: 'CORRECTO' } },
      commonChecks: { ciclo: { classification: 'RAPIDO' },
        color: { status: 'INCIDENCIA', scopeOutputIds: ['base'], incidentOptions: ['VETEADO'] } },
    } },
  };
  const { records, rows, incidents } = sharedReportRows('ot', [visit, { ...visit, id: 'otra', estado: 'DRAFT' }]);
  expect(records).toEqual({});
  expect(rows).toHaveLength(1);
  expect(rows[0].checks['ot:lila:base'].peso.result).toBe(30);
  expect(rows[0].checks['ot:lila:tapa'].peso.result).toBe(10);
  expect(incidents.map(({ checkId, scopeOutputIds }) => [checkId, scopeOutputIds])).toEqual([
    ['peso', ['base']], ['ciclo', ['base', 'tapa']], ['color', ['base']],
  ]);
});
