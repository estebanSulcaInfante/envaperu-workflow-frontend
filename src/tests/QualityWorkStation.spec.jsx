import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QualityWorkStation, { mergeCentralVisits } from '../components/QualityWorkStation';
import { emptyPieceQualityState } from '../components/qualityPieceModel';

const ot = {
  public_id: 'ot-254', codigo_ot: 'OT-000254', fecha_operativa: '2099-10-15', turno: 'DIA',
  trabajos_color: [
    { id: 'work-red', color: 'ROJO', estado: 'EN_EJECUCION', orden_fabricacion_codigo: 'OF-009', molde: { codigo: 'M-1' }, salidas: [{ pieza_id: 'base', nombre: 'Base' }, { pieza_id: 'tapa', nombre: 'Tapa' }] },
    { id: 'work-blue', color: 'AZUL', estado: 'PLANIFICADO', orden_fabricacion_codigo: 'OF-010', molde: { codigo: 'M-1' }, salidas: [{ pieza_id: 'base', nombre: 'Base' }] },
  ],
};

function renderWork(props = {}) {
  let state = { pieceQuality: emptyPieceQualityState(), ...props.localState };
  const setLocalState = (updater) => { state = typeof updater === 'function' ? updater(state) : updater; };
  const view = render(<QualityWorkStation ot={props.ot || ot} localState={state} setLocalState={props.setLocalState || setLocalState} onHistory={() => {}} historyOnly={props.historyOnly} qualityVisitApi={props.qualityVisitApi} onWorkVisitRoute={props.onWorkVisitRoute} />);
  return { ...view, getState: () => state };
}

