import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  return `/api/ordenes/${numeroOp}/qr?size=${size}`;
};

// Buscar productos para autocomplete
export const buscarProductos = async (query = '') => {
  const response = await api.get('/productos', { params: { q: query, limit: 20 } });
  return response.data;
};

// Buscar piezas/moldes para autocomplete
export const buscarPiezas = async (query = '') => {
  const response = await api.get('/piezas', { params: { q: query, limit: 20 } });
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
  const response = await api.post('/moldes', data);
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
export const obtenerPieza = async (sku) => {
  const response = await api.get(`/piezas/${sku}`);
  return response.data;
};

// Crear pieza
export const crearPieza = async (data) => {
  const response = await api.post('/piezas', data);
  return response.data;
};

// Actualizar pieza
export const actualizarPieza = async (sku, data) => {
  const response = await api.put(`/piezas/${sku}`, data);
  return response.data;
};

// Eliminar pieza
export const eliminarPieza = async (sku) => {
  const response = await api.delete(`/piezas/${sku}`);
  return response.data;
};

// Obtener piezas producibles (con molde asignado)
export const obtenerPiezasProducibles = async () => {
  const response = await api.get('/piezas-producibles');
  return response.data;
};

// ==================== CATÁLOGO PRODUCTOS ====================

// Crear producto
export const crearProducto = async (data) => {
  const response = await api.post('/productos', data);
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

export default api;
