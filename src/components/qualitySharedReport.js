import { pieceIdentity, weightResult } from './qualityPieceModel';

// Project the confirmed work-level measurement into the existing report by output.
export function sharedReportRows(otId, visits = []) {
  const records = {};
  const incidents = [];
  const rows = [];
  for (const visit of visits) {
    if (visit.estado !== 'CONFIRMED') continue;
    const { checks, outputIds } = visit.payload || {};
    if (!checks?.outputChecks || !Array.isArray(outputIds)) continue;
    const shared = checks.commonChecks || {};
    const scope = { otId, workId: visit.trabajo_id, visitId: visit.id };
    const perPiece = {};
    function addIncident(key, family, name, check, ids) {
      incidents.push({ ...check, ...scope, id: `${visit.id}:${key}`, checkId: family,
        type: name, scopeOutputIds: ids, status: 'ABIERTA', createdAt: visit.confirmed_at });
    }
    for (const outputId of outputIds) {
      const weight = checks.outputChecks[outputId] || {};
      const key = pieceIdentity(otId, visit.trabajo_id, outputId);
      const readings = {
        peso: { ...weight, status: 'MEDIDO', result: weightResult(weight.netGrams, weight.quantity) },
        ciclo: { ...shared.ciclo, status: 'MEDIDO' },
      };
      for (const family of ['color', 'inyeccion', 'funcional']) {
        const check = shared[family] || {};
        const covered = check.scopeOutputIds?.some(id => String(id) === String(outputId));
        readings[family] = { ...check, status: covered ? (check.statusByOutput?.[outputId] || check.status) : 'PENDIENTE' };
      }
      perPiece[key] = readings;
      if (visit.tipo === 'INICIAL') records[key] = { initialChecks: readings, checks: readings };
      if (['ALTO', 'BAJO'].includes(weight.classification)) {
        addIncident(`peso:${outputId}`, 'peso', weight.classification === 'ALTO' ? 'Peso alto' : 'Peso bajo', weight, [outputId]);
      }
    }
    if (['RAPIDO', 'LENTO'].includes(shared.ciclo?.classification)) {
      addIncident('ciclo', 'ciclo', shared.ciclo.classification === 'LENTO' ? 'Ciclo lento' : 'Ciclo rápido', shared.ciclo, outputIds);
    }
    for (const [family, name] of Object.entries({ color: 'Color', inyeccion: 'Inyección', funcional: 'Funcional' })) {
      const check = shared[family] || {};
      const affected = (check.scopeOutputIds || []).filter(id => (check.statusByOutput?.[id] || check.status) === 'INCIDENCIA');
      if (affected.length) addIncident(family, family, `${name} · incidencia`, check, affected);
    }
    rows.push({ ...scope, id: visit.id, status: 'CONFIRMED', kind: visit.tipo,
      recordedAt: visit.recorded_at, observedAt: visit.observed_at, checks: perPiece, pieceKeys: Object.keys(perPiece) });
  }
  return { rows, records, incidents };
}
