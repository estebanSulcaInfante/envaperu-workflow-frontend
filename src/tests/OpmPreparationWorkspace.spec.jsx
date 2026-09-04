import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import OpmPreparationWorkspace from '../components/OpmPreparationWorkspace';
import {
  asignarStockPreparadoRequerimiento,
  consumirEntregaMaterialPreparado,
  crearOrdenPreparacionMaterial,
  decidirCalidadBolsaMaterialPreparado,
  emitirInsumoOrdenPreparacionMaterial,
  generarNecesidadMaterialPreparado,
  incorporarAporteOrdenPreparacionMaterial,
  invalidarLecturaPesoPreparacion,
  liberarAsignacionStockMaterialPreparado,
  listarReservasMaterialPreparadoTrabajo,
  obtenerColaPreparacionMaterial,
  obtenerDetalleOrdenPreparacionMaterial,
  obtenerStockCompatibleRequerimiento,
  prepararEntregaMaterialPreparado,
  recibirBolsaMaterialPreparado,
  recibirEntregaMaterialPreparadoMaquina,
  registrarLecturaPesoPreparacion,
  reservarMaterialPreparadoTrabajo,
  retornarEntregaMaterialPreparado,
  despacharEntregaMaterialPreparado,
} from '../services/opmPreparationApi';
import {
  listarAlmacenesScm,
  obtenerAlcanceAlmacenScm,
} from '../services/scmWarehouseOperationsApi';

const can = vi.fn(() => true);
const actorContext = { actorId: 1 };

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ actorId: actorContext.actorId, can }),
}));

vi.mock('../services/opmPreparationApi', () => ({
  asignarStockPreparadoRequerimiento: vi.fn(),
  consumirEntregaMaterialPreparado: vi.fn(),
  crearOrdenPreparacionMaterial: vi.fn(),
  conciliarOrdenPreparacionMaterial: vi.fn(),
  confirmarLecturaPesoPreparacion: vi.fn(),
  generarNecesidadMaterialPreparado: vi.fn(),
  invalidarLecturaPesoPreparacion: vi.fn(),
  liberarAsignacionStockMaterialPreparado: vi.fn(),
  incorporarAporteOrdenPreparacionMaterial: vi.fn(),
  listarDestinosMaterialPreparado: vi.fn(async () => ({
    items: [{
      id: 91, codigo: 'P-ENVA-INY-01', nombre: 'Punto inyectora 1', tipo: 'PUNTO_PRODUCCION',
      almacen: null, permite_saldo_libre: false, seleccionable_como_stock: false,
      usos: ['ENTREGA_PRODUCCION'],
    }, {
      id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados', tipo: 'ALMACEN',
      almacen: { id: 'warehouse-1', codigo: 'AMP', nombre: 'Materia prima' },
      permite_saldo_libre: true, seleccionable_como_stock: true,
      usos: ['RECEPCION_ALMACEN', 'RETORNO_ALMACEN'],
    }],
  })),
  listarReservasMaterialPreparadoTrabajo: vi.fn(),
  obtenerColaPreparacionMaterial: vi.fn(),
  obtenerDetalleOrdenPreparacionMaterial: vi.fn(),
  obtenerStockCompatibleRequerimiento: vi.fn(),
  prepararEntregaMaterialPreparado: vi.fn(),
  registrarLecturaPesoPreparacion: vi.fn(),
  recibirBolsaMaterialPreparado: vi.fn(),
  recibirEntregaMaterialPreparadoMaquina: vi.fn(),
  reservarMaterialPreparadoTrabajo: vi.fn(),
  retornarEntregaMaterialPreparado: vi.fn(),
  despacharEntregaMaterialPreparado: vi.fn(),
  cerrarOrdenPreparacionMaterial: vi.fn(),
  decidirCalidadBolsaMaterialPreparado: vi.fn(),
  emitirInsumoOrdenPreparacionMaterial: vi.fn(),
}));

vi.mock('../services/scmWarehouseOperationsApi', () => ({
  listarAlmacenesScm: vi.fn(async () => ({
    items: [{
      id: 'warehouse-1',
      codigo: 'AMP',
      ubicaciones: [
        { id: 31, codigo: 'REC', nombre: 'Recepción MP', tipo: 'ALMACEN', activo: true },
        { id: 52, codigo: 'A-ENVA-MP-PREP', nombre: 'Preparación MP', tipo: 'STAGING', activo: true },
      ],
    }],
  })),
  obtenerAlcanceAlmacenScm: vi.fn(async () => ({ almacenes: [{ id: 'warehouse-1', codigo: 'AMP' }] })),
}));

const queuePage = {
  items: [{
    compatibilityKey: 'REC-VERDE-PASTO-R2',
    recipe: { id: 'rec-2', code: 'REC-VERDE-PASTO', revision: 2, name: 'Verde pasto' },
    needs: [
      { id: 'need-1', version: 4, workColorCode: 'TC-000041', runCode: 'COR-000041', requiredKg: 20, coveredKg: 5, plannedKg: 5, pendingKg: 15 },
      { id: 'need-2', version: 2, workColorCode: 'TC-000052', runCode: 'COR-000052', requiredKg: 20, coveredKg: 0, plannedKg: 0, pendingKg: 20 },
    ],
    requiredKg: 40,
    coveredKg: 5,
    plannedKg: 5,
    pendingKg: 35,
    activeOpm: { id: 'opm-7', code: 'OPM-000007', status: 'EN_PREPARACION' },
  }],
  nextCursor: null,
};

