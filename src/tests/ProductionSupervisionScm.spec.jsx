import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductionSupervisionScm from '../components/ProductionSupervisionScm';
import {
  listarSupervisionMangasScm,
  listarSupervisionOtsScm,
  obtenerDetalleSupervisionOtScm,
  obtenerResumenSupervisionOtsScm,
} from '../services/scmProductionObservabilityApi';

let actorCapabilities;

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => actorCapabilities.has(capability),
    experience: { label: 'Gerente General' },
  }),
}));

vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarSupervisionMangasScm: vi.fn(),
  listarSupervisionOtsScm: vi.fn(),
  obtenerDetalleSupervisionOtScm: vi.fn(),
  obtenerResumenSupervisionOtsScm: vi.fn(),
}));

vi.mock('../utils/limaDate', () => ({ todayInLima: () => '2026-08-10' }));

const fabricationItem = {
  ot: {
    public_id: 'ot-fab-1', codigo: 'OT-000001', tipo: 'FABRICACION',
    estado_documental: 'LIBERADA', estado_operativo: 'EN_EJECUCION',
    fecha_operativa: '2026-08-10', turno: 'DIA', version: 3,
  },
  upstream: {
    op: { id: 'op-1', codigo: 'OP-000001', estado: 'APROBADA', fecha_necesidad: '2026-08-12' },
    orden: { id: 'of-1', codigo: 'OF-000001', tipo: 'OF', estado: 'LIBERADA' },
    ordenes: [{ id: 'of-1', codigo: 'OF-000001', tipo: 'OF', estado: 'LIBERADA' }],
    plan: { id: 'plan-1', revision: 2 },
  },
  recurso: { tipo: 'MAQUINA', id: 'maq-1', codigo: 'MAQ-01', nombre: 'Haitian 3000' },
  responsable: { id: 'worker-1', codigo: 'TR-01', nombre: 'Said Villamizar' },
  trabajo_actual: {
    id: 'work-1', codigo: 'TC-001', secuencia: 1, color: 'Carne sólido',
    estado: 'EN_EJECUCION', objetivo_un: 2400, confirmado_un: 1200,
  },
  trabajo_siguiente: { id: 'work-2', secuencia: 2, color: 'Azul', estado: 'PLANIFICADO' },
  trabajos_resumen: { total: 2, por_estado: { EN_EJECUCION: 1, PLANIFICADO: 1 } },
  cantidades_resumen: { objetivo_un: 3000, confirmado_un: 1600 },
  mangas_resumen: {
    total: 36, abiertas: 1, planificadas: 12, preetiquetadas: 2, pesadas: 20,
    pendientes_pesaje: 3, pendientes_recepcion: 1, recibidas: 17, anuladas: 0,
  },
  pesaje_resumen: { cantidad: 20, neto_kg: 48.125, ultimo_pesaje_at: '2026-08-10T14:00:00Z' },
  almacen_resumen: { pendientes_recepcion: 1, recibidas: 17, ultima_recepcion_at: '2026-08-10T14:20:00Z' },
  alertas_resumen: { abiertas: 1, criticas: 0 },
  visibilidad: { pesaje: true, alertas: true, almacen: true, calidad: true },
  etapa_actual: 'EN_EJECUCION',
  bloqueos: [],
  riesgo: { atrasada: false, horas_sin_actividad: 0.5, severidad: 'INFO' },
  ultimo_evento_at: '2026-08-10T14:20:00Z',
};

const assemblyItem = {
  ...fabricationItem,
  ot: {
    ...fabricationItem.ot,
    public_id: 'ot-arm-1', codigo: 'OT-000002', tipo: 'ARMADO',
    estado_documental: 'PLANIFICADA', estado_operativo: 'PLANIFICADA',
  },
  upstream: {
    ...fabricationItem.upstream,
    orden: { id: 'oa-1', codigo: 'OA-000001', tipo: 'OA', estado: 'LIBERADA' },
    ordenes: [{ id: 'oa-1', codigo: 'OA-000001', tipo: 'OA', estado: 'LIBERADA' }],
  },
  recurso: { tipo: 'CENTRO', id: 'ct-1', codigo: 'CT-01', nombre: 'Mesa de armado 1' },
  responsable: null,
  trabajo_actual: null,
  trabajo_siguiente: null,
  pesaje_resumen: null,
  alertas_resumen: null,
  visibilidad: { pesaje: false, alertas: false, almacen: false, calidad: false },
  etapa_actual: 'PENDIENTE_PESAJE',
  riesgo: { atrasada: true, horas_sin_actividad: 28, severidad: 'ADVERTENCIA' },
};

