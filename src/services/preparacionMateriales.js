import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

export const PREPARACION_MATERIALES_SOURCE = 'API';

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const requestData = async (request) => (await request()).data;
const number = (value) => Number(value || 0);

const mapRequirement = (item) => ({
  id: item.id,
  material: item.material.nombre,
  codigo: item.material.codigo,
  tipo: item.tipo_componente.replaceAll('_', ' '),
  planKg: number(item.cantidad_plan_kg),
  reservadoKg: number(item.cantidad_reservada_kg),
  emitidoKg: number(item.cantidad_emitida_neta_kg),
  consumidoPreparacionKg: number(item.cantidad_consumida_preparacion_kg),
  consumidoMaquinaKg: 0,
  reservas: item.reservas,
});

const mapRun = (item) => {
  const requirements = item.requerimientos.map(mapRequirement);
  const reservations = item.requerimientos.flatMap((requirement) => requirement.reservas.map((reservation) => ({
    id: reservation.id,
    loteInterno: reservation.id.slice(0, 8).toUpperCase(),
    loteProveedor: 'Apertura / saldo agregado',
    material: requirement.material.nombre,
    ubicacion: reservation.ubicacion.nombre,
    calidad: 'LIBERADO',
    disponibleKg: number(reservation.cantidad_kg),
    asignadoKg: number(reservation.cantidad_kg),
    emitidaNetaKg: number(reservation.emitida_neta_kg),
  })));
  const emissions = item.requerimientos.flatMap((requirement) => requirement.reservas.flatMap(
    (reservation) => reservation.emisiones.map((emission) => ({
      id: emission.id,
      reservaId: reservation.id,
      lote: reservation.id.slice(0, 8).toUpperCase(),
      material: requirement.material.nombre,
      cantidadKg: number(emission.cantidad_kg),
      devueltaKg: number(emission.cantidad_devuelta_kg),
      consumidaKg: number(emission.cantidad_consumida_kg),
      netaKg: number(emission.cantidad_neta_kg),
      destino: emission.destino.nombre,
      balanza: 'No aplica',
      trabajador: `Actor #${emission.actor_id}`,
      estado: number(emission.cantidad_neta_kg) > 0 ? 'EN PREPARACIÓN' : 'DEVUELTA',
    })),
  ));
  const planned = requirements.reduce((sum, value) => sum + value.planKg, 0);
  const reserved = requirements.reduce((sum, value) => sum + value.reservadoKg, 0);
  const emitted = requirements.reduce((sum, value) => sum + value.emitidoKg, 0);
  const premix = item.premezclas?.at(-1);
  const stageIndex = premix ? 3 : requirements.length === 0 ? 0 : emitted >= planned ? 2 : reserved >= planned ? 1 : 0;
  const output = item.corrida.salidas?.[0];
  return {
    id: item.corrida.codigo,
    runId: item.corrida.id,
    orderId: item.orden_fabricacion.id,
    color: item.corrida.color || 'Color por configurar',
    receta: item.corrida.receta_revision_id || 'Sin requerimientos',
    metaKg: item.corrida.salidas?.reduce((sum, value) => sum + number(value.kg_estandar_objetivo), 0) || planned,
    etapa: premix ? 'PREMEZCLA_CONFIRMADA' : requirements.length === 0 ? 'REQUERIMIENTO_PENDIENTE' : emitted >= planned ? 'EMITIDA' : reserved >= planned ? 'RESERVADA' : 'PLANIFICADA',
    etapaIndex: stageIndex,
    requerimientos: requirements,
    asignaciones: reservations,
    emisiones: emissions,
    premezcla: premix ? {
      id: premix.codigo,
      preparacionId: premix.id,
      cantidadKg: number(premix.cantidad_kg),
      metodoCantidad: 'Suma de emisiones incorporadas',
      ubicacion: premix.ubicacion_codigo,
      trabajador: `Actor #${premix.actor_id}`,
      fecha: premix.created_at,
      estado: premix.estado,
      genealogiaTipo: premix.genealogia_tipo,
      inputs: premix.inputs.map((input) => {
        const emission = emissions.find((value) => value.id === input.emision_id);
        return {
          emisionId: input.emision_id,
          lote: emission?.lote || 'EmisiÃ³n trazada',
          material: input.material.nombre,
          cantidadKg: number(input.cantidad_kg),
        };
      }),
    } : null,
    eventos: [],
    dosisColorante: {
      dosisGr: requirements.find((value) => value.tipo === 'COLORANTE')?.planKg * 1000 || 0,
      baseKg: 1,
      formula: requirements.find((value) => value.tipo === 'COLORANTE')?.codigo || 'Se mostrará al generar requerimientos',
      planKg: requirements.find((value) => value.tipo === 'COLORANTE')?.planKg || 0,
    },
    producto: output?.nombre || item.corrida.codigo,
  };
};

export const obtenerPreparacionMateriales = async () => {
  const response = await requestData(() => api.get('/scm/v1/materiales-ejecucion', config()));
  const grouped = new Map();
  response.items.forEach((item) => {
    const key = item.orden_fabricacion.codigo;
    if (!grouped.has(key)) {
      grouped.set(key, {
        numeroOp: key,
        orderId: item.orden_fabricacion.id,
        producto: item.corrida.salidas?.map((value) => value.nombre).join(', ') || 'OF sin salida',
        maquina: item.orden_fabricacion.maquina_prevista_id ? `Máquina #${item.orden_fabricacion.maquina_prevista_id}` : 'Sin máquina',
        estado: item.orden_fabricacion.estado,
        lotes: [],
      });
    }
    grouped.get(key).lotes.push(mapRun(item));
  });
  return {
    ordenes: Array.from(grouped.values()),
    capabilities: {
      generar: { apiReady: true }, reservar: { apiReady: true },
      emitir: { apiReady: true }, devolver: { apiReady: true },
      confirmarPremezcla: { apiReady: true },
    },
  };
};

export const generarRequerimientosMaterial = (orderId) => requestData(
  () => api.post(`/scm/v1/ordenes-fabricacion/${orderId}/requerimientos-material/generar`, {}, config(true)),
);

export const reservarMaterialesCorrida = (runId) => requestData(
  () => api.post(`/scm/v1/corridas-fabricacion/${runId}/materiales/reservar`, {}, config(true)),
);

export const emitirReservaMaterial = (reservationId, payload) => requestData(
  () => api.post(`/scm/v1/reservas-material/${reservationId}/emitir`, payload, config(true)),
);

export const devolverEmisionMaterial = (emissionId, payload) => requestData(
  () => api.post(`/scm/v1/emisiones-material/${emissionId}/devolver`, payload, config(true)),
);

export const confirmarPremezclaCorrida = (runId, payload) => requestData(
  () => api.post(`/scm/v1/corridas-fabricacion/${runId}/premezclas`, payload, config(true)),
);
