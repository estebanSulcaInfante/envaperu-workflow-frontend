import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QualityPieceStation from '../components/QualityPieceStation';
import { emptyPieceQualityState } from '../components/qualityPieceModel';

const ot = {
  public_id: 'ot-modal', codigo_ot: 'OT-MODAL', fecha_operativa: '2099-10-15', turno: 'DIA', maquina_nombre: 'HT-250 C',
  trabajos_color: [{ id: 'work-red', color: 'ROJO', estado: 'EN_EJECUCION', molde: { codigo: 'M-1' }, salidas: [{ pieza_id: 'pieza-a', nombre: 'Base' }] }],
};

function renderStation(localState = { pieceQuality: emptyPieceQualityState() }, routeSuffix = '') {
  let state = localState;
  const setLocalState = (updater) => { state = typeof updater === 'function' ? updater(state) : updater; };
  const key = encodeURIComponent('ot-modal:work-red:pieza-a');
  const view = render(<MemoryRouter initialEntries={[`/calidad/estacion/ots/ot-modal/registrar?pieza=${key}${routeSuffix}`]}><Routes><Route path="/calidad/estacion/ots/:otId/*" element={<QualityPieceStation ot={ot} localState={state} setLocalState={setLocalState} />} /></Routes></MemoryRouter>);
  return { ...view, getState: () => state };
}

function incidentButton(family) {
  return within(screen.getByRole('region', { name: new RegExp(`^${family}`) }))
    .getByRole('button', { name: /^(Reportar|Ver incidencia)$/ });
}

async function completeVisit(user, { colorIncident = false, weightAlreadyClassified = false, inspectedFamilies = [] } = {}) {
  const net = screen.getByRole('textbox', { name: 'Neto (g) · Base' });
  if (!net.value) await user.type(net, '125');
  const quantity = screen.getByRole('textbox', { name: 'Cantidad · Base' });
  if (!quantity.value) await user.type(quantity, '5');
  if (!weightAlreadyClassified) {
    await user.click(within(screen.getByRole('region', { name: /^Peso/ })).getByRole('button', { name: 'Dar conforme' }));
  }
  const cycle = screen.getByRole('textbox', { name: 'Ciclo (s) · Base' });
  if (!cycle.value) await user.type(cycle, '12');
  if (!colorIncident) {
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: 'Dar conforme' }));
  }
  if (!inspectedFamilies.includes('Inyección')) {
    await user.click(within(screen.getByRole('region', { name: /^Inyección/ })).getByRole('button', { name: 'Dar conforme' }));
  }
  if (!inspectedFamilies.includes('Funcional')) {
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
  }
  await user.click(screen.getByRole('button', { name: /Guardar (control de arranque|visita)/ }));
}