const listResponse = {
  items: [fabricationItem, assemblyItem],
  page: { next_cursor: 'next-2', limit: 25, has_more: true },
  as_of: '2026-08-10T14:30:00Z',
};

const mangaListResponse = {
  items: [{
    manga: {
      public_id: 'manga-1', codigo: 'MANGA-000001', tipo: 'NORMAL',
      estado_operativo: 'PENDIENTE_RECEPCION_ALMACEN',
      estado_logistico: 'PENDIENTE_RECEPCION',
      articulo: { codigo: 'PC-001', nombre: 'Alcancia carne', sku_pieza_color: 'PC-CARNE' },
      color: 'Carne solido', cantidad_objetivo_un: 67, cantidad_confirmada_un: 65,
      responsable: fabricationItem.responsable,
      etiqueta: { tipo: 'POSTPESAJE', estado: 'IMPRESA', version: 1 },
      pesaje: { peso_fisico_neto_kg: 1.825, kg_produccion_estandar: 1.75, estado: 'EFECTIVO' },
      almacen: null,
    },
    ot: fabricationItem.ot,
    recurso: fabricationItem.recurso,
    upstream: fabricationItem.upstream,
    trabajo: fabricationItem.trabajo_actual,
    visibilidad: fabricationItem.visibilidad,
    ultimo_evento_at: fabricationItem.ultimo_evento_at,
  }],
  page: { next_cursor: null, limit: 25, has_more: false },
  as_of: '2026-08-10T14:30:00Z',
};

const summaryResponse = {
  granularidad: 'DIA',
  periodo: { fecha_desde: '2026-08-10', fecha_hasta: '2026-08-10' },
  totales: {
    ots: 2,
    objetivo_un: 4800,
    confirmado_un: 1200,
    mangas_total: 72,
    mangas_pendientes_pesaje: 3,
    mangas_pendientes_recepcion: 1,
    mangas_recibidas: 17,
    peso_fisico_neto_kg: 48.125,
    kg_produccion_estandar: 46.5,
    alertas_abiertas: 1,
    por_estado_documental: { LIBERADA: 1, PLANIFICADA: 1 },
    por_estado_operativo: { EN_EJECUCION: 1, PLANIFICADA: 1 },
  },
  series: [],
  as_of: '2026-08-10T14:30:00Z',
};

const detailResponse = {
  as_of: '2026-08-10T14:30:00Z',
  item: {
    ...fabricationItem,
    trabajos: [{
      ...fabricationItem.trabajo_actual,
      mangas: [{
        public_id: 'manga-1', codigo: 'MANGA-000001',
        estado_operativo: 'CERRADA', estado_logistico: 'PENDIENTE_RECEPCION',
        cantidad_objetivo_un: 67, cantidad_confirmada_un: 65,
        responsable: fabricationItem.responsable,
        etiqueta: {
          public_id: 'etiqueta-prepesaje-1', tipo: 'PREPESAJE', estado: 'IMPRESA', version: 2,
        },
        pesaje: {
          peso_fisico_neto_kg: 1.825, kg_produccion_estandar: 1.75, estado: 'EFECTIVO',
        },
        almacen: {
          estado_logistico: 'PENDIENTE_RECEPCION', estado_calidad: 'PENDIENTE',
        },
      }],
    }],
  },
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL actual">{`${location.pathname}${location.search}`}</output>;
}

const setViewportWidth = (width) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: (() => {
      const maximum = query.match(/max-width:\s*([\d.]+)px/);
      const minimum = query.match(/min-width:\s*([\d.]+)px/);
      return (!maximum || width <= Number(maximum[1]))
        && (!minimum || width >= Number(minimum[1]));
    })(),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const renderPage = (entry = '/control/supervision-produccion') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[entry]}>
      <ProductionSupervisionScm />
      <LocationProbe />
    </MemoryRouter>
  </ThemeProvider>,
);

