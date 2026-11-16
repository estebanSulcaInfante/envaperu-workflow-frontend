import { describe, expect, it } from 'vitest';
import {
  CHECK_IDS,
  emptyPieceQualityState,
  ensureWorkQuality,
  ensurePieceRecord,
  functionalApplicability,
  latestCycleSuggestion,
  normalizePieceRows,
  normalizeWorkRows,
  workIsActive,
  workHasStarted,
  workIsQueued,
  otInitialVisits,
  otInitialVisit,
  inferVisitWorkId,
  outputCheckScope,
  workVisitConfirmedCount,
  pieceCompletion,
  pieceIdentity,
  isDayInitialClosed,
  isInitialClosed,
  weightResult,
} from '../components/qualityPieceModel';

it('atribuye una visita sin trabajo solo cuando se pueden identificar todas sus piezas', () => {
  const pieces = [{ key: 'base', workId: 'rojo' }, { key: 'tapa', workId: 'rojo' }, { key: 'otra', workId: 'azul' }];
  expect(inferVisitWorkId({ pieceKeys: ['base', 'tapa'] }, pieces)).toBe('rojo');
  expect(inferVisitWorkId({ pieceKeys: ['base', 'desconocida'] }, pieces)).toBe('');
  expect(inferVisitWorkId({ pieceKeys: ['base', 'otra'] }, pieces)).toBe('');
});

const ot = {
  public_id: 'ot-254',
  trabajos_color: [
    {
      id: 'work-red',
      color: 'ROJO',
      molde: { codigo: 'M-1' },
      salidas: [
        { pieza_id: 'pieza-a', nombre: 'Base' },
        { pieza_id: 'pieza-b', nombre: 'Tapa' },
      ],
    },
    {
      id: 'work-blue',
      color: 'AZUL',
      molde: { codigo: 'M-1' },
      salidas: [{ pieza_id: 'pieza-a', nombre: 'Base' }],
    },
  ],
};