describe('QualityPieceStation incident forms', () => {
  it('shows measured cycle time as context and records the chosen classification with the visit', async () => {
    const user = userEvent.setup();
    const view = renderStation();
    await user.type(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' }), '12');
    await user.click(incidentButton('Ciclo'));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('radio', { name: 'Ciclo lento' })).toHaveFocus();
    expect(dialog.queryByRole('radio', { name: 'Ciclo correcto' })).not.toBeInTheDocument();
    expect(dialog.getAllByRole('radio')).toHaveLength(2);
    expect(dialog.getByText(/12\s*s\b/)).toBeVisible();
    await user.click(dialog.getByRole('radio', { name: 'Ciclo lento' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar incidencia' }));
    expect(within(screen.getByRole('region', { name: /^Ciclo/ })).getByText('Ciclo lento')).toBeVisible();
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    const seconds = screen.getByRole('textbox', { name: 'Ciclo (s) · Base' });
    await user.clear(seconds);
    await user.type(seconds, '15');
    await user.click(incidentButton('Ciclo'));
    const reopened = within(screen.getByRole('dialog'));
    expect(reopened.getByText(/15\s*s\b/)).toBeVisible();
    expect(reopened.getByRole('radio', { name: 'Ciclo lento' })).toBeChecked();
    await user.click(reopened.getByRole('button', { name: 'Guardar incidencia' }));
    await completeVisit(user);
    expect(view.getState().pieceQuality.incidents).toEqual([
      expect.objectContaining({ checkId: 'ciclo', type: 'Ciclo lento' }),
    ]);
  });

  it.each([
    ['Inyección', /rebaba/i],
    ['Funcional', /no es hermético/i],
  ])('opens %s directly on its choices and preserves cancellation', async (family, finding) => {
    const user = userEvent.setup();
    const view = renderStation();
    const open = incidentButton(family);
    await user.click(open);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('checkbox', { name: /Sin incidencias/i })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Guardar incidencia' })).toBeDisabled();
    expect(dialog.getAllByRole('checkbox').map(input => input === document.activeElement)).toContain(true);
    await user.click(dialog.getByRole('checkbox', { name: finding }));
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
    await user.click(open);
    const reopened = within(screen.getByRole('dialog'));
    expect(reopened.getByRole('checkbox', { name: finding })).not.toBeChecked();
    await user.click(reopened.getByRole('checkbox', { name: finding }));
    await user.click(reopened.getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    await completeVisit(user, { inspectedFamilies: [family] });
    expect(view.getState().pieceQuality.incidents).toEqual([
      expect.objectContaining({ type: expect.stringMatching(finding) }),
    ]);
  });

  it('supports multiple findings, cancels without mutation, and deduplicates the saved finding', async () => {
    const user = userEvent.setup();
    const view = renderStation();
    await user.click(incidentButton('Color'));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    expect(within(dialog).queryByRole('checkbox', { name: /Sin incidencias/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Guardar incidencia' })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Veteado' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Puntos negros' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar incidencia' })).not.toBeInTheDocument());
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);

    await user.click(incidentButton('Color'));
    const reopened = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    expect(within(reopened).getByRole('checkbox', { name: 'Veteado' })).not.toBeChecked();
    await user.click(within(reopened).getByRole('checkbox', { name: 'Veteado' }));
    await user.click(within(reopened).getByRole('checkbox', { name: 'Puntos negros' }));
    await user.click(within(reopened).getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);

    await user.click(incidentButton('Color'));
    await user.click(within(screen.getByRole('dialog', { name: 'Registrar incidencia' })).getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    await completeVisit(user, { colorIncident: true });
    expect(view.getState().pieceQuality.incidents).toHaveLength(1);
    expect(view.getState().pieceQuality.incidents[0]).toMatchObject({ type: 'Veteado · Puntos negros', pieceKey: 'ot-modal:work-red:pieza-a' });
  });

  it('moves weight classification into the modal and records high/low only after its action', async () => {
    const user = userEvent.setup();
    const view = renderStation();
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(incidentButton('Peso'));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    expect(within(dialog).getByText('125 g netos · 5 piezas · 25 g/pieza')).toBeVisible();
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1);
    expect(within(dialog).getByRole('radio', { name: 'Peso alto' })).toHaveFocus();
    expect(within(dialog).queryByRole('radio', { name: 'Peso correcto' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Peso alto' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    await completeVisit(user, { weightAlreadyClassified: true });
    expect(view.getState().pieceQuality.incidents).toHaveLength(1);
    expect(view.getState().pieceQuality.incidents[0]).toMatchObject({ type: 'Peso alto', classification: 'ALTO', result: 25 });

  });

  it('stores correct weight classification without creating an incident', async () => {
    const user = userEvent.setup();
    const view = renderStation();
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(within(screen.getByRole('region', { name: /^Peso/ })).getByRole('button', { name: 'Dar conforme' }));
    const cycle = within(screen.getByRole('region', { name: /^Ciclo/ }));
    await user.type(cycle.getByRole('textbox'), '12');
    await user.click(cycle.getByRole('button', { name: 'Reportar' }));
    const report = within(screen.getByRole('dialog'));
    await user.click(report.getByRole('radio', { name: 'Ciclo lento' }));
    await user.click(report.getByRole('button', { name: 'Guardar incidencia' }));
    await user.click(cycle.getByRole('button', { name: 'Dar conforme' }));
    expect(cycle.getByText('Ciclo correcto')).toBeVisible();
    expect(cycle.getByRole('textbox')).toHaveValue('12');
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    await completeVisit(user, { weightAlreadyClassified: true });
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
  });

  it('keeps findings isolated by visit scope when the visit is confirmed', async () => {
    const key = 'ot-modal:work-red:pieza-a';
    const base = emptyPieceQualityState();
    base.incidents = [{ id: `piece-quality:v1:${key}:color`, pieceKey: key, checkId: 'color', status: 'ABIERTA', type: 'Veteado', colorOptions: ['VETEADO'], createdAt: '2026-11-11T10:00:00Z' }];
    base.visits = [{ id: 'v1', otId: 'ot-modal', kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: [key], checks: { [key]: { color: { status: 'INCIDENCIA' } } } }];
    const view = renderStation({ pieceQuality: base }, '&modo=PERIODICA&visitId=v2&number=3');
    const user = userEvent.setup();
    await user.click(incidentButton('Color'));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Puntos negros' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(1);
    await completeVisit(user, { colorIncident: true });
    expect(view.getState().pieceQuality.incidents).toHaveLength(2);
    expect(view.getState().pieceQuality.incidents.map((item) => item.id)).toContain(`piece-quality:v1:${key}:color`);
    expect(view.getState().pieceQuality.incidents.map((item) => item.id)).toContain(`piece-quality:v2:${key}:color`);

  });

  it('requires the injection finding for the inspected visit even when the piece has a prior open finding', async () => {
    const base = emptyPieceQualityState();
    const key = 'ot-modal:work-red:pieza-a';
    base.incidents = [{ id: 'previous', pieceKey: key, checkId: 'inyeccion', visitId: 'previous-visit', status: 'ABIERTA' }];
    const view = renderStation({ pieceQuality: base }, '&modo=PERIODICA&number=2');
    const user = userEvent.setup();
    await user.click(incidentButton('Inyección'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    await completeVisit(user, { inspectedFamilies: ['Inyección'] });
    expect(view.getState().pieceQuality.visits.filter(visit => visit.status === 'CONFIRMED')).toHaveLength(0);
    expect(screen.getByText(/selecciona el resultado de inyección/i)).toBeVisible();
  });

  it('only allows confirmed visits to be saved as a confirmed correction', () => {
    const key = 'ot-modal:work-red:pieza-a';
    const base = emptyPieceQualityState();
    base.visits = [{ id: 'confirmed', otId: 'ot-modal', kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: [key], checks: { [key]: { ciclo: { seconds: '12' } } } }];
    renderStation({ pieceQuality: base }, '&modo=PERIODICA&visitId=confirmed&number=2');
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar visita' })).toBeVisible();
  });

  it('clears the functional finding if the inspector sets the check to No aplica', async () => {
    const view = renderStation();
    const user = userEvent.setup();
    const panel = within(screen.getByRole('region', { name: /^Funcional/ }));
    expect(panel.queryByRole('combobox')).toBeNull();
    await user.click(panel.getByRole('button', { name: /^(Reportar|Ver incidencia)$/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('checkbox', { name: 'No cierra la tapa' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar incidencia' }));
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
    expect(panel.getByRole('button', { name: /^(Reportar|Ver incidencia)$/ })).toBeEnabled();
    await completeVisit(user, { inspectedFamilies: ['Funcional'] });
    const quality = view.getState().pieceQuality;
    expect(quality.incidents).toHaveLength(0);
    const saved = quality.visits[0].checks['ot-modal:work-red:pieza-a'].funcional;
    expect(saved).toMatchObject({ applicable: false, status: 'NA' });
    expect(saved.incidentOptions || []).toHaveLength(0);
  });
});
