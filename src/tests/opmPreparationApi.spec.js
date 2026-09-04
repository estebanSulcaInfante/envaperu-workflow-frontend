import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../services/api', () => ({
  default: { get: getMock, post: postMock },
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 17,
}));

import {
  asignarStockPreparadoRequerimiento,
  confirmarLecturaPesoPreparacion,
  consumirEntregaMaterialPreparado,
  crearOrdenPreparacionMaterial,
  decidirCalidadBolsaMaterialPreparado,
  emitirInsumoOrdenPreparacionMaterial,
  generarNecesidadMaterialPreparado,
  invalidarLecturaPesoPreparacion,
  liberarAsignacionStockMaterialPreparado,
  liberarReservaMaterialPreparado,
  listarReservasMaterialPreparadoTrabajo,
  listarDestinosMaterialPreparado,
  obtenerColaPreparacionMaterial,
  obtenerStockCompatibleRequerimiento,
  prepararEntregaMaterialPreparado,
  recibirBolsaMaterialPreparado,
  recibirEntregaMaterialPreparadoMaquina,
  resolverRecepcionMaterialPreparadoQr,
  confirmarRecepcionMaterialPreparadoQr,
  registrarLecturaPesoPreparacion,
  reservarMaterialPreparadoTrabajo,
  reservarInsumosOrdenPreparacionMaterial,
  retornarEntregaMaterialPreparado,
  despacharEntregaMaterialPreparado,
} from '../services/opmPreparationApi';

