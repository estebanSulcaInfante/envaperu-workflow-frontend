import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const actorConfig = ({ idempotent = false, idempotencyKey, params } = {}) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': idempotencyKey || crypto.randomUUID() } : {}),
  },
  ...(params ? { params } : {}),
});

const data = async (request) => (await request()).data;
const number = (value) => Number(value || 0);

const recipeOf = (recipe) => ({
  id: recipe.revision_id,
  name: recipe.nombre,
  revision: recipe.revision,
  status: recipe.estado,
});

const normalizePreparedQueue = ({ requirementsPage, ordersPage, eligiblePage }) => {
  const eligibleRuns = eligiblePage.items.map((item) => ({
    id: item.id,
    code: item.codigo,
    order: item.orden_fabricacion,
    recipe: recipeOf(item.receta),
    requiredKg: number(item.cantidad_requerida_kg),
    workColor: item.trabajo_color,
  }));
  const groups = new Map();

  requirementsPage.items.forEach((requirement) => {
    const key = `${requirement.receta_revision_id}:${requirement.composicion_hash}`;
    const need = {
      id: requirement.id,
      runId: requirement.corrida.id,
      runCode: requirement.corrida.codigo,
      workColorId: requirement.trabajo_color?.id || '',
      workColorCode: requirement.trabajo_color?.codigo || requirement.corrida.codigo,
      requiredKg: number(requirement.cantidad_requerida_kg),
      coveredKg: number(requirement.cubierta_kg),
      plannedKg: number(requirement.planificada_kg),
      pendingKg: number(requirement.pendiente_planificacion_kg),
      uncoveredKg: number(requirement.pendiente_kg),
      status: requirement.estado,
      version: requirement.version,
    };
    const current = groups.get(key) || {
      compatibilityKey: key,
      recipe: recipeOf(requirement.receta),
      needs: [],
      requiredKg: 0,
      coveredKg: 0,
      plannedKg: 0,
      pendingKg: 0,
      activeOpm: null,
    };
    current.needs.push(need);
    current.requiredKg += need.requiredKg;
    current.coveredKg += need.coveredKg;
    current.plannedKg += need.plannedKg;
    current.pendingKg += need.pendingKg;
    groups.set(key, current);
  });

  ordersPage.items.forEach((order) => {
    const summary = {
      id: order.id,
      code: order.codigo,
      status: order.estado,
      recipe: recipeOf(order.receta),
      targetKg: number(order.cantidad_objetivo_kg),
    };
    groups.set(`opm:${order.id}`, {
      compatibilityKey: `opm:${order.id}`,
      recipe: summary.recipe,
      needs: [],
      requiredKg: summary.targetKg,
      coveredKg: 0,
      plannedKg: summary.targetKg,
      pendingKg: 0,
      activeOpm: summary,
    });
  });

  const nextCursor = [
    eligiblePage.next_cursor, requirementsPage.next_cursor, ordersPage.next_cursor,
  ].some(Boolean) ? {
      eligible: eligiblePage.next_cursor,
      requirements: requirementsPage.next_cursor,
      orders: ordersPage.next_cursor,
    } : null;
  return {
    items: Array.from(groups.values()),
    eligibleRuns,
    nextCursor,
  };
};

const emptyPage = { items: [], next_cursor: null, has_more: false };
const pageRequest = (path, { cursor, limit, estado, continuing }) => {
  if (continuing && !cursor) return Promise.resolve(emptyPage);
  return data(() => api.get(path, actorConfig({
    params: { limit, ...(cursor ? { cursor } : {}), ...(estado ? { estado } : {}) },
  })));
};

export const obtenerColaPreparacionMaterial = async ({
  cursor = null, limit = 25, estadoRequerimiento, estadoOpm, includeEligible = true,
} = {}) => {
  const continuing = cursor !== null;
  const [eligiblePage, requirementsPage, ordersPage] = await Promise.all([
    includeEligible
      ? pageRequest('/scm/v1/corridas-fabricacion/elegibles-preparacion', {
        cursor: cursor?.eligible, limit, continuing,
      })
      : Promise.resolve(emptyPage),
    pageRequest('/scm/v1/requerimientos-preparacion', {
      cursor: cursor?.requirements, limit, estado: estadoRequerimiento, continuing,
    }),
    pageRequest('/scm/v1/ordenes-preparacion-material', {
      cursor: cursor?.orders, limit, estado: estadoOpm, continuing,
    }),
  ]);
  return normalizePreparedQueue({ requirementsPage, ordersPage, eligiblePage });
};

export const listarDestinosMaterialPreparado = () => data(
  () => api.get('/scm/v1/ubicaciones-material-preparado/destinos', actorConfig()),
);

export const obtenerDetalleOrdenPreparacionMaterial = (opmId) => data(
  () => api.get(`/scm/v1/ordenes-preparacion-material/${opmId}`, actorConfig()),
);

export const obtenerDetalleLoteMaterialPreparado = (lotId) => data(
  () => api.get(`/scm/v1/lotes-material-preparado/${lotId}`, actorConfig()),
);

export const generarNecesidadMaterialPreparado = (runId, options = {}) => data(
  () => api.post('/scm/v1/requerimientos-preparacion/calcular', {
    corrida_fabricacion_id: runId,
  }, actorConfig({ idempotent: true, ...options })),
);

