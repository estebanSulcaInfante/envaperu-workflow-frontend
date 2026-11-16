import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CalidadProcesoScm from '../components/CalidadProcesoScm';
import { todayInLima } from '../utils/limaDate';
import QualityOtInspectionSummary from '../components/QualityOtInspectionSummary.jsx';
import { obtenerOrdenFabricacionScm, obtenerOtScm } from '../services/scmOtApi';
import { obtenerMoldes } from '../services/api';

vi.mock('../services/scmOtApi', () => ({ listarJornadasPlantaScm: vi.fn(), listarOtScm: vi.fn(), obtenerOtScm: vi.fn(), obtenerOrdenFabricacionScm: vi.fn() }));
vi.mock('../services/api', () => ({ obtenerMoldes: vi.fn() }));

const outputA = { public_id: 'salida-a', codigo: 'SAL-A', articulo: { nombre: 'Pieza A' } };
const outputB = { public_id: 'salida-b', codigo: 'SAL-B', articulo: { nombre: 'Pieza B' } };
const ot = {
  public_id: 'ot-000254', codigo_ot: 'OT-000254', fecha_operativa: '2026-10-24', turno: 'DIA', estado: 'EN_EJECUCION',
  maquina_id: 'machine-ht-250-c', maquina_nombre: 'HT-250 C', trabajos_color: [{
    id: 'work-1', estado: 'PAUSADO', color: 'VERDE', orden_fabricacion_codigo: 'OF-009',
    salidas: [outputA, outputB],
  }],
};
const otherMachineOt = {
  public_id: 'ot-000255', codigo_ot: 'OT-000255', fecha_operativa: '2026-10-24', turno: 'DIA', estado: 'EN_EJECUCION',
  maquina_id: 'machine-ht-120-a', maquina_codigo: 'HT-120-A', maquina_nombre: 'Sopladora HT-120 A', trabajos_color: [],
};
const sameCodeFamilyOt = {
  public_id: 'ot-000256', codigo_ot: 'OT-000256', fecha_operativa: '2026-10-24', turno: 'DIA', estado: 'EN_EJECUCION',
  maquina_id: 'machine-ht-250-b', maquina_codigo: 'HT-250-B', maquina_nombre: 'HT-250 B', trabajos_color: [],
};

const withRouter = (element) => <MemoryRouter initialEntries={['/calidad/reporte']}>{element}</MemoryRouter>;
const renderBoard = (props = {}) => render(withRouter(<CalidadProcesoScm view="board" ots={[ot]} initialDate="2026-10-24" initialShift="DIA" {...props} />));