describe('contrato HTTP de OPM y material preparado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { items: [], next_cursor: null } });
    postMock.mockResolvedValue({ data: { id: 'result-1' } });
  });

  it('separa resolución QR de confirmación idempotente', async () => {
    await resolverRecepcionMaterialPreparadoQr({
      maquina_qr: 'SCM:MAQUINA:INY-01:V1', bolsa_qr: 'BMP-000001-001',
    });
    expect(postMock).toHaveBeenNthCalledWith(1,
      '/scm/v1/recepciones-material-preparado/resolver-qr',
      { maquina_qr: 'SCM:MAQUINA:INY-01:V1', bolsa_qr: 'BMP-000001-001' },
      { headers: { 'X-Actor-Id': '17' } },
    );
    await confirmarRecepcionMaterialPreparadoQr({
      maquina_qr: 'SCM:MAQUINA:INY-01:V1', bolsa_qr: 'BMP-000001-001',
      entrega_id: 'delivery-1', expected_version: 4,
      accion: 'RECIBIR', motivo: 'Recepción física',
    }, { idempotencyKey: 'operation-1' });
    expect(postMock).toHaveBeenNthCalledWith(2,
      '/scm/v1/recepciones-material-preparado/confirmar-qr',
      expect.objectContaining({ accion: 'RECIBIR', expected_version: 4 }),
      { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'operation-1' } },
    );
  });

  it('pagina los tres resúmenes canónicos con cursores independientes y no solicita ningún ledger', async () => {
    await obtenerColaPreparacionMaterial({
      cursor: { eligible: 'eligible-next', requirements: 'requirements-next', orders: 'orders-next' },
      limit: 25,
      estadoRequerimiento: 'PENDIENTE',
      estadoOpm: 'EN_PREPARACION',
    });

    expect(getMock).toHaveBeenCalledTimes(3);
    expect(getMock).toHaveBeenNthCalledWith(1, '/scm/v1/corridas-fabricacion/elegibles-preparacion', {
      headers: { 'X-Actor-Id': '17' },
      params: { cursor: 'eligible-next', limit: 25 },
    });
    expect(getMock).toHaveBeenNthCalledWith(2, '/scm/v1/requerimientos-preparacion', {
      headers: { 'X-Actor-Id': '17' },
      params: { cursor: 'requirements-next', limit: 25, estado: 'PENDIENTE' },
    });
    expect(getMock).toHaveBeenNthCalledWith(3, '/scm/v1/ordenes-preparacion-material', {
      headers: { 'X-Actor-Id': '17' },
      params: { cursor: 'orders-next', limit: 25, estado: 'EN_PREPARACION' },
    });
  });

  it('consolida únicamente el DTO real de requerimientos y OPM por composición compatible', async () => {
    getMock
      .mockResolvedValueOnce({ data: { items: [{
        tipo: 'CORRIDA_ELEGIBLE', id: 'run-2', codigo: 'COR-000002', estado: 'LIBERADA',
        orden_fabricacion: { id: 'of-2', codigo: 'OF-000002' },
        receta: { revision_id: 9, nombre: 'Crema sólido', revision: 2, estado: 'APROBADA' },
        cantidad_requerida_kg: '20.000', trabajo_color: { id: 'tc-2', codigo: 'TC-000002', estado: 'PLANIFICADO' },
      }], next_cursor: null, has_more: false, limit: 25 } })
      .mockResolvedValueOnce({ data: { items: [{
        id: 'need-1', corrida_fabricacion_id: 'run-1',
        corrida: { id: 'run-1', codigo: 'COR-000001', estado: 'LIBERADA', orden_fabricacion: { id: 'of-1', codigo: 'OF-000001' } },
        trabajo_color: { id: 'tc-1', codigo: 'TC-000001', estado: 'PLANIFICADO' },
        receta_revision_id: 9,
        receta: { revision_id: 9, nombre: 'Crema sólido', revision: 2, estado: 'APROBADA' },
        cantidad_requerida_kg: '20.000', planificada_kg: '10.000', cubierta_kg: '10.000',
        consumida_kg: '0.000', pendiente_kg: '10.000', pendiente_planificacion_kg: '10.000',
        composicion_hash: 'sha256-real', estado: 'CUBIERTA_PARCIAL', version: 2,
      }], next_cursor: 'requirements-page-2', has_more: true, limit: 25 } })
      .mockResolvedValueOnce({ data: { items: [{
        id: 'opm-1', codigo: 'OPM-000001', receta_revision_id: 9,
        receta: { revision_id: 9, nombre: 'Crema sólido', revision: 2, estado: 'APROBADA' },
        cantidad_objetivo_kg: '10.000', estado: 'LIBERADA', version: 3,
        cantidad_asignaciones: 1,
      }], next_cursor: null, has_more: false, limit: 25 } });

    const result = await obtenerColaPreparacionMaterial({ limit: 25 });

    expect(result.eligibleRuns[0]).toMatchObject({ id: 'run-2', code: 'COR-000002', requiredKg: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => item.compatibilityKey === '9:sha256-real')).toEqual(expect.objectContaining({
      compatibilityKey: '9:sha256-real',
      plannedKg: 10,
      coveredKg: 10,
      pendingKg: 10,
      activeOpm: null,
    }));
    expect(result.items.find((item) => item.compatibilityKey === 'opm:opm-1')?.activeOpm)
      .toEqual(expect.objectContaining({ id: 'opm-1', code: 'OPM-000001' }));
    expect(result.nextCursor).toEqual({ eligible: null, requirements: 'requirements-page-2', orders: null });
  });

  it('expone destinos operativos globales sin inventar un almacén', async () => {
    const payload = { items: [{
      id: 91, codigo: 'P-ENVA-INY-01', nombre: 'Punto inyectora 1', tipo: 'PUNTO_PRODUCCION',
      almacen: null, permite_saldo_libre: false, seleccionable_como_stock: false,
      usos: ['ENTREGA_PRODUCCION'],
    }] };
    getMock.mockResolvedValueOnce({ data: payload });

    await expect(listarDestinosMaterialPreparado()).resolves.toEqual(payload);
    expect(getMock).toHaveBeenCalledWith('/scm/v1/ubicaciones-material-preparado/destinos', {
      headers: { 'X-Actor-Id': '17' },
    });
  });

  it('no consulta corridas elegibles cuando el actor carece de OPM_CREAR', async () => {
    await obtenerColaPreparacionMaterial({ limit: 25, includeEligible: false });

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls.map(([path]) => path)).toEqual([
      '/scm/v1/requerimientos-preparacion',
      '/scm/v1/ordenes-preparacion-material',
    ]);
  });

  it('calcula la necesidad desde una corrida mediante el contrato canónico real', async () => {
    await generarNecesidadMaterialPreparado('run-uuid-9', {
      idempotencyKey: 'calculate-run-9',
    });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/requerimientos-preparacion/calcular', {
      corrida_fabricacion_id: 'run-uuid-9',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'calculate-run-9' },
    });
  });

  it('consulta y asigna bolsas completas de stock mediante la decisión explícita del requerimiento', async () => {
    await obtenerStockCompatibleRequerimiento('need-7', {
      limit: 25,
      cursor: 'stock-next',
    });
    await asignarStockPreparadoRequerimiento('need-7', {
      version: 4,
      bolsa_ids: ['bag-7', 'bag-8'],
      motivo: 'Cubrir primero con bolsas completas disponibles',
    }, { idempotencyKey: 'assign-stock-7' });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/requerimientos-preparacion/need-7/stock-compatible', {
      headers: { 'X-Actor-Id': '17' },
      params: { cursor: 'stock-next', limit: 25 },
    });
    expect(postMock).toHaveBeenCalledWith('/scm/v1/requerimientos-preparacion/need-7/asignaciones-stock', {
      version: 4,
      bolsa_ids: ['bag-7', 'bag-8'],
      motivo: 'Cubrir primero con bolsas completas disponibles',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'assign-stock-7' },
    });
  });

  it('libera una cobertura de stock equivocada sin mover Kardex', async () => {
    await liberarAsignacionStockMaterialPreparado('assignment-stock-7', {
      motivo: 'La cobertura corresponde a otra corrida',
    }, { idempotencyKey: 'release-stock-7' });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/asignaciones-stock-material-preparado/assignment-stock-7/liberar', {
      motivo: 'La cobertura corresponde a otra corrida',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'release-stock-7' },
    });
  });

  it('reutiliza la misma clave idempotente al reintentar una intención', async () => {
    const payload = {
      motivo: 'Consolidación Jarra 6L',
      coberturas: [{ requerimiento_id: 'need-1', cantidad_kg: '11.000' }],
    };
    const options = { idempotencyKey: 'intent-opm-0001' };

    await crearOrdenPreparacionMaterial(payload, options);
    await crearOrdenPreparacionMaterial(payload, options);

    expect(postMock).toHaveBeenNthCalledWith(1, '/scm/v1/ordenes-preparacion-material/proponer', payload, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'intent-opm-0001' },
    });
    expect(postMock).toHaveBeenNthCalledWith(2, '/scm/v1/ordenes-preparacion-material/proponer', payload, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'intent-opm-0001' },
    });
  });

  it('reserva inputs desde ubicaciones canónicas y emite una reserva hacia Preparación', async () => {
    await reservarInsumosOrdenPreparacionMaterial('opm-7', {
      version: 3,
      ubicacion_origen_ids: [31, 32],
    }, { idempotencyKey: 'reserve-inputs-7' });
    await emitirInsumoOrdenPreparacionMaterial('opm-7', 'raw-reservation-8', {
      version: 4,
      ubicacion_destino_id: 52,
      cantidad_kg: '25.000',
      motivo: 'Traslado a zona de preparación',
    }, { idempotencyKey: 'emit-input-8' });

    expect(postMock).toHaveBeenNthCalledWith(1, '/scm/v1/ordenes-preparacion-material/opm-7/reservar-insumos', {
      version: 3,
      ubicacion_origen_ids: [31, 32],
    }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'reserve-inputs-7' } });
    expect(postMock).toHaveBeenNthCalledWith(2, '/scm/v1/ordenes-preparacion-material/opm-7/reservas-insumo/raw-reservation-8/emitir', {
      version: 4,
      ubicacion_destino_id: 52,
      cantidad_kg: '25.000',
      motivo: 'Traslado a zona de preparación',
    }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'emit-input-8' } });
  });

  it('registra una lectura manual y exige que el segundo actor repita los tres pesos', async () => {
    await registrarLecturaPesoPreparacion('opm-7', {
      version: 5,
      tipo_uso: 'APORTE',
      bruto_kg: '25.100',
      tara_kg: '0.100',
      neto_kg: '25.000',
      motivo: 'Aporte de material virgen',
      evidencia_ref: 'UAT-lectura-001',
    }, { idempotencyKey: 'read-input-7' });
    await confirmarLecturaPesoPreparacion('reading-7', {
      version: 1,
      bruto_kg: '25.100',
      tara_kg: '0.100',
      neto_kg: '25.000',
      motivo: 'Lectura verificada por segundo actor',
    }, { idempotencyKey: 'confirm-reading-7' });

    expect(postMock.mock.calls[0][1]).toMatchObject({ metodo: 'CONTINGENCIA_MANUAL' });
    expect(postMock.mock.calls[1]).toEqual([
      '/scm/v1/lecturas-preparacion/reading-7/confirmar-segundo-actor',
      {
        version: 1,
        bruto_kg: '25.100',
        tara_kg: '0.100',
        neto_kg: '25.000',
        motivo: 'Lectura verificada por segundo actor',
      },
      { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'confirm-reading-7' } },
    ]);
  });

  it('asigna cada lectura de bolsa a una necesidad concreta sin enviar ese campo en aportes', async () => {
    await registrarLecturaPesoPreparacion('opm-7', {
      version: 8,
      tipo_uso: 'BOLSA_SALIDA',
      asignacion_requerimiento_id: 'assignment-need-15',
      bruto_kg: '15.120',
      tara_kg: '0.120',
      neto_kg: '15.000',
      motivo: 'Bolsa completa para corrida 52',
      evidencia_ref: 'UAT-OPM-BOLSA-15',
    }, { idempotencyKey: 'bag-reading-15' });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/ordenes-preparacion-material/opm-7/lecturas', {
      version: 8,
      tipo_uso: 'BOLSA_SALIDA',
      asignacion_requerimiento_id: 'assignment-need-15',
      bruto_kg: '15.120',
      tara_kg: '0.120',
      neto_kg: '15.000',
      motivo: 'Bolsa completa para corrida 52',
      evidencia_ref: 'UAT-OPM-BOLSA-15',
      metodo: 'CONTINGENCIA_MANUAL',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'bag-reading-15' },
    });
  });

  it('invalida una lectura provisional equivocada sin borrarla del historial', async () => {
    await invalidarLecturaPesoPreparacion('reading-error-7', {
      version: 2,
      motivo: 'Lectura digitada sobre la bolsa equivocada',
    }, { idempotencyKey: 'invalidate-reading-7' });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/lecturas-preparacion/reading-error-7/invalidar', {
      version: 2,
      motivo: 'Lectura digitada sobre la bolsa equivocada',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'invalidate-reading-7' },
    });
  });

  it('recibe una bolsa en una ubicación canónica antes de Calidad', async () => {
    await recibirBolsaMaterialPreparado('lot-7', 'bag-7', {
      ubicacion_id: 31,
      motivo: 'Recepción física confirmada por Almacén',
    }, { idempotencyKey: 'receive-bag-7' });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/lotes-material-preparado/lot-7/bolsas/bag-7/recibir', {
      ubicacion_id: 31,
      motivo: 'Recepción física confirmada por Almacén',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'receive-bag-7' },
    });
  });

  it('resuelve Calidad bolsa por bolsa después de la recepción', async () => {
    await decidirCalidadBolsaMaterialPreparado('lot-7', 'bag-7', {
      decision: 'LIBERAR',
      motivo: 'Muestra conforme y bolsa identificada',
    }, { idempotencyKey: 'quality-bag-7' });

    expect(postMock).toHaveBeenCalledWith('/scm/v1/lotes-material-preparado/lot-7/bolsas/bag-7/calidad', {
      decision: 'LIBERAR',
      motivo: 'Muestra conforme y bolsa identificada',
    }, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'quality-bag-7' },
    });
  });

  it('ejecuta el contrato L2 completo con bolsa entera y custodia explícita', async () => {
    await listarReservasMaterialPreparadoTrabajo('work-7');
    await reservarMaterialPreparadoTrabajo('work-7', {
      asignacion_id: 'assignment-7', bolsa_id: 'bag-7', motivo: 'Vincular bolsa completa',
    }, { idempotencyKey: 'reserve-prepared-7' });
    await prepararEntregaMaterialPreparado('reservation-7', {
      version: 1, ubicacion_destino_id: 91, motivo: 'Preparar para inyectora 1',
    }, { idempotencyKey: 'prepare-delivery-7' });
    await despacharEntregaMaterialPreparado('delivery-7', {
      version: 1, motivo: 'Despacho físico controlado',
    }, { idempotencyKey: 'dispatch-delivery-7' });
    await recibirEntregaMaterialPreparadoMaquina('delivery-7', {
      version: 2, motivo: 'Maquinista recibe bolsa íntegra',
    }, { idempotencyKey: 'receive-machine-7' });
    await consumirEntregaMaterialPreparado('work-7', {
      entrega_id: 'delivery-7', version: 3, motivo: 'Consumo de bolsa completa',
    }, { idempotencyKey: 'consume-delivery-7' });
    await retornarEntregaMaterialPreparado('delivery-8', {
      version: 3, ubicacion_retorno_id: 31, motivo: 'Retorno total sin apertura',
    }, { idempotencyKey: 'return-delivery-8' });
    await liberarReservaMaterialPreparado('reservation-8', {
      version: 4, motivo: 'Cerrar reserva devuelta',
    }, { idempotencyKey: 'release-reservation-8' });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/trabajos-color/work-7/reservas-material-preparado', {
      headers: { 'X-Actor-Id': '17' },
    });
    expect(postMock.mock.calls).toEqual(expect.arrayContaining([
      ['/scm/v1/trabajos-color/work-7/reservas-material-preparado', {
        asignacion_id: 'assignment-7', bolsa_id: 'bag-7', motivo: 'Vincular bolsa completa',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'reserve-prepared-7' } }],
      ['/scm/v1/reservas-material-preparado/reservation-7/preparar-entrega', {
        version: 1, ubicacion_destino_id: 91, motivo: 'Preparar para inyectora 1',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'prepare-delivery-7' } }],
      ['/scm/v1/entregas-material-preparado/delivery-7/despachar', {
        version: 1, motivo: 'Despacho físico controlado',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'dispatch-delivery-7' } }],
      ['/scm/v1/entregas-material-preparado/delivery-7/recibir-maquina', {
        version: 2, motivo: 'Maquinista recibe bolsa íntegra',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'receive-machine-7' } }],
      ['/scm/v1/trabajos-color/work-7/consumos-material-preparado', {
        entrega_id: 'delivery-7', version: 3, motivo: 'Consumo de bolsa completa',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'consume-delivery-7' } }],
      ['/scm/v1/entregas-material-preparado/delivery-8/retornar', {
        version: 3, ubicacion_retorno_id: 31, motivo: 'Retorno total sin apertura',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'return-delivery-8' } }],
      ['/scm/v1/reservas-material-preparado/reservation-8/liberar', {
        version: 4, motivo: 'Cerrar reserva devuelta',
      }, { headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'release-reservation-8' } }],
    ]));
  });

  it('reutiliza la clave idempotente del consumo L2 en un replay', async () => {
    const payload = { entrega_id: 'delivery-7', version: 3, motivo: 'Consumo completo' };
    const options = { idempotencyKey: 'consume-intent-7' };

    await consumirEntregaMaterialPreparado('work-7', payload, options);
    await consumirEntregaMaterialPreparado('work-7', payload, options);

    expect(postMock).toHaveBeenNthCalledWith(1, '/scm/v1/trabajos-color/work-7/consumos-material-preparado', payload, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'consume-intent-7' },
    });
    expect(postMock).toHaveBeenNthCalledWith(2, '/scm/v1/trabajos-color/work-7/consumos-material-preparado', payload, {
      headers: { 'X-Actor-Id': '17', 'Idempotency-Key': 'consume-intent-7' },
    });
  });

});
