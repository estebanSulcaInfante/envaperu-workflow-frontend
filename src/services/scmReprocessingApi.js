import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const config = (idempotent = false) => ({
  headers: {
    'X-Actor-Id': String(obtenerActorScm()),
    ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  },
});

const data = async (request) => (await request()).data;

export const listarReferenciasReproceso = () => data(
  () => api.get('/scm/v1/reproceso/referencias', config()),
);
export const listarMaestroReproceso = (type) => data(
  () => api.get(`/scm/v1/reproceso/maestros/${type}`, config()),
);
export const crearMaestroReproceso = (type, payload) => data(
  () => api.post(`/scm/v1/reproceso/maestros/${type}`, payload, config()),
);
export const actualizarMaestroReproceso = (type, id, payload) => data(
  () => api.patch(`/scm/v1/reproceso/maestros/${type}/${id}`, payload, config()),
);
export const listarReglasCompatibilidad = () => data(
  () => api.get('/scm/v1/reproceso/reglas-compatibilidad', config()),
);
export const crearReglaCompatibilidad = (payload) => data(
  () => api.post('/scm/v1/reproceso/reglas-compatibilidad', payload, config()),
);
export const aprobarReglaCompatibilidad = (id) => data(
  () => api.post(`/scm/v1/reproceso/reglas-compatibilidad/${id}/aprobar`, {}, config()),
);
export const listarMermas = () => data(
  () => api.get('/scm/v1/reproceso/mermas', config()),
);
export const registrarMerma = (payload) => data(
  () => api.post('/scm/v1/reproceso/mermas', payload, config(true)),
);
export const listarOrdenesMolienda = () => data(
  () => api.get('/scm/v1/reproceso/ordenes-molienda', config()),
);
export const crearOrdenMolienda = (payload) => data(
  () => api.post('/scm/v1/reproceso/ordenes-molienda', payload, config()),
);
export const agregarAporteMolienda = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/aportes`, payload, config()),
);
export const validarOrdenMolienda = (id) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/validar`, {}, config()),
);
export const aprobarExcepcionMolienda = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/aprobar-excepcion`, payload, config()),
);
export const registrarPesosPreMolino = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/pesos-pre-molino`, payload, config()),
);
export const autorizarDiferenciaCustodia = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/aportes/${id}/autorizar-diferencia`, payload, config()),
);
export const iniciarOrdenMolienda = (id) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/iniciar`, {}, config()),
);
export const cerrarOrdenMolienda = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/ordenes-molienda/${id}/cerrar`, payload, config(true)),
);
export const listarLotesRecuperados = () => data(
  () => api.get('/scm/v1/reproceso/lotes-recuperados', config()),
);
export const liberarLoteRecuperado = (id, payload) => data(
  () => api.post(`/scm/v1/reproceso/lotes-recuperados/${id}/liberar`, payload, config()),
);

export const listarAlertasOperativas = (params = {}) => data(
  () => api.get('/scm/v1/alertas', { ...config(), params }),
);
export const gestionarAlertaOperativa = (id, action, payload = {}) => data(
  () => api.post(`/scm/v1/alertas/${id}/${action}`, payload, config()),
);
export const listarReglasAlerta = () => data(
  () => api.get('/scm/v1/alertas/reglas', config()),
);
export const crearRevisionReglaAlerta = (code, payload) => data(
  () => api.post(`/scm/v1/alertas/reglas/${code}/revisiones`, payload, config()),
);
export const aprobarRevisionReglaAlerta = (code, id) => data(
  () => api.post(`/scm/v1/alertas/reglas/${code}/revisiones/${id}/aprobar`, {}, config()),
);
