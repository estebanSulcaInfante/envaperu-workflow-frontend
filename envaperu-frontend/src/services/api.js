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

export default api;