describe('QualityWorkStation · trabajo observado', () => {
  it('conserva un borrador local pendiente aunque el servidor ya tenga una revisión más nueva', () => {
    const local = {
      id: 'draft-1', otId: ot.public_id, workId: 'work-red', kind: 'INICIAL', number: 1,
      status: 'DRAFT', syncStatus: 'pending', version: 1,
      checks: { outputChecks: { base: { netGrams: '112' } } }, outputIds: ['base'],
    };
    const merged = mergeCentralVisits(
      { pieceQuality: { ...emptyPieceQualityState(), workVisits: [local] } },
      [{ id: 'central-1', ot_id: ot.public_id, trabajo_id: 'work-red', tipo: 'INICIAL', numero: 1, estado: 'DRAFT', version: 2, payload: { outputIds: ['base'], checks: { outputChecks: { base: { netGrams: '99' } } } } }],
      ot.public_id,
    );
    expect(merged.pieceQuality.workVisits[0]).toEqual(expect.objectContaining({ id: 'draft-1', version: 1, syncStatus: 'pending', centralVersion: 2 }));
    expect(merged.pieceQuality.workVisits[0].checks.outputChecks.base.netGrams).toBe('112');
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('opens the active work directly without a mandatory piece or mould step', () => {
    renderWork();
    expect(screen.getByTestId('quality-work-station')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Resumen de inspección de la OT' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toBeVisible();
    expect(screen.queryByText('Piezas de esta OT')).not.toBeInTheDocument();
  });

  it('conserva el control confirmado de otro color antes del siguiente control de la OT', async () => {
    const user = userEvent.setup();
    const confirmed = { id: 'visit-2', kind: 'PERIODICA', number: '2', status: 'CONFIRMED', otId: ot.public_id };
    const historical = { ...confirmed, workId: 'work-blue' };
    const pieceQuality = { ...emptyPieceQualityState(), visits: [historical],
      workVisits: [historical, { ...historical, id: 'unrelated', otId: 'ot-otra' }] };
    renderWork({ localState: { pieceQuality } });
    const completed = screen.getByRole('list', { name: 'Controles periódicos completados' });
    expect(within(completed).getAllByRole('listitem')).toHaveLength(1);
    expect(completed).toHaveTextContent('Control #2');
    expect(completed).toHaveTextContent('AZUL');
    expect(completed).toHaveTextContent('Completado');
    expect(within(completed).queryByRole('button')).not.toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Registrar visita periódica #3' });
    expect(completed.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(next);
    expect(screen.getByTestId('quality-selected-work')).toHaveTextContent('ROJO');
  });

  it('ordena las visitas anteriores incluso antes de elegir trabajo y respeta sus números guardados', () => {
    const paused = { ...ot, trabajos_color: ot.trabajos_color.map(work => ({ ...work, estado: 'PAUSADO' })) };
    const visit = { kind: 'PERIODICA', otId: ot.public_id, status: 'CONFIRMED' };
    const visits = [
      { ...visit, id: 'third', workId: 'work-red', number: 3 },
      { ...visit, id: 'older', workId: 'work-blue', recordedAt: '2026-10-27T08:30:00-05:00' },
      { ...visit, id: 'draft', workId: 'work-blue', number: 4, status: 'DRAFT' },
    ];
    renderWork({ ot: paused, localState: { pieceQuality: { ...emptyPieceQualityState(), visits } } });
    const list = screen.getByRole('list', { name: 'Controles periódicos completados' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(/Control #2.*AZUL/);
    expect(entries[1]).toHaveTextContent(/Control #3.*ROJO/);
  });

  it('requires explicit work selection when there is no unique active work', async () => {
    const user = userEvent.setup();
    const noActive = { ...ot, trabajos_color: ot.trabajos_color.map((work) => ({ ...work, estado: 'PAUSADO' })) };
    renderWork({ localState: { pieceQuality: emptyPieceQualityState() }, ot: noActive });
    expect(screen.getByText(/No hay un único trabajo activo/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Registrar control de arranque' })).not.toBeInTheDocument();
    await user.click(screen.getByTestId('quality-ot-work-row-work-blue'));
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toBeVisible();
  });

  it('aplica inmediatamente el trabajo elegido antes de abrir el control en una ruta', async () => {
    const user = userEvent.setup();
    const route = vi.fn();
    const twoActive = { ...ot, trabajos_color: ot.trabajos_color.map((work) => ({ ...work, estado: 'EN_EJECUCION' })) };
    renderWork({ ot: twoActive, onWorkVisitRoute: route });
    await user.click(screen.getByTestId('quality-ot-work-row-work-blue'));
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    expect(screen.getByTestId('quality-selected-work')).toHaveTextContent('AZUL');
  });

  it('en la OT con plazo cerrado explica el cierre solo en la fila y permite registrar una periódica', () => {
    renderWork({ ot: { ...ot, fecha_operativa: '2026-10-27', inicio_real: '2026-10-27T09:00:00-05:00' } });
    const progress = screen.getByRole('group', { name: 'Avance de inspección de la OT' });
    expect(progress).toHaveTextContent('Control de arranque: No');
    expect(screen.queryByText('Arranque fuera de ventana')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toHaveTextContent('Plazo cerrado a las 08:00 (Lima)');
    expect(screen.getByRole('button', { name: /Registrar visita periódica/ })).toBeEnabled();
  });

  it('muestra el arranque ya registrado aunque se consulte después del cierre', () => {
    const pieceQuality = { ...emptyPieceQualityState(), workVisits: [
      { id: 'initial-red', otId: ot.public_id, workId: 'work-red', kind: 'INICIAL', status: 'CONFIRMED' },
    ] };
    renderWork({ ot: { ...ot, fecha_operativa: '2026-10-27' }, localState: { pieceQuality } });
    const start = screen.getByRole('button', { name: 'Registrar control de arranque' });
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Realizado');
    expect(screen.queryByText(/Plazo cerrado/)).not.toBeInTheDocument();
  });

  it('allows only one OT initial after changing work and preserves the prior work history', async () => {
    const user = userEvent.setup();
    const pieceQuality = {
      ...emptyPieceQualityState(),
      workVisits: [{ id: 'initial-red', otId: 'ot-254', workId: 'work-red', kind: 'INICIAL', status: 'CONFIRMED', outputIds: ['base', 'tapa'] }],
    };
    renderWork({ localState: { pieceQuality }, ot: { ...ot, trabajos_color: ot.trabajos_color.map((work) => work.id === 'work-blue' ? { ...work, estado: 'EN_EJECUCION' } : work) } });
    await user.click(screen.getByTestId('quality-ot-work-row-work-blue'));
    const initial = screen.getByRole('button', { name: 'Registrar control de arranque' });
    expect(initial).toBeDisabled();
    expect(initial).toHaveTextContent('Arranque registrado en otra producción');
    expect(screen.getByRole('button', { name: /visita periódica/ })).toBeEnabled();
  });

  it('exposes the pending initial draft and a direct way to resume its original work', async () => {
    const user = userEvent.setup();
    const pieceQuality = {
      ...emptyPieceQualityState(),
      workVisits: [{ id: 'draft-red', otId: 'ot-254', workId: 'work-red', kind: 'INICIAL', status: 'DRAFT', outputIds: ['base', 'tapa'], checks: {} }],
    };
    const twoActive = { ...ot, trabajos_color: ot.trabajos_color.map((work) => ({ ...work, estado: 'EN_EJECUCION' })) };
    renderWork({ ot: twoActive, localState: { pieceQuality } });
    await user.click(screen.getByTestId('quality-ot-work-row-work-blue'));
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toHaveTextContent('Borrador de arranque pendiente');
    const resume = screen.getByRole('button', { name: /Retomar arranque de ROJO/i });
    expect(resume).toBeVisible();
    await user.click(resume);
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toHaveTextContent('Continuar borrador');
  });

  it('does not create a periodic control for a queued work, but can resume its draft', async () => {
    const user = userEvent.setup();
    const queuedOt = { ...ot, trabajos_color: ot.trabajos_color.map((work) => ({ ...work, estado: 'PLANIFICADO' })) };
    renderWork({ ot: queuedOt });
    await user.click(screen.getByTestId('quality-ot-work-row-work-blue'));
    expect(screen.getByRole('button', { name: /visita periódica/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /visita periódica/ })).toHaveTextContent('Trabajo en cola');
  });

  it('allows a night periodic visit without an initial from the prior shift', async () => {
    const user = userEvent.setup();
    renderWork({ ot: { ...ot, turno: 'NOCHE', fecha_operativa: '2026-10-24' } });
    await user.click(screen.getByRole('button', { name: /visita periódica/ }));
    expect(screen.getByRole('heading', { name: 'Control #2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar visita' })).toBeVisible();
  });

  it('keeps an initial draft resumable after the night 20:00 cutoff', async () => {
    const user = userEvent.setup();
    const pieceQuality = {
      ...emptyPieceQualityState(),
      workVisits: [{ id: 'night-initial-draft', otId: 'ot-254', workId: 'work-red', kind: 'INICIAL', status: 'DRAFT', outputIds: ['base', 'tapa'], checks: { outputChecks: { base: { netGrams: '112' } }, commonChecks: {} } }],
    };
    renderWork({ ot: { ...ot, turno: 'NOCHE', fecha_operativa: '2026-10-24' }, localState: { pieceQuality } });
    const initial = screen.getByRole('button', { name: 'Registrar control de arranque' });
    expect(initial).not.toBeDisabled();
    expect(initial).toHaveTextContent('Continuar borrador');
    await user.click(initial);
    expect(screen.getByRole('heading', { name: 'Control de arranque' })).toBeVisible();
  });

  it('updates the night initial gate live at 20:00 Lima', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:59:59.000Z'));
    renderWork({ ot: { ...ot, turno: 'NOCHE', fecha_operativa: '2026-10-24' } });
    const initial = screen.getByRole('button', { name: 'Registrar control de arranque' });
    expect(initial).not.toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.getByRole('button', { name: 'Registrar control de arranque' })).toBeDisabled();
    expect(screen.getByText('Plazo cerrado a las 20:00 (Lima)')).toBeVisible();
  });

  it('keeps weight rows per output and exposes explicit scope and per-output result', async () => {
    const user = userEvent.setup();
    renderWork();
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    expect(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Neto (g) · Tapa' })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Ciclo observado (s)' })).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: 'Ciclo (s) · Base' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Salidas revisadas (2/2)')[0]).toBeVisible();
    const color = screen.getByRole('region', { name: 'Color' });
    expect(within(color).getByRole('group', { name: 'Resultado de Color' })).toBeVisible();
  });

  it('restores the single-panel visit form hierarchy with readonly work identity', async () => {
    const user = userEvent.setup();
    renderWork();
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    const panel = screen.getByTestId('quality-work-checks-panel');
    expect(panel).toBeVisible();
    expect(within(panel).queryByTestId('quality-affected-mangas')).not.toBeInTheDocument();
    expect(panel.querySelectorAll('[data-family="peso"]')).toHaveLength(2);
    expect(within(panel).getByRole('region', { name: 'Ciclo' })).toBeVisible();
    expect(within(panel).getByRole('region', { name: 'Color' })).toBeVisible();
    expect(within(panel).getByRole('region', { name: 'Inyección' })).toBeVisible();
    expect(within(panel).getByRole('region', { name: 'Funcional' })).toBeVisible();
    expect(within(panel).queryByRole('table')).not.toBeInTheDocument();
    expect(within(panel).getByLabelText('Momento observado')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Guardar visita' })).toBeVisible();
    expect(within(panel).getByTestId('quality-selected-work')).toHaveTextContent('ROJO');
    expect(within(panel).queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
  });

  it('muestra el avance de la OT en el arranque y el icono de borrador en su cabecera', async () => {
    const user = userEvent.setup();
    renderWork({ ot: { ...ot, periodic_quota: 3 } });
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    const header = within(screen.getByRole('heading', { name: 'Control de arranque' }).closest('header'));
    expect(header.getByLabelText('Avance de visitas periódicas')).toHaveTextContent('0/3');
    expect(header.queryByRole('status')).not.toBeInTheDocument();
    await user.type(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' }), '112');
    expect(header.getByRole('status')).toHaveTextContent('Guardando');
    await waitFor(() => expect(header.getByRole('status')).toHaveTextContent('Guardado'));
    expect(header.getByLabelText('Avance de visitas periódicas')).toHaveTextContent('0/3');
  });

  it('lee una vez el guardado central y emite el formulario anidado al autosave', async () => {
    const user = userEvent.setup();
    const qualityVisitApi = {
      loadVisits: vi.fn().mockResolvedValue({ items: [] }),
      saveDraft: vi.fn().mockResolvedValue({ id: 'central-draft', version: 1, estado: 'DRAFT', ot_id: ot.public_id, trabajo_id: 'work-red', tipo: 'INICIAL', payload: { outputIds: ['base', 'tapa'], checks: {} } }),
    };
    renderWork({ qualityVisitApi });
    await waitFor(() => expect(qualityVisitApi.loadVisits).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' }), '112');
    await waitFor(() => expect(qualityVisitApi.saveDraft).toHaveBeenCalledTimes(1), { timeout: 2500 });
    expect(qualityVisitApi.saveDraft.mock.calls[0][1]).toEqual(expect.objectContaining({ trabajo_id: 'work-red', tipo: 'INICIAL', payload: expect.objectContaining({ checks: expect.objectContaining({ outputChecks: expect.any(Object) }) }) }));
    expect(qualityVisitApi.saveDraft.mock.calls[0][1].observed_at).toMatch(/-05:00$/);
    expect(qualityVisitApi.saveDraft.mock.calls[0][2].idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('expone recuperación explícita cuando otro actor cambia la versión del borrador', async () => {
    const user = userEvent.setup();
    const qualityVisitApi = {
      loadVisits: vi.fn().mockResolvedValue({ items: [] }),
      saveDraft: vi.fn().mockRejectedValue({ status: 409, message: 'VERSION_CONFLICT' }),
    };
    renderWork({ qualityVisitApi });
    await waitFor(() => expect(qualityVisitApi.loadVisits).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' }), '112');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Usar versión compartida' })).toBeVisible(), { timeout: 2500 });
    expect(screen.getByRole('button', { name: 'Conservar mi edición' })).toBeVisible();
    expect(screen.getByText(/Otra persona guardó cambios en este control/)).toBeVisible();
  });

  it('no reaplica la edición si la recarga del conflicto revela una visita confirmada', async () => {
    const user = userEvent.setup();
    const confirmed = { id: 'central-confirmed', ot_id: ot.public_id, trabajo_id: 'work-red', tipo: 'INICIAL', numero: 1, estado: 'CONFIRMED', version: 2, payload: { outputIds: ['base', 'tapa'], checks: {} } };
    const qualityVisitApi = {
      loadVisits: vi.fn()
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValue({ items: [confirmed] }),
      saveDraft: vi.fn().mockRejectedValue({ status: 409, message: 'VERSION_CONFLICT' }),
    };
    renderWork({ qualityVisitApi });
    await waitFor(() => expect(qualityVisitApi.loadVisits).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' }), '112');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Conservar mi edición' })).toBeVisible(), { timeout: 2500 });
    await user.click(screen.getByRole('button', { name: 'Conservar mi edición' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Conservar mi edición' })).not.toBeInTheDocument());
    expect(screen.getByText(/versión compartida ya está confirmada/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Descartar edición y ver confirmada' })).toBeVisible();
  });

  it('hidrata visitas embebidas del detalle sin repetir GET', async () => {
    const qualityVisitApi = { loadVisits: vi.fn() };
    const embedded = { id: 'central-1', ot_id: ot.public_id, trabajo_id: 'work-red', tipo: 'INICIAL', estado: 'CONFIRMED', version: 2, payload: { outputIds: ['base', 'tapa'], checks: {} } };
    const view = renderWork({ ot: { ...ot, visitas_calidad: [embedded] }, qualityVisitApi });
    await waitFor(() => expect(view.getState().pieceQuality.workVisits).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'central-1', status: 'CONFIRMED', version: 2 })])));
    expect(qualityVisitApi.loadVisits).not.toHaveBeenCalled();
  });

  it('reopens a work draft without carrying initial values into a periodic visit', async () => {
    const user = userEvent.setup();
    const pieceQuality = { ...emptyPieceQualityState(), workVisits: [{ id: 'draft-1', otId: 'ot-254', workId: 'work-red', kind: 'PERIODICA', status: 'DRAFT', checks: { outputChecks: { base: { netGrams: '112' } }, commonChecks: {} } }] };
    renderWork({ localState: { pieceQuality } });
    await user.click(screen.getByRole('button', { name: /visita periódica/ }));
    expect(screen.getByRole('spinbutton', { name: 'Neto (g) · Base' })).toHaveValue(112);
  });

  it('confirms one work visit and mirrors pieceKeys, checks and results for the report contract', async () => {
    const user = userEvent.setup();
    const view = renderWork();
    await user.click(screen.getByRole('button', { name: 'Registrar control de arranque' }));
    for (const [label, value] of [['Neto (g) · Base', '112'], ['Cantidad · Base', '4'], ['Neto (g) · Tapa', '30'], ['Cantidad · Tapa', '3'], ['Ciclo observado (s)', '12']]) {
      await user.type(screen.getByRole('spinbutton', { name: label }), value);
    }
    await user.click(screen.getByRole('button', { name: 'Peso correcto · Base' }));
    await user.click(screen.getByRole('button', { name: 'Peso correcto · Tapa' }));
    await user.click(screen.getByRole('button', { name: 'Ciclo correcto' }));
    for (const family of ['Color', 'Inyección']) await user.click(within(screen.getByRole('region', { name: family })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(within(screen.getByRole('region', { name: 'Funcional' })).getAllByRole('button', { name: 'No aplica' })[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    const saved = view.getState().pieceQuality;
    expect(saved.workVisits).toHaveLength(1);
    expect(saved.workVisits[0]).not.toHaveProperty('affectedMangas');
    expect(saved.workVisits[0].checks).not.toHaveProperty('affectedMangas');
    expect(saved.visits[0].pieceKeys).toHaveLength(2);
    expect(saved.visits[0].checksByPiece).toBeDefined();
    expect(saved.visits[0].pieceResults).toEqual(expect.arrayContaining([expect.objectContaining({ outputId: 'base', result: 28 }), expect.objectContaining({ outputId: 'tapa', result: 10 })]));
  });

  it('keeps confirmed history read-only and leaves draft recovery in the station', () => {
    const pieceQuality = {
      ...emptyPieceQualityState(),
      workVisits: [
        { id: 'confirmed-1', otId: 'ot-254', workId: 'work-red', kind: 'INICIAL', status: 'CONFIRMED', outputIds: ['base', 'tapa'] },
        { id: 'draft-1', otId: 'ot-254', workId: 'work-red', kind: 'PERIODICA', status: 'DRAFT', outputIds: ['base', 'tapa'] },
      ],
    };
    renderWork({ localState: { pieceQuality }, historyOnly: true });
    expect(screen.getByText(/Confirmado/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retomar borrador' })).not.toBeInTheDocument();
  });
});