describe('qualityPieceModel', () => {
  it('does not count an active work twice when the OT also includes it as context', () => {
    const [red, blue] = ot.trabajos_color;
    const data = { ...ot, trabajos_color: [{ ...red, estado: 'EN_EJECUCION' }, blue],
      trabajo_color_contexto: { trabajo_color_id: red.id, estado: 'EN_EJECUCION', color: 'ROJO' } };
    expect(normalizeWorkRows(data).filter(workIsActive)).toHaveLength(1);
    expect(normalizePieceRows(data)).toHaveLength(3);
    expect(normalizeWorkRows(data)).toHaveLength(2);
    expect(normalizeWorkRows({ ...data, trabajo_color_contexto: { ...red, id: 'otro-rojo' } })).toHaveLength(3);
  });

  it('preserves work + output identity even when piece names repeat', () => {
    const pieces = normalizePieceRows(ot);
    expect(pieces).toHaveLength(3);
    expect(new Set(pieces.map((piece) => piece.key)).size).toBe(3);
    expect(pieces[0].key).toBe(pieceIdentity('ot-254', 'work-red', 'pieza-a'));
    expect(pieces[0].key).not.toBe(pieces[2].key);
  });

  it('calculates net grams per counted piece and rejects partial weights', () => {
    expect(weightResult('125', '5')).toBe(25);
    expect(weightResult('125', '5.5')).toBeNull();
    expect(weightResult('', '5')).toBeNull();
  });

  it('keeps functional applicability undefined until an explicit source exists', () => {
    expect(functionalApplicability({ nombre: 'Pieza' }, {})).toBeNull();
    expect(functionalApplicability({ funcional_aplica: false }, {})).toBe(false);
  });

  it('suggests the latest confirmed cycle from the same mould and not another mould', () => {
    const pieces = normalizePieceRows(ot);
    const [piece, otherPiece] = pieces;
    const suggestion = latestCycleSuggestion(piece, [
      { id: 'v-1', status: 'CONFIRMED', mouldId: 'M-2', cycleSeconds: 10 },
      { id: 'v-2', status: 'DRAFT', mouldId: 'M-1', cycleSeconds: 11 },
      { id: 'v-3', status: 'CONFIRMED', mouldId: 'M-1', pieceKeys: [otherPiece.key], checks: { [otherPiece.key]: { ciclo: { seconds: 12 } } } },
    ], pieces);
    expect(suggestion).toMatchObject({ visitId: 'v-3', seconds: 12, pieceKey: otherPiece.key });
    expect(latestCycleSuggestion({ ...piece, mouldId: '' }, [{ id: 'v-4', status: 'CONFIRMED', mouldId: '', cycleSeconds: 8 }], pieces)).toBeNull();
  });

  it('does not mark an initial complete while applicability or any applicable check is missing', () => {
    const [piece] = normalizePieceRows(ot);
    const state = emptyPieceQualityState();
    const record = ensurePieceRecord(state, piece);
    expect(CHECK_IDS).toEqual(['peso', 'ciclo', 'color', 'inyeccion', 'funcional']);
    expect(pieceCompletion(record)).toMatchObject({ complete: false, hasUndefinedApplicability: true });
    record.checks.funcional.applicable = false;
    CHECK_IDS.filter((id) => id !== 'funcional').forEach((id) => { record.checks[id].status = 'OK'; });
    expect(pieceCompletion(record)).toMatchObject({ complete: true, total: 4 });
  });

  it('keeps periodic observations separate from the initial snapshot', () => {
    const [piece] = normalizePieceRows(ot);
    const quality = emptyPieceQualityState();
    const initial = ensurePieceRecord(quality, piece);
    initial.initialChecks.peso = { applicable: true, status: 'MEDIDO', result: 25 };
    initial.checks = initial.initialChecks;
    initial.periodic = [{ visitId: 'periodic-1', checks: { peso: { status: 'MEDIDO', result: 28 } } }];
    expect(pieceCompletion(initial).completed).toBe(1);
    expect(initial.periodic[0].checks.peso.result).toBe(28);
    expect(initial.initialChecks.peso.result).toBe(25);
  });

  it('closes day initial at 08:00 Lima, including historical dates, while night stays open', () => {
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-10', turno: 'DIA', now: new Date('2026-08-10T13:00:00.000Z') })).toBe(true);
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-10', turno: 'DIA', now: new Date('2026-08-10T13:00:01.000Z') })).toBe(true);
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-10', turno: 'DIA', now: new Date('2026-08-10T12:59:59.000Z') })).toBe(false);
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-10', turno: 'DIA', now: new Date('2026-08-10T11:59:59.000Z') })).toBe(false);
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-10', turno: 'NOCHE', now: new Date('2026-08-10T13:00:00.000Z') })).toBe(false);
    expect(isDayInitialClosed({ fechaOperativa: '2026-08-09', turno: 'DIA', now: new Date('2026-08-10T13:00:00.000Z') })).toBe(true);
  });

  it('closes a night initial exactly at 20:00 Lima and keeps the following dawn closed', () => {
    expect(isInitialClosed({ fechaOperativa: '2026-10-24', turno: 'NOCHE', now: new Date('2026-10-25T00:59:59.000Z') })).toBe(false);
    expect(isInitialClosed({ fechaOperativa: '2026-10-24', turno: 'NOCHE', now: new Date('2026-10-25T01:00:00.000Z') })).toBe(true);
    expect(isInitialClosed({ fechaOperativa: '2026-10-24', turno: 'NOCHE', now: new Date('2026-10-25T06:00:00.000Z') })).toBe(true);
  });

  it('does not apply a night cutoff to a future OT or to EXTRA', () => {
    const now = new Date('2026-10-25T02:00:00.000Z');
    expect(isInitialClosed({ fechaOperativa: '2026-10-26', turno: 'NOCHE', now })).toBe(false);
    expect(isInitialClosed({ fechaOperativa: '2026-10-24', turno: 'EXTRA', now })).toBe(false);
  });

  it('does not count a new initial draft as a confirmed completion', () => {
    const [piece] = normalizePieceRows(ot);
    const quality = emptyPieceQualityState();
    const record = ensurePieceRecord(quality, piece);
    record.initialStatus = 'DRAFT';
    record.initialChecks = { peso: { status: 'MEDIDO', netGrams: '125', quantity: '5' } };
    record.initialConfirmedChecks = {};
    expect(pieceCompletion(record).complete).toBe(false);
  });

  it('projects a work before outputs and keeps each output available for scope', () => {
    const works = normalizeWorkRows({ ...ot, trabajos_color: [{ ...ot.trabajos_color[0], estado: 'EN_EJECUCION', orden_fabricacion_codigo: 'OF-9' }] });
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({ workId: 'work-red', label: 'ROJO', ofLabel: 'OF-9', mouldId: 'M-1' });
    expect(works[0].outputs.map((output) => output.id)).toEqual(['pieza-a', 'pieza-b']);
    expect(workIsActive(works[0])).toBe(true);
  });

  it('deduplicates explicit output scope and counts periodic work visits only once', () => {
    expect(outputCheckScope(['base', 'base', '', 'tapa'])).toEqual(['base', 'tapa']);
    expect(workVisitConfirmedCount({ workVisits: [
      { id: 'draft', otId: 'ot-254', kind: 'PERIODICA', status: 'DRAFT' },
      { id: 'confirmed', otId: 'ot-254', kind: 'PERIODICA', status: 'CONFIRMED' },
      { id: 'other', otId: 'ot-9', kind: 'PERIODICA', status: 'CONFIRMED' },
    ] }, 'ot-254')).toBe(1);
  });

  it('hydrates the shared quality schema when the browser starts with an empty local state', () => {
    expect(ensureWorkQuality({})).toMatchObject({ version: 1, records: {}, visits: [], incidents: [], workRecords: {}, workVisits: [] });
  });

  it('treats the initial as one OT-level control and keeps legacy rows discoverable', () => {
    const quality = ensureWorkQuality({
      workVisits: [{ id: 'initial-work-red', otId: 'ot-1', workId: 'work-red', kind: 'INICIAL', status: 'CONFIRMED' }],
      visits: [{ id: 'legacy-initial', otId: 'ot-1', workId: 'work-old', kind: 'INICIAL', status: 'CONFIRMED' }],
    });
    expect(otInitialVisits(quality, 'ot-1')).toHaveLength(2);
    expect(otInitialVisit(quality, 'ot-1')).toMatchObject({ id: 'initial-work-red', status: 'CONFIRMED' });
    expect(otInitialVisit(quality, 'ot-2')).toBeNull();
  });

  it('infers a legacy initial work only when all its piece keys agree', () => {
    const pieces = [
      { key: 'piece-red', workId: 'work-red' },
      { key: 'piece-blue', workId: 'work-blue' },
    ];
    const quality = ensureWorkQuality({ visits: [{ id: 'legacy', otId: 'ot-1', kind: 'INICIAL', status: 'CONFIRMED', pieceKeys: ['piece-red'] }] });
    expect(otInitialVisit(quality, 'ot-1', pieces)).toMatchObject({ workId: 'work-red' });
    const ambiguous = ensureWorkQuality({ visits: [{ id: 'legacy-ambiguous', otId: 'ot-1', kind: 'INICIAL', status: 'CONFIRMED', pieceKeys: ['piece-red', 'piece-blue'] }] });
    expect(otInitialVisit(ambiguous, 'ot-1', pieces)).toMatchObject({ workId: '' });
  });

  it('does not treat queued work as started, including an unknown status', () => {
    expect(workHasStarted({ status: 'PLANIFICADO' })).toBe(false);
    expect(workIsQueued({ status: 'EN_COLA' })).toBe(true);
    expect(workHasStarted({ status: 'PAUSADO' })).toBe(true);
    expect(workHasStarted({ status: 'PLANIFICADO', iniciada_at: '2026-10-24T07:55:00-05:00' })).toBe(true);
    expect(workHasStarted({ status: 'NO_INFORMADO' })).toBe(false);
  });

});
