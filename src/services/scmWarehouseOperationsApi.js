import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = (idempotent = false) => ({
  'X-Actor-Id': String(obtenerActorScm()),
  ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
});
const data = async (request) => (await request()).data;

export const listarAlmacenesScm = () => data(() => api.get(
  '/scm/v1/almacenes', { headers: headers() },
));
export const obtenerAlcanceAlmacenScm = () => data(() => api.get(
  '/scm/v1/mi-alcance-almacen', { headers: headers() },
));
export const abrirSesionOperacionAlmacenScm = (payload) => data(() => api.post(
  '/scm/v1/operaciones-almacen/sesiones', payload, { headers: headers(true) },
));
export const escanearSesionOperacionAlmacenScm = (sessionId, codigo) => data(() => api.post(
  `/scm/v1/operaciones-almacen/sesiones/${encodeURIComponent(sessionId)}/escanear`,
  { codigo }, { headers: headers(true) },
));
export const confirmarSesionOperacionAlmacenScm = (sessionId, payload) => data(() => api.post(
  `/scm/v1/operaciones-almacen/sesiones/${encodeURIComponent(sessionId)}/confirmar`,
  payload, { headers: headers(true) },
));
export const quitarItemSesionOperacionAlmacenScm = (sessionId, itemId, version) => data(() => api.delete(
  `/scm/v1/operaciones-almacen/sesiones/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`,
  { data: { version }, headers: headers(true) },
));
export const listarTransferenciasScm = () => data(() => api.get(
  '/scm/v1/transferencias?limit=100', { headers: headers() },
));
export const prepararRetornoTransferenciaScm = (transferId, existenciaIds = []) => data(() => api.post(
  `/scm/v1/transferencias/${encodeURIComponent(transferId)}/retorno`,
  { existencia_ids: existenciaIds }, { headers: headers(true) },
));
export const obtenerResumenInventarioScm = () => data(() => api.get(
  '/scm/v1/inventario/resumen', { headers: headers() },
));
export const obtenerTrazabilidadUnidadScm = (code) => data(() => api.get(
  `/scm/v1/unidades-logisticas/${encodeURIComponent(code)}/trazabilidad`,
  { headers: headers() },
));
export const crearAlmacenScm = (payload) => data(() => api.post(
  '/scm/v1/almacenes', payload, { headers: headers(true) },
));
export const crearUbicacionAlmacenScm = (warehouseId, payload) => data(() => api.post(
  `/scm/v1/almacenes/${encodeURIComponent(warehouseId)}/ubicaciones`,
  payload, { headers: headers(true) },
));
export const asignarTrabajadorAlmacenScm = (warehouseId, payload) => data(() => api.post(
  `/scm/v1/almacenes/${encodeURIComponent(warehouseId)}/trabajadores`,
  payload, { headers: headers(true) },
));
