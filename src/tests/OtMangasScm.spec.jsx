import {
  act, fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import OtMangasScm from '../components/OtMangasScm';
import { getTrabajadores } from '../services/api';

const scmMocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  actorId: 'actor-1',
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  recalcularPlanMangas: vi.fn(),
  listarOtScm: vi.fn(),
  listarContinuidadesMangaPendientesScm: vi.fn(),
  crearOtFabricacionScm: vi.fn(),
  crearTrabajoColorScm: vi.fn(),
  cambiarEstadoTrabajoColorScm: vi.fn(),
  cambiarEstadoOtScm: vi.fn(),
  asignarTrabajadorTrabajoColorScm: vi.fn(),
  reasignarMangasTrabajoColorScm: vi.fn(),
  agregarMangasTrabajoColorScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
  solicitarMangaExtraScm: vi.fn(),
  aprobarMangaExtraScm: vi.fn(),
  obtenerPesajeMangaScm: vi.fn(),
  previsualizarCorreccionAsignacionMangaScm: vi.fn(),
  corregirAsignacionTrabajoMangaScm: vi.fn(),
  anularPesajeScm: vi.fn(),
  reabrirMangaScm: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getTrabajadores: vi.fn().mockResolvedValue([
    {
      id: 8,
      codigo: 'TRB-008',
      nombre_completo: 'Ana Maquinista',
      activo: true,
      roles: [{ codigo: 'MAQUINISTA' }],
    },
    {
      id: 9,
      codigo: 'TRB-009',
      nombre_completo: 'Luis Relevo',
      activo: true,
      roles: [{ codigo: 'MAQUINISTA' }],
    },
  ]),
  obtenerMaquinas: vi.fn().mockResolvedValue([
    { id: 4, codigo: 'SOP-01', nombre: 'Sopladora 1' },
  ]),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  agregarMangasNormalesScm: vi.fn(),
  agregarMangasTrabajoColorScm: scmMocks.agregarMangasTrabajoColorScm,
  anularMangaScm: vi.fn(),
  anularPesajeScm: scmMocks.anularPesajeScm,
  aprobarMangaExtraScm: scmMocks.aprobarMangaExtraScm,
  aprobarCorreccionPesajeScm: vi.fn(),
  asignarTrabajadorTrabajoColorScm: scmMocks.asignarTrabajadorTrabajoColorScm,
  cambiarEstadoOtScm: scmMocks.cambiarEstadoOtScm,
  cambiarEstadoTrabajoColorScm: scmMocks.cambiarEstadoTrabajoColorScm,
  crearOtFabricacionScm: scmMocks.crearOtFabricacionScm,
  crearOtScm: vi.fn(),
  crearTrabajoColorScm: scmMocks.crearTrabajoColorScm,
  generarEtiquetasPrepesaje: scmMocks.generarEtiquetasPrepesaje,
  listarOtScm: scmMocks.listarOtScm,
  listarContinuidadesMangaPendientesScm:
    scmMocks.listarContinuidadesMangaPendientesScm,
  listarSolicitudesMangaExtraScm: scmMocks.listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm: scmMocks.listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm: scmMocks.obtenerPesajeMangaScm,
  previsualizarCorreccionAsignacionMangaScm:
    scmMocks.previsualizarCorreccionAsignacionMangaScm,
  corregirAsignacionTrabajoMangaScm: scmMocks.corregirAsignacionTrabajoMangaScm,
  obtenerPlanMangas: scmMocks.obtenerPlanMangas,
  recalcularPlanMangas: scmMocks.recalcularPlanMangas,
  reabrirMangaScm: scmMocks.reabrirMangaScm,
  reasignarMangasTrabajoColorScm: scmMocks.reasignarMangasTrabajoColorScm,
  reemplazarEtiquetaScm: vi.fn(),
  solicitarCorreccionPesajeScm: vi.fn(),
  solicitarMangaExtraScm: scmMocks.solicitarMangaExtraScm,
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarCentrosTrabajoScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: (_error, fallback) => fallback,
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actorId: scmMocks.actorId,
    can: scmMocks.can,
    canAny: () => true,
    experience: { label: 'Jefe de Producción' },
  }),
}));

const greenManga = {
  public_id: 'manga-green-1',
  codigo: 'MNG-VERDE-001',
  articulo_nombre: 'Alcancía Pablo verde',
  color: 'VERDE SÓLIDO',
  tipo: 'NORMAL',
  cantidad_asignada_un: '100',
  maquinista_previsto_id: 8,
  maquinista: 'Ana Maquinista',
  estado: 'PLANIFICADA',
  etiqueta_vigente: null,
};

const blueManga = {
  public_id: 'manga-blue-1',
  codigo: 'MNG-AZUL-001',
  articulo_nombre: 'Alcancía Pablo azul',
  color: 'AZUL',
  tipo: 'NORMAL',
  cantidad_asignada_un: '100',
  maquinista_previsto_id: 8,
  maquinista: 'Ana Maquinista',
  estado: 'PLANIFICADA',
  etiqueta_vigente: null,
};

const weighedManga = {
  public_id: 'manga-weighed-1',
  codigo: 'MNG-PESADA-001',
  articulo_nombre: 'Alcancía Pablo verde',
  color: 'VERDE SÓLIDO',
  tipo: 'NORMAL',
  cantidad_asignada_un: '100',
  unidad_inventario: 'KG',
  estado: 'PENDIENTE_RECEPCION_ALMACEN',
  etiqueta_vigente: { public_id: 'label-1', estado: 'IMPRESA' },
};

const buildWork = ({
  id,
  code,
  color,
  state = 'PLANIFICADO',
  version = 1,
  mangas = [],
  sequence = 1,
}) => ({
  id,
  codigo: code,
  secuencia: sequence,
  estado: state,
  version,
  orden_fabricacion_id: `of-${id}`,
  orden_fabricacion_codigo: `OF-${String(sequence).padStart(3, '0')}`,
  corrida_fabricacion_id: `run-${id}`,
  corrida_codigo: `COR-${String(sequence).padStart(2, '0')}`,
  color,
  cantidad_objetivo_un: '100',
  cantidad_confirmada_un: '0',
  asignacion_activa: null,
  asignaciones_personal: [{
    id: `assignment-${id}`,
    trabajador_id: 8,
    trabajador: 'Ana Maquinista',
    estado: 'PREVISTA',
  }],
  mangas,
});

const greenWork = buildWork({
  id: 'work-green',
  code: 'OT-000001-TC01',
  color: 'VERDE SÓLIDO',
  mangas: [greenManga, weighedManga],
});

const blueWork = buildWork({
  id: 'work-blue',
  code: 'OT-000001-TC02',
  color: 'AZUL',
  mangas: [blueManga],
  sequence: 2,
});

const machineOt = {
  public_id: 'ot-machine-1',
  codigo_ot: 'OT-000001',
  fecha_operativa: '2026-08-10',
  maquina_id: 4,
  maquina_codigo: 'SOP-01',
  maquina: 'Sopladora 1',
  turno: 'DIA',
  estado: 'PLANIFICADA',
  version: 1,
  orden_operacion_id: null,
  maquinista_previsto_id: 8,
  corrida_fabricacion_id: null,
  trabajos_color: [greenWork, blueWork],
  mangas: [...greenWork.mangas, ...blueWork.mangas],
};

const weighingDetail = {
  manga_version: 7,
  original: {
    public_id: 'weigh-1',
    peso_bruto_kg: '10.100',
    tara_kg: '0.100',
    peso_fisico_neto_kg: '10.000',
    cantidad_confirmada: '100',
    kg_produccion_ot: '10.000',
    estado: 'VIGENTE',
  },
  vigente: {
    peso_bruto_kg: '10.100',
    tara_kg: '0.100',
    peso_fisico_neto_kg: '10.000',
    cantidad_confirmada: '100',
    kg_produccion_ot: '10.000',
  },
  anulacion: null,
  correcciones: [],
};

function UrlProbe() {
  const location = useLocation();
  return <output aria-label="URL actual">{location.pathname}{location.search}</output>;
}

function HistoryProbe() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Volver historial</button>;
}

function HistoryForwardProbe() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(1)}>Avanzar historial</button>;
}

function ContextNavigationProbe() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      data-testid="switch-work-context"
      onClick={() => navigate('/?ot=ot-machine-1&trabajo=work-blue')}
    >
      Cambiar contexto
    </button>
  );
}