describe('CalidadProcesoScm · reporte readonly', () => {
  it('usa la fecha operativa actual de Lima y permite consultar otra fecha', async () => {
    render(withRouter(<CalidadProcesoScm view="board" ots={[]} initialShift="DIA" />));

    const dateInput = screen.getByTestId('calidad-date-input');
    expect(dateInput).toHaveValue(todayInLima());
    fireEvent.change(dateInput, { target: { value: '2026-11-14' } });
    expect(dateInput).toHaveValue('2026-11-14');
  });
  it('proyecta una visita por trabajo, sin contar piezas ni borradores, y conserva la fila en cola', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [
        { id: 'work-red', estado: 'PAUSADO', color: { nombre: 'Rojo', hex: '#c62828' }, molde_id: 'mold-1', molde_nombre: 'Regaderas sólidos', orden_fabricacion_codigo: 'OF-001', salidas: [outputA, outputB] },
        { id: 'work-blue', estado: 'EN_EJECUCION', color: { nombre: 'Azul', hex: '#1565c0' }, molde_id: 'mold-1', molde_nombre: 'Regaderas sólidos', orden_fabricacion_codigo: 'OF-002', salidas: [outputA] },
        { id: 'work-green', estado: 'PLANIFICADO', color: { nombre: 'Verde', hex: '#2e7d32' }, molde_id: 'mold-2', molde_nombre: 'Balde alto', salidas: [outputB] },
      ],
    };
    const quality = {
      pieceQuality: {
        version: 1,
        workVisits: [
          { id: 'initial-red', otId: inspectionOt.public_id, workId: 'work-red', kind: 'INICIAL', status: 'CONFIRMED' },
          { id: 'periodic-blue', otId: inspectionOt.public_id, workId: 'work-blue', kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: ['duplicate-piece-a', 'duplicate-piece-b'] },
          { id: 'periodic-blue', otId: inspectionOt.public_id, workId: 'work-blue', kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: ['duplicate-piece-a'] },
          { id: 'draft-green', otId: inspectionOt.public_id, workId: 'work-green', kind: 'PERIODICA', status: 'DRAFT' },
        ],
        periodicQuotaByOt: { [inspectionOt.public_id]: 3 },
      },
    };
    render(withRouter(<QualityOtInspectionSummary ot={inspectionOt} quality={quality} moldCatalog={[{ id: 'mold-1', nombre: 'Regaderas sólidos' }]} />));

    const summary = screen.getByTestId('quality-ot-inspection-summary');
    expect(within(summary).getByText('Sí', { selector: 'strong' })).toBeVisible();
    expect(within(summary).getByText('1/3', { selector: 'strong' })).toBeVisible();
    expect(within(summary).getByText('Regaderas sólidos · Rojo')).toBeVisible();
    expect(within(screen.getByTestId('quality-ot-work-row-work-red')).getByText('1 inspección')).toBeVisible();
    expect(within(summary).getByText('Regaderas sólidos · Azul')).toBeVisible();
    expect(within(screen.getByTestId('quality-ot-work-row-work-blue')).getByText('1 inspección')).toBeVisible();
    expect(within(summary).getByText('Balde alto · Verde')).toBeVisible();
    expect(within(summary).getByText('En cola')).toBeVisible();
    expect(within(summary).getByLabelText('Inspecciones en cola')).toHaveTextContent('—');
  });

  it('proyecta la tarjeta solo con pendientes de inspección, prioriza activo y conserva pausados inspeccionables', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [
        { id: 'work-paused', estado: 'PAUSADO', color: { nombre: 'Rojo', hex: '#c62828' }, molde_nombre: 'Regaderas sólidos', orden_fabricacion_codigo: 'OF-277-A', salidas: [outputA] },
        { id: 'work-active', estado: 'EN_EJECUCION', color: { nombre: 'Azul', hex: '#1565c0' }, molde_nombre: 'Regaderas sólidos', orden_fabricacion_codigo: 'OF-277-B', salidas: [outputA] },
        { id: 'work-queued', estado: 'PLANIFICADO', color: { nombre: 'Verde', hex: '#2e7d32' }, molde_nombre: 'Balde alto', orden_fabricacion_codigo: 'OF-277-C', salidas: [outputB] },
      ],
    };
    render(withRouter(<CalidadProcesoScm view="board" ots={[inspectionOt]} initialDate="2026-10-24" initialShift="DIA" />));

    const card = screen.getByTestId('calidad-report-ot-ot-000254');
    const progress = within(card).getByRole('group', { name: 'Avance de inspección de la OT' });
    expect(progress).toHaveTextContent('Control de arranque: No');
    expect(progress).toHaveTextContent('Control periódico: 0');
    expect([...progress.querySelectorAll('strong')].map(value => value.textContent)).toEqual(['No', '0']);
    expect(progress).not.toHaveTextContent('/');
    expect(within(card).getByText('Pendientes de inspección')).toBeVisible();
    expect(within(card).getByText('Regaderas sólidos · Azul')).toBeVisible();
    expect(within(card).getByText('Regaderas sólidos · Rojo')).toBeVisible();
    expect(within(card).queryByText('Balde alto · Verde')).not.toBeInTheDocument();
    expect(within(card).getByText('Pausado')).toBeVisible();
    expect(within(card).queryByText('incidencias abiertas')).not.toBeInTheDocument();
    const pending = within(card).getByRole('list', { name: 'Pendientes de inspección' });
    expect([...pending.querySelectorAll('[data-testid^="quality-ot-work-row-"]')].map((row) => row.dataset.testid)).toEqual([
      'quality-ot-work-row-work-active',
      'quality-ot-work-row-work-paused',
    ]);
  });

  it('muestra el avance entre la OT y los pendientes en la estación y cuenta solo las visitas confirmadas', () => {
    const localState = { pieceQuality: {
      version: 1,
      periodicQuotaByOt: { [ot.public_id]: 3 },
      workVisits: [
        { id: 'i', otId: ot.public_id, workId: 'work-1', kind: 'INICIAL', status: 'CONFIRMED' },
        { id: 'p', otId: ot.public_id, workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED' },
        { id: 'b', otId: ot.public_id, workId: 'work-1', kind: 'PERIODICA', status: 'DRAFT' },
      ],
    } };
    render(withRouter(<CalidadProcesoScm view="station-board" ots={[ot]} localState={localState} initialDate="2026-10-24" initialShift="DIA" />));
    const card = within(screen.getByTestId('calidad-report-ot-ot-000254'));
    const order = card.getByRole('link', { name: ot.codigo_ot });
    const progress = card.getByRole('group', { name: 'Avance de inspección de la OT' });
    expect(progress).toHaveTextContent('Control de arranque: Sí');
    expect(progress).toHaveTextContent('Control periódico: 1/3');
    expect([...progress.querySelectorAll('strong')].map(value => value.textContent)).toEqual(['Sí', '1/3']);
    expect(order.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progress.compareDocumentPosition(card.getByText('Pendientes de inspección')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('distingue una tarjeta sin pendiente de una máquina sin trabajo activo', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [{ id: 'work-queued', estado: 'PLANIFICADO', color: 'Verde', molde_nombre: 'Balde alto', salidas: [outputB] }],
    };
    render(withRouter(<CalidadProcesoScm view="board" ots={[inspectionOt]} initialDate="2026-10-24" initialShift="DIA" />));
    const card = screen.getByTestId('calidad-report-ot-ot-000254');
    expect(within(card).getByText('Sin trabajos pendientes de inspección')).toBeVisible();
    expect(within(card).getByText('En cola; sin trabajo activo')).toBeVisible();
  });

  it('atribuye visitas por OT además de trabajo y no retira al homónimo de otra OT', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [{ id: 'work-1', estado: 'EN_EJECUCION', color: 'Azul', molde_nombre: 'Molde común', salidas: [outputA] }],
    };
    render(withRouter(<QualityOtInspectionSummary
      ot={inspectionOt}
      quality={{ pieceQuality: { version: 1, visits: [
        { id: 'other-ot-visit', otId: 'ot-otro', workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED' },
        { id: 'own-ot-visit', otId: inspectionOt.public_id, workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED' },
      ] } }}
    />));

    expect(within(screen.getByTestId('quality-ot-work-row-work-1')).getByText('1 inspección')).toBeVisible();
  });

  it('conserva pendiente en tarjeta cuando solo existe una visita confirmada de otra OT', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [{ id: 'work-1', estado: 'EN_EJECUCION', color: 'Azul', molde_nombre: 'Molde común', salidas: [outputA] }],
    };
    render(withRouter(<QualityOtInspectionSummary
      ot={inspectionOt}
      quality={{ pieceQuality: { version: 1, visits: [
        { id: 'other-ot-visit', otId: 'ot-otro', workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED' },
      ] } }}
      pendingOnly
      showHeader={false}
    />));

    expect(screen.getByRole('list', { name: 'Pendientes de inspección' })).toBeVisible();
    expect(screen.getByTestId('quality-ot-work-row-work-1')).toBeVisible();
  });

  it('marca molde sin cargar y muestra un único aviso recuperable si falla la OF del resumen', async () => {
    obtenerOrdenFabricacionScm.mockReset();
    obtenerOrdenFabricacionScm.mockRejectedValueOnce(new Error('OF temporalmente no disponible'));
    const summaryOt = {
      ...ot,
      trabajos_color: [{ ...ot.trabajos_color[0], orden_fabricacion_id: 'of-fallida', molde_nombre: undefined }],
    };
    renderBoard({ ots: [summaryOt] });

    const card = await screen.findByTestId('calidad-report-ot-ot-000254');
    expect(await within(card).findByText('Molde sin cargar · VERDE')).toBeVisible();
    const partialAlert = screen.getByRole('alert');
    expect(partialAlert).toHaveTextContent('Lectura parcial');
    expect(within(partialAlert).getByRole('button', { name: 'Actualizar lectura' })).toBeVisible();
  });

  it('solo muestra fuera de ventana con inicio real verificable y desambigua homónimos por OF', () => {
    const inspectionOt = {
      ...ot,
      turno: 'DIA',
      inicio_real: '2026-10-24T13:00:00-05:00',
      trabajos_color: [
        { id: 'work-1', estado: 'EN_EJECUCION', color: 'Azul', molde_id: 'mold-1', molde_nombre: 'Molde común', orden_fabricacion_codigo: 'OF-001', salidas: [outputA] },
        { id: 'work-2', estado: 'PAUSADO', color: 'Azul', molde_id: 'mold-1', molde_nombre: 'Molde común', orden_fabricacion_codigo: 'OF-002', salidas: [outputA] },
      ],
    };
    render(withRouter(<QualityOtInspectionSummary ot={inspectionOt} quality={{ pieceQuality: { version: 1 } }} />));

    const summary = screen.getByTestId('quality-ot-inspection-summary');
    expect(within(summary).getByText('Arranque fuera de ventana')).toBeVisible();
    expect(within(summary).getByText(/OF-001/)).toBeVisible();
    expect(within(summary).getByText(/OF-002/)).toBeVisible();
  });

  it('permite seleccionar una fila de trabajo sin atribuir otra OT', async () => {
    const user = userEvent.setup();
    const onSelectWork = vi.fn();
    render(withRouter(<QualityOtInspectionSummary
      ot={{ ...ot, trabajos_color: [{ ...ot.trabajos_color[0], molde_nombre: 'Molde azul', color: 'Azul' }] }}
      quality={{ pieceQuality: { version: 1 } }}
      onSelectWork={onSelectWork}
      selectedWorkId="work-1"
    />));

    const row = screen.getByTestId('quality-ot-work-row-work-1');
    expect(row).toHaveAttribute('aria-pressed', 'true');
    await user.click(row);
    expect(onSelectWork).toHaveBeenCalledWith('work-1', expect.objectContaining({ workId: 'work-1' }));
  });

  it('conserva el arranque inequívoco aunque una periódica legacy no tenga trabajo', () => {
    const inspectionOt = {
      ...ot,
      trabajos_color: [{ ...ot.trabajos_color[0], molde_nombre: 'Molde histórico', color: 'Rojo' }],
      fecha_inicio: '2026-10-24',
    };
    render(withRouter(<QualityOtInspectionSummary ot={inspectionOt} quality={{ pieceQuality: {
      version: 1,
      workVisits: [
        { id: 'initial', otId: inspectionOt.public_id, workId: 'work-1', kind: 'INICIAL', status: 'CONFIRMED' },
        { id: 'legacy-periodic', otId: inspectionOt.public_id, kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: ['legacy-piece-without-match'] },
      ],
    } }} />));

    const summary = screen.getByTestId('quality-ot-inspection-summary');
    expect(within(summary).getByText('Sí', { selector: 'strong' })).toBeVisible();
    expect(within(summary).getByText('Revisar historial')).toBeVisible();
    expect(within(summary).getByText('1 inspección')).toBeVisible();
    expect(within(summary).queryByText(/Arranque fuera de ventana/)).not.toBeInTheDocument();
  });

  it('muestra OT enlazada y oculta escrituras de disponibilidad/registro', async () => {
    const user = userEvent.setup();
    renderBoard({ machines: [{ id: 'machine-empty', codigo: 'MT-100', nombre: 'MT-100' }] });

    expect(await screen.findByText('Reporte de Calidad')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Registrar|No trabajará|Reactivar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OT-000254' })).toHaveAttribute('href', '/calidad/reporte/ots/ot-000254?fecha=2026-10-24&turno=DIA');
    await user.click(screen.getByRole('button', { name: 'Más acciones de OT-000254' }));
    expect(screen.getByRole('menuitem', { name: 'Abrir estación de Calidad' })).toHaveAttribute('href', '/calidad/estacion/ots/ot-000254?fecha=2026-10-24&turno=DIA');
    expect(screen.getByRole('menuitem', { name: 'Abrir informe de OT' })).toBeVisible();
  });

  it('presenta la hoja de informe con controles anteriores sin formularios', () => {
    const localState = {
      controls: { 'work-1:salida-a': { done: true } },
      visits: [{ otId: 'ot-000254', workId: 'work-1', kind: 'INICIAL', samples: [{ outputId: 'salida-a', result: 25 }] }],
      incidents: [], periodic: {},
    };
    render(withRouter(<CalidadProcesoScm view="sheet" otId="ot-000254" ots={[ot]} localState={localState} initialDate="2026-10-24" initialShift="DIA" />));

    expect(screen.getByRole('heading', { name: 'Informe de OT' })).toBeVisible();
    expect(screen.getByText('Controles anteriores')).toBeVisible();
    expect(screen.getByText('Realizado')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Registrar|Guardar|Incidencia/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir OT en estación/i })).toHaveAttribute('href', '/calidad/estacion/ots/ot-000254?fecha=2026-10-24&turno=DIA');
  });

  it('preserva filtros y posición al abrir el informe', async () => {
    const user = userEvent.setup();
    const onOpenOt = vi.fn();
    renderBoard({ onOpenOt });
    await user.click(screen.getByRole('link', { name: 'OT-000254', exact: true }));
    expect(onOpenOt).toHaveBeenCalledWith('ot-000254', expect.objectContaining({ date: '2026-10-24', shift: 'DIA', machine: 'TODAS' }));
  });

  it('no sustituye otra OT cuando el deep-link no existe', () => {
    render(withRouter(<CalidadProcesoScm view="sheet" otId="ot-inexistente" ots={[ot]} initialDate="2026-10-24" initialShift="DIA" />));
    expect(screen.getByText(/No se encontró la OT/)).toBeVisible();
    expect(screen.queryByText('Controles anteriores')).not.toBeInTheDocument();
  });

  it('reintenta la lectura de la OF en el informe y resuelve el nombre del molde desde el catálogo', async () => {
    const user = userEvent.setup();
    const detail = { ...ot, trabajos_color: [{ ...ot.trabajos_color[0], orden_fabricacion_id: 'of-9', corrida_fabricacion_id: 'corrida-1' }] };
    obtenerMoldes.mockResolvedValue([{ id: 17, nombre: 'Regaderas sólidos' }]);
    obtenerOtScm.mockResolvedValue({ ot: detail });
    obtenerOrdenFabricacionScm.mockRejectedValueOnce(new Error('Lectura interrumpida'))
      .mockResolvedValueOnce({ molde_id: 17, corridas: [{ id: 'corrida-1', salidas: [] }] });
    render(withRouter(<CalidadProcesoScm view="sheet" otId={ot.public_id} readOts={async () => [ot]} initialDate={ot.fecha_operativa} initialShift="DIA" />));
    expect(await screen.findByRole('alert')).toHaveTextContent('detalle de la OT');
    await user.click(screen.getByRole('button', { name: 'Reintentar lectura' }));
    const row = await screen.findByTestId('quality-ot-work-row-work-1');
    expect(within(row).getByText('Regaderas sólidos · VERDE')).toBeVisible();
  });

  it('recupera el detalle exacto de la OT después de una lectura fallida', async () => {
    const user = userEvent.setup();
    obtenerMoldes.mockResolvedValue([]);
    obtenerOtScm.mockResolvedValueOnce({ ot: otherMachineOt }).mockResolvedValueOnce({ ot });
    render(withRouter(<CalidadProcesoScm view="station" otId={ot.public_id} readOts={async () => [ot]} initialDate={ot.fecha_operativa} initialShift="DIA" />));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar');
    expect(screen.queryByTestId('quality-work-station')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar lectura' }));
    expect(await screen.findByTestId('quality-work-station')).toBeVisible();
    expect(obtenerOtScm).toHaveBeenCalledWith(ot.public_id, expect.objectContaining({ signal: expect.anything() }));
  });

  it('abre el historial del turno noche en modo de consulta', async () => {
    render(<MemoryRouter initialEntries={['/calidad/estacion/ots/ot-000254/historial']}><CalidadProcesoScm view="station" otId={ot.public_id} ots={[{ ...ot, turno: 'NOCHE' }]} initialDate={ot.fecha_operativa} initialShift="NOCHE" /></MemoryRouter>);
    expect(await screen.findByTestId('quality-work-history')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Registrar control de arranque|Confirmar lo observado/ })).not.toBeInTheDocument();
  });

  it('permite seleccionar turno EXTRA sin convertirlo en escritura', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBoard({ initialShift: 'EXTRA', onFiltersChange });
    expect(screen.getByRole('combobox', { name: 'Turno' })).toHaveTextContent('Extra');
    await user.click(screen.getByRole('combobox', { name: 'Turno' }));
    await user.click(screen.getByRole('option', { name: 'Día' }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ shift: 'DIA' }));
  });

  it('proyecta el contrato pieceQuality de la estación en los conteos vivos del reporte', () => {
    const completeChecks = Object.fromEntries(['peso', 'ciclo', 'color', 'inyeccion', 'funcional'].map((id) => [id, { status: 'OK', applicable: true, result: id === 'peso' ? 25 : undefined }]));
    const localState = {
      pieceQuality: {
        version: 1,
        records: { 'ot-000254:work-1:salida-a': { checks: completeChecks } },
        visits: [{ id: 'visit-1', otId: 'ot-000254', workId: 'work-1', kind: 'PERIODICA', pieceKeys: ['ot-000254:work-1:salida-a'], status: 'CONFIRMED' }],
        incidents: [{ id: 'incident-1', otId: 'ot-000254', status: 'ABIERTA', type: 'Rebaba' }],
        periodicQuotaByOt: { 'ot-000254': 0 },
      },
    };
    renderBoard({ localState });
    const card = screen.getByTestId('calidad-report-ot-ot-000254');
    expect(within(card).getByText('Sin trabajos pendientes de inspección')).toBeVisible();
    expect(within(card).queryByText('incidencias abiertas')).not.toBeInTheDocument();
  });

  it('muestra en qué salida y trabajo se observó la incidencia de una visita multipieza', () => {
    const visit = {
      id: 'periodica-2', otId: ot.public_id, workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED',
      pieceKeys: ['ot-000254:work-1:salida-a', 'ot-000254:work-1:salida-b'],
      checks: {
        'ot-000254:work-1:salida-a': { peso: { result: 28 } },
        'ot-000254:work-1:salida-b': { peso: { result: 10 } },
      },
    };
    const localState = { pieceQuality: { version: 1, visits: [visit], incidents: [{
      id: 'inc-tapa', workId: 'work-1', otId: ot.public_id, outputId: 'salida-b', type: 'Rebaba',
      visitId: visit.id, status: 'ABIERTA', affectedMangas: [{ id: 'bag-2', code: 'OF9-OT254-M002' }, { id: 'bag-3', code: 'OF9-OT254-M003' }],
    }] } };
    render(withRouter(<CalidadProcesoScm view="sheet" otId={ot.public_id} ots={[ot]} localState={localState} initialDate="2026-10-24" initialShift="DIA" />));
    const section = screen.getByRole('region', { name: 'Incidencias abiertas' });
    expect(within(section).getByText('Rebaba')).toBeVisible();
    expect(within(section).getByText(/Pieza B/)).toBeVisible();
    expect(within(section).getByText(/OF9-OT254-M002 · OF9-OT254-M003/)).toBeVisible();
    expect(within(section).queryByText(/Pieza A/)).not.toBeInTheDocument();
    expect(screen.getByText('28 g/pieza')).toBeVisible();
    expect(screen.getByText('10 g/pieza')).toBeVisible();
  });

  it('busca por nombre o código de máquina después de 300 ms y conserva la jornada en el enlace', async () => {
    const user = userEvent.setup();
    renderBoard({ ots: [ot, otherMachineOt], machines: [{ id: 'machine-ht-120-a', codigo: 'HT-120-A', nombre: 'Sopladora HT-120 A' }] });

    const search = screen.getByRole('textbox', { name: 'Buscar máquina u OT' });
    await user.type(search, 'HT-120-A');
    expect(screen.getByRole('link', { name: 'OT-000254' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'OT-000255' })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.queryByRole('link', { name: 'OT-000254' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OT-000255' })).toHaveAttribute(
      'href',
      '/calidad/reporte/ots/ot-000255?fecha=2026-10-24&turno=DIA&maquina=machine-ht-120-a',
    );
  });

  it('acepta Día y Noche escritos y notifica el cambio de jornada con debounce', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBoard({ onFiltersChange });

    await user.type(screen.getByRole('textbox', { name: 'Buscar máquina u OT' }), 'Noche');
    expect(onFiltersChange).not.toHaveBeenCalledWith(expect.objectContaining({ shift: 'NOCHE' }));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ shift: 'NOCHE' }));
  });

  it('al borrar una búsqueda que fijó una máquina vuelve a Todas sin perder fecha ni turno', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBoard({ ots: [ot], onFiltersChange });
    const search = screen.getByRole('textbox', { name: 'Buscar máquina u OT' });
    await user.type(search, 'HT-250');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await user.clear(search);
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ date: '2026-10-24', shift: 'DIA', machine: 'TODAS' });
    expect(screen.getByRole('link', { name: 'OT-000254' })).toBeVisible();
  });

  it('desfija la máquina automática si borrar parcialmente deja varias coincidencias', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderBoard({ ots: [ot, sameCodeFamilyOt], onFiltersChange });
    const search = screen.getByRole('textbox', { name: 'Buscar máquina u OT' });
    await user.type(search, 'HT-250 C');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ date: '2026-10-24', shift: 'DIA', machine: 'machine-ht-250-c' });

    await user.clear(search);
    await user.type(search, 'HT-250');
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ date: '2026-10-24', shift: 'DIA', machine: 'TODAS' });
    expect(screen.getByRole('link', { name: 'OT-000254' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'OT-000256' })).toBeVisible();
  });

  it('en Noche habilita la estación voluntaria sin alarma por cobertura ausente', () => {
    renderBoard({ initialShift: 'NOCHE', ots: [{ ...ot, turno: 'NOCHE' }] });

    expect(screen.getByText(/Noche habilitada: registro voluntario/)).toBeVisible();
    expect(screen.queryByText('incidencias abiertas')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OT-000254' })).toBeVisible();
    expect(screen.queryByText(/Sin control de calidad en este turno/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más acciones de OT-000254' })).toBeVisible();
  });

  it('keeps two consecutive OTs on the same machine isolated in the night board', () => {
    const secondOt = {
      ...ot,
      public_id: 'ot-000275',
      codigo_ot: 'OT-000275',
      turno: 'NOCHE',
      trabajos_color: [{ ...ot.trabajos_color[0], id: 'work-275' }],
    };
    const localState = {
      pieceQuality: {
        version: 1,
        visits: [{ id: 'night-visit-268', otId: 'ot-000254', workId: 'work-1', kind: 'PERIODICA', status: 'CONFIRMED', pieceKeys: ['ot-000254:work-1:salida-a'] }],
        records: {},
        incidents: [],
        periodicQuotaByOt: {},
      },
    };
    renderBoard({ initialShift: 'NOCHE', ots: [{ ...ot, turno: 'NOCHE' }, secondOt], localState });
    const secondCard = screen.getByTestId('calidad-report-ot-ot-000275');
    expect(within(secondCard).getByText('Pendientes de inspección')).toBeVisible();
    expect(within(secondCard).getByText('Molde no informado · VERDE')).toBeVisible();
    expect(within(secondCard).queryByText(/sin cuota predeterminada/)).not.toBeInTheDocument();
  });

  it('identifica la OT por su número junto a la máquina y mantiene el estado del trabajo', async () => {
    const onOpenStation = vi.fn();
    render(withRouter(<CalidadProcesoScm view="station-board" ots={[ot]} initialDate="2026-10-24" initialShift="DIA" onOpenStation={onOpenStation} />));

    expect(screen.getByRole('heading', { name: 'Estación de Calidad' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Buscar máquina u OT' })).toBeVisible();
    const card = within(screen.getByTestId('calidad-report-ot-ot-000254'));
    const otLink = card.getByRole('link', { name: ot.codigo_ot });
    expect(otLink).toBeVisible();
    expect(otLink).toHaveAttribute('href', '/calidad/estacion/ots/ot-000254?fecha=2026-10-24&turno=DIA');
    expect(card.queryByText(/en ejecuci[oó]n/i)).not.toBeInTheDocument();
    expect(card.getByText('Pausado')).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Seleccionar OT' }));
    expect(onOpenStation).toHaveBeenCalledWith(ot.public_id, expect.objectContaining({ date: '2026-10-24', shift: 'DIA' }));
  });
});
