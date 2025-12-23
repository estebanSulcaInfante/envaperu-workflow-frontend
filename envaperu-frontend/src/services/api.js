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

export default api;