describe('OT de máquina, Trabajos de color y mangas', () => {
  it('permite solicitar cierre documental KG sin conteo ni bloquear continuidad por estado global', async () => {
    const kgManga = { ...greenManga, unidad_inventario: 'KG', kg_medido: '5.000', estado: 'CONTINUIDAD_PENDIENTE' };
    const kgOt = { ...machineOt, estado: 'PAUSADA', unidad_inventario: 'KG', trabajos_color: [{ ...greenWork, estado: 'PAUSADO', mangas: [kgManga] }], mangas: [kgManga] };
    scmMocks.listarOtScm.mockResolvedValue({ items: [kgOt] });
    scmMocks.cambiarEstadoOtScm.mockResolvedValue({ ot: { ...kgOt, estado: 'CERRADA' }, kg_medido: '5.000' });
    render(<MemoryRouter initialEntries={['/?ot=ot-machine-1']}><OtMangasScm /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar OT por kg medidos' }));
    await waitFor(() => expect(scmMocks.cambiarEstadoOtScm).toHaveBeenCalledWith('ot-machine-1', 'cerrar', 1));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    scmMocks.actorId = 'actor-1';
    scmMocks.can.mockReturnValue(true);
    sessionStorage.clear();
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-1',
        codigo: 'OF-001',
        estado: 'LIBERADA',
        maquina_prevista_id: 4,
        corridas: [{
          id: 'run-1',
          codigo: 'COR-1',
          color: 'VERDE SÓLIDO',
          color_nombre: 'VERDE SÓLIDO',
          estado: 'LIBERADA',
          ciclos_objetivo: 100,
          salidas: [{ id: 'out-1', peso_unitario_snapshot_g: '1000' }],
        }],
      }],
    });
    scmMocks.obtenerPlanMangas.mockResolvedValue({
      plan: {
        revision: 1,
        lineas: [{
          id: 11,
          corrida_fabricacion_id: 'run-1',
          articulo: { nombre: 'Alcancía Pablo verde' },
          orden_operacion_salida_id: 'out-1',
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: '100',
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: '100',
        }],
      },
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [machineOt] });
    scmMocks.listarContinuidadesMangaPendientesScm.mockResolvedValue({ items: [] });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({ items: [] });
    scmMocks.solicitarMangaExtraScm.mockResolvedValue({
      solicitud: { id: 'extra-green' },
    });
    scmMocks.aprobarMangaExtraScm.mockResolvedValue({ mangas: [greenManga] });
    scmMocks.obtenerPesajeMangaScm.mockResolvedValue(weighingDetail);
    scmMocks.previsualizarCorreccionAsignacionMangaScm.mockResolvedValue({
      manga: { codigo: 'MNG-PESADA-001' },
      origen: { ot_codigo: 'OT-000001', trabajo_codigo: 'OT-000001-TC01' },
      destino: { ot_codigo: 'OT-000001', trabajo_codigo: 'OT-000001-TC02' },
      kg_referencia: '10.000',
      kg_fuente: 'PESAJE_FINAL',
      puede_aplicar: true,
      compatibilidad: [],
      bloqueos: [],
      verificaciones: [{
        campo: 'maquina_id', etiqueta: 'Máquina', origen: 4, destino: 4, coincide: true,
      }],
    });
    scmMocks.corregirAsignacionTrabajoMangaScm.mockResolvedValue({
      correccion: { id: 'corr-audit-001' },
    });
    scmMocks.anularPesajeScm.mockResolvedValue({
      manga: { estado: 'ANULADA' },
      plan: { cantidad_devuelta_un: '100' },
    });
    scmMocks.reabrirMangaScm.mockResolvedValue({
      manga: { ...weighedManga, estado: 'EN_LLENADO', version: 8 },
      pesaje_invalidado: { ...weighingDetail.original, estado: 'REABIERTO' },
    });
    scmMocks.crearOtFabricacionScm.mockResolvedValue({
      ot: { ...machineOt, public_id: 'ot-machine-2', codigo_ot: 'OT-000002' },
    });
    scmMocks.crearTrabajoColorScm.mockResolvedValue({
      trabajo_color: greenWork,
      mangas: greenWork.mangas,
    });
    scmMocks.cambiarEstadoTrabajoColorScm.mockImplementation(
      async (_id, action) => ({
        trabajo_color: {
          ...greenWork,
          estado: action === 'pausar' ? 'PAUSADO' : 'EN_EJECUCION',
        },
      }),
    );
    scmMocks.reasignarMangasTrabajoColorScm.mockResolvedValue({
      trabajo_color: greenWork,
      asignacion: { trabajador: 'Luis Relevo' },
      mangas: [greenManga],
      trabajos_impresion_reemplazo: [],
    });
    scmMocks.generarEtiquetasPrepesaje.mockResolvedValue({
      print_job_id: 'print-1', labels: [{}],
    });
  });

  const renderSubject = () => render(
    <MemoryRouter>
      <OtMangasScm />
    </MemoryRouter>,
  );

  const renderSubjectWithUrl = (initialEntries = ['/']) => render(
    <MemoryRouter initialEntries={initialEntries}>
      <OtMangasScm />
      <UrlProbe />
    </MemoryRouter>,
  );

  const openWorkCreator = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));
    return screen.findByRole('dialog', { name: 'Agregar Trabajo de color' });
  };

  it('compone la bandeja con banda de filtros, tablero y alta secundaria', async () => {
    const user = userEvent.setup();
    renderSubject();
    expect(await screen.findByTestId('plant-journeys-control-band')).toBeVisible();
    expect(screen.getByTestId('daily-machine-board')).toBeVisible();
    expect(screen.queryByText('Detalle de Máquinas')).not.toBeInTheDocument();
    const newOt = screen.getByRole('button', { name: 'Nueva OT' });
    expect(newOt).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear OT de máquina' })).not.toBeInTheDocument();
    await user.click(newOt);
    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    expect(within(dialog).getByRole('button', { name: 'Crear OT de máquina' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  it('sincroniza fecha y turno del tablero al abrir Nueva OT y cancela sin cambiar la URL', async () => {
    const user = userEvent.setup();
    renderSubjectWithUrl(['/produccion/ots-planta?fecha=2026-08-11&turno=DIA&modo=fabricacion']);
    await screen.findByTestId('daily-machine-board');

    const dateFilter = screen.getByLabelText('Fecha de jornada');
    await user.clear(dateFilter);
    await user.type(dateFilter, '2026-08-12');
    await user.click(screen.getByRole('button', { name: 'Actualizar jornadas' }));
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('fecha=2026-08-12'));

    const newOt = screen.getByRole('button', { name: 'Nueva OT' });
    const urlBefore = screen.getByLabelText('URL actual').textContent;
    await user.click(newOt);
    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    expect(within(dialog).getByLabelText('Fecha operativa')).toHaveValue('2026-08-12');
    expect(within(dialog).getByRole('combobox', { name: 'Turno' })).toHaveTextContent('Día');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva OT de máquina' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('URL actual')).toHaveTextContent(urlBefore);
    expect(document.activeElement).toBe(newOt);
  });

  it('expone la cola compacta y el documento de pesaje como artículo, no diálogo', async () => {
    renderSubject();
    const queue = await screen.findByTestId('color-work-queue');
    expect(queue).toBeVisible();
    expect(screen.getByRole('region', { name: 'Trabajo consultado' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: /Pesaje de/ })).not.toBeInTheDocument();
  });

  it('ordena la cola compacta como color, OF y código antes del estado', async () => {
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: [greenWork], mangas: greenWork.mangas }],
    });
    renderSubject();
    const queue = await screen.findByTestId('color-work-queue');
    const card = within(queue).getByRole('button', { name: 'Ver mangas de VERDE SÓLIDO' });
    const color = within(card).getByText('VERDE SÓLIDO');
    const order = within(card).getByText('OF-001');
    const code = within(card).getByText((_, node) => node?.textContent?.startsWith('OT-000001-TC01'));
    expect(color.compareDocumentPosition(order) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByText('PLANIFICADO')).toBeVisible();
  });

  it('jerarquía: separa consultar mangas del formulario para agregar trabajo', async () => {
    const user = userEvent.setup();
    renderSubject();
    await screen.findByTestId('color-work-queue');
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trabajo consultado' })).toHaveTextContent('OT-000001-TC01');
    await user.click(screen.getByRole('button', { name: 'Agregar trabajo', exact: true }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar Trabajo de color' });
    expect(within(dialog).getByText('Destino: Sopladora 1')).toBeVisible();
    const kg = await within(dialog).findByRole('textbox', { name: 'Kg teóricos a asignar' });
    fireEvent.change(kg, { target: { value: '13' } });
    await user.click(within(dialog).getByRole('button', { name: 'Volver sin agregar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Trabajo consultado' })).toHaveTextContent('OT-000001-TC01');
    await user.click(screen.getByRole('button', { name: 'Agregar trabajo', exact: true }));
    expect(screen.getByRole('textbox', { name: 'Kg teóricos a asignar' })).toHaveValue('13');
  });

  it('jerarquía: cambiar de trabajo consulta solo sus mangas sin iniciar ni crear', async () => {
    const user = userEvent.setup();
    renderSubject();
    const blue = await screen.findByRole('button', { name: 'Ver mangas de AZUL' });
    await user.click(blue);
    expect(blue).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('region', { name: 'Trabajo consultado' });
    expect(detail).toHaveTextContent('OT-000001-TC02');
    expect(within(detail).getByText('MNG-AZUL-001')).toBeVisible();
    expect(within(detail).queryByText('MNG-VERDE-001')).not.toBeInTheDocument();
    expect(scmMocks.cambiarEstadoTrabajoColorScm).not.toHaveBeenCalled();
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('jerarquía: elegir el color del alta no cambia el trabajo consultado', async () => {
    const user = userEvent.setup();
    const orders = await scmMocks.listarOrdenesFabricacionScm();
    orders.items[0].corridas.push({
      ...orders.items[0].corridas[0], id: 'run-new-blue', color: 'AZUL NUEVO',
      color_nombre: 'AZUL NUEVO', secuencia: 2,
    });
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue(orders);
    renderSubject();
    await openWorkCreator();
    await user.click(screen.getByRole('combobox', { name: 'Color a fabricar' }));
    await user.click(screen.getByRole('option', { name: /AZUL NUEVO/ }));
    await user.click(screen.getByRole('button', { name: 'Volver sin agregar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Trabajo consultado' })).toHaveTextContent('OT-000001-TC01');
    expect(screen.getByRole('button', { name: 'Ver mangas de VERDE SÓLIDO' })).toHaveAttribute('aria-pressed', 'true');
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('jerarquía: protege el envío y al confirmar consulta el trabajo devuelto', async () => {
    const user = userEvent.setup();
    let finishCreate;
    scmMocks.crearTrabajoColorScm.mockImplementationOnce(() => new Promise((resolve) => { finishCreate = resolve; }));
    renderSubject();
    await openWorkCreator();
    await user.click(await screen.findByRole('button', { name: 'Agregar a la cola de esta OT' }));
    expect(screen.getByRole('button', { name: 'Agregando trabajo…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volver sin agregar' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Agregar Trabajo de color' })).toBeVisible();
    await act(async () => { finishCreate({ trabajo_color: blueWork, mangas: blueWork.mangas }); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Trabajo consultado' })).toHaveTextContent('OT-000001-TC02');
    expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledTimes(1);
  });

  it('jerarquía: sin permiso permite consultar sin ofrecer el alta', async () => {
    scmMocks.can.mockImplementation((code) => code !== 'OT_CREAR');
    renderSubject();
    await screen.findByRole('region', { name: 'Trabajo consultado' });
    expect(screen.queryByRole('button', { name: 'Agregar trabajo', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva OT', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('consulta el tablero por fecha y turno sin ocultar máquinas', async () => {
    const user = userEvent.setup();
    renderSubject();

    await waitFor(() => expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      {
        fecha_operativa: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        turno: 'DIA',
      },
    ));

    const dateFilter = screen.getByLabelText('Fecha de jornada');
    await user.clear(dateFilter);
    await user.type(dateFilter, '2026-08-11');
    await user.click(screen.getByRole('button', { name: 'Actualizar jornadas' }));

    await waitFor(() => {
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
        undefined,
        'FABRICACION',
        { fecha_operativa: '2026-08-11', turno: 'DIA' },
      );
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
        undefined,
        'ENSAMBLE',
        { fecha_operativa: '2026-08-11', turno: 'DIA' },
      );
    });
  });

  it('actualiza también el catálogo de OF para mostrar órdenes recién liberadas', async () => {
    const user = userEvent.setup();
    renderSubject();

    await waitFor(() => expect(scmMocks.listarOrdenesFabricacionScm).toHaveBeenCalledTimes(1));
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValueOnce({
      items: [{
        id: 'of-2',
        codigo: 'OF-002',
        estado: 'LIBERADA',
        maquina_prevista_id: 4,
        corridas: [{
          id: 'run-2', codigo: 'COR-2', color: 'AZUL', estado: 'LIBERADA',
        }],
      }],
    });

    await user.click(screen.getByRole('button', { name: 'Actualizar', exact: true }));

    await waitFor(() => expect(scmMocks.listarOrdenesFabricacionScm).toHaveBeenCalledTimes(2));
    await openWorkCreator();
    expect(await screen.findByRole('combobox', { name: 'Orden de fabricación' }))
      .toHaveValue('OF-002');
  });

  it('explica el estado vacío cuando los filtros no encuentran jornadas', async () => {
    scmMocks.listarOtScm.mockResolvedValueOnce({ items: [] });
    renderSubject();

    expect(await screen.findByText(
      /No hay OT para la fecha y turno seleccionados/i,
    )).toBeVisible();
    expect(screen.queryByLabelText('OT de máquina')).not.toBeInTheDocument();
  });

  it('crea una cabecera OT de máquina sin OF ni objetivo de fabricación', async () => {
    const user = userEvent.setup();
    renderSubjectWithUrl();

    await user.click(await screen.findByRole('button', { name: 'Nueva OT' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva OT de máquina' }))
      .getByRole('combobox', { name: 'Máquina' }));
    await user.click(screen.getByRole('option', { name: /SOP-01/ }));

    await user.click(await screen.findByRole('button', {
      name: 'Crear OT de máquina',
    }));

    expect(scmMocks.crearOtFabricacionScm).not.toHaveBeenCalled();
    const review = await screen.findByRole('dialog', { name: 'Revisar nueva OT' });
    expect(within(review).getByText(/SOP-01/)).toBeVisible();
    await user.click(within(review).getByRole('button', { name: 'Volver' }));
    expect(scmMocks.crearOtFabricacionScm).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Crear OT de máquina' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar creación' }));
    await waitFor(() => expect(scmMocks.crearOtFabricacionScm).toHaveBeenCalledTimes(1));
    const payload = scmMocks.crearOtFabricacionScm.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      maquina_id: 4,
      turno: 'DIA',
    }));
    expect(payload).not.toHaveProperty('orden_fabricacion_id');
    expect(payload).not.toHaveProperty('corrida_fabricacion_id');
    expect(payload).not.toHaveProperty('color');
    expect(payload).not.toHaveProperty('asignaciones');
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent(
      '/produccion/ots-planta/trabajo?fecha=',
    ));
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('ot=ot-machine-2');
  });

  it('conserva el éxito de crear OT aunque falle la actualización posterior', async () => {
    const user = userEvent.setup();
    renderSubject();
    await waitFor(() => expect(scmMocks.listarOtScm).toHaveBeenCalledTimes(2));
    scmMocks.listarOtScm.mockRejectedValue(new Error('refresh caído'));
    await user.click(await screen.findByRole('button', { name: 'Nueva OT' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva OT de máquina' }))
      .getByRole('combobox', { name: 'Máquina' }));
    await user.click(screen.getByRole('option', { name: /SOP-01/ }));
    await user.click(await screen.findByRole('button', { name: 'Crear OT de máquina' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar creación' }));
    await waitFor(() => expect(scmMocks.crearOtFabricacionScm).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(
      /OT-000002 creada como jornada de máquina.*Aplicado, pero no actualizado.*no reenvíes la acción/i,
    )).toBeVisible();
    expect(screen.queryByText(/No se pudo crear la OT de máquina/i)).not.toBeInTheDocument();
  });

  it('ofrece maquinistas activos con la proyección operativa limitada por permisos', async () => {
    getTrabajadores.mockResolvedValueOnce([{
      id: 7,
      codigo: 'TRB-000007',
      nombre_completo: 'Jair Casa Blanca',
      activo: true,
    }]);

    renderSubject();

    await waitFor(() => expect(getTrabajadores).toHaveBeenCalledWith({
      rol: 'MAQUINISTA',
      activo: true,
    }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await userEvent.click(within(reliefDialog).getByRole('combobox', { name: 'Nuevo maquinista' }));
    expect(await screen.findByRole('option', { name: 'Jair Casa Blanca' })).toBeInTheDocument();
  });

  it('muestra dos Trabajos de color como cola dentro de una sola OT', async () => {
    renderSubject();

    const queue = await screen.findByTestId('color-work-queue');
    expect(within(queue).getByText('VERDE SÓLIDO')).toBeVisible();
    expect(within(queue).getByText('AZUL')).toBeVisible();
    expect(within(queue).getByText(/OF-001/)).toBeVisible();
    expect(within(queue).getByText(/OF-002/)).toBeVisible();
    expect(screen.getByText(/2 trabajos de color/i)).toBeVisible();
  });

  it('agrega un Trabajo de color a la OT seleccionada usando el plan de su OF', async () => {
    const user = userEvent.setup();
    renderSubject();
    await openWorkCreator();

    await screen.findByText('Manga 100');
    await user.click(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    }));

    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      'ot-machine-1',
      {
        corrida_fabricacion_id: 'run-1',
        maquinista_id: 8,
        asignaciones: [{ plan_linea_id: 11, cantidad_un: 100 }],
        continuidad_manga_ids: [],
      },
    ));
  });

  it('bloquea el alta mientras la búsqueda de OF sigue sin confirmar', async () => {
    const user = userEvent.setup();
    renderSubject();
    await openWorkCreator();
    await screen.findByText('Manga 100');
    const orderSearch = screen.getByRole('combobox', { name: 'Orden de fabricación' });
    await user.click(orderSearch);
    await user.keyboard('{Control>}a{/Control}OF-INEXISTENTE');
    expect(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    })).toBeDisabled();
    await user.tab();
    expect(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    })).toBeDisabled();
    await user.click(orderSearch);
    await user.keyboard('{Control>}a{/Control}OF-001');
    await screen.findByRole('option', { name: /OF-001/ });
    await user.keyboard('{ArrowDown}{Enter}');
    await screen.findByText('Manga 100');
    expect(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    })).toBeEnabled();
    expect(screen.queryByText('Selecciona una OF de los resultados para confirmar la búsqueda'))
      .not.toBeInTheDocument();
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('muestra el motivo de bloqueo junto al CTA cuando la búsqueda no está confirmada', async () => {
    const user = userEvent.setup();
    renderSubject();
    await openWorkCreator();
    await screen.findByText('Manga 100');
    const orderSearch = screen.getByRole('combobox', { name: 'Orden de fabricación' });
    await user.click(orderSearch);
    await user.keyboard('{Control>}a{/Control}OF-INEXISTENTE');

    expect(screen.getByTestId('color-work-block-reason'))
      .toHaveTextContent('Selecciona una OF de los resultados para confirmar la búsqueda');
  });

  it('busca la OF por su ID canónico además de nombre y código', async () => {
    const user = userEvent.setup();
    const orders = await scmMocks.listarOrdenesFabricacionScm();
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        ...orders.items[0],
        id: 'of-canonical-5176',
        molde: { codigo: 'M-01', nombre: 'Molde de prueba' },
      }],
    });
    renderSubject();
    await openWorkCreator();
    const orderSearch = screen.getByRole('combobox', { name: 'Orden de fabricación' });
    await user.click(orderSearch);
    await user.clear(orderSearch);
    await user.type(orderSearch, 'of-canonical-5176');
    await user.click(await screen.findByRole('option', { name: /Molde de prueba/ }));

    expect(orderSearch).toHaveValue('Molde de prueba · OF-001');
    expect(screen.getByRole('link', { name: 'Ver OF' })).toHaveAttribute(
      'href', '/produccion/ordenes-fabricacion?of=of-canonical-5176',
    );
  });

  it('prioriza el nombre real de la máquina y deja el código como dato secundario', async () => {
    scmMocks.listarOtScm.mockResolvedValue({ items: [{
      ...machineOt,
      maquina_nombre: 'Prensa de inyección real',
      maquina_codigo: 'PR-01',
    }] });
    renderSubject();
    await openWorkCreator();

    const dialog = screen.getByRole('dialog', { name: 'Agregar Trabajo de color' });
    expect(within(dialog).getByText('Destino: Prensa de inyección real')).toBeVisible();
    expect(within(dialog).getByText(/OT OT-000001 · código PR-01/)).toBeVisible();
  });

  it('explica cuando la propuesta no tiene salidas para el color seleccionado', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPlanMangas.mockResolvedValueOnce({
      plan: {
        revision: 1,
        lineas: [{
          id: 11,
          corrida_fabricacion_id: 'run-otra',
          articulo: { nombre: 'Alcancía Pablo verde' },
          orden_operacion_salida_id: 'out-1',
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: '100',
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: '0',
        }],
      },
    });
    renderSubject();
    await openWorkCreator();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La propuesta no tiene salidas para este color.',
    );
    expect(screen.getByTestId('color-work-block-reason'))
      .toHaveTextContent('La propuesta no tiene salidas para este color.');
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Volver sin agregar' }));
  });

  it('hereda el maquinista de la OT aunque no sea el primero del catálogo', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [{ ...machineOt, maquinista_previsto_id: 9 }] });
    renderSubject();
    await openWorkCreator();
    await screen.findByText('Manga 100');
    const summary = screen.getByTestId('work-initial-worker');
    expect(within(summary).getByText('Maquinista: Luis Relevo')).toBeVisible();
    expect(within(summary).getByText('Tomado de la OT')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Maquinista inicial' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' }));
    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      machineOt.public_id, expect.objectContaining({ maquinista_id: 9 }),
    ));
  });

  it('cambia el maquinista solo para este trabajo y permite volver al de la OT', async () => {
    const user = userEvent.setup();
    renderSubject();
    await openWorkCreator();
    await user.click(await screen.findByRole('button', { name: 'Cambiar para este trabajo' }));
    await user.click(screen.getByRole('combobox', { name: 'Maquinista inicial' }));
    await user.click(screen.getByRole('option', { name: 'Luis Relevo' }));
    await user.click(screen.getByRole('button', { name: 'Usar maquinista de la OT' }));
    expect(within(screen.getByTestId('work-initial-worker')).getByText('Maquinista: Ana Maquinista')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cambiar para este trabajo' }));
    await user.click(screen.getByRole('combobox', { name: 'Maquinista inicial' }));
    await user.click(screen.getByRole('option', { name: 'Luis Relevo' }));
    await user.click(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' }));
    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      machineOt.public_id, expect.objectContaining({ maquinista_id: 9 }),
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openWorkCreator();
    expect(within(screen.getByTestId('work-initial-worker')).getByText('Maquinista: Ana Maquinista')).toBeVisible();
    expect(machineOt.maquinista_previsto_id).toBe(8);
  });

  it.each([null, 999])('exige elegir maquinista cuando el predeterminado %s no está disponible', async (workerId) => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [{ ...machineOt, maquinista_previsto_id: workerId }] });
    renderSubject();
    await openWorkCreator();
    const select = await screen.findByRole('combobox', { name: 'Maquinista inicial' });
    expect(select).not.toHaveTextContent('Ana Maquinista');
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    await user.click(select);
    await user.click(screen.getByRole('option', { name: 'Luis Relevo' }));
    await screen.findByText('Manga 100');
    await user.click(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' }));
    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      machineOt.public_id, expect.objectContaining({ maquinista_id: 9 }),
    ));
  });

  it('descarta la elección manual al cambiar de OT', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [machineOt, {
      ...machineOt, public_id: 'ot-other', codigo_ot: 'OT-000002', maquinista_previsto_id: 9,
    }] });
    renderSubject();
    await openWorkCreator();
    await user.click(await screen.findByRole('button', { name: 'Cambiar para este trabajo' }));
    await user.click(screen.getByRole('button', { name: 'Volver sin agregar' }));
    await user.click(await screen.findByRole('combobox', { name: 'OT de máquina' }));
    await user.click(screen.getByRole('option', { name: /OT-000002/ }));
    await openWorkCreator();
    expect(within(screen.getByTestId('work-initial-worker')).getByText('Maquinista: Luis Relevo')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver sin agregar' }));
    await user.click(await screen.findByRole('combobox', { name: 'OT de máquina' }));
    await user.click(screen.getByRole('option', { name: /OT-000001/ }));
    await openWorkCreator();
    expect(within(screen.getByTestId('work-initial-worker')).getByText('Maquinista: Ana Maquinista')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Maquinista inicial' })).not.toBeInTheDocument();
  });

  it('conserva el maquinista elegido si falla el alta del trabajo', async () => {
    const user = userEvent.setup();
    scmMocks.crearTrabajoColorScm.mockRejectedValueOnce(new Error('Sin conexión'));
    renderSubject();
    await openWorkCreator();
    await user.click(await screen.findByRole('button', { name: 'Cambiar para este trabajo' }));
    await user.click(screen.getByRole('combobox', { name: 'Maquinista inicial' }));
    await user.click(screen.getByRole('option', { name: 'Luis Relevo' }));
    await user.click(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' }));
    await screen.findByText('No se pudo agregar el Trabajo de color.');
    expect(within(screen.getByRole('dialog', { name: 'Agregar Trabajo de color' }))
      .getByRole('alert')).toHaveTextContent('No se pudo agregar el Trabajo de color.');
    expect(screen.getByRole('combobox', { name: 'Maquinista inicial' })).toHaveTextContent('Luis Relevo');
  });

  it('vincula una manga abierta con el mismo QR aunque el saldo nuevo sea cero', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPlanMangas.mockResolvedValueOnce({
      plan: {
        revision: 1,
        lineas: [{
          id: 11,
          corrida_fabricacion_id: 'run-1',
          articulo: { nombre: 'Alcancía Pablo verde' },
          orden_operacion_salida_id: 'out-1',
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: '100',
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: '0',
        }],
      },
    });
    scmMocks.listarContinuidadesMangaPendientesScm.mockResolvedValueOnce({
      items: [{
        manga: {
          public_id: 'manga-open-k1',
          codigo: 'MNG-ABIERTA-K1',
          cantidad_asignada_un: '50',
        },
        origen: {
          ot_codigo: 'OT-000000',
          turno: 'DIA',
          maquinista: 'José Quispe',
        },
        control_frontera: { peso_neto_kg: '2.000' },
        conteo_acumulado_un: '20',
        cantidad_pendiente_un: '30',
      }],
    });
    renderSubject();

    await openWorkCreator();
    expect(await screen.findByText('Mangas abiertas del turno anterior')).toBeVisible();
    const continuity = screen.getByRole('checkbox', {
      name: 'Continuar MNG-ABIERTA-K1 en esta OT',
    });
    expect(continuity).toBeChecked();
    expect(screen.getByText(/MNG-ABIERTA-K1 · 20\/50 un · faltan 30/)).toBeVisible();
    expect(scmMocks.listarContinuidadesMangaPendientesScm).toHaveBeenCalledWith(
      'ot-machine-1', 'run-1',
    );

    await user.click(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    }));

    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      'ot-machine-1',
      {
        corrida_fabricacion_id: 'run-1',
        maquinista_id: 8,
        asignaciones: [],
        continuidad_manga_ids: ['manga-open-k1'],
      },
    ));
  });

  it('explica la ausencia de plan y calcula la primera propuesta antes de agregar', async () => {
    const user = userEvent.setup();
    const readyPlan = await scmMocks.obtenerPlanMangas();
    scmMocks.obtenerPlanMangas.mockResolvedValue({ plan: null });
    scmMocks.recalcularPlanMangas.mockResolvedValueOnce(readyPlan);
    renderSubject();
    await openWorkCreator();
    expect(await screen.findByText('Esta OF aún no tiene un plan de mangas.')).toBeVisible();
    const add = screen.getByRole('button', { name: 'Agregar a la cola de esta OT' });
    expect(add).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Recalcular propuesta' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver OF' })).toHaveAttribute('href', '/produccion/ordenes-fabricacion?of=of-1');
    await user.click(screen.getByRole('button', { name: 'Calcular propuesta de mangas' }));
    expect(await screen.findByText('Mangas propuestas para la OF')).toBeVisible();
    expect(screen.getByText('Capacidad por manga')).toBeVisible();
    expect(screen.getByText('Pendiente de asignar')).toBeVisible();
    expect(screen.getByText(/Son unidades de planificación/)).toBeVisible();
    expect(add).toBeEnabled();
    expect(scmMocks.recalcularPlanMangas).toHaveBeenCalledWith('of-1');
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('distingue un error de consulta de la ausencia de plan y permite reintentar', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPlanMangas.mockRejectedValueOnce(new Error('Sin conexión'));
    renderSubject();
    await openWorkCreator();
    expect(await screen.findByText('No se pudo consultar la propuesta de mangas.')).toBeVisible();
    expect(screen.queryByText('Esta OF aún no tiene un plan de mangas.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calcular propuesta de mangas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(await screen.findByText('Mangas propuestas para la OF')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeEnabled();
  });

  it.each(['0', '-1', '101', '1.5'])('no agrega un trabajo con cantidad inválida %s', async (value) => {
    renderSubject();
    await openWorkCreator();
    const quantity = await screen.findByRole('textbox', { name: 'Kg teóricos a asignar' });
    fireEvent.change(quantity, { target: { value } });
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    expect(scmMocks.crearTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('sin permiso de cálculo explica cómo preparar la propuesta', async () => {
    scmMocks.can.mockImplementation((code) => code !== 'PLAN_MANGA_ADMINISTRAR');
    scmMocks.obtenerPlanMangas.mockResolvedValue({ plan: null });
    renderSubject();
    await openWorkCreator();
    expect(await screen.findByText('Esta OF aún no tiene un plan de mangas.')).toBeVisible();
    expect(screen.getByText(/solicita apoyo a una persona autorizada/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Calcular propuesta de mangas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
  });

  it('bloquea durante carga e ignora la propuesta tardía de otra OF', async () => {
    const user = userEvent.setup();
    const readyPlan = await scmMocks.obtenerPlanMangas();
    const orders = await scmMocks.listarOrdenesFabricacionScm();
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({ items: [
      ...orders.items,
      { ...orders.items[0], id: 'of-2', codigo: 'OF-002', corridas: [{
        ...orders.items[0].corridas[0], id: 'run-2',
      }] },
    ] });
    let finishOld;
    const oldRequest = new Promise((resolve) => { finishOld = resolve; });
    scmMocks.obtenerPlanMangas.mockImplementation((id) => (
      id === 'of-1' ? oldRequest : Promise.resolve({ plan: null })
    ));
    renderSubject();
    await openWorkCreator();
    expect(await screen.findByText('Preparando propuesta de mangas…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Orden de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'OF-002', exact: true }));
    expect(await screen.findByText('Esta OF aún no tiene un plan de mangas.')).toBeVisible();
    await act(async () => { finishOld(readyPlan); await oldRequest; });
    expect(screen.queryByText('Manga 100')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver OF' })).toHaveAttribute('href', '/produccion/ordenes-fabricacion?of=of-2');
  });

  it('asigna kg con elección discreta explícita y aviso parcial no bloqueante', async () => {
    const user = userEvent.setup();
    const orders = await scmMocks.listarOrdenesFabricacionScm();
    orders.items[0].corridas[0].salidas = [{ id: 'out-kg', peso_unitario_snapshot_g: '240.0000' }];
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue(orders);
    const plan = await scmMocks.obtenerPlanMangas();
    plan.plan.lineas[0] = { ...plan.plan.lineas[0], orden_operacion_salida_id: 'out-kg', capacidad_efectiva_un: 50, mangas_propuestas: 2 };
    scmMocks.obtenerPlanMangas.mockResolvedValue(plan);
    renderSubject();
    await openWorkCreator();
    const input = await screen.findByRole('textbox', { name: 'Kg teóricos a asignar' });
    await user.clear(input);
    await user.type(input, '13');
    const add = screen.getByRole('button', { name: 'Agregar a la cola de esta OT' });
    expect(add).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Usar 12,96 kg · 54 un' }));
    expect(screen.getByText(/Última manga parcial: 0,96 kg/)).toBeVisible();
    expect(add).toBeEnabled();
    fireEvent.change(input, { target: { value: '13.01' } });
    expect(add).toBeDisabled();
    fireEvent.change(input, { target: { value: '13' } });
    await user.click(screen.getByRole('button', { name: 'Usar 12,96 kg · 54 un' }));
    await user.click(add);
    await waitFor(() => expect(scmMocks.crearTrabajoColorScm).toHaveBeenCalledWith(
      'ot-machine-1', expect.objectContaining({ asignaciones: [{ plan_linea_id: 11, cantidad_un: 54 }] }),
    ));
  });

  it('explica el maestro de empaque faltante y enlaza el artículo exacto', async () => {
    const user = userEvent.setup();
    scmMocks.recalcularPlanMangas.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            code: 'PACKAGING_RULE_MISSING',
            message: 'PC-DEMO-AP-CARNE requiere un perfil de empaque.',
            details: {
              articulo: {
                id: 1,
                codigo: 'PC-DEMO-AP-CARNE',
                nombre: 'Alcancía Pablo Grande CARNE SÓLIDO',
                clase: 'PIEZA_COLOR',
              },
              perfiles: {
                asignados: 0,
                activos: 0,
                predeterminados_activos: 0,
              },
              reglas: {
                manga_aprobadas_para_perfiles_activos: 0,
                manga_aprobadas_para_predeterminado: 0,
              },
              accion: {
                etiqueta: 'Revisar empaque de PC-DEMO-AP-CARNE',
                ruta: '/datos-maestros/ingenieria-scm?tab=empaque&articulo=1',
                requiere_validacion_fisica: true,
              },
            },
          },
        },
      },
    });
    renderSubject();

    await openWorkCreator();
    await user.click(screen.getByText('Herramientas de propuesta'));
    await user.click(await screen.findByRole('button', {
      name: 'Recalcular propuesta',
    }));

    expect(await screen.findByRole('heading', {
      name: /Falta validar el empaque de PC-DEMO-AP-CARNE/i,
    })).toBeVisible();
    expect(screen.getByText(/0 perfiles asignados.*0 activos.*0 predeterminados/i))
      .toBeVisible();
    expect(screen.getByText(/0 reglas MANGA aprobadas/i)).toBeVisible();
    expect(screen.getByText(/supervisor.*validar físicamente/i)).toBeVisible();
    expect(screen.getByRole('link', {
      name: 'Revisar empaque de PC-DEMO-AP-CARNE',
    })).toHaveAttribute(
      'href',
      '/datos-maestros/ingenieria-scm?tab=empaque&articulo=1',
    );
  });

  it('solicita, lista y aprueba manga EXTRA sin mezclar Trabajos de color', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPlanMangas.mockResolvedValue({
      plan: {
        revision: 1,
        lineas: [{
          id: 11,
          corrida_fabricacion_id: 'run-work-green',
          articulo: { nombre: 'Alcancía Pablo verde' },
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: '100',
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: '100',
        }],
      },
    });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({
      items: [
        {
          id: 'extra-green',
          trabajo_color_id: 'work-green',
          estado: 'PENDIENTE',
          cantidad_solicitada_un: '50',
          motivo: 'Completar saldo verde',
        },
        {
          id: 'extra-blue',
          trabajo_color_id: 'work-blue',
          estado: 'PENDIENTE',
          cantidad_solicitada_un: '70',
          motivo: 'Completar saldo azul',
        },
      ],
    });
    renderSubject();

    expect(await screen.findByRole('combobox', { name: 'Salida de este trabajo' }))
      .toHaveAttribute('id', 'manga-plan-line');
    await user.type(await screen.findByLabelText('Cantidad (un)'), '50');
    await user.type(screen.getByLabelText('Motivo para manga EXTRA'), 'Faltante de turno');
    await user.click(screen.getByRole('button', { name: 'Solicitar EXTRA' }));

    await waitFor(() => expect(scmMocks.solicitarMangaExtraScm).toHaveBeenCalledWith(
      'ot-machine-1',
      {
        trabajo_color_id: 'work-green',
        plan_linea_id: 11,
        cantidad_un: 50,
        motivo: 'Faltante de turno',
      },
    ));
    expect(await screen.findByText(/Completar saldo verde/)).toBeVisible();
    expect(screen.queryByText(/Completar saldo azul/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ver mangas de AZUL/i }));
    expect(await screen.findByText(/Completar saldo azul/)).toBeVisible();
    expect(screen.queryByText(/Completar saldo verde/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ver mangas de VERDE SÓLIDO/i }));
    expect(await screen.findByText(/Completar saldo verde/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Aprobar solicitud extra-green' }));
    await waitFor(() => expect(
      scmMocks.aprobarMangaExtraScm,
    ).toHaveBeenCalledWith('extra-green'));
  });

  it('inicia un Trabajo de color sin pedir su código técnico', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Iniciar este color' }));

    await waitFor(() => expect(
      scmMocks.cambiarEstadoTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', 'iniciar', 1, ''));
    expect(screen.queryByText('OT-000001-TC01')).not.toBeInTheDocument();
  });

  it('explica la exclusividad y permite pausar antes de reanudar otro color', async () => {
    const user = userEvent.setup();
    const runningGreen = { ...greenWork, estado: 'EN_EJECUCION', version: 2 };
    const pausedBlue = { ...blueWork, estado: 'PAUSADO', version: 3 };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, estado: 'EN_EJECUCION', trabajos_color: [runningGreen, pausedBlue] }],
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: /Ver mangas de AZUL/i }));
    expect(screen.getByRole('button', { name: 'Reanudar este color' })).toBeDisabled();
    expect(screen.getByText(/VERDE SÓLIDO está en ejecución/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Ver mangas de VERDE SÓLIDO/i }));
    await user.click(screen.getByRole('button', { name: 'Pausar para cambiar de color' }));
    await user.click(await screen.findByRole('button', { name: 'Pausar trabajo' }));
    await waitFor(() => expect(
      scmMocks.cambiarEstadoTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', 'pausar', 2, ''));
  });

  it('reanuda A después de una pausa sin crear otro trabajo', async () => {
    const user = userEvent.setup();
    const pausedGreen = { ...greenWork, estado: 'PAUSADO', version: 4 };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: [pausedGreen, blueWork] }],
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Reanudar este color' }));
    await waitFor(() => expect(
      scmMocks.cambiarEstadoTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', 'reanudar', 4, ''));
  });

  it('reasigna solamente el subconjunto de mangas marcado para relevo', async () => {
    const user = userEvent.setup();
    renderSubject();

    expect(await screen.findByRole('link', { name: 'Recuperar etiquetas' }))
      .toHaveAttribute('href', '/control/impresion-etiquetas');
    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    expect(within(reliefDialog).getByText(/si sales o recargas esta hoja no reenvíes/i)).toBeVisible();
    await user.click(within(reliefDialog).getByRole('button', {
      name: 'Seleccionar los 1 stickers pendientes',
    }));
    expect(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    })).toBeChecked();
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Relevar y transferir 1 sticker' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 9,
      motivo: 'Cambio de turno',
      version: 1,
      manga_ids: ['manga-green-1'],
    }));
  });

  it('cancela el borrador de relevo sin perder la selección de impresión', async () => {
    const user = userEvent.setup();
    renderSubject();

    const printCheckbox = await screen.findByRole('checkbox', {
      name: 'Imprimir manga MNG-VERDE-001',
    });
    await user.click(printCheckbox);
    await user.click(screen.getByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Borrador');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Gestionar relevo' }))
      .not.toBeInTheDocument());
    expect(printCheckbox).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Incluir MNG-VERDE-001 en el relevo' }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gestionar relevo' }));
    const reopened = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    expect(within(reopened).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    })).not.toBeChecked();
    expect(within(reopened).getByLabelText('Motivo del relevo')).toHaveValue('');
    expect(scmMocks.reasignarMangasTrabajoColorScm).not.toHaveBeenCalled();
  });

  it('conserva el error de relevo dentro del Dialog para reintentar', async () => {
    const user = userEvent.setup();
    scmMocks.reasignarMangasTrabajoColorScm.mockRejectedValueOnce(new Error('fallo temporal'));
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Reintentar');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Relevar y transferir 1 sticker' }));

    expect(await within(reliefDialog).findByText(/Resultado no confirmado.*no reenvíes el relevo automáticamente/i)).toBeVisible();
    expect(screen.getAllByText(/Resultado no confirmado.*no reenvíes el relevo automáticamente/i)).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Gestionar relevo' })).toBeVisible();
  });

  it('mantiene el lote pendiente seleccionable cuando el control vigente está seleccionado', async () => {
    const user = userEvent.setup();
    const controlledManga = {
      ...greenManga,
      public_id: 'manga-controlled-1',
      codigo: 'MNG-CONTROL-001',
      estado: 'CONTINUIDAD_PENDIENTE',
      maquinista_actual_id: 8,
      maquinista_actual: 'Ana Maquinista',
      continuidad: { cantidad_pendiente_un: '63', conteo_acumulado_un: '37' },
    };
    const workWithBothGroups = { ...greenWork, mangas: [greenManga, controlledManga] };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: [workWithBothGroups, blueWork], mangas: [greenManga, controlledManga, blueManga] }],
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-CONTROL-001 en el relevo',
    }));
    expect(within(reliefDialog).getByRole('button', {
      name: 'Seleccionar los 1 stickers pendientes',
    })).toBeVisible();
    await user.click(within(reliefDialog).getByRole('button', {
      name: 'Seleccionar los 1 stickers pendientes',
    }));
    expect(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    })).toBeChecked();
    expect(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-CONTROL-001 en el relevo',
    })).not.toBeChecked();
  });

  it('descarta la respuesta de relevo cuando cambia el Trabajo antes de resolver', async () => {
    const user = userEvent.setup();
    let resolveRelief;
    const pendingRelief = new Promise((resolve) => { resolveRelief = resolve; });
    scmMocks.reasignarMangasTrabajoColorScm.mockReturnValueOnce(pendingRelief);
    render(
      <MemoryRouter>
        <ContextNavigationProbe />
        <OtMangasScm />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Cambio de contexto');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Relevar y transferir 1 sticker' }));
    await waitFor(() => expect(scmMocks.reasignarMangasTrabajoColorScm).toHaveBeenCalled());
    const listCallsBeforeResolve = scmMocks.listarOtScm.mock.calls.length;

    fireEvent.click(document.querySelector('[data-testid="switch-work-context"]'));
    expect(await screen.findByText('Mangas de AZUL')).toBeVisible();
    await act(async () => {
      resolveRelief({
        trabajo_color: greenWork,
        asignacion: { trabajador: 'Luis Relevo' },
        mangas: [greenManga],
        trabajos_impresion_reemplazo: [
          { print_job_id: 'stale-print-job', labels: [{}] },
          { print_job_id: 'stale-print-job', labels: [{}] },
          { print_job_id: 'stale-print-job-2', labels: [{}] },
        ],
      });
      await pendingRelief;
    });

    await waitFor(() => expect(scmMocks.listarOtScm).toHaveBeenCalledTimes(listCallsBeforeResolve));
    const recovery = screen.getByTestId('relief-recovery-alert');
    expect(recovery).toHaveTextContent(/OT-000001.*OT-000001-TC01/);
    expect(recovery).toHaveTextContent('stale-print-job, stale-print-job-2');
    expect(recovery).not.toHaveTextContent('stale-print-job, stale-print-job,');
    expect(within(recovery).getByText('Recuperar etiquetas en cola central'))
      .toHaveAttribute('href', '/control/impresion-etiquetas');
    expect(screen.queryByText(/Luis Relevo quedó como responsable/i)).not.toBeInTheDocument();
  });

  it('descarta la respuesta de relevo cuando cambia el actor antes de resolver', async () => {
    const user = userEvent.setup();
    let resolveRelief;
    const pendingRelief = new Promise((resolve) => { resolveRelief = resolve; });
    scmMocks.reasignarMangasTrabajoColorScm.mockReturnValueOnce(pendingRelief);
    const view = renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Cambio de actor');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Relevar y transferir 1 sticker' }));
    await waitFor(() => expect(scmMocks.reasignarMangasTrabajoColorScm).toHaveBeenCalled());

    scmMocks.actorId = 'actor-2';
    view.rerender(
      <MemoryRouter>
        <OtMangasScm />
      </MemoryRouter>,
    );
    await act(async () => {
      resolveRelief({
        trabajo_color: greenWork,
        asignacion: { trabajador: 'Luis Relevo' },
        mangas: [greenManga],
        trabajos_impresion_reemplazo: [{ print_job_id: 'other-actor-job', labels: [{}] }],
      });
      await pendingRelief;
    });

    await waitFor(() => expect(screen.queryByText(/Luis Relevo quedó como responsable/i))
      .not.toBeInTheDocument());
    expect(screen.queryByTestId('relief-recovery-alert')).not.toBeInTheDocument();
  });

  it('no libera busy ajeno cuando cambia de Trabajo sin un relevo activo', async () => {
    const user = userEvent.setup();
    let resolveTransition;
    const pendingTransition = new Promise((resolve) => { resolveTransition = resolve; });
    scmMocks.cambiarEstadoTrabajoColorScm.mockReturnValueOnce(pendingTransition);
    render(
      <MemoryRouter>
        <ContextNavigationProbe />
        <OtMangasScm />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Iniciar este color' }));
    await waitFor(() => expect(scmMocks.cambiarEstadoTrabajoColorScm).toHaveBeenCalled());
    fireEvent.click(document.querySelector('[data-testid="switch-work-context"]'));
    expect(await screen.findByText('Mangas de AZUL')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Iniciar este color' })).toBeDisabled();

    await act(async () => {
      resolveTransition({ trabajo_color: { ...blueWork, estado: 'EN_EJECUCION' } });
      await pendingTransition;
    });
  });

  it('transfiere un sticker preimpreso solo tras confirmar que la manga está vacía', async () => {
    const user = userEvent.setup();
    const openManga = {
      ...greenManga,
      estado: 'PREETIQUETADA',
      etiqueta_vigente: { public_id: 'label-open', estado: 'IMPRESA' },
    };
    const workWithOpenManga = { ...greenWork, mangas: [openManga, weighedManga] };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: [workWithOpenManga, blueWork] }],
    });
    scmMocks.reasignarMangasTrabajoColorScm.mockResolvedValueOnce({
      trabajo_color: workWithOpenManga,
      asignacion: { trabajador: 'Luis Relevo' },
      mangas: [openManga],
      trabajos_impresion_reemplazo: [
        { print_job_id: 'print-relevo-1', labels: [{ public_id: 'label-new-1' }] },
        {
          print_job_id: 'print-relevo-2',
          labels: [{ public_id: 'label-new-2' }, { public_id: 'label-new-3' }],
        },
      ],
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Confirmo que estas mangas están vacías y sus stickers no fueron utilizados',
    }));
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Relevar y transferir 1 sticker' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 9,
      motivo: 'Cambio de turno',
      version: 1,
      manga_ids: ['manga-green-1'],
      confirmacion_stickers_vacios: true,
    }));
    expect(scmMocks.anularPesajeScm).not.toHaveBeenCalled();
    expect(await screen.findByText('print-relevo-1')).toBeVisible();
    expect(screen.getByText('print-relevo-2')).toBeVisible();
    expect(screen.getByText(/1 etiqueta/)).toBeVisible();
    expect(screen.getByText(/2 etiquetas/)).toBeVisible();
    expect(screen.getByText(/Reimpresión obligatoria por relevo/i)).toBeVisible();
  });

  it('releva una manga controlada en la misma OT sin cambiar manga ni QR', async () => {
    const user = userEvent.setup();
    const controlledManga = {
      ...greenManga,
      estado: 'CONTINUIDAD_PENDIENTE',
      maquinista_actual_id: 8,
      maquinista_actual: 'Ana Maquinista',
      etiqueta_vigente: {
        public_id: 'prelabel-stable-1', tipo: 'PREPESAJE', estado: 'IMPRESA',
      },
      continuidad: {
        conteo_acumulado_un: '37',
        cantidad_pendiente_un: '63',
        ultimo_control: {
          peso_neto_kg: '3.700',
          aporte_desde_control_anterior_kg: '1.500',
        },
      },
    };
    const pausedWork = {
      ...greenWork,
      estado: 'PAUSADO',
      version: 4,
      mangas: [controlledManga, weighedManga],
      asignacion_activa: null,
      asignaciones_personal: [{
        id: 'assignment-work-green',
        trabajador_id: 8,
        trabajador: 'Ana Maquinista',
        estado: 'CERRADA',
      }],
    };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: [pausedWork, blueWork] }],
    });
    scmMocks.reasignarMangasTrabajoColorScm.mockResolvedValueOnce({
      trabajo_color: { ...pausedWork, estado: 'EN_EJECUCION', version: 5 },
      asignacion: { trabajador_id: 9, trabajador: 'Luis Relevo' },
      mangas: [{
        ...controlledManga,
        estado: 'EN_LLENADO',
        maquinista_actual_id: 9,
        maquinista_actual: 'Luis Relevo',
      }],
      trabajos_impresion_reemplazo: [],
      transferencia_manga_abierta: {
        continua_incompleta: true,
        qr_preservado: true,
        tramos_abiertos: [{ secuencia: 2, cantidad_inicio_un: '37' }],
      },
      stickers_transferidos: 0,
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.click(within(reliefDialog).getByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    expect(within(reliefDialog).getByText(/1 manga\(s\) tienen un control vigente/i)).toBeVisible();
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Salida anticipada');
    await user.click(within(reliefDialog).getByRole('button', {
      name: 'Registrar relevo · continúa incompleta',
    }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 9,
      motivo: 'Salida anticipada',
      version: 4,
      manga_ids: ['manga-green-1'],
      manga_abierta: true,
    }));
    expect(await screen.findByText(
      /Misma manga y QR; no se imprime otra preetiqueta/i,
    )).toBeVisible();
  });

  it('registra un relevo de responsabilidad sin transferir stickers', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{
        ...machineOt,
        estado: 'EN_EJECUCION',
        trabajos_color: [{ ...greenWork, estado: 'EN_EJECUCION' }, blueWork],
      }],
    });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    await user.type(within(reliefDialog).getByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Registrar relevo sin stickers' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 9,
      motivo: 'Cambio de turno',
      version: 1,
      manga_ids: [],
    }));
  });

  it('muestra por qué un trabajo no puede completarse todavía', async () => {
    const runningGreen = { ...greenWork, estado: 'EN_EJECUCION', version: 2 };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, estado: 'EN_EJECUCION', trabajos_color: [runningGreen, blueWork] }],
    });
    renderSubject();

    expect(await screen.findByText(/No se puede completar todavía: 1 manga/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Completar trabajo' })).toBeDisabled();
  });

  it('limita la selección e impresión de mangas al Trabajo de color activo', async () => {
    const user = userEvent.setup();
    renderSubject();

    const greenCheckbox = await screen.findByRole('checkbox', {
      name: 'Imprimir manga MNG-VERDE-001',
    });
    await user.click(greenCheckbox);
    expect(screen.getByRole('button', { name: 'Generar 1 preetiqueta' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Ver mangas de AZUL/i }));
    expect(screen.queryByText('MNG-VERDE-001')).not.toBeInTheDocument();
    expect(await screen.findByText('MNG-AZUL-001')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Selecciona hasta 2 mangas' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', {
      name: 'Imprimir manga MNG-AZUL-001',
    }));
    await user.click(screen.getByRole('button', { name: 'Generar 1 preetiqueta' }));
    await waitFor(() => expect(
      scmMocks.generarEtiquetasPrepesaje,
    ).toHaveBeenCalledWith(['manga-blue-1']));
  });

  it('conserva el trabajo generado y ofrece copiarlo o abrir su vista previa local', async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const firstRender = renderSubject();

    await user.click(await screen.findByRole('checkbox', {
      name: 'Imprimir manga MNG-VERDE-001',
    }));
    await user.click(screen.getByRole('button', { name: 'Generar 1 preetiqueta' }));

    expect((await screen.findAllByText(/generada y pendiente de impresión/i)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Copiar ID del trabajo' }));
    expect(clipboardWrite).toHaveBeenCalledWith('print-1');

    await user.click(screen.getByRole('button', { name: 'Abrir vista previa en estación' }));
    expect(openSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5050/?tab=scm-prelabels&job=print-1',
      '_blank',
      'noopener,noreferrer',
    );

    firstRender.unmount();
    renderSubject();
    expect((await screen.findAllByText(/generada y pendiente de impresión/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('print-1')).toBeVisible();
  });

  it('conserva la anulación controlada desde una manga del trabajo', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const annulButton = await screen.findByRole('button', {
      name: 'Anular pesaje definitivamente',
    });
    expect(annulButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Motivo de anulación'), {
      target: { value: 'Manga descartada por identificación incorrecta' },
    });
    fireEvent.change(screen.getByLabelText('Evidencia opcional'), {
      target: { value: 'INC-2026-08-10' },
    });
    await user.click(annulButton);

    await waitFor(() => expect(scmMocks.anularPesajeScm).toHaveBeenCalledWith(
      'weigh-1',
      {
        motivo: 'Manga descartada por identificación incorrecta',
        evidencia: 'INC-2026-08-10',
      },
    ));
    expect(await screen.findByText(/los QR quedaron invalidados/i)).toBeVisible();
  });

  it('ofrece corrección auditada para una manga con pesaje final', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));

    const dialog = await screen.findByTestId('manga-weighing-document');
    expect(within(dialog).getByText('Corregir OT / Trabajo de color')).toBeVisible();
    expect(within(dialog).getByText(/conserva manga, QR, pesajes y saldo KG/i)).toBeVisible();
  });

  it('no ofrece reatribución del piloto para una manga UN', async () => {
    const user = userEvent.setup();
    const unManga = { ...weighedManga, unidad_inventario: 'UN' };
    scmMocks.listarOtScm.mockResolvedValue({
      items: [{
        ...machineOt,
        trabajos_color: [{ ...greenWork, mangas: [greenManga, unManga] }, blueWork],
        mangas: [greenManga, unManga, blueManga],
      }],
    });
    renderSubject();

    await userEvent.click(await screen.findByRole('button', { name: 'Gestionar relevo' }));
    const reliefDialog = await screen.findByRole('dialog', { name: 'Gestionar relevo' });
    expect(within(reliefDialog).getByRole('combobox', { name: 'Nuevo maquinista' }))
      .toHaveAttribute('id', 'relief-worker');
    await user.click(within(reliefDialog).getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');

    expect(within(dialog).queryByText('Corregir OT / Trabajo de color')).toBeNull();
  });

  it('muestra la evidencia previa y el ID auditable con instrucción de rótulo', async () => {
    const user = userEvent.setup();
    renderSubject();
    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');

    await user.click(within(dialog).getByLabelText('Trabajo destino'));
    await user.click(await screen.findByRole('option', { name: /OT-000001-TC02.*AZUL/i }));
    await user.click(within(dialog).getByLabelText('Asignación destino'));
    await user.click(await screen.findByRole('option', { name: /Ana Maquinista.*PREVISTA/i }));
    await user.click(within(dialog).getByRole('button', {
      name: 'Revisar compatibilidad y bloqueos',
    }));

    expect(await within(dialog).findByText(/Manga\/QR: MNG-PESADA-001.*KG: 10.000/i)).toBeVisible();
    expect(within(dialog).getByRole('table', {
      name: 'Verificaciones de compatibilidad',
    })).toHaveTextContent('PASS');
    const correctionPanel = within(dialog).getByText('Corregir OT / Trabajo de color')
      .closest('.MuiPaper-root');
    await user.type(within(correctionPanel).getByLabelText('Motivo obligatorio'), 'OT elegida por error');
    await user.click(within(dialog).getByRole('button', {
      name: 'Confirmar corrección auditada',
    }));

    expect(await screen.findByText(/Corrección corr-audit-001 aplicada/i)).toBeVisible();
    expect(screen.getByText(/no continúes con el rótulo anterior/i)).toBeVisible();
  });

  it('conserva el éxito si falla la recarga posterior al comando aplicado', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockImplementation(() => (
      scmMocks.corregirAsignacionTrabajoMangaScm.mock.calls.length
        ? Promise.reject(new Error('recarga indisponible'))
        : Promise.resolve({ items: [machineOt] })
    ));
    renderSubject();
    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');
    await user.click(within(dialog).getByLabelText('Trabajo destino'));
    await user.click(await screen.findByRole('option', { name: /OT-000001-TC02.*AZUL/i }));
    await user.click(within(dialog).getByLabelText('Asignación destino'));
    await user.click(await screen.findByRole('option', { name: /Ana Maquinista.*PREVISTA/i }));
    await user.click(within(dialog).getByRole('button', {
      name: 'Revisar compatibilidad y bloqueos',
    }));
    const correctionPanel = within(dialog).getByText('Corregir OT / Trabajo de color')
      .closest('.MuiPaper-root');
    await user.type(
      within(correctionPanel).getByLabelText('Motivo obligatorio'),
      'OT elegida por error',
    );
    await user.click(within(dialog).getByRole('button', {
      name: 'Confirmar corrección auditada',
    }));

    expect(await screen.findByText(/Corrección corr-audit-001 aplicada/i)).toBeVisible();
    expect(screen.getByText(/vista quedó pendiente de actualizar/i)).toBeVisible();
    expect(screen.queryByText(/No se pudo aplicar la corrección/i)).toBeNull();
  });

  it('recarga la versión e invalida el preview ante conflicto concurrente', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPesajeMangaScm
      .mockResolvedValueOnce(weighingDetail)
      .mockResolvedValueOnce({ ...weighingDetail, manga_version: 8 });
    scmMocks.corregirAsignacionTrabajoMangaScm.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'VERSION_CONFLICT' } } },
    });
    renderSubject();
    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');
    await user.click(within(dialog).getByLabelText('Trabajo destino'));
    await user.click(await screen.findByRole('option', { name: /OT-000001-TC02.*AZUL/i }));
    await user.click(within(dialog).getByLabelText('Asignación destino'));
    await user.click(await screen.findByRole('option', { name: /Ana Maquinista.*PREVISTA/i }));
    await user.click(within(dialog).getByRole('button', {
      name: 'Revisar compatibilidad y bloqueos',
    }));
    const correctionPanel = within(dialog).getByText('Corregir OT / Trabajo de color')
      .closest('.MuiPaper-root');
    await user.type(within(correctionPanel).getByLabelText('Motivo obligatorio'), 'Conflicto esperado');
    await user.click(within(correctionPanel).getByRole('button', {
      name: 'Confirmar corrección auditada',
    }));

    expect(await screen.findByText(/recargamos su versión/i)).toBeVisible();
    expect(scmMocks.obtenerPesajeMangaScm).toHaveBeenCalledTimes(2);
    expect(within(correctionPanel).queryByText(/Compatible: confirma/i)).toBeNull();
    expect(within(correctionPanel).getByRole('button', {
      name: 'Confirmar corrección auditada',
    })).toBeDisabled();
  });

  it('ofrece corrección auditada después del primer control sin exigir cierre final', async () => {
    const user = userEvent.setup();
    const controlledManga = {
      ...greenManga,
      estado: 'EN_LLENADO',
      unidad_inventario: 'KG',
      continuidad: {
        ultimo_control: { peso_neto_kg: '3.250' },
      },
    };
    const controlledWork = { ...greenWork, mangas: [controlledManga, weighedManga] };
    scmMocks.listarOtScm.mockResolvedValue({
      items: [{
        ...machineOt,
        trabajos_color: [controlledWork, blueWork],
        mangas: [controlledManga, weighedManga, blueManga],
      }],
    });
    scmMocks.obtenerPesajeMangaScm.mockResolvedValue({
      manga_version: 4,
      estado_manga: 'EN_LLENADO',
      original: null,
      vigente: null,
      anulacion: null,
      correcciones: [],
    });
    renderSubject();

    const openButton = await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-VERDE-001',
    });
    expect(openButton).toBeEnabled();
    await user.click(openButton);

    const dialog = await screen.findByTestId('manga-weighing-document');
    expect(within(dialog).getByText(/manga abierta con control vigente de 3.250 kg/i)).toBeVisible();
    expect(within(dialog).getByText('Corregir OT / Trabajo de color')).toBeVisible();
  });

  it('reabre para continuar llenado conservando identidad, historial y línea base', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');
    const reopeningPanel = within(dialog).getByText('Reabrir manga').closest('.MuiPaper-root');
    expect(reopeningPanel).toHaveTextContent(/Conserva su ID, QR, controles/);
    expect(reopeningPanel).toHaveTextContent(/cierre anterior en el historial/);
    expect(within(dialog).getByRole('button', {
      name: 'Anular pesaje definitivamente',
    })).toBeVisible();

    const reopenButton = within(dialog).getByRole('button', {
      name: 'Reabrir manga y continuar con el mismo QR',
    });
    expect(reopenButton).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Tipo de reapertura'));
    await user.click(screen.getByRole('option', { name: 'Continuar llenado' }));
    await user.type(
      within(dialog).getByLabelText('Motivo de reapertura'),
      'Se agregaron más piezas antes de recepción',
    );
    await user.type(
      within(dialog).getByLabelText('Evidencia opcional de reapertura'),
      'UAT-M001',
    );
    await user.click(reopenButton);

    await waitFor(() => expect(scmMocks.reabrirMangaScm).toHaveBeenCalledWith(
      'manga-weighed-1',
      {
        version: 7,
        tipo_reapertura: 'CONTINUAR_LLENADO',
        motivo: 'Se agregaron más piezas antes de recepción',
        evidencia: 'UAT-M001',
      },
    ));
    expect(await screen.findByText(/reabierta para continuar llenado.*línea base/i)).toBeVisible();
    expect(screen.queryByTestId('manga-weighing-document')).not.toBeInTheDocument();
    expect(scmMocks.anularPesajeScm).not.toHaveBeenCalled();
  });

  it('reabre un cierre accidental sin convertir su NET en línea base', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    }));
    const dialog = await screen.findByTestId('manga-weighing-document');
    await user.click(within(dialog).getByLabelText('Tipo de reapertura'));
    await user.click(screen.getByRole('option', { name: 'Cierre accidental' }));
    expect(within(dialog).getByText(/NET anterior quedará solo en el historial/i))
      .toBeVisible();
    await user.type(
      within(dialog).getByLabelText('Motivo de reapertura'),
      'La lectura final correspondía a otra manga',
    );
    await user.click(within(dialog).getByRole('button', {
      name: 'Reabrir manga y continuar con el mismo QR',
    }));

    await waitFor(() => expect(scmMocks.reabrirMangaScm).toHaveBeenCalledWith(
      'manga-weighed-1',
      {
        version: 7,
        tipo_reapertura: 'CIERRE_ACCIDENTAL',
        motivo: 'La lectura final correspondía a otra manga',
        evidencia: null,
      },
    ));
    expect(await screen.findByText(/reabierta por cierre accidental.*solo en el historial/i))
      .toBeVisible();
  });

  it('mantiene una OT explícita inválida como error y no cae a la primera OT', async () => {
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-missing']}>
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('ot-identity-error')).toHaveTextContent(
      'La OT solicitada (ot-missing) no está disponible',
    );
    expect(screen.queryByRole('region', { name: 'Trabajo consultado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Detalle de OT-000001/i })).not.toBeInTheDocument();
  });

  it('persiste Trabajo y manga seleccionados en la URL documental', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UrlProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Ver mangas de AZUL' }));
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('trabajo=work-blue'));
    await user.click(screen.getByRole('button', { name: 'Ver mangas de VERDE SÓLIDO' }));
    const weighingInvoker = await screen.findByRole('button', { name: 'Ver pesaje de MNG-PESADA-001' });
    await user.click(weighingInvoker);
    const weighingDocument = await screen.findByTestId('manga-weighing-document');
    await waitFor(() => expect(document.activeElement)
      .toHaveAttribute('id', 'manga-weighing-document-title'));
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('manga=manga-weighed-1');
    await user.click(within(weighingDocument).getByRole('button', { name: 'Volver al Trabajo' }));
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Ver pesaje de MNG-PESADA-001',
    })).toHaveFocus());
  });

  it('cierra un documento abierto por URL directa y devuelve el foco al Trabajo', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green&manga=manga-weighed-1',
      ]}>
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    const weighingDocument = await screen.findByTestId('manga-weighing-document');
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ot-work-detail')).not.toBeInTheDocument();
    expect(screen.getByTestId('ot-master-detail')).toContainElement(weighingDocument);
    expect(getComputedStyle(weighingDocument).gridColumn).toBe('1/-1');
    await user.click(within(weighingDocument).getByRole('button', { name: 'Volver al Trabajo' }));
    const workRegion = await screen.findByRole('region', { name: 'Trabajo consultado' });
    expect(workRegion).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(screen.getByTestId('ot-work-detail')).toHaveFocus());
    expect(screen.queryByTestId('manga-weighing-document')).not.toBeInTheDocument();
  });

  it('cierra el documento Manga/Pesaje al retirar manga del historial', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green&manga=manga-weighed-1',
      ]} initialIndex={1}>
        <HistoryProbe />
        <UrlProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    await screen.findByTestId('manga-weighing-document');
    await user.click(screen.getByRole('button', { name: 'Volver historial' }));
    await waitFor(() => expect(screen.queryByTestId('manga-weighing-document')).not.toBeInTheDocument());
    expect(screen.getByLabelText('URL actual')).not.toHaveTextContent('manga=');
  });

  it('reintenta Manga/Pesaje tras un GET fallido al recorrer Back/Forward', async () => {
    const user = userEvent.setup();
    scmMocks.obtenerPesajeMangaScm
      .mockRejectedValueOnce(new Error('pesaje temporalmente no disponible'))
      .mockResolvedValueOnce(weighingDetail);
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green&manga=manga-weighed-1',
      ]} initialIndex={1}>
        <HistoryProbe />
        <HistoryForwardProbe />
        <UrlProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Trabajo consultado' });
    await waitFor(() => expect(scmMocks.obtenerPesajeMangaScm).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No se pudo consultar el pesaje.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver historial' }));
    await waitFor(() => expect(screen.getByLabelText('URL actual')).not.toHaveTextContent('manga='));
    await user.click(screen.getByRole('button', { name: 'Avanzar historial' }));
    expect(await screen.findByTestId('manga-weighing-document')).toBeVisible();
    expect(scmMocks.obtenerPesajeMangaScm).toHaveBeenCalledTimes(2);
  });

  it('mantiene la lista de mangas y ofrece el relevo junto al responsable', async () => {
    renderSubject();
    const list = await screen.findByTestId('manga-list-before-tools');
    expect(screen.queryByText('Herramientas de relevo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestionar relevo' })).toBeVisible();
    expect(list).toBeVisible();
  });

  it('mantiene el documento de Manga/Pesaje en el ancho completo de la hoja OT', async () => {
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
      ]}>
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    const slot = await screen.findByTestId('manga-document-slot');
    expect(getComputedStyle(slot).gridColumn).toBe('1/-1');
    expect(getComputedStyle(screen.getByTestId('ot-master-detail')).gridTemplateColumns)
      .toBe('minmax(0, 1fr)');
  });

  it('prioriza máquina y código en una cabecera compacta sin kicker repetido', async () => {
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
      ]}>
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('OT-000001');
    expect(heading).not.toHaveTextContent('Detalle de');
    expect(screen.getByText(/Sopladora 1.*2026-08-10.*turno DIA/i)).toBeVisible();
  });

  it('mantiene la cola horizontal y las acciones dentro del ancho disponible', async () => {
    const longWorks = [
      { ...greenWork, codigo: 'TRABAJO-CON-NOMBRE-LARGO-VERDE-2026', color: 'VERDE SÓLIDO CON IDENTIFICADOR OPERATIVO EXTENSO' },
      { ...blueWork, codigo: 'TRABAJO-CON-NOMBRE-LARGO-AZUL-2026', color: 'AZUL CON IDENTIFICADOR OPERATIVO EXTENSO' },
    ];
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{ ...machineOt, trabajos_color: longWorks, mangas: longWorks.flatMap((work) => work.mangas) }],
    });
    renderSubject();
    const queue = await screen.findByTestId('color-work-queue');
    expect(getComputedStyle(queue).minWidth).toBe('0px');
    expect(getComputedStyle(queue.parentElement).minWidth).toBe('0px');
    expect(getComputedStyle(queue).overflowX).toBe('auto');
    expect(screen.getByTestId('manga-list-before-tools')).toBeVisible();
  });

  it('usa tarjetas de Manga/Pesaje en viewport móvil sin tabla ancha', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({
      matches: query.includes('max-width:899px') || query.includes('max-width:599px'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    try {
      const user = userEvent.setup();
      renderSubject();
      expect(await screen.findByTestId('manga-mobile-list')).toBeVisible();
      await user.click(await screen.findByRole('button', {
        name: 'Ver pesaje de MNG-PESADA-001',
      }));
      expect(await screen.findByTestId('weighing-version-cards')).toBeVisible();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const weighingDocument = screen.getByTestId('manga-weighing-document');
      await user.click(within(weighingDocument).getByRole('combobox', { name: 'Trabajo destino' }));
      await user.click(screen.getByRole('option', { name: /OT-000001.*OT-000001-TC02/i }));
      await user.click(within(weighingDocument).getByRole('button', {
        name: 'Revisar compatibilidad y bloqueos',
      }));
      expect(await screen.findByTestId('assignment-preview-cards')).toBeVisible();
      expect(screen.queryByRole('table', { name: 'Verificaciones de compatibilidad' }))
        .not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('bloquea una consulta Manga/Pesaje directa sin MANGA_PESAJE_VER', async () => {
    scmMocks.can.mockImplementation((code) => code !== 'MANGA_PESAJE_VER');
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green&manga=manga-weighed-1',
      ]}>
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('ot-identity-error')).toHaveTextContent(
      'requiere la capacidad MANGA_PESAJE_VER',
    );
    expect(screen.queryByTestId('manga-weighing-document'))
      .not.toBeInTheDocument();
    expect(scmMocks.obtenerPesajeMangaScm).not.toHaveBeenCalled();
  });

  it('oculta ampliación para un Trabajo COMPLETADO', async () => {
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{
        ...machineOt,
        trabajos_color: [{ ...greenWork, estado: 'COMPLETADO' }, blueWork],
      }],
    });
    renderSubject();
    await screen.findByRole('region', { name: 'Trabajo consultado' });
    expect(screen.queryByText('Herramientas de ampliación')).not.toBeInTheDocument();
    expect(screen.queryByText('Mangas adicionales para este color')).not.toBeInTheDocument();
  });

  it('reemplaza el documento cuando el historial cambia de manga', async () => {
    const user = userEvent.setup();
    const blueWeighed = { ...blueManga, estado: 'PESADA' };
    scmMocks.listarOtScm.mockResolvedValueOnce({
      items: [{
        ...machineOt,
        trabajos_color: [greenWork, { ...blueWork, mangas: [blueWeighed] }],
        mangas: [...greenWork.mangas, blueWeighed],
      }],
    });
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green&manga=manga-weighed-1',
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-blue&manga=manga-blue-1',
      ]} initialIndex={1}>
        <HistoryProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('manga-weighing-document'))
      .toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver historial' }));
    expect(await screen.findByTestId('manga-weighing-document'))
      .toBeVisible();
  });

  it('resincroniza OT y Trabajo al volver en el historial del navegador', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-blue',
      ]} initialIndex={1}>
        <HistoryProbe />
        <UrlProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('region', { name: 'Trabajo consultado' }))
      .toHaveTextContent('OT-000001-TC02');
    await user.click(screen.getByRole('button', { name: 'Volver historial' }));
    await waitFor(() => expect(screen.getByLabelText('URL actual'))
      .toHaveTextContent('trabajo=work-green'));
    expect(screen.getByRole('region', { name: 'Trabajo consultado' }))
      .toHaveTextContent('OT-000001-TC01');
  });

  it('ignora una respuesta tardía de un contexto anterior al recargar una URL válida', async () => {
    const user = userEvent.setup();
    const deferred = () => {
      let resolve;
      const promise = new Promise((nextResolve) => { resolve = nextResolve; });
      return { promise, resolve };
    };
    const oldFabrication = deferred();
    const oldAssembly = deferred();
    const nextFabrication = deferred();
    const nextAssembly = deferred();
    scmMocks.listarOtScm.mockImplementation((_id, mode, query) => {
      if (query.fecha_operativa === '2026-08-10' && mode === 'FABRICACION') return oldFabrication.promise;
      if (query.fecha_operativa === '2026-08-10') return oldAssembly.promise;
      if (mode === 'FABRICACION') return nextFabrication.promise;
      return nextAssembly.promise;
    });
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
        '/produccion/ots-planta/trabajo?fecha=2026-08-11&turno=DIA&modo=fabricacion&ot=ot-machine-1&trabajo=work-green',
      ]} initialIndex={0}>
        <HistoryForwardProbe />
        <OtMangasScm view="detail" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Avanzar historial' }));
    await act(async () => {
      nextFabrication.resolve({ items: [machineOt] });
      nextAssembly.resolve({ items: [] });
    });
    expect(await screen.findByRole('region', { name: 'Trabajo consultado' }))
      .toHaveTextContent('OT-000001-TC01');
    await act(async () => {
      oldFabrication.resolve({ items: [] });
      oldAssembly.resolve({ items: [] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('region', { name: 'Trabajo consultado' }))
      .toHaveTextContent('OT-000001-TC01');
  });
});