const opmDetail = {
  id: 'opm-7',
  codigo: 'OPM-000007',
  estado: 'EN_PREPARACION',
  version: 6,
  receta_revision_id: 'rec-2',
  receta: { revision_id: 'rec-2', nombre: 'Verde pasto', revision: 2, estado: 'APROBADA' },
  cantidad_objetivo_kg: '35.000',
  asignaciones: [{
    id: 'coverage-1', requerimiento_id: 'need-1', corrida_fabricacion_id: 'run-41',
    corrida_codigo: 'COR-000041', trabajo_color: null,
    tipo_fuente: 'OPM_ESPERADA', orden_preparacion_id: 'opm-7', lote_id: null, bolsa_id: null,
    cantidad_planificada_kg: '15.000', cantidad_comprometida_kg: '0.000',
    cantidad_consumida_kg: '0.000', estado: 'PLANIFICADA',
  }],
  requerimientos_insumo: [],
  aportes: [],
  lecturas: [
    { id: 'a-1', tipo_uso: 'APORTE', bruto_kg: '34.200', tara_kg: '0.100', neto_kg: '34.100', metodo: 'CONTINGENCIA_MANUAL', estado: 'PENDIENTE_SEGUNDA_CONFIRMACION', version: 1 },
    { id: 'a-2', tipo_uso: 'APORTE', bruto_kg: '0.700', tara_kg: '0.020', neto_kg: '0.680', metodo: 'CONTINGENCIA_MANUAL', estado: 'PENDIENTE_SEGUNDA_CONFIRMACION', version: 1 },
    { id: 'b-1', tipo_uso: 'BOLSA_SALIDA', bruto_kg: '20.100', tara_kg: '0.100', neto_kg: '20.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'APROBADA', version: 2 },
  ],
  bolsas: [],
  lote: null,
  balance: {
    entradas_incorporadas_kg: '34.780', salidas_bolsas_kg: '20.000',
    perdida_muestra_remanente_kg: '0.000', diferencia_kg: '14.780', conciliado: false,
  },
};

const l2Detail = {
  ...opmDetail,
  estado: 'CERRADA',
  asignaciones: [{
    id: 'assignment-7', requerimiento_id: 'need-1', corrida_fabricacion_id: 'run-41',
    corrida_codigo: 'COR-000041', trabajo_color: { id: 'work-7', codigo: 'TC-000041', estado: 'EN_EJECUCION' },
    tipo_fuente: 'OPM_ESPERADA', orden_preparacion_id: 'opm-7', lote_id: 'lot-7', bolsa_id: null,
    cantidad_planificada_kg: '10.000', cantidad_comprometida_kg: '10.000',
    cantidad_consumida_kg: '0.000', estado: 'COMPROMETIDA',
  }],
  lecturas: [],
  bolsas: [{
    id: 'bag-7', codigo: 'BMP-000007-01', peso_bruto_kg: '10.100', tara_kg: '0.100',
    peso_neto_kg: '10.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'DISPONIBLE', version: 3,
    ubicacion: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados' },
  }],
  lote: { id: 'lot-7', codigo: 'LMP-000007', estado: 'DISPONIBLE' },
  balance: {
    entradas_incorporadas_kg: '10.000', salidas_bolsas_kg: '10.000',
    perdida_muestra_remanente_kg: '0.000', diferencia_kg: '0.000', conciliado: true,
  },
};

const preparedReservation = (delivery = null, status = 'ACTIVA') => ({
  id: 'reservation-7', asignacion_id: 'assignment-7', requerimiento_id: 'need-1',
  bolsa: l2Detail.bolsas[0],
  trabajo_color: { id: 'work-7', codigo: 'TC-000041', estado: 'EN_EJECUCION' },
  ubicacion_origen: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados' },
  cantidad_kg: '10.000', estado: status, motivo: 'Reserva piloto', version: 1,
  entrega: delivery,
});

const preparedDelivery = (status, version) => ({
  id: 'delivery-7', reserva_id: 'reservation-7', asignacion_id: 'assignment-7', bolsa_id: 'bag-7',
  trabajo_color: { id: 'work-7', codigo: 'TC-000041', estado: 'EN_EJECUCION' },
  estado: status,
  origen: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados' },
  destino: { id: 91, codigo: 'P-ENVA-INY-01', nombre: 'Punto inyectora 1' },
  retorno: null, cantidad_kg: '10.000', motivo: 'Entrega piloto', version,
});

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <OpmPreparationWorkspace />
  </ThemeProvider>,
);

