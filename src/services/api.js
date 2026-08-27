import axios from 'axios';
import { getAccessToken } from '../auth/supabaseClient';
import { SCM_AUTH_MODE } from '../config/runtime';

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const API_BASE_URL = apiOrigin ? `${apiOrigin}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors?.request?.use(async (requestConfig) => {
  if (SCM_AUTH_MODE !== 'supabase') return requestConfig;
  const token = await getAccessToken();
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

const withoutInternalIdentifiers = (data, identifiers) => {
  const payload = { ...data };
  identifiers.forEach((identifier) => delete payload[identifier]);
  return payload;
};

// Crear nueva orden de producción
export const crearOrden = async (data) => {
  const response = await api.post('/ordenes', data);
  return response.data;
};

// Obtener todas las órdenes
export const obtenerOrdenes = async () => {
  const response = await api.get('/ordenes');
  return response.data;
};

// Obtener una orden específica
export const obtenerOrden = async (numeroOp) => {
  const response = await api.get(`/ordenes/${numeroOp}`);
  return response.data;
};

// Cambiar estado de una orden (abrir/cerrar)
export const toggleEstadoOrden = async (numeroOp, activa) => {
  const response = await api.put(`/ordenes/${numeroOp}/estado`, { activa });
  return response.data;
};

// Obtener datos del QR (base64 y URL del form)
export const obtenerQRData = async (numeroOp, size = 200) => {
  const response = await api.get(`/ordenes/${numeroOp}/qr-data`, {
    params: { size }
  });
  return response.data;
};

// Descargar Excel de una orden
export const descargarExcel = async (numeroOp) => {
  const response = await api.get(`/ordenes/${numeroOp}/excel`, {
    responseType: 'blob'
  });
  
  // Crear URL y descargar
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${numeroOp}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// URL directa del QR como imagen
export const getQRImageUrl = (numeroOp, size = 200) => {
  return `${API_BASE_URL}/ordenes/${numeroOp}/qr?size=${size}`;
};

// Buscar productos para autocomplete
export const buscarProductos = async (query = '') => {
  const response = await api.get('/productos', { params: { q: query, limit: 20 } });
  return response.data;
};

// Buscar piezas/moldes para autocomplete
export const buscarPiezasGlobales = async (query = '', limit = 200, options = {}) => {
  const response = await api.get('/piezas', {
    params: {
      q: query,
      limit,
      ...(options.includeInactiveVariants ? { include_inactive_variants: true } : {}),
    },
  });
  return response.data;
};

export const buscarPiezasColor = async (query = '') => {
  const response = await api.get('/piezas-color', { params: { q: query, limit: 20 } });
  return response.data;
};

// Obtener todos los colores
export const obtenerColores = async (params = {}) => {
  const response = await api.get('/colores', { params });
  return response.data;
};

// Obtener todas las líneas
export const obtenerLineas = async (params = {}) => {
  const response = await api.get('/catalogo/lineas', { params });
  return response.data;
};

// Obtener todas las familias
export const obtenerFamilias = async (params = {}) => {
  const response = await api.get('/catalogo/familias', { params });
  return response.data;
};

export const crearLinea = async (data) => {
  const response = await api.post('/catalogo/lineas', data);
  return response.data;
};

export const actualizarLinea = async (id, data) => {
  const response = await api.put(`/catalogo/lineas/${id}`, data);
  return response.data;
};

export const inactivarLinea = async (id, version) => {
  const response = await api.delete(`/catalogo/lineas/${id}`, { params: { version } });
  return response.data;
};

export const crearFamilia = async (data) => {
  const response = await api.post('/catalogo/familias', data);
  return response.data;
};

export const actualizarFamilia = async (id, data) => {
  const response = await api.put(`/catalogo/familias/${id}`, data);
  return response.data;
};

export const inactivarFamilia = async (id, version) => {
  const response = await api.delete(`/catalogo/familias/${id}`, { params: { version } });
  return response.data;
};

export const obtenerFamiliasDeLinea = async (lineaId, params = {}) => {
  const response = await api.get(`/catalogo/lineas/${lineaId}/familias`, { params });
  return response.data;
};

export const asociarFamiliaALinea = async (lineaId, familiaId) => {
  const response = await api.post(`/catalogo/lineas/${lineaId}/familias`, { familia_id: familiaId });
  return response.data;
};

// Crea una Familia y su asociación con la Línea dentro de la misma transacción.
export const crearFamiliaEnLinea = async (lineaId, familia) => {
  const response = await api.post(`/catalogo/lineas/${lineaId}/familias`, { familia });
  return response.data;
};

export const desasociarFamiliaDeLinea = async (lineaId, familiaId) => {
  const response = await api.delete(`/catalogo/lineas/${lineaId}/familias/${familiaId}`);
  return response.data;
};

// Obtener todas las familias de color
export const obtenerFamiliasColor = async (params = {}) => {
  const response = await api.get('/familias-color', { params });
  return response.data;
};

export const crearFamiliaColor = async (data) => {
  const response = await api.post('/familias-color', data);
  return response.data;
};

export const actualizarFamiliaColor = async (id, data) => {
  const response = await api.put(`/familias-color/${id}`, data);
  return response.data;
};

export const inactivarFamiliaColor = async (id, version) => {
  const response = await api.delete(`/familias-color/${id}`, { params: { version } });
  return response.data;
};

// Obtener todas las formas (piezas de molde)
export const obtenerFormas = async () => {
  const response = await api.get('/formas');
  return response.data;
};

// Crear ColorProduccion on-the-fly. Acepta el string legacy o el contrato
// normalizado { nombre, familia_color_id }.
export const crearColor = async (color) => {
  const payload = typeof color === 'string' ? { nombre: color } : color;
  const response = await api.post('/colores', payload);
  return response.data;
};

export const actualizarColor = async (id, data) => {
  const response = await api.put(`/colores/${id}`, data);
  return response.data;
};

export const inactivarColor = async (id, version) => {
  const response = await api.delete(`/colores/${id}`, { params: { version } });
  return response.data;
};

export const obtenerIngredientesRecetaColor = async (params = {}) => {
  const response = await api.get('/catalogo/ingredientes-receta-color', { params });
  return response.data;
};

export const obtenerRecetasColorMaestras = async (params = {}) => {
  const response = await api.get('/catalogo/recetas-color', { params });
  return response.data;
};

export const crearRecetaColorMaestra = async (data) => {
  const response = await api.post('/catalogo/recetas-color', data);
  return response.data;
};

export const actualizarRecetaColorMaestra = async (id, data) => {
  const response = await api.put(`/catalogo/recetas-color/${id}`, data);
  return response.data;
};

export const inactivarRecetaColorMaestra = async (id, version) => {
  const response = await api.delete(`/catalogo/recetas-color/${id}`, { params: { version } });
  return response.data;
};

// Validar pre-requisitos para crear orden. Conserva la firma
// (moldeId, colorIds) y admite el contexto completo de una OP excepcional.
export const validarOrdenPrereq = async (moldeOrContext, legacyColorIds = []) => {
  const context = moldeOrContext && typeof moldeOrContext === 'object' && !Array.isArray(moldeOrContext)
    ? moldeOrContext
    : { moldeId: moldeOrContext, colorIds: legacyColorIds };
  const params = {};
  const addIfPresent = (key, value) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value;
  };

  addIfPresent('molde_id', context.moldeId);
  const normalizedColorIds = Array.isArray(context.colorIds)
    ? context.colorIds.filter((id) => id !== undefined && id !== null && id !== '').join(',')
    : context.colorIds;
  addIfPresent('color_ids', normalizedColorIds);
  addIfPresent('producto_sku', context.productoSku);
  addIfPresent('maquina_id', context.maquinaId);
  addIfPresent('numero_op', context.numeroOp);

  const response = await api.get('/validar-orden-prereq', { params });
  return response.data;
};

// Actualizar metricas de una orden (Snapshots / Moldes Dañados)
export const actualizarMetricasOrden = async (numeroOp, data) => {
  const response = await api.put(`/ordenes/${numeroOp}/metricas`, data);
  return response.data;
};

// ==================== REGISTROS DIARIOS ====================

// Obtener registros diarios (todos o de una orden)
export const obtenerRegistros = async (numeroOp = null) => {
  const url = numeroOp ? `/ordenes/${numeroOp}/registros` : '/registros';
  const response = await api.get(url);
  return response.data;
};

// Crear nuevo registro diario
export const crearRegistro = async (numeroOp, data) => {
  const response = await api.post(`/ordenes/${numeroOp}/registros`, data);
  return response.data;
};

// Obtener catálogo de máquinas
export const obtenerMaquinas = async () => {
  const response = await api.get('/maquinas');
  return response.data;
};

// ==================== OCR ====================

// Escanear imagen de registro con OCR
export const scanRegistroOCR = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await api.post('/ocr/scan-registro', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// ==================== CONTROL DE PESO ====================

// Obtener bultos de un registro
export const obtenerBultos = async (registroId) => {
  const response = await api.get(`/registros/${registroId}/bultos`);
  return response.data;
};

// Agregar nuevo bulto
export const agregarBulto = async (registroId, data) => {
  const response = await api.post(`/registros/${registroId}/bultos`, data);
  return response.data;
};

// Eliminar bulto
export const eliminarBulto = async (bultoId) => {
  const response = await api.delete(`/bultos/${bultoId}`);
  return response.data;
};

// Validar peso total vs registro
export const validarPesoRegistro = async (registroId) => {
  const response = await api.get(`/registros/${registroId}/validacion-peso`);
  return response.data;
};

// ==================== CATÁLOGO MOLDES ====================

// Obtener todos los moldes
export const obtenerMoldes = async () => {
  const response = await api.get('/moldes');
  return response.data;
};

// Obtener un molde específico
export const obtenerMolde = async (codigo) => {
  const response = await api.get(`/moldes/${codigo}`);
  return response.data;
};

// Crear molde
export const crearMolde = async (data) => {
  const response = await api.post('/moldes', withoutInternalIdentifiers(data, ['codigo']));
  return response.data;
};

// Actualizar molde
export const actualizarMolde = async (codigo, data) => {
  const response = await api.put(`/moldes/${codigo}`, data);
  return response.data;
};

// Eliminar molde
export const eliminarMolde = async (codigo) => {
  const response = await api.delete(`/moldes/${codigo}`);
  return response.data;
};

// ==================== CATÁLOGO PIEZAS ====================

// Obtener pieza específica
export const crearPiezaGlobal = async (data) => {
  const response = await api.post('/piezas', withoutInternalIdentifiers(data, ['codigo']));
  return response.data;
};

export const actualizarPiezaGlobal = async (piezaId, data) => {
  const response = await api.put(`/piezas/${piezaId}`, data);
  return response.data;
};

export const guardarImagenPiezaColor = async (sku, file) => {
  const body = new FormData();
  body.append('imagen', file);
  const response = await api.put(`/piezas-color/${encodeURIComponent(sku)}/imagen`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const eliminarImagenPiezaColor = async (sku) => {
  const response = await api.delete(`/piezas-color/${encodeURIComponent(sku)}/imagen`);
  return response.data;
};

export const obtenerPiezaColor = async (sku) => {
  const response = await api.get(`/piezas-color/${sku}`);
  return response.data;
};

export const crearPiezaColor = async (data) => {
  const response = await api.post('/piezas-color', withoutInternalIdentifiers(data, ['sku']));
  return response.data;
};

export const actualizarPiezaColor = async (sku, data) => {
  const response = await api.put(`/piezas-color/${sku}`, data);
  return response.data;
};

export const cambiarEstadoPiezaColor = async (sku, activo, version) => {
  const response = await api.patch(`/piezas-color/${encodeURIComponent(sku)}/estado`, {
    activo,
    version,
  });
  return response.data;
};

export const eliminarPiezaColor = async (sku) => {
  const response = await api.delete(`/piezas-color/${sku}`);
  return response.data;
};

// Alias de compatibilidad para consumidores de variantes de color.
export const buscarPiezas = buscarPiezasColor;
export const obtenerPieza = obtenerPiezaColor;
export const crearPieza = crearPiezaColor;
export const actualizarPieza = actualizarPiezaColor;
export const eliminarPieza = eliminarPiezaColor;

// Obtener piezas producibles (con molde asignado)
export const obtenerPiezasProducibles = async () => {
  const response = await api.get('/piezas-producibles');
  return response.data;
};

// ==================== CATÁLOGO PRODUCTOS ====================

// Crear producto
export const crearProducto = async (data) => {
  const response = await api.post('/productos', withoutInternalIdentifiers(data, ['cod_sku_pt', 'sku']));
  return response.data;
};

// Actualizar producto
export const actualizarProducto = async (sku, data) => {
  const response = await api.put(`/productos/${sku}`, data);
  return response.data;
};

// Eliminar producto
export const eliminarProducto = async (sku) => {
  const response = await api.delete(`/productos/${sku}`);
  return response.data;
};

// Obtener producto con BOM
export const obtenerProducto = async (sku) => {
  const response = await api.get(`/productos/${sku}`);
  return response.data;
};

// ==================== CATÁLOGO LÍNEAS/FAMILIAS ====================

// Las funciones obtenerLineas y obtenerFamilias fueron movidas arriba.

// ==================== CONFIGURACIÓN RÁPIDA ====================

// Crear Molde + Pieza(s) + Producto(s) en cascada
export const configurarProductoCascada = async (data) => {
  const response = await api.post('/configurar-producto', data);
  return response.data;
};

// ==================== IMPORTACIÓN MASIVA ====================

// Validar archivo de productos
export const validarImportProductos = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/importar/productos?mode=validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// Ejecutar importación de productos
export const ejecutarImportProductos = async (file, crearColores = true) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(
    `/importar/productos?mode=execute&crear_colores=${crearColores}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
};

