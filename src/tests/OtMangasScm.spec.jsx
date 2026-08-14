import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import OtMangasScm from '../components/OtMangasScm';

const scmMocks = vi.hoisted(() => ({
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  recalcularPlanMangas: vi.fn(),
  listarOtScm: vi.fn(),
  crearOtFabricacionScm: vi.fn(),
  crearTrabajoColorScm: vi.fn(),
  cambiarEstadoTrabajoColorScm: vi.fn(),
  asignarTrabajadorTrabajoColorScm: vi.fn(),
  reasignarMangasTrabajoColorScm: vi.fn(),
  agregarMangasTrabajoColorScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
  solicitarMangaExtraScm: vi.fn(),
  aprobarMangaExtraScm: vi.fn(),
  obtenerPesajeMangaScm: vi.fn(),
  anularPesajeScm: vi.fn(),
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
}));

vi.mock('../services/scmOtApi', () => ({
  agregarMangasNormalesScm: vi.fn(),
  agregarMangasTrabajoColorScm: scmMocks.agregarMangasTrabajoColorScm,
  anularMangaScm: vi.fn(),
  anularPesajeScm: scmMocks.anularPesajeScm,
  aprobarMangaExtraScm: scmMocks.aprobarMangaExtraScm,
  aprobarCorreccionPesajeScm: vi.fn(),
  asignarTrabajadorTrabajoColorScm: scmMocks.asignarTrabajadorTrabajoColorScm,
  cambiarEstadoOtScm: vi.fn(),
  cambiarEstadoTrabajoColorScm: scmMocks.cambiarEstadoTrabajoColorScm,
  crearOtFabricacionScm: scmMocks.crearOtFabricacionScm,
  crearOtScm: vi.fn(),
  crearTrabajoColorScm: scmMocks.crearTrabajoColorScm,
  generarEtiquetasPrepesaje: scmMocks.generarEtiquetasPrepesaje,
  listarOtScm: scmMocks.listarOtScm,
  listarSolicitudesMangaExtraScm: scmMocks.listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm: scmMocks.listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm: scmMocks.obtenerPesajeMangaScm,
  obtenerPlanMangas: scmMocks.obtenerPlanMangas,
  recalcularPlanMangas: scmMocks.recalcularPlanMangas,
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
    can: () => true,
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
  corrida_fabricacion_id: null,
  trabajos_color: [greenWork, blueWork],
  mangas: [...greenWork.mangas, ...blueWork.mangas],
};

const weighingDetail = {
  original: {
    public_id: 'weigh-1',
    peso_bruto_kg: '10.100',
    tara_kg: '0.100',
    peso_fisico_neto_kg: '10.000',
    cantidad_confirmada: '100',
    kg_produccion_ot: '10.000',
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

describe('OT de máquina, Trabajos de color y mangas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: '100',
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: '100',
        }],
      },
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [machineOt] });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({ items: [] });
    scmMocks.solicitarMangaExtraScm.mockResolvedValue({
      solicitud: { id: 'extra-green' },
    });
    scmMocks.aprobarMangaExtraScm.mockResolvedValue({ mangas: [greenManga] });
    scmMocks.obtenerPesajeMangaScm.mockResolvedValue(weighingDetail);
    scmMocks.anularPesajeScm.mockResolvedValue({
      manga: { estado: 'ANULADA' },
      plan: { cantidad_devuelta_un: '100' },
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

  it('explica el estado vacío cuando los filtros no encuentran jornadas', async () => {
    scmMocks.listarOtScm.mockResolvedValueOnce({ items: [] });
    renderSubject();

    expect(await screen.findByText(
      /No hay OT para la fecha y turno seleccionados/i,
    )).toBeVisible();
    expect(screen.queryByLabelText('OT de máquina')).not.toBeInTheDocument();
  });

  it('crea una cabecera OT de máquina sin OF, corrida ni color', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', {
      name: 'Crear OT de máquina',
    }));

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
      },
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

    await user.click(await screen.findByRole('button', {
      name: 'Recalcular plan de la OF',
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

    await user.click(await screen.findByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.type(screen.getByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(screen.getByRole('button', { name: 'Relevar y transferir 1 sticker' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 8,
      motivo: 'Cambio de turno',
      version: 1,
      manga_ids: ['manga-green-1'],
    }));
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

    await user.click(await screen.findByRole('checkbox', {
      name: 'Incluir MNG-VERDE-001 en el relevo',
    }));
    await user.click(screen.getByRole('checkbox', {
      name: 'Confirmo que estas mangas están vacías y sus stickers no fueron utilizados',
    }));
    expect(screen.getByText(/toda manga con contenido permanece con el maquinista saliente/i)).toBeVisible();
    await user.type(screen.getByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(screen.getByRole('button', { name: 'Relevar y transferir 1 sticker' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 8,
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

    await user.type(await screen.findByLabelText('Motivo del relevo'), 'Cambio de turno');
    await user.click(screen.getByRole('button', { name: 'Registrar relevo sin stickers' }));

    await waitFor(() => expect(
      scmMocks.reasignarMangasTrabajoColorScm,
    ).toHaveBeenCalledWith('work-green', {
      trabajador_id: 8,
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
      name: 'Seleccionar manga MNG-VERDE-001',
    });
    await user.click(greenCheckbox);
    expect(screen.getByRole('button', { name: 'Generar 1 preetiqueta' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Ver mangas de AZUL/i }));
    expect(screen.queryByText('MNG-VERDE-001')).not.toBeInTheDocument();
    expect(await screen.findByText('MNG-AZUL-001')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Selecciona hasta 2 mangas' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', {
      name: 'Seleccionar manga MNG-AZUL-001',
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
      name: 'Seleccionar manga MNG-VERDE-001',
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
});