describe('Piloto OPM: preparación almacenable consolidada', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    actorContext.actorId = 1;
    can.mockReturnValue(true);
    obtenerColaPreparacionMaterial.mockResolvedValue(queuePage);
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValue(opmDetail);
    generarNecesidadMaterialPreparado.mockResolvedValue({ id: 'need-generated' });
    listarReservasMaterialPreparadoTrabajo.mockResolvedValue({ items: [] });
    obtenerStockCompatibleRequerimiento.mockResolvedValue({
      requerimiento: { id: 'need-1', version: 4 },
      items: [{
        id: 'bag-stock-1', codigo: 'BMP-000010-01',
        lote: { id: 'lot-stock-1', codigo: 'LMP-000010' },
        peso_neto_kg: '10.000', estado: 'DISPONIBLE',
        ubicacion: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén MP' },
        version: 2,
      }],
      limit: 25,
      next_cursor: null,
      has_more: false,
    });
    asignarStockPreparadoRequerimiento.mockResolvedValue({
      requerimiento: { id: 'need-1', version: 5, pendiente_planificacion_kg: '5.000' },
      asignaciones: [{ id: 'assignment-stock-1', bolsa_id: 'bag-stock-1' }],
    });
  });

  it('carga un resumen paginado y consolida necesidades compatibles sin descargar el ledger', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Preparación almacenable · OPM' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por preparar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'En preparación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listo' })).toBeInTheDocument();
    expect(screen.getByLabelText('1 en preparación')).toBeInTheDocument();
    expect(screen.getByText('Verde pasto')).toBeInTheDocument();
    expect(screen.getByText('2 necesidades compatibles')).toBeInTheDocument();
    expect(screen.getByText('35.000 kg sin fuente')).toBeInTheDocument();
    expect(obtenerColaPreparacionMaterial).toHaveBeenCalledWith({ cursor: null, limit: 25, includeEligible: true });
    expect(obtenerDetalleOrdenPreparacionMaterial).not.toHaveBeenCalled();
  });

  it('explica y bloquea la creación cuando falta la capacidad', async () => {
    can.mockImplementation((capability) => capability !== 'OPM_CREAR');
    renderPage();

    const create = await screen.findByRole('button', { name: 'Crear OPM para Verde pasto' });
    expect(create).toBeDisabled();
    expect(screen.getByText('Requiere OPM_CREAR')).toBeInTheDocument();
    expect(obtenerColaPreparacionMaterial).toHaveBeenCalledWith({
      cursor: null, limit: 25, includeEligible: false,
    });
    expect(crearOrdenPreparacionMaterial).not.toHaveBeenCalled();
  });

  it('obliga a decidir de forma visible si cubre el requerimiento con bolsas completas de stock', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Revisar stock para TC-000041' }));

    expect(obtenerStockCompatibleRequerimiento).toHaveBeenCalledWith('need-1', {
      cursor: null,
      limit: 25,
    });
    const dialog = await screen.findByRole('dialog', { name: 'Stock compatible · TC-000041' });
    expect(within(dialog).getByText('BMP-000010-01')).toBeInTheDocument();
    expect(within(dialog).getByText(/LMP-000010/)).toBeInTheDocument();
    expect(within(dialog).getByText(/10.000 kg/)).toBeInTheDocument();
    expect(within(dialog).getByText(/A-ENVA-MP-01/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: /BMP-000010-01/ }));
    await user.type(within(dialog).getByLabelText('Motivo'), 'Usar primero el stock disponible');
    expect(within(dialog).getByText(/no mueve ni reserva físicamente el Kardex/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Asignar cobertura desde bolsas completas' }));

    expect(asignarStockPreparadoRequerimiento).toHaveBeenCalledWith('need-1', {
      version: 4,
      bolsa_ids: ['bag-stock-1'],
      motivo: 'Usar primero el stock disponible',
    }, { idempotencyKey: expect.any(String) });
    expect(obtenerColaPreparacionMaterial).toHaveBeenCalledTimes(2);
  });

  it('muestra la decisión de stock pero la bloquea sin MATERIAL_PREPARADO_RESERVAR', async () => {
    can.mockImplementation((capability) => capability !== 'MATERIAL_PREPARADO_RESERVAR');
    renderPage();

    const button = await screen.findByRole('button', { name: 'Revisar stock para TC-000041' });
    expect(button).toBeDisabled();
    expect(screen.getAllByText('Requiere MATERIAL_PREPARADO_RESERVAR').length).toBeGreaterThan(0);
    expect(obtenerStockCompatibleRequerimiento).not.toHaveBeenCalled();
  });

  it('carga el detalle solo al abrir la OPM y hace visible la contingencia manual y sus bloqueos', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(obtenerDetalleOrdenPreparacionMaterial).toHaveBeenCalledWith('opm-7');
    expect(await screen.findByRole('heading', { name: 'OPM-000007' })).toBeInTheDocument();
    expect(screen.getByText('Pesos provisionales · contingencia manual')).toBeInTheDocument();
    const contributions = screen.getByRole('table', { name: 'Aportes provisionales de la OPM' });
    expect(within(contributions).getAllByText('Manual · contingencia')).toHaveLength(2);
    expect(screen.getByText('El balance está fuera de tolerancia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conciliar balance' })).toBeDisabled();
  });

  it('permite invalidar una lectura provisional equivocada conservando su trazabilidad', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    const contributions = screen.getByRole('table', { name: 'Aportes provisionales de la OPM' });
    await user.click(within(contributions).getAllByRole('button', { name: 'Invalidar lectura' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Invalidar lectura provisional' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Lectura tomada sobre la bolsa equivocada');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(invalidarLecturaPesoPreparacion).toHaveBeenCalledWith('a-1', {
      version: 1,
      motivo: 'Lectura tomada sobre la bolsa equivocada',
    }, { idempotencyKey: expect.any(String) });
  });

  it('obliga a atribuir una bolsa 25/15 a una necesidad concreta cuando la OPM consolida varias', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...opmDetail,
      asignaciones: [{
        ...opmDetail.asignaciones[0],
        id: 'assignment-25', corrida_codigo: 'COR-000041',
        trabajo_color: { id: 'work-41', codigo: 'TC-000041', estado: 'EN_EJECUCION' },
        cantidad_planificada_kg: '25.000', cantidad_comprometida_kg: '25.000',
      }, {
        ...opmDetail.asignaciones[0],
        id: 'assignment-15', requerimiento_id: 'need-2', corrida_fabricacion_id: 'run-52',
        corrida_codigo: 'COR-000052', trabajo_color: { id: 'work-52', codigo: 'TC-000052', estado: 'EN_EJECUCION' },
        cantidad_planificada_kg: '15.000', cantidad_comprometida_kg: '15.000',
      }],
      lecturas: [],
      balance: {
        entradas_incorporadas_kg: '40.000', salidas_bolsas_kg: '0.000',
        perdida_muestra_remanente_kg: '0.000', diferencia_kg: '40.000', conciliado: false,
      },
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));
    await user.click(await screen.findByRole('button', { name: 'Pesar salida para bolsa' }));

    const dialog = screen.getByRole('dialog', { name: 'Registrar pesaje provisional de salida para bolsa' });
    await user.click(within(dialog).getByLabelText('Necesidad que cubrirá'));
    expect(await screen.findByRole('option', { name: /TC-000041 · COR-000041 · plan 25.000 kg · pendiente 25.000 kg/ })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /TC-000052 · COR-000052 · plan 15.000 kg · pendiente 15.000 kg/ }));
    expect(screen.queryByText('assignment-15')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Peso bruto (kg)'), '15.120');
    await user.type(within(dialog).getByLabelText('Tara (kg)'), '0.120');
    await user.type(within(dialog).getByLabelText('Peso neto (kg)'), '15');
    await user.type(within(dialog).getByLabelText('Motivo de contingencia'), 'Bolsa completa para corrida 52');
    await user.type(within(dialog).getByLabelText('Referencia de evidencia'), 'UAT-BOLSA-15');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar provisional' }));

    expect(registrarLecturaPesoPreparacion).toHaveBeenCalledWith('opm-7', {
      version: 6,
      tipo_uso: 'BOLSA_SALIDA',
      asignacion_requerimiento_id: 'assignment-15',
      bruto_kg: '15.120',
      tara_kg: '0.120',
      neto_kg: '15.000',
      motivo: 'Bolsa completa para corrida 52',
      evidencia_ref: 'UAT-BOLSA-15',
    }, { idempotencyKey: expect.any(String) });
  });

  it('autoselecciona de forma estable la única necesidad y muestra el rechazo si la bolsa excede su remanente', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registrarLecturaPesoPreparacion.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: { code: 'OPM_OUTPUT_BAG_EXCEEDS_ASSIGNMENT', message: 'La bolsa completa excede la capacidad restante de la necesidad.' } },
      },
    });
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...opmDetail,
      lecturas: [],
      balance: {
        entradas_incorporadas_kg: '15.000', salidas_bolsas_kg: '0.000',
        perdida_muestra_remanente_kg: '0.000', diferencia_kg: '15.000', conciliado: false,
      },
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));
    await user.click(await screen.findByRole('button', { name: 'Pesar salida para bolsa' }));

    const dialog = screen.getByRole('dialog', { name: 'Registrar pesaje provisional de salida para bolsa' });
    expect(within(dialog).queryByLabelText('Necesidad que cubrirá')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Necesidad autoseleccionada: COR-000041/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Peso bruto (kg)'), '16.120');
    await user.type(within(dialog).getByLabelText('Tara (kg)'), '0.120');
    await user.type(within(dialog).getByLabelText('Peso neto (kg)'), '16');
    await user.type(within(dialog).getByLabelText('Motivo de contingencia'), 'Prueba de límite por necesidad');
    await user.type(within(dialog).getByLabelText('Referencia de evidencia'), 'UAT-EXCESO-16');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar provisional' }));

    expect(registrarLecturaPesoPreparacion).toHaveBeenCalledWith('opm-7', expect.objectContaining({
      asignacion_requerimiento_id: 'coverage-1',
      neto_kg: '16.000',
    }), { idempotencyKey: expect.any(String) });
    expect(await screen.findByText('La bolsa completa excede la capacidad restante de la necesidad.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar misma operación' })).not.toBeInTheDocument();
  });

  it('muestra la cobertura trazable por TrabajoColor y no permite fraccionar bolsas en el piloto', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(await screen.findByText('Cobertura y consumo por TrabajoColor')).toBeInTheDocument();
    expect(screen.getByText('COR-000041')).toBeInTheDocument();
    expect(screen.getByText('Solo bolsas completas en el piloto')).toBeInTheDocument();
    expect(screen.getByText('Inputs incorporados')).toBeInTheDocument();
    expect(screen.queryByText('Inputs confirmados')).not.toBeInTheDocument();
    expect(screen.getByText(/la bolsa y su QR canónicos nacen al cerrar el lote/i)).toBeInTheDocument();
    expect(screen.getByText('Calidad · NO APLICA')).toBeInTheDocument();
  });

  it('permite abrir la conciliación cuando la única diferencia pendiente es el balance', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...opmDetail,
      aportes: [{ id: 'input-1', lectura_id: 'a-1', emision_id: 'emission-1', estado: 'INCORPORADO' }],
      lecturas: [
        { id: 'a-1', tipo_uso: 'APORTE', bruto_kg: '25.100', tara_kg: '0.100', neto_kg: '25.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'UTILIZADA', version: 2 },
        { id: 'b-1', tipo_uso: 'BOLSA_SALIDA', bruto_kg: '24.900', tara_kg: '0.100', neto_kg: '24.800', metodo: 'CONTINGENCIA_MANUAL', estado: 'APROBADA', version: 2 },
      ],
      balance: {
        entradas_incorporadas_kg: '25.000', salidas_bolsas_kg: '24.800',
        perdida_muestra_remanente_kg: '0.000', diferencia_kg: '0.200', conciliado: false,
      },
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(await screen.findByRole('button', { name: 'Conciliar balance' })).toBeEnabled();
  });

  it('permite iniciar una cola vacía generando la necesidad de una corrida elegible', async () => {
    const user = userEvent.setup();
    obtenerColaPreparacionMaterial
      .mockResolvedValueOnce({
        items: [],
        eligibleRuns: [{
          id: 'run-9', code: 'COR-000009', requiredKg: 18,
          recipe: { name: 'Crema', revision: 2 },
          workColor: { id: 'tc-9', codigo: 'TC-000009' },
        }],
        nextCursor: null,
      })
      .mockResolvedValueOnce(queuePage);

    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Generar necesidad' }));

    expect(generarNecesidadMaterialPreparado).toHaveBeenCalledWith('run-9', {
      idempotencyKey: expect.any(String),
    });
    expect(await screen.findByText('Verde pasto')).toBeInTheDocument();
  });

  it('mantiene la misma intención idempotente al reintentar después de un timeout', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    crearOrdenPreparacionMaterial
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({});
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Crear OPM para Verde pasto' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear OPM consolidada' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Consolidar turno noche');
    await user.click(within(dialog).getByRole('button', { name: 'Crear OPM' }));
    await user.click(await screen.findByRole('button', { name: 'Reintentar misma operación' }));

    expect(crearOrdenPreparacionMaterial).toHaveBeenCalledTimes(2);
    expect(crearOrdenPreparacionMaterial.mock.calls[0][1].idempotencyKey)
      .toBe(crearOrdenPreparacionMaterial.mock.calls[1][1].idempotencyKey);
  });

  it('presenta el conflicto 409 como bloqueo terminal y no ofrece un reintento ciego', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    crearOrdenPreparacionMaterial.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: { message: 'La necesidad ya quedó cubierta por otra OPM.' } },
      },
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Crear OPM para Verde pasto' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear OPM consolidada' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Consolidar necesidades');
    await user.click(within(dialog).getByRole('button', { name: 'Crear OPM' }));

    expect(await screen.findByText('La necesidad ya quedó cubierta por otra OPM.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar misma operación' })).not.toBeInTheDocument();
  });

  it('actualiza también el detalle abierto y usa su versión vigente al incorporar un input', async () => {
    const user = userEvent.setup();
    const approvedDetail = {
      ...opmDetail,
      version: 6,
      lecturas: [{
        id: 'reading-approved', tipo_uso: 'APORTE', bruto_kg: '40.120', tara_kg: '0.120',
        neto_kg: '40.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'APROBADA', version: 2,
      }],
      requerimientos_insumo: [{
        id: 'input-1', cantidad_plan_kg: '40.000',
        material: { codigo: 'MP-PP-CLARIFICADO', nombre: 'PP clarificado' },
        reservas: [{
          id: 'input-reservation-1', cantidad_kg: '40.000', emitida_neta_kg: '40.000',
          ubicacion: { codigo: 'A-ENVA-MP-GEN' },
          emisiones: [{
            id: 'emission-1', codigo: 'EMI-000001', cantidad_disponible_kg: '40.000',
          }],
        }],
      }],
      balance: {
        entradas_incorporadas_kg: '0.000', salidas_bolsas_kg: '0.000',
        perdida_muestra_remanente_kg: '0.000', diferencia_kg: '0.000', conciliado: false,
      },
    };
    const refreshedDetail = { ...approvedDetail, version: 9 };
    obtenerDetalleOrdenPreparacionMaterial
      .mockResolvedValueOnce(approvedDetail)
      .mockResolvedValue(refreshedDetail);
    incorporarAporteOrdenPreparacionMaterial.mockResolvedValue({ id: 'contribution-1' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(obtenerDetalleOrdenPreparacionMaterial).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Incorporar input' }));
    const dialog = screen.getByRole('dialog', { name: 'Incorporar lectura aprobada' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Incorporar aporte aprobado');
    await user.click(within(dialog).getByRole('button', { name: 'Incorporar input real' }));

    expect(incorporarAporteOrdenPreparacionMaterial).toHaveBeenCalledWith('opm-7', {
      version: 9,
      lectura_id: 'reading-approved',
      emision_id: 'emission-1',
      motivo: 'Incorporar aporte aprobado',
    }, { idempotencyKey: expect.any(String) });
  });

  it('recarga el detalle tras un conflicto de versión sin reintentar ciegamente la incorporación', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const approvedDetail = {
      ...opmDetail,
      lecturas: [{
        id: 'reading-approved', tipo_uso: 'APORTE', bruto_kg: '40.120', tara_kg: '0.120',
        neto_kg: '40.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'APROBADA', version: 2,
      }],
      requerimientos_insumo: [{
        id: 'input-1', cantidad_plan_kg: '40.000',
        material: { codigo: 'MP-PP-CLARIFICADO', nombre: 'PP clarificado' },
        reservas: [{
          id: 'input-reservation-1', cantidad_kg: '40.000', emitida_neta_kg: '40.000',
          ubicacion: { codigo: 'A-ENVA-MP-GEN' },
          emisiones: [{ id: 'emission-1', codigo: 'EMI-000001', cantidad_disponible_kg: '40.000' }],
        }],
      }],
    };
    obtenerDetalleOrdenPreparacionMaterial
      .mockResolvedValueOnce(approvedDetail)
      .mockResolvedValue({ ...approvedDetail, version: 9 });
    incorporarAporteOrdenPreparacionMaterial.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: { code: 'VERSION_CONFLICT', message: 'El recurso fue modificado por otra persona.' } },
      },
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));
    await user.click(screen.getByRole('button', { name: 'Incorporar input' }));
    const dialog = screen.getByRole('dialog', { name: 'Incorporar lectura aprobada' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Incorporar aporte aprobado');
    await user.click(within(dialog).getByRole('button', { name: 'Incorporar input real' }));

    expect(await screen.findByText(/La OPM cambió mientras trabajabas/)).toBeInTheDocument();
    await waitFor(() => expect(obtenerDetalleOrdenPreparacionMaterial).toHaveBeenCalledTimes(2));
    expect(incorporarAporteOrdenPreparacionMaterial).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Reintentar misma operación' })).not.toBeInTheDocument();
  });

  it('continúa la cola con cursor opaco sin ampliar el límite', async () => {
    const user = userEvent.setup();
    obtenerColaPreparacionMaterial
      .mockResolvedValueOnce({
        ...queuePage,
        nextCursor: { eligible: null, requirements: 'requirements-page-2', orders: null },
      })
      .mockResolvedValueOnce({ items: [], eligibleRuns: [], nextCursor: null });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cargar siguientes 25' }));

    expect(obtenerColaPreparacionMaterial).toHaveBeenNthCalledWith(2, {
      cursor: { eligible: null, requirements: 'requirements-page-2', orders: null },
      limit: 25,
      includeEligible: true,
    });
  });

  it('muestra un error de carga sin reemplazarlo por datos inventados', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    obtenerColaPreparacionMaterial.mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByText('No se pudo cargar la cola resumida de preparación.')).toBeInTheDocument();
    expect(screen.getByText('No hay necesidades pendientes ni corridas elegibles.')).toBeInTheDocument();
  });

  it('recibe una bolsa en una ubicación física autorizada y conserva la custodia canónica', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...opmDetail,
      lote: { id: 'lot-7', codigo: 'LMP-000007', estado: 'PENDIENTE_RECEPCION' },
      bolsas: [{ id: 'bag-7', codigo: 'BMP-000007-01', peso_bruto_kg: '20.100', tara_kg: '0.100', peso_neto_kg: '20.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'PENDIENTE_RECEPCION' }],
    });
    recibirBolsaMaterialPreparado.mockResolvedValue({ id: 'bag-7', estado: 'PENDIENTE_CALIDAD' });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Recibir en almacén' }));
    await user.click(screen.getByLabelText('Ubicación física autorizada'));
    await user.click(await screen.findByRole('option', { name: 'AMP · REC · Recepción MP' }));
    await user.type(screen.getByLabelText('Motivo'), 'Recepción física verificada');
    await user.click(screen.getByRole('button', { name: 'Confirmar ubicación y custodia' }));

    expect(recibirBolsaMaterialPreparado).toHaveBeenCalledWith('lot-7', 'bag-7', {
      ubicacion_id: 31,
      motivo: 'Recepción física verificada',
    }, { idempotencyKey: expect.any(String) });
  });

  it('recarga el alcance físico al cambiar de perfil sin conservar ubicaciones del actor anterior', async () => {
    const user = userEvent.setup();
    const page = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));
    await waitFor(() => expect(obtenerAlcanceAlmacenScm).toHaveBeenCalledTimes(1));
    expect(listarAlmacenesScm).toHaveBeenCalledTimes(1);

    actorContext.actorId = 10;
    page.rerender(
      <ThemeProvider theme={createTheme()}>
        <OpmPreparationWorkspace />
      </ThemeProvider>,
    );

    await waitFor(() => expect(obtenerAlcanceAlmacenScm).toHaveBeenCalledTimes(2));
    expect(listarAlmacenesScm).toHaveBeenCalledTimes(2);
  });

  it('emite una reserva de input a Preparación antes de habilitar el inicio', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      id: 'opm-7',
      codigo: 'OPM-000007',
      estado: 'LIBERADA',
      version: 4,
      receta: { revision_id: 'rec-2', nombre: 'Verde pasto', revision: 2 },
      cantidad_objetivo_kg: '25.000',
      asignaciones: [],
      lecturas: [],
      bolsas: [],
      aportes: [],
      balance: {
        entradas_incorporadas_kg: '0.000', salidas_bolsas_kg: '0.000',
        perdida_muestra_remanente_kg: '0.000', diferencia_kg: '0.000', conciliado: false,
      },
      requerimientos_insumo: [{
        id: 'raw-requirement-1',
        material: { codigo: 'MP-0001', nombre: 'Polipropileno virgen' },
        cantidad_plan_kg: '25.000',
        reservas: [{
          id: 'raw-reservation-1', cantidad_kg: '25.000', emitida_neta_kg: '0.000',
          ubicacion: { id: 31, codigo: 'REC' }, emisiones: [],
        }],
      }],
      lote: null,
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(await screen.findByRole('button', { name: 'Iniciar preparación' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Emitir a preparación' }));
    expect(screen.getByText('Origen reservado: REC. Emitir mueve 25.000 kg a una zona de Preparación; todavía no consume el material.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Destino de preparación'));
    await user.click(await screen.findByRole('option', { name: 'AMP · A-ENVA-MP-PREP · Preparación MP' }));
    expect(screen.queryByRole('option', { name: 'AMP · REC · Recepción MP' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Motivo'), 'Traslado controlado a preparación');
    await user.click(screen.getByRole('button', { name: 'Emitir 25.000 kg' }));

    expect(emitirInsumoOrdenPreparacionMaterial).toHaveBeenCalledWith('opm-7', 'raw-reservation-1', {
      version: 4,
      ubicacion_destino_id: 52,
      cantidad_kg: '25.000',
      motivo: 'Traslado controlado a preparación',
    }, { idempotencyKey: expect.any(String) });
  });

  it('resuelve Calidad por bolsa y nunca aparenta liberar el lote con una sola decisión', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...opmDetail,
      lote: { id: 'lot-7', codigo: 'LMP-000007', estado: 'PENDIENTE_CALIDAD' },
      bolsas: [{ id: 'bag-7', codigo: 'BMP-000007-01', peso_bruto_kg: '20.100', tara_kg: '0.100', peso_neto_kg: '20.000', metodo: 'CONTINGENCIA_MANUAL', estado: 'PENDIENTE_CALIDAD' }],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Resolver Calidad' }));
    const dialog = screen.getByRole('dialog', { name: 'Decisión de Calidad · BMP-000007-01' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Muestra conforme y bolsa identificada');
    await user.click(within(dialog).getByRole('button', { name: 'Liberar' }));

    expect(decidirCalidadBolsaMaterialPreparado).toHaveBeenCalledWith('lot-7', 'bag-7', {
      decision: 'LIBERAR',
      motivo: 'Muestra conforme y bolsa identificada',
    }, { idempotencyKey: expect.any(String) });
  });

  it('vincula una bolsa completa a la asignación y recién entonces crea reserva física', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(listarReservasMaterialPreparadoTrabajo).toHaveBeenCalledWith('work-7');
    await user.click(await screen.findByRole('button', { name: 'Vincular bolsa completa para TC-000041' }));
    const dialog = screen.getByRole('dialog', { name: 'Vincular bolsa completa · TC-000041' });
    await user.click(within(dialog).getByLabelText('Bolsa completa'));
    await user.click(await screen.findByRole('option', { name: /BMP-000007-01 · 10.000 kg/ }));
    await user.type(within(dialog).getByLabelText('Motivo'), 'Asignar bolsa completa al TrabajoColor');
    await user.click(within(dialog).getByRole('button', { name: 'Crear reserva física' }));

    expect(reservarMaterialPreparadoTrabajo).toHaveBeenCalledWith('work-7', {
      asignacion_id: 'assignment-7',
      bolsa_id: 'bag-7',
      motivo: 'Asignar bolsa completa al TrabajoColor',
    }, { idempotencyKey: expect.any(String) });
  });

  it('rehidrata la bolsa de stock comprometida con código amigable y nunca muestra su UUID', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...l2Detail,
      asignaciones: [{
        ...l2Detail.asignaciones[0],
        tipo_fuente: 'LOTE_PREPARADO_STOCK',
        orden_preparacion_id: null,
        bolsa_id: 'bag-stock-uuid-hidden',
        bolsa: {
          id: 'bag-stock-uuid-hidden', codigo: 'BMP-000099-02',
          lote_id: 'lot-99', lote_codigo: 'LMP-000099',
          peso_neto_kg: '10.000', estado: 'DISPONIBLE',
          ubicacion: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados' },
        },
      }],
      bolsas: [],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Vincular bolsa completa para TC-000041' }));
    const dialog = screen.getByRole('dialog', { name: 'Vincular bolsa completa · TC-000041' });
    await user.click(within(dialog).getByLabelText('Bolsa completa'));
    expect(await screen.findByRole('option', { name: /BMP-000099-02 · 10.000 kg · A-ENVA-MP-01/ })).toBeInTheDocument();
    expect(screen.queryByText('bag-stock-uuid-hidden')).not.toBeInTheDocument();
  });

  it('permite corregir una cobertura de stock antes de crear la reserva física', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce({
      ...l2Detail,
      asignaciones: [{
        ...l2Detail.asignaciones[0],
        tipo_fuente: 'LOTE_PREPARADO_STOCK', orden_preparacion_id: null,
        bolsa_id: 'bag-stock-1',
        bolsa: {
          id: 'bag-stock-1', codigo: 'BMP-000099-02', lote_id: 'lot-99', lote_codigo: 'LMP-000099',
          peso_neto_kg: '10.000', estado: 'DISPONIBLE',
          ubicacion: { id: 31, codigo: 'A-ENVA-MP-01', nombre: 'Almacén de preparados' },
        },
      }],
      bolsas: [],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Liberar cobertura de stock' }));
    const dialog = screen.getByRole('dialog', { name: 'Liberar cobertura de stock · TC-000041' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'La bolsa corresponde a otra corrida');
    await user.click(within(dialog).getByRole('button', { name: 'Liberar cobertura de stock' }));

    expect(liberarAsignacionStockMaterialPreparado).toHaveBeenCalledWith('assignment-7', {
      motivo: 'La bolsa corresponde a otra corrida',
    }, { idempotencyKey: expect.any(String) });
  });

  it('prepara la entrega seleccionando el destino global publicado aunque no pertenezca a un almacén', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({ items: [preparedReservation()] });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Preparar entrega de BMP-000007-01' }));
    const dialog = screen.getByRole('dialog', { name: 'Preparar entrega · BMP-000007-01' });
    await user.click(within(dialog).getByLabelText('Destino de producción'));
    await user.click(await screen.findByRole('option', { name: 'P-ENVA-INY-01 · Punto inyectora 1 · punto global' }));
    await user.type(within(dialog).getByLabelText('Motivo'), 'Enviar a la inyectora 1');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar preparación de entrega' }));

    expect(prepararEntregaMaterialPreparado).toHaveBeenCalledWith('reservation-7', {
      version: 1,
      ubicacion_destino_id: 91,
      motivo: 'Enviar a la inyectora 1',
    }, { idempotencyKey: expect.any(String) });
  });

  it('separa despacho de recepción en máquina y bloquea consumo mientras está en tránsito', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({
      items: [preparedReservation(preparedDelivery('EN_TRANSITO', 2))],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    expect(screen.queryByRole('button', { name: 'Consumir bolsa completa' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Confirmar recepción en máquina' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirmar recepción en máquina · BMP-000007-01' });
    await user.type(within(dialog).getByLabelText('Motivo'), 'Maquinista recibe la bolsa cerrada');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar recepción' }));

    expect(recibirEntregaMaterialPreparadoMaquina).toHaveBeenCalledWith('delivery-7', {
      version: 2,
      motivo: 'Maquinista recibe la bolsa cerrada',
    }, { idempotencyKey: expect.any(String) });
    expect(consumirEntregaMaterialPreparado).not.toHaveBeenCalled();
  });

  it('despacha una entrega preparada sin confundir despacho con consumo', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({
      items: [preparedReservation(preparedDelivery('PREPARADA', 1))],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Despachar bolsa' }));
    const dialog = screen.getByRole('dialog', { name: 'Despachar bolsa · BMP-000007-01' });
    expect(within(dialog).queryByLabelText(/cantidad/i)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Motivo'), 'Despacho controlado a inyectora 1');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar despacho' }));

    expect(despacharEntregaMaterialPreparado).toHaveBeenCalledWith('delivery-7', {
      version: 1,
      motivo: 'Despacho controlado a inyectora 1',
    }, { idempotencyKey: expect.any(String) });
    expect(consumirEntregaMaterialPreparado).not.toHaveBeenCalled();
  });

  it('habilita consumo solo después de recibir en máquina y respeta su capacidad', async () => {
    can.mockImplementation((capability) => capability !== 'MATERIAL_PREPARADO_CONSUMIR');
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({
      items: [preparedReservation(preparedDelivery('RECIBIDA_MAQUINA', 3))],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    const consume = await screen.findByRole('button', { name: 'Consumir bolsa completa' });
    expect(consume).toBeDisabled();
    expect(screen.getByText('Requiere MATERIAL_PREPARADO_CONSUMIR')).toBeInTheDocument();
  });

  it('consume la bolsa completa recibida sin ofrecer cantidad parcial', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({
      items: [preparedReservation(preparedDelivery('RECIBIDA_MAQUINA', 3))],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Consumir bolsa completa' }));
    const dialog = screen.getByRole('dialog', { name: 'Consumir bolsa completa · BMP-000007-01' });
    expect(within(dialog).queryByLabelText(/cantidad/i)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Motivo'), 'Bolsa completa incorporada al TrabajoColor');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar consumo total' }));

    expect(consumirEntregaMaterialPreparado).toHaveBeenCalledWith('work-7', {
      entrega_id: 'delivery-7',
      version: 3,
      motivo: 'Bolsa completa incorporada al TrabajoColor',
    }, { idempotencyKey: expect.any(String) });
  });

  it('retorna una bolsa completa no consumida a una ubicación canónica de almacén', async () => {
    const user = userEvent.setup();
    obtenerDetalleOrdenPreparacionMaterial.mockResolvedValueOnce(l2Detail);
    listarReservasMaterialPreparadoTrabajo.mockResolvedValueOnce({
      items: [preparedReservation(preparedDelivery('RECIBIDA_MAQUINA', 3))],
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir OPM-000007' }));

    await user.click(await screen.findByRole('button', { name: 'Retornar bolsa completa' }));
    const dialog = screen.getByRole('dialog', { name: 'Retornar bolsa completa · BMP-000007-01' });
    await user.click(within(dialog).getByLabelText('Ubicación de retorno'));
    await user.click(await screen.findByRole('option', { name: 'AMP · A-ENVA-MP-01 · Almacén de preparados' }));
    await user.type(within(dialog).getByLabelText('Motivo'), 'Bolsa cerrada vuelve al almacén');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar retorno total' }));

    expect(retornarEntregaMaterialPreparado).toHaveBeenCalledWith('delivery-7', {
      version: 3,
      ubicacion_retorno_id: 31,
      motivo: 'Bolsa cerrada vuelve al almacén',
    }, { idempotencyKey: expect.any(String) });
  });
});