// Validar archivo de piezas
export const validarImportPiezas = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/importar/piezas?mode=validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// Ejecutar importación de piezas
export const ejecutarImportPiezas = async (file, crearColores = true) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(
    `/importar/piezas?mode=execute&crear_colores=${crearColores}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
};

// Detectar colores en archivo Excel
export const detectarColoresExcel = async (file, tipo = 'productos') => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(`/importar/colores-detectados?tipo=${tipo}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// ============================================================================
// REVISIÓN PROGRESIVA DE PRODUCTOS
// ============================================================================

// Listar productos con filtros de revisión
export const listarProductosRevision = async (params = {}) => {
  const response = await api.get('/productos/revision', { params });
  return response.data;
};

// Actualizar estado de revisión de un producto
export const actualizarRevisionProducto = async (codSkuPt, data) => {
  const response = await api.put(`/productos/${codSkuPt}/revision`, data);
  return response.data;
};

// Actualizar estado de revisión en bulk
export const actualizarRevisionBulk = async (skus, estadoRevision, notasRevision = null) => {
  const response = await api.put('/productos/revision/bulk', {
    skus,
    estado_revision: estadoRevision,
    notas_revision: notasRevision
  });
  return response.data;
};

// Obtener estadísticas de revisión
export const obtenerEstadisticasRevision = async () => {
  const response = await api.get('/productos/revision/estadisticas');
  return response.data;
};

// ==============================
// REVISIÓN DE PIEZAS
// ==============================

// Listar piezas para revisión
export const listarPiezasRevision = async (params = {}) => {
  const response = await api.get('/piezas/revision', { params });
  return response.data;
};

// Actualizar estado de revisión de una pieza
export const actualizarRevisionPieza = async (sku, data) => {
  const response = await api.put(`/piezas/${sku}/revision`, data);
  return response.data;
};

// Actualizar estado de revisión de múltiples piezas
export const actualizarRevisionPiezasBulk = async (skus, estadoRevision, notasRevision = null) => {
  const response = await api.put('/piezas/revision/bulk', {
    skus,
    estado_revision: estadoRevision,
    notas_revision: notasRevision
  });
  return response.data;
};

// Obtener estadísticas de revisión de piezas
export const obtenerEstadisticasRevisionPiezas = async () => {
  const response = await api.get('/piezas/revision/estadisticas');
  return response.data;
};

// ==================== RECETA COLOR NORMALIZADA (Prefill pigmentos) ====================

/**
 * Consulta la receta acumulada de pigmentos para un color dado.
 * @param {number} colorId       - ID del color (requerido)
 * @param {string|null} productoSku - SKU del producto (opcional, para receta específica)
 * @param {number|null} metaKg   - Si se provee, la API calcula gramos absolutos
 * @returns {{ tiene_receta: boolean, n_muestras_min: number, pigmentos: Array }}
 */
export const obtenerRecetaColor = async (colorId, productoSku = null, metaKg = null, kgVirgenBase = null) => {
  const params = { color_produccion_id: colorId };
  if (productoSku) params.producto_sku = productoSku;
  if (metaKg)      params.meta_kg = metaKg;
  if (kgVirgenBase) params.kg_virgen_base = kgVirgenBase;
  const response = await api.get('/catalogo/receta-color', { params });
  return response.data;
};

// ==================== CATÁLOGO MOLDES Y FORMAS (CRUD Avanzado) ====================

export const getMoldes = async () => {
  const response = await api.get('/moldes');
  return response.data;
};

export const getMoldeDetalle = async (codigo) => {
  const response = await api.get(`/moldes/${codigo}`);
  return response.data;
};

export const updateMolde = async (codigo, data) => {
  const response = await api.put(`/moldes/${codigo}`, data);
  return response.data;
};

export const addFormaMolde = async (codigo, data) => {
  const response = await api.post(`/moldes/${codigo}/formas`, data);
  return response.data;
};

export const guardarImagenProducto = async (sku, file) => {
  const body = new FormData();
  body.append('imagen', file);
  const response = await api.put(`/productos/${encodeURIComponent(sku)}/imagen`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const eliminarImagenProducto = async (sku) => {
  const response = await api.delete(`/productos/${encodeURIComponent(sku)}/imagen`);
  return response.data;
};

export const updateFormaMolde = async (formaId, data) => {
  const response = await api.put(`/formas/${formaId}`, data);
  return response.data;
};

export const addColorForma = async (formaId, colorId) => {
  const response = await api.post(`/formas/${formaId}/colores`, { color_id: colorId });
  return response.data;
};

export const habilitarColorMolde = async (moldeCodigo, colorId) => {
  const response = await api.post(`/moldes/${encodeURIComponent(moldeCodigo)}/colores`, {
    color_id: colorId,
  });
  return response.data;
};

export const deleteForma = async (formaId) => {
  const response = await api.delete(`/formas/${formaId}`);
  return response.data;
};

// ==================== TRABAJADORES ====================

export const getTrabajadores = async (params = {}) => {
  const response = await api.get('/catalogo/trabajadores', { params });
  return response.data;
};

export const createTrabajador = async (data) => {
  const response = await api.post('/catalogo/trabajadores', data);
  return response.data;
};

export const updateTrabajador = async (id, data) => {
  const response = await api.put(`/catalogo/trabajadores/${id}`, data);
  return response.data;
};

export const toggleEstadoTrabajador = async (id, activo) => {
  const response = await api.patch(`/catalogo/trabajadores/${id}/estado`, { activo });
  return response.data;
};

export const getRolesOperativos = async () => {
  const response = await api.get('/catalogo/roles-operativos');
  return response.data;
};

// ==================== MÁQUINAS ====================

export const getMaquinas = async (params = {}) => {
  const response = await api.get('/catalogo/maquinas', { params });
  return response.data;
};

export const createMaquina = async (data) => {
  const response = await api.post('/catalogo/maquinas', data);
  return response.data;
};

export const updateMaquina = async (id, data) => {
  const response = await api.put(`/catalogo/maquinas/${id}`, data);
  return response.data;
};

export const toggleEstadoMaquina = async (id, estado) => {
  const response = await api.patch(`/catalogo/maquinas/${id}/estado`, { estado });
  return response.data;
};

export const getTiposMaquina = async (params = {}) => {
  const response = await api.get('/catalogo/tipos-maquina', { params });
  return response.data;
};

export const getCurrentActor = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const createTipoMaquina = async (data) => {
  const response = await api.post('/catalogo/tipos-maquina', data);
  return response.data;
};

export const updateTipoMaquina = async (id, data) => {
  const response = await api.put(`/catalogo/tipos-maquina/${id}`, data);
  return response.data;
};

export const deactivateTipoMaquina = async (id, version) => {
  const response = await api.delete(`/catalogo/tipos-maquina/${id}`, { params: { version } });
  return response.data;
};

export default api;
