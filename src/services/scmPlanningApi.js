import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const data = async (request) => (await request()).data;

export const listarOpDemandaScm = () => data(
  () => api.get('/scm/v1/ordenes-produccion', config()),
);

export const crearOpDemandaScm = (payload) => data(
  () => api.post('/scm/v1/ordenes-produccion', payload, config(true)),
);

export const obtenerPlanOpScm = (orderId) => data(
  () => api.get(`/scm/v1/ordenes-produccion/${orderId}/plan`, config()),
);

export const aprobarOpDemandaScm = (order) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/aprobar`,
    { version: order.version },
    config(true),
  ),
);

export const cancelarOpDemandaScm = (order, motivo) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/cancelar`,
    { version: order.version, motivo },
    config(true),
  ),
);

export const calcularPlanOpScm = (order) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/calcular-plan`,
    { version: order.version },
    config(true),
  ),
);

export const actualizarRutasOpScm = (order) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/actualizar-rutas`,
    { version: order.version },
    config(true),
  ),
);

export const ajustarMetasPlanOpScm = (order, plan, ajustes, motivo) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/ajustar-metas`,
    {
      version: order.version,
      plan_id: plan.id,
      content_hash: plan.content_hash,
      ajustes,
      motivo,
    },
    config(true),
  ),
);

export const confirmarPlanOpScm = (order, plan) => data(
  () => api.post(
    `/scm/v1/ordenes-produccion/${order.id}/confirmar-plan`,
    {
      version: order.version,
      plan_id: plan.id,
      content_hash: plan.content_hash,
    },
    config(true),
  ),
);
