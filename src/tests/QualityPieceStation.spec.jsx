import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QualityPieceStation from '../components/QualityPieceStation';
import { emptyPieceQualityState } from '../components/qualityPieceModel';


const output = (piezaId, nombre) => ({ pieza_id: piezaId, nombre });
const ot = {
  public_id: 'ot-254', codigo_ot: 'OT-000254', fecha_operativa: '2099-10-15', turno: 'DIA', maquina_nombre: 'HT-250 C',
  trabajos_color: [
    { id: 'work-red', color: 'ROJO', estado: 'EN_EJECUCION', molde: { codigo: 'M-1' }, salidas: [output('pieza-a', 'Base'), output('pieza-b', 'Tapa')] },
    { id: 'work-blue', color: 'AZUL', estado: 'PLANIFICADO', molde: { codigo: 'M-1' }, salidas: [output('pieza-a', 'Base')] },
  ],
};
const withWorkStatuses = (statuses) => ({ ...ot, trabajos_color: ot.trabajos_color.map((work, index) => ({ ...work, estado: statuses[index] })) });

function renderStation(entry = '/calidad/estacion/ots/ot-254?fecha=2026-10-15&turno=DIA&maquina=HT-250%20C', props = {}) {
  let state = { ...props.localState, pieceQuality: props.localState?.pieceQuality || emptyPieceQualityState() };
  const setLocalState = (updater) => { state = typeof updater === 'function' ? updater(state) : updater; };
  const setter = props.setLocalState || setLocalState;
  const view = render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/calidad/estacion/ots/:otId/*" element={<QualityPieceStation ot={props.ot || ot} setLocalState={setter} localState={state} {...props} />} /></Routes></MemoryRouter>);
  return { ...view, getState: () => state };
}

function incidentButton(family) {
  return within(screen.getByRole('region', { name: new RegExp(`^${family}`) }))
    .getByRole('button', { name: /^(Reportar|Ver incidencia)$/ });
}

describe('QualityPieceStation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('opens the active work directly and keeps repeated output names tied to that work', () => {
    renderStation();
    expect(screen.getByRole('button', { name: /ROJO/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /AZUL/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('blocks a second initial from the legacy piece route while preserving old history', () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=INICIAL`, {
      localState: { pieceQuality: { ...emptyPieceQualityState(), visits: [{ id: 'old-initial', otId: 'ot-254', workId: 'work-blue', kind: 'INICIAL', status: 'CONFIRMED', pieceKeys: [] }] } },
    });
    expect(screen.getByText(/arranque de esta OT ya fue registrado/i)).toBeVisible();
    expect(screen.queryByTestId('quality-registration')).not.toBeInTheDocument();
  });

  it('blocks a new periodic from the legacy piece route when the work is still queued', () => {
    const key = encodeURIComponent('ot-254:work-blue:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, {
      ot: withWorkStatuses(['PLANIFICADO', 'PLANIFICADO']),
    });
    expect(screen.getByText(/trabajo sigue en cola/i)).toBeVisible();
    expect(screen.queryByTestId('quality-registration')).not.toBeInTheDocument();
  });

  it('opens a periodic control for the observed work from its URL and returns to its OT breadcrumb', async () => {
    const user = userEvent.setup();
    renderStation('/calidad/estacion/ots/ot-254?fecha=2099-10-15&turno=DIA&trabajo=work-red&control=PERIODICA&number=2');
    const trail = screen.getByRole('navigation', { name: 'Ubicación' });
    expect(within(trail).getByText('Control #2')).toHaveAttribute('aria-current', 'page');
    const form = await screen.findByRole('region', { name: 'Registro del trabajo' });
    expect(within(form).getAllByLabelText(/^Neto \(g\)/)).toHaveLength(2);
    expect(within(form).getByTestId('quality-selected-work')).toHaveTextContent('ROJO');
    expect(within(form).queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
    await user.click(within(trail).getByRole('link', { name: 'OT-000254' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Registro del trabajo' })).not.toBeInTheDocument());
    expect(within(trail).getByText('OT-000254')).toHaveAttribute('aria-current', 'page');
  });

  it('stores the periodic visit target in OT configuration, preserving zero and empty distinctly', async () => {
    const user = userEvent.setup();
    const view = renderStation('/calidad/estacion/ots/ot-254?config=visitas');
    const quota = screen.getByRole('spinbutton', { name: 'Visitas periódicas previstas' });
    await user.type(quota, '3');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getState().pieceQuality.periodicQuotaByOt['ot-254']).toBe(3);
    await user.clear(quota);
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getState().pieceQuality.periodicQuotaByOt['ot-254']).toBe('');
    await user.type(quota, '0');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getState().pieceQuality.periodicQuotaByOt['ot-254']).toBe(0);
  });

  it('does not reinterpret an unavailable periodic number as the next control', async () => {
    renderStation('/calidad/estacion/ots/ot-254?trabajo=work-red&control=PERIODICA&number=99');
    expect(await screen.findByText(/El enlace no corresponde a un control disponible/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Registro del trabajo' })).not.toBeInTheDocument();
  });

  it('keeps edited measurements visible when saving before the breadcrumb or history fails', async () => {
    const user = userEvent.setup();
    renderStation('/calidad/estacion/ots/ot-254?trabajo=work-red&control=PERIODICA&number=2', { setLocalState: () => false });
    const form = await screen.findByRole('region', { name: 'Registro del trabajo' });
    const weight = within(form).getAllByLabelText(/^Neto \(g\)/)[0];
    fireEvent.change(weight, {target: {value:'182'}});
    const nav = screen.getByRole('navigation', {name:'Ubicación'});
    await user.click(within(nav).getByRole('link',{name:'OT-000254'}));
    await user.click(screen.getByRole('button',{name:'Historial de visitas'}));
    expect(form).toBeVisible();
    expect(weight).toHaveValue(182);
    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo guardar/);
  });

  it('keeps the edited OT target and exposes a retry when configuration persistence fails', async () => {
    const user = userEvent.setup();
    renderStation('/calidad/estacion/ots/ot-254?config=visitas', { setLocalState: () => false });
    const quota = screen.getByRole('spinbutton', { name: 'Visitas periódicas previstas' });
    await user.type(quota, '4');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(quota).toHaveValue(4);
    expect(screen.queryByRole('status', { name: 'Configuración guardada' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar la configuración');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  it('reads the configured OT target as registration progress without exposing an editor', () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, {
      localState: { pieceQuality: { ...emptyPieceQualityState(), periodicQuotaByOt: { 'ot-254': 3 } } },
    });
    expect(screen.getByLabelText('Avance de visitas periódicas')).toHaveTextContent('Periódicas confirmadas0/3');
    expect(screen.queryByRole('spinbutton', { name: 'Cuota periódica de la OT' })).not.toBeInTheDocument();
  });

  it('keeps the OT context and offers explicit work history', async () => {
    const user = userEvent.setup();
    renderStation();
    expect(screen.getByTestId('quality-work-station')).toBeVisible();
    expect(window.location.search).toBe(''); // MemoryRouter owns the URL; context is verified by rendered OT data.
    await user.click(screen.getByRole('button', { name: 'Historial de visitas' }));
    expect(screen.getByTestId('quality-work-history')).toBeVisible();
  });

  it('cancels a contextual incident without mutating the saved draft', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}`);
    await user.click(incidentButton('Color'));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Descripción (opcional)' }), 'Rebaba en borde');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar incidencia' })).not.toBeInTheDocument());
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: /^(Reportar|Ver incidencia)$/ }));
    expect(within(screen.getByRole('dialog', { name: 'Registrar incidencia' })).getByRole('textbox', { name: 'Descripción (opcional)' })).toHaveValue('');
  });

  it('renders concurrent WIP without merging it with piece identity', () => {
    renderStation('/calidad/estacion/ots/ot-254', { assemblyOts: [{ public_id: 'arm-1', modo_ejecucion_ensamble: 'CONCURRENTE', ot_fabricacion_contexto: { public_id: 'ot-254' }, producto_sku: 'WIP-BASE', estado: 'EN_PROCESO' }] });
    expect(screen.getByTestId('concurrent-wip')).toBeVisible();
    expect(screen.getByText('WIP-BASE')).toBeVisible();
    expect(screen.getByRole('button', { name: /ROJO/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens periodic registration in the URL with OT progress and multiple pieces from the work', async () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?fecha=2026-10-15&turno=DIA&pieza=${key}&modo=PERIODICA`);
    await userEvent.click(screen.getByRole('button', {name: 'Elegir piezas de la visita'}));
    expect(screen.getByTestId('quality-registration')).toBeVisible();
    expect(screen.getByText('Registrar visita periódica')).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: 'Cuota periódica de la OT' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Avance de visitas periódicas')).toHaveTextContent('Periódicas confirmadas0');
    expect(screen.getByRole('button', { name: 'Base' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tapa' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('quality-selected-work')).toHaveTextContent('ROJO');
    expect(screen.queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
    expect(screen.getAllByText('ROJO', { exact: true })[0]).toBeVisible();
  });

  it('shows all five families in the flat layout without an expansion step', async () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`);
    for (const family of ['Peso', 'Ciclo', 'Color', 'Inyección', 'Funcional']) {
      expect(screen.getByRole('region', { name: new RegExp(`^${family}`) })).toBeVisible();
    }
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' })).toBeVisible();
  });

  it('keeps each family to one visible title in the flat layout', async () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`);
    expect(screen.getAllByRole('heading', { name: 'Peso' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Ciclo' })).toHaveLength(1);
  });

  it('requires weight classification after the net and quantity are entered', async () => {
    const user = userEvent.setup();
    const key = 'ot-254:work-red:pieza-a';
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}&modo=PERIODICA`);
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    expect(incidentButton('Peso')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    expect(screen.getByText('Selecciona la clasificación del peso.')).toBeVisible();
  });

  it('records a high-weight incident only when explicitly requested and remains idempotent', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA&number=2`);
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(incidentButton('Peso'));
    const weightDialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    await user.click(within(weightDialog).getByRole('radio', { name: 'Peso alto' }));
    await user.click(within(weightDialog).getByRole('button', { name: 'Guardar incidencia' }));
    await user.type(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' }), '12');
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(within(screen.getByRole('region', { name: /^Inyección/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(1);
    expect(view.getState().pieceQuality.incidents[0]).toMatchObject({ checkId: 'peso', type: 'Peso alto', description: '' });
    await user.click(screen.getByRole('button', { name: /^Control #2/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(1);
  });

  it('reopens a periodic draft with the weight classification and optional description intact', async () => {
    const key = 'ot-254:work-red:pieza-a';
    const checks = { peso: { netGrams: '125', quantity: '5', classification: 'BAJO', description: 'Revisar lote', recordIncident: true } };
    const localState = { pieceQuality: { ...emptyPieceQualityState(), visits: [{ id: 'draft-weight', otId: 'ot-254', kind: 'PERIODICA', status: 'DRAFT', number: '2', pieceKeys: [key], checks: { [key]: checks } }], records: { [key]: { key, otId: 'ot-254', workId: 'work-red', outputId: 'pieza-a', initialChecks: {}, checks: {}, periodic: [{ visitId: 'draft-weight', draft: true, checks }] } } } };
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}&modo=PERIODICA&visitId=draft-weight&number=2`, { localState });
    const user = userEvent.setup();
    await user.click(incidentButton('Peso'));
    const weightDialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    expect(within(weightDialog).getByRole('radio', { name: 'Peso bajo' })).toBeChecked();
    expect(within(weightDialog).getByRole('textbox', { name: 'Descripción del peso (opcional)' })).toHaveValue('Revisar lote');
    expect(within(weightDialog).getByRole('button', { name: 'Guardar incidencia' })).toBeVisible();
  });

  it('allows voluntary night periodic registration from a direct legacy URL', () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { ot: { ...ot, turno: 'NOCHE' } });
    expect(screen.getByTestId('quality-registration')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Registrar visita periódica' })).toBeVisible();
    expect(screen.queryByTestId('quality-station-read-only')).not.toBeInTheDocument();
  });

  it('closes a night initial live at 20:00 Lima without discarding the open capture', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:59:59.000Z'));
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=INICIAL`, { ot: { ...ot, fecha_operativa: '2026-10-24', turno: 'NOCHE' } });
    expect(screen.getByTestId('quality-registration')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), { target: { value: '125' } });
    await act(async () => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.queryByTestId('quality-registration')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('20:00 Lima');
    expect(view.getState().pieceQuality.visits).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'DRAFT', kind: 'INICIAL' })]));
  });

  it('keeps night quota configuration explicit and optional', async () => {
    const user = userEvent.setup();
    const view = renderStation('/calidad/estacion/ots/ot-254?turno=NOCHE&config=visitas', { ot: { ...ot, turno: 'NOCHE' } });
    const quota = screen.getByRole('spinbutton', { name: 'Visitas periódicas previstas' });
    expect(quota).toHaveValue(null);
    await user.type(quota, '2');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getState().pieceQuality.periodicQuotaByOt['ot-254']).toBe(2);
  });

  it('keeps the work selected from the OT row and does not offer a second selector in the form', async () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA&number=2`);
    const form = screen.getByTestId('quality-registration');
    expect(within(form).getByTestId('quality-selected-work')).toHaveTextContent('ROJO');
    expect(within(form).queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
    expect(within(form).queryByRole('button', { name: 'AZUL Sin muestra' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Base' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'ROJO · Base' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toBeVisible();
  });

  it('preselects the unique running work even when the URL points at another color', async () => {
    const key = encodeURIComponent('ot-254:work-blue:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { ot: withWorkStatuses(['PLANIFICADO', 'EN_EJECUCION']) });
    expect(screen.getAllByText('AZUL', { exact: true })[0]).toBeVisible();
    expect(screen.getByTestId('quality-selected-work')).toHaveTextContent('AZUL');
    expect(screen.queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toBeVisible();
  });

  it('keeps a partial initial capture on its original work', async () => {
    const key = 'ot-254:work-red:pieza-a';
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}`, {
      ot: withWorkStatuses(['PLANIFICADO', 'EN_EJECUCION']),
      localState: { pieceQuality: { ...emptyPieceQualityState(), records: { [key]: { key, initialChecks: { peso: { netGrams: '125' } } } } } },
    });
    expect(screen.getAllByText('ROJO', { exact: true })[0]).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toHaveValue('125');
  });

  it('opens the first incomplete family with a specific field message and focus', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}`);
    expect(screen.getByRole('region', { name: /^Peso/ })).toBeVisible();
    expect(screen.getByRole('region', { name: /^Ciclo/ })).toBeVisible();
    expect(screen.getByRole('region', { name: /^Color/ })).toBeVisible();
    expect(screen.getByRole('region', { name: /^Inyección/ })).toBeVisible();
    expect(screen.getByRole('region', { name: /^Funcional/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar control de arranque' }));
    expect(screen.getByText('Ingresa el neto en gramos.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toHaveFocus(), { timeout: 1000 });
  });

  it.each([
    ['ningún trabajo activo', ['PLANIFICADO', 'PAUSADO']],
    ['más de un trabajo activo', ['EN_EJECUCION', 'EN_EJECUCION']],
  ])('exige elegir trabajo antes de medir cuando hay %s', (_label, statuses) => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { ot: withWorkStatuses(statuses) });
    expect(screen.queryByRole('group', { name: 'Color del trabajo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Neto (g) · Base' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ROJO Sin muestra/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AZUL Sin muestra/ })).not.toBeInTheDocument();
  });

  it('offers a clear return to OT rows when a legacy route cannot resolve one work', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { ot: withWorkStatuses(['EN_EJECUCION', 'EN_EJECUCION']) });
    expect(screen.getByText(/No se pudo identificar un único trabajo de color/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver a la OT' }));
    expect(screen.queryByTestId('quality-registration')).not.toBeInTheDocument();
    expect(screen.getByTestId('quality-work-station')).toBeVisible();
  });

  it('selects the only available work automatically', async () => {
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { ot: { ...ot, trabajos_color: [ot.trabajos_color[0]] } });
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument();
  });

  it('reopens and updates one confirmed periodic visit without duplicating visit or periodic record', async () => {
    const user = userEvent.setup();
    const key = 'ot-254:work-red:pieza-a';
    const checks = {
      peso: { netGrams: '125', quantity: '5' },
      ciclo: { seconds: '12' },
      color: { status: 'OK' },
      inyeccion: { status: 'OK' },
      funcional: { applicable: false, status: 'NA' },
    };
    const visit = {
      id: 'periodic-2', otId: 'ot-254', kind: 'PERIODICA', status: 'CONFIRMED', number: '2',
      pieceKeys: [key], mouldId: 'M-1', quota: 0, observedAt: '2026-10-15T09:00', checks: { [key]: checks },
    };
    const localState = { pieceQuality: { ...emptyPieceQualityState(), visits: [visit], records: { [key]: {
      key, otId: 'ot-254', workId: 'work-red', outputId: 'pieza-a', mouldId: 'M-1',
      initialChecks: {}, checks: {}, periodic: [{ visitId: 'periodic-2', draft: false, checks }],
    } } } };
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}&modo=PERIODICA&visitId=periodic-2&number=2`, { localState });
    expect(screen.getByRole('heading', { name: 'Control #2' })).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: 'Cuota periódica de la OT' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    const saved = view.getState().pieceQuality;
    expect(saved.visits).toHaveLength(1);
    expect(saved.visits[0]).toMatchObject({ id: 'periodic-2', status: 'CONFIRMED', number: '2', quota: 0 });
    expect(saved.records[key].periodic.filter((item) => item.visitId === 'periodic-2')).toHaveLength(1);
  });

  it('numbers a new periodic visit within its OT instead of using another OT global count', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const localState = { pieceQuality: { ...emptyPieceQualityState(), visits: [{ id: 'other-visit', otId: 'ot-999', kind: 'PERIODICA', status: 'CONFIRMED', number: '1', pieceKeys: [] }] } };
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`, { localState });
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(within(screen.getByRole('region', { name: /^Peso/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.type(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' }), '12');
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(within(screen.getByRole('region', { name: /^Inyección/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    const saved = view.getState().pieceQuality.visits;
    expect(saved).toHaveLength(2);
    expect(saved.find((visit) => visit.otId === 'ot-254')).toMatchObject({ number: '2', status: 'CONFIRMED' });
    expect(saved.find((visit) => visit.id === 'other-visit')).toMatchObject({ number: '1' });
  });

  it('reopens a draft periodic visit by id without exposing the OT quota editor', async () => {
    const key = 'ot-254:work-red:pieza-a';
    const checks = { peso: { netGrams: '125' } };
    const visit = {
      id: 'draft-2', otId: 'ot-254', kind: 'PERIODICA', status: 'DRAFT', number: '2',
      pieceKeys: [key], mouldId: 'M-1', quota: 0, observedAt: '2026-10-15T09:00', checks: { [key]: checks },
    };
    const localState = { pieceQuality: { ...emptyPieceQualityState(), visits: [visit], records: { [key]: {
      key, otId: 'ot-254', workId: 'work-red', outputId: 'pieza-a', mouldId: 'M-1',
      initialChecks: {}, checks: {}, periodic: [{ visitId: 'draft-2', draft: true, checks }],
    } } } };
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}&modo=PERIODICA&visitId=draft-2&number=2`, { localState });
    expect(screen.getByRole('heading', { name: 'Control #2' })).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: 'Cuota periódica de la OT' })).not.toBeInTheDocument();
    const saved = view.getState().pieceQuality;
    expect(saved.visits).toHaveLength(1);
    expect(saved.visits[0]).toMatchObject({ id: 'draft-2', status: 'DRAFT', number: '2', quota: 0 });
    expect(saved.records[key].periodic.filter((item) => item.visitId === 'draft-2')).toHaveLength(1);
  });

  it('propagates one cycle observation to the other selected piece in the same visit', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA`);
    await user.click(screen.getByRole('button', {name: 'Elegir piezas de la visita'}));
    await user.click(screen.getByRole('button', { name: 'Tapa' }));
    const cycleFields = screen.getAllByLabelText(/Ciclo \(s\)/);
    await user.type(cycleFields[0], '12');
    expect(cycleFields[1]).toHaveValue('');
    await user.click(screen.getByRole('button', {name:/Usar 12 s/}));
    expect(cycleFields[1]).toHaveValue('12');
  });

  it('opens a contextual incident during capture without losing the captured fields', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}`);
    const net = screen.getByRole('textbox', { name: 'Neto (g) · Base' });
    await user.type(net, '125');
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: /^(Reportar|Ver incidencia)$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    expect(within(dialog).getByText(/ROJO · Base/)).toBeVisible();
    await user.type(within(dialog).getByRole('textbox', { name: 'Descripción (opcional)' }), 'Mancha observada');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar incidencia' })).not.toBeInTheDocument());
    expect(net).toHaveValue('125');
  });

  it('stores the selected work color on an incident', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}`);
    await user.click(incidentButton('Color'));
    const dialog = screen.getByRole('dialog', { name: 'Registrar incidencia' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Veteado' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Descripción (opcional)' }), 'Borde irregular');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar incidencia' }));
    expect(view.getState().pieceQuality.incidents).toHaveLength(0);
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(within(screen.getByRole('region', { name: /^Peso/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.type(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' }), '12');
    await user.click(within(screen.getByRole('region', { name: /^Inyección/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar control de arranque' }));
    expect(view.getState().pieceQuality.incidents[0]).toMatchObject({ pieceKey: 'ot-254:work-red:pieza-a', color: 'ROJO', type: 'Veteado' });
  });

  it('autoguarda tras un cambio sin escribir al abrir ni navegar', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA&number=2`);
    expect(screen.queryByTestId('quality-autosave-status')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '1234');
    await waitFor(() => expect(screen.getByTestId('quality-autosave-status')).toHaveTextContent('Guardado'), { timeout: 2000 });
    expect(screen.getByTestId('quality-registration')).toBeVisible();
    expect(view.getState().pieceQuality.visits).toHaveLength(1);
    expect(view.getState().pieceQuality.visits[0]).toMatchObject({ status: 'DRAFT', number: '2' });
  });

  it('mantiene la identidad del borrador al confirmar explícitamente', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA&number=2`);
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '125');
    await user.type(screen.getByRole('textbox', { name: 'Cantidad · Base' }), '5');
    await user.click(within(screen.getByRole('region', { name: /^Peso/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.type(screen.getByRole('textbox', { name: 'Ciclo (s) · Base' }), '12');
    await user.click(within(screen.getByRole('region', { name: /^Color/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(within(screen.getByRole('region', { name: /^Inyección/ })).getByRole('button', { name: 'Dar conforme' }));
    await user.click(screen.getByRole('button', { name: 'No aplica', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar visita' }));
    expect(view.getState().pieceQuality.visits).toHaveLength(1);
    expect(view.getState().pieceQuality.visits[0].status).toBe('CONFIRMED');
  });

  it('recupera el borrador por OT, pieza física y número aunque falte visitId en la URL', async () => {
    const key = 'ot-254:work-red:pieza-a';
    const checks = { peso: { netGrams: '1234' } };
    const localState = { pieceQuality: { ...emptyPieceQualityState(), visits: [{ id: 'draft-urlless', otId: 'ot-254', kind: 'PERIODICA', status: 'DRAFT', number: '2', pieceKeys: [key], checks: { [key]: checks } }], records: { [key]: { key, otId: 'ot-254', workId: 'work-red', outputId: 'pieza-a', periodic: [{ visitId: 'draft-urlless', draft: true, checks }] } } } };
    renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${encodeURIComponent(key)}&modo=PERIODICA&number=2`, { localState });
    expect(screen.getByRole('textbox', { name: 'Neto (g) · Base' })).toHaveValue('1234');
  });

  it('hace flush del cambio pendiente al ocultar la pestaña', async () => {
    const user = userEvent.setup();
    const key = encodeURIComponent('ot-254:work-red:pieza-a');
    const view = renderStation(`/calidad/estacion/ots/ot-254/registrar?pieza=${key}&modo=PERIODICA&number=2`);
    await user.type(screen.getByRole('textbox', { name: 'Neto (g) · Base' }), '1250');
    fireEvent(window, new Event('pagehide'));
    expect(view.getState().pieceQuality.visits[0]).toMatchObject({ status: 'DRAFT' });
    expect(view.getState().pieceQuality.visits[0].checks['ot-254:work-red:pieza-a'].peso.netGrams).toBe('1250');
  });
});