describe('Control > Supervisión de producción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorCapabilities = new Set([
      'OT_VER', 'OF_VER', 'OA_VER', 'MANGA_PESAJE_VER', 'ALERTA_VER',
      'RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER',
    ]);
    setViewportWidth(1440);
    listarSupervisionOtsScm.mockResolvedValue(listResponse);
    listarSupervisionMangasScm.mockResolvedValue(mangaListResponse);
    obtenerResumenSupervisionOtsScm.mockResolvedValue(summaryResponse);
    obtenerDetalleSupervisionOtScm.mockResolvedValue(detailResponse);
  });

  it('presenta KPIs y estados documental, operativo y logístico sin acciones de operación', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Supervisión de producción' })).toBeVisible();
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-running')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-units')).toHaveTextContent('1,200 / 4,800 un');
    expect(screen.getByTestId('kpi-physical-weight')).toHaveTextContent('48.125 kg');
    expect(screen.getByTestId('kpi-standard-weight')).toHaveTextContent('46.500 kg');
    const row = screen.getByTestId('supervision-row-ot-fab-1');
    expect(within(row).getByText('OT-000001')).toBeVisible();
    expect(within(row).getByText(/Documental: LIBERADA/i)).toBeVisible();
    expect(within(row).getByText(/Operativo: EN EJECUCION/i)).toBeVisible();
    expect(within(row).getByText(/Avance total OT/i)).toBeVisible();
    expect(within(row).getByText(/1,600 \/ 3,000 un/i)).toBeVisible();
    expect(within(row).getByText(/Actual: Carne sólido/i)).toBeVisible();
    expect(within(row).getByText(/48\.125 kg físicos/i)).toBeVisible();
    expect(screen.getByText(/Datos al/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /crear|iniciar|anular|corregir/i })).not.toBeInTheDocument();
  });

  it('ofrece modo Mangas con busqueda por codigo y trazabilidad a su OT', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Mangas' }));

    await waitFor(() => expect(listarSupervisionMangasScm).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Mangas' })).toBeVisible();
    const row = await screen.findByTestId('supervision-manga-manga-1');
    expect(within(row).getByText('MANGA-000001')).toBeVisible();
    expect(within(row).getByText(/PC-001.*Alcancia carne/i)).toBeVisible();
    expect(within(row).getByText(/OT-000001/i)).toBeVisible();
    expect(within(row).getByText(/1\.825 kg fisicos/i)).toBeVisible();

    const search = screen.getByRole('textbox', { name: /Omnib/i });
    await user.clear(search);
    await user.type(search, 'MANGA-000001');
    await waitFor(() => expect(listarSupervisionMangasScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'MANGA-000001' }),
    ));

    await user.click(within(row).getByRole('button', { name: /Ver trazabilidad/i }));
    await waitFor(() => expect(obtenerDetalleSupervisionOtScm).toHaveBeenCalledWith(
      'ot-fab-1', expect.any(Object),
    ));
  });

  it('hidrata filtros desde URL, los envía al servidor y persiste quick filters', async () => {
    const user = userEvent.setup();
    renderPage('/control/supervision-produccion?rango=PERSONALIZADO&desde=2026-08-01&hasta=2026-08-10&tipo=ARMADO&turno=NOCHE&q=alcancia&quick=ATRASADAS');

    await waitFor(() => expect(listarSupervisionOtsScm).toHaveBeenCalledWith(expect.objectContaining({
      desde: '2026-08-01',
      hasta: '2026-08-10',
      tipo: 'ARMADO',

      turno: 'NOCHE',
      q: 'alcancia',
      quick: 'ATRASADAS',
    })));

    await user.click(screen.getByRole('button', { name: 'En ejecución' }));
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('quick=EN_EJECUCION'));
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('desde=2026-08-01');
  });

  it('aplica la omnibúsqueda tras 300 ms sin consultar por cada tecla', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');
    const callsBeforeTyping = listarSupervisionOtsScm.mock.calls.length;

    await user.type(screen.getByRole('textbox', { name: 'Omnibúsqueda' }), 'OT-9');
    expect(listarSupervisionOtsScm).toHaveBeenCalledTimes(callsBeforeTyping);

    await waitFor(() => expect(listarSupervisionOtsScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'OT-9' }),
    ));
    expect(listarSupervisionOtsScm).toHaveBeenCalledTimes(callsBeforeTyping + 1);
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('q=OT-9');
  });

  it('respeta capacidades progresivas y no filtra ni revela pesajes o alertas sin permiso', async () => {
    actorCapabilities = new Set(['OT_VER']);
    renderPage();

    await screen.findByText('OT-000001');
    expect(screen.getByRole('button', { name: 'Pendientes de pesaje' })).toBeVisible();
    expect(screen.getByTestId('kpi-pending-weighing')).toHaveTextContent('3');
    expect(screen.queryByText('48.125 kg')).not.toBeInTheDocument();
    expect(screen.queryByText(/1 alerta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir OA/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Abrir jornada/i })).not.toHaveLength(0);
  });

  it('abre un detalle jerárquico y conserva links profundos sujetos a capacidades', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000001' }));

    expect(await screen.findByRole('heading', { name: 'Trazabilidad de OT-000001' })).toBeVisible();
    expect(obtenerDetalleSupervisionOtScm).toHaveBeenCalledWith('ot-fab-1', expect.any(Object));
    const dialog = screen.getByRole('dialog', { name: 'Trazabilidad de OT-000001' });
    expect(within(dialog).getByText('OP-000001')).toBeVisible();
    expect(within(dialog).getByText('OF-000001')).toBeVisible();
    expect(within(dialog).getByText('MANGA-000001')).toBeVisible();
    expect(within(dialog).getByText(/Logístico: PENDIENTE RECEPCION/i)).toBeVisible();
    expect(within(dialog).getByText(/Neto físico 1.825 kg/i)).toBeVisible();
    expect(within(dialog).getByText(/Etiqueta PREPESAJE · v2 · IMPRESA/i)).toBeVisible();
    expect(within(dialog).getByText(/Almacén: PENDIENTE RECEPCION/i)).toBeVisible();
    expect(within(dialog).getByText(/Calidad: PENDIENTE/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir jornada de OT-000001' }))
      .toHaveAttribute('href', expect.stringContaining('/produccion/ots-planta?'));
  });

  it('expone todas las OF de una OT multicolor y marca la orden actual', async () => {
    obtenerDetalleSupervisionOtScm.mockResolvedValueOnce({
      ...detailResponse,
      item: {
        ...detailResponse.item,
        upstream: {
          ...detailResponse.item.upstream,
          orden: { id: 'of-2', codigo: 'OF-000002', tipo: 'OF', estado: 'LIBERADA' },
          ordenes: [
            { id: 'of-1', codigo: 'OF-000001', tipo: 'OF', estado: 'COMPLETADA' },
            { id: 'of-2', codigo: 'OF-000002', tipo: 'OF', estado: 'LIBERADA' },
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000001' }));

    const orders = await screen.findByTestId('detail-upstream-orders');
    expect(within(orders).getByText('OF-000001')).toBeVisible();
    expect(within(orders).getByText('OF-000002')).toBeVisible();
    expect(within(orders).getByText('Actual')).toBeVisible();
  });

  it('separa permisos de recepción y calidad en el detalle de almacén', async () => {
    actorCapabilities = new Set(['OT_VER', 'RECEPCION_MANGA_VER']);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000001' }));

    const dialog = await screen.findByRole('dialog', { name: 'Trazabilidad de OT-000001' });
    expect(within(dialog).getByText(/Almacén: PENDIENTE RECEPCION/i)).toBeVisible();
    expect(within(dialog).queryByText(/Calidad: PENDIENTE/i)).not.toBeInTheDocument();
  });

  it('permite consultar calidad sin revelar la recepción de almacén', async () => {
    actorCapabilities = new Set(['OT_VER', 'CALIDAD_MANGA_VER']);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000001' }));

    const dialog = await screen.findByRole('dialog', { name: 'Trazabilidad de OT-000001' });
    expect(within(dialog).getByText(/Calidad: PENDIENTE/i)).toBeVisible();
    expect(within(dialog).queryByText(/Almacén: PENDIENTE RECEPCION/i)).not.toBeInTheDocument();
  });

  it('descarta la respuesta tardía de un detalle cerrado al abrir otra OT', async () => {
    let resolveFirst;
    obtenerDetalleSupervisionOtScm
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({
        as_of: detailResponse.as_of,
        item: {
          ...assemblyItem,
          trabajos: [{
            id: 'arm-work', secuencia: 1, estado: 'PLANIFICADO', color: 'Armado',
            mangas: [{ public_id: 'arm-manga', codigo: 'MANGA-ARM-2' }],
          }],
        },
      });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000001' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    await user.click(screen.getByRole('button', { name: 'Ver detalle de OT-000002' }));
    expect(await screen.findByRole('heading', { name: 'Trazabilidad de OT-000002' })).toBeVisible();
    expect(await screen.findByText('MANGA-ARM-2')).toBeVisible();

    resolveFirst(detailResponse);
    await waitFor(() => expect(screen.queryByText('MANGA-000001')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Trazabilidad de OT-000002' })).toBeVisible();
  });

  it('usa cards a 1024 px con sidebar y conserva una acción de detalle accesible', async () => {
    setViewportWidth(1024);
    renderPage();

    expect(await screen.findByTestId('supervision-card-ot-fab-1')).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Órdenes de trabajo supervisadas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver detalle de OT-000001' })).toBeVisible();
  });

  it('pagina por cursor y permite volver sin convertirlo en número de página del servidor', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('OT-000001');

    listarSupervisionOtsScm.mockResolvedValueOnce({
      items: [{ ...fabricationItem, ot: { ...fabricationItem.ot, public_id: 'ot-3', codigo: 'OT-000003' } }],
      page: { next_cursor: null, limit: 25, has_more: false },
      as_of: '2026-08-10T14:31:00Z',
    });
    await user.click(screen.getByRole('button', { name: 'Siguiente página' }));

    await waitFor(() => expect(listarSupervisionOtsScm).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-2' })));
    expect(await screen.findByText('OT-000003')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled();
  });

  it('tolera datos parciales sin inventar responsable, upstream o métricas restringidas', async () => {
    listarSupervisionOtsScm.mockResolvedValueOnce({
      items: [{
        ot: { public_id: 'partial', codigo: 'OT-PARCIAL', tipo: 'FABRICACION' },
        visibilidad: { pesaje: false, alertas: false },
      }],
      page: { next_cursor: null, limit: 25, has_more: false },
      as_of: '2026-08-10T14:30:00Z',
    });
    obtenerResumenSupervisionOtsScm.mockRejectedValueOnce(new Error('Sin resumen'));
    renderPage();

    const row = await screen.findByTestId('supervision-row-partial');
    expect(within(row).getByText('Por asignar')).toBeVisible();
    expect(within(row).getByText('Sin orden superior')).toBeVisible();
    expect(within(row).getByText('Mangas: No informado')).toBeVisible();
    expect(screen.getByTestId('kpi-units')).toHaveTextContent('No informado');
    expect(screen.getByTestId('kpi-physical-weight')).toHaveTextContent('No informado');
    expect(screen.getByText(/El resumen no está disponible/i)).toBeVisible();
  });

  it('muestra carga y estado vacío de forma accesible', async () => {
    let resolveList;
    listarSupervisionOtsScm.mockImplementationOnce(() => new Promise((resolve) => {
      resolveList = resolve;
    }));
    obtenerResumenSupervisionOtsScm.mockResolvedValueOnce({
      ...summaryResponse,
      totales: { ...summaryResponse.totales, ots: 0 },
    });
    renderPage();

    expect(screen.getByRole('status', { name: 'Cargando supervisión' })).toBeVisible();
    resolveList({
      items: [], page: { next_cursor: null, limit: 25, has_more: false },
      as_of: listResponse.as_of,
    });

    expect(await screen.findByText('No hay OT para estos filtros')).toBeVisible();
  });

  it('presenta error de lista con reintento sin convertirlo en un estado vacío', async () => {
    listarSupervisionOtsScm.mockRejectedValueOnce({});
    renderPage();

    expect(await screen.findByText(/No se pudo cargar la supervisión de OT/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(screen.queryByText('No hay OT para estos filtros')).not.toBeInTheDocument();
  });

  it('rechaza un rango local inválido antes de consultar el API', async () => {
    renderPage('/control/supervision-produccion?rango=PERSONALIZADO&desde=2026-08-11&hasta=2026-08-10');

    expect(await screen.findByText(/Desde no puede ser posterior a Hasta/i)).toBeVisible();
    expect(listarSupervisionOtsScm).not.toHaveBeenCalled();
    expect(screen.queryByRole('status', { name: 'Cargando supervisión' })).not.toBeInTheDocument();
  });

  it('pausa el refresco automático de 30 segundos', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(731);
    const clearSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    const user = userEvent.setup();

    try {
      renderPage();
      await screen.findByText('OT-000001');
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

      await user.click(screen.getByRole('button', { name: 'Pausar actualización automática' }));
      await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('auto=0'));
      expect(clearSpy).toHaveBeenCalledWith(731);
      expect(screen.getByRole('button', { name: 'Reanudar actualización automática' })).toBeVisible();
    } finally {
      intervalSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });
});