export const obtenerStockCompatibleRequerimiento = (requirementId, {
  cursor = null, limit = 25,
} = {}) => data(
  () => api.get(`/scm/v1/requerimientos-preparacion/${requirementId}/stock-compatible`, actorConfig({
    params: { limit, ...(cursor ? { cursor } : {}) },
  })),
);

export const asignarStockPreparadoRequerimiento = (requirementId, payload, options = {}) => data(
  () => api.post(`/scm/v1/requerimientos-preparacion/${requirementId}/asignaciones-stock`, payload, actorConfig({ idempotent: true, ...options })),
);

export const liberarAsignacionStockMaterialPreparado = (assignmentId, payload, options = {}) => data(
  () => api.post(`/scm/v1/asignaciones-stock-material-preparado/${assignmentId}/liberar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const crearOrdenPreparacionMaterial = (payload, options = {}) => data(
  () => api.post('/scm/v1/ordenes-preparacion-material/proponer', payload, actorConfig({ idempotent: true, ...options })),
);

export const liberarOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/liberar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const reservarInsumosOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/reservar-insumos`, payload, actorConfig({ idempotent: true, ...options })),
);

export const emitirInsumoOrdenPreparacionMaterial = (opmId, reservationId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/reservas-insumo/${reservationId}/emitir`, payload, actorConfig({ idempotent: true, ...options })),
);

export const iniciarOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/iniciar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const registrarLecturaPesoPreparacion = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/lecturas`, {
    ...payload,
    metodo: 'CONTINGENCIA_MANUAL',
  }, actorConfig({ idempotent: true, ...options })),
);

export const confirmarLecturaPesoPreparacion = (readingId, payload, options = {}) => data(
  () => api.post(`/scm/v1/lecturas-preparacion/${readingId}/confirmar-segundo-actor`, payload, actorConfig({ idempotent: true, ...options })),
);

export const invalidarLecturaPesoPreparacion = (readingId, payload, options = {}) => data(
  () => api.post(`/scm/v1/lecturas-preparacion/${readingId}/invalidar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const incorporarAporteOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/aportes`, payload, actorConfig({ idempotent: true, ...options })),
);

export const conciliarOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/conciliar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const recibirBolsaMaterialPreparado = (lotId, bagId, payload, options = {}) => data(
  () => api.post(`/scm/v1/lotes-material-preparado/${lotId}/bolsas/${bagId}/recibir`, payload, actorConfig({ idempotent: true, ...options })),
);

export const cerrarOrdenPreparacionMaterial = (opmId, payload, options = {}) => data(
  () => api.post(`/scm/v1/ordenes-preparacion-material/${opmId}/cerrar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const decidirCalidadBolsaMaterialPreparado = (lotId, bagId, payload, options = {}) => data(
  () => api.post(`/scm/v1/lotes-material-preparado/${lotId}/bolsas/${bagId}/calidad`, payload, actorConfig({ idempotent: true, ...options })),
);

export const listarReservasMaterialPreparadoTrabajo = (workColorId) => data(
  () => api.get(`/scm/v1/trabajos-color/${workColorId}/reservas-material-preparado`, actorConfig()),
);

export const reservarMaterialPreparadoTrabajo = (workColorId, payload, options = {}) => data(
  () => api.post(`/scm/v1/trabajos-color/${workColorId}/reservas-material-preparado`, payload, actorConfig({ idempotent: true, ...options })),
);

export const prepararEntregaMaterialPreparado = (reservationId, payload, options = {}) => data(
  () => api.post(`/scm/v1/reservas-material-preparado/${reservationId}/preparar-entrega`, payload, actorConfig({ idempotent: true, ...options })),
);

export const despacharEntregaMaterialPreparado = (deliveryId, payload, options = {}) => data(
  () => api.post(`/scm/v1/entregas-material-preparado/${deliveryId}/despachar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const recibirEntregaMaterialPreparadoMaquina = (deliveryId, payload, options = {}) => data(
  () => api.post(`/scm/v1/entregas-material-preparado/${deliveryId}/recibir-maquina`, payload, actorConfig({ idempotent: true, ...options })),
);

export const resolverRecepcionMaterialPreparadoQr = (payload) => data(
  () => api.post('/scm/v1/recepciones-material-preparado/resolver-qr', payload, actorConfig()),
);

export const confirmarRecepcionMaterialPreparadoQr = (payload, options = {}) => data(
  () => api.post('/scm/v1/recepciones-material-preparado/confirmar-qr', payload, actorConfig({ idempotent: true, ...options })),
);

export const consumirEntregaMaterialPreparado = (workColorId, payload, options = {}) => data(
  () => api.post(`/scm/v1/trabajos-color/${workColorId}/consumos-material-preparado`, payload, actorConfig({ idempotent: true, ...options })),
);

export const retornarEntregaMaterialPreparado = (deliveryId, payload, options = {}) => data(
  () => api.post(`/scm/v1/entregas-material-preparado/${deliveryId}/retornar`, payload, actorConfig({ idempotent: true, ...options })),
);

export const liberarReservaMaterialPreparado = (reservationId, payload, options = {}) => data(
  () => api.post(`/scm/v1/reservas-material-preparado/${reservationId}/liberar`, payload, actorConfig({ idempotent: true, ...options })),
);

export { normalizePreparedQueue };
