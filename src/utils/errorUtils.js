/**
 * Utilidades para manejo de errores
 * Provee mensajes amigables en español y funciones de ayuda
 */

// Mapeo de códigos HTTP a mensajes amigables
export const HTTP_ERROR_MESSAGES = {
  400: 'Datos inválidos. Por favor, revisa el formulario.',
  401: 'No autorizado. Por favor, inicia sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontrado. El recurso solicitado no existe.',
  409: 'Conflicto. El recurso ya existe o hay un conflicto de datos.',
  422: 'Error de validación. Verifica los campos ingresados.',
  500: 'Error del servidor. Por favor, intenta más tarde.',
  502: 'Error de conexión con el servidor.',
  503: 'Servicio no disponible. Intenta más tarde.',
};

// Mensajes específicos por contexto
export const CONTEXT_ERROR_MESSAGES = {
  // Órdenes
  orden_crear: 'Error al crear la orden de producción.',
  orden_cargar: 'Error al cargar la orden.',
  orden_actualizar: 'Error al actualizar la orden.',
  
  // Registros
  registro_crear: 'Error al guardar el registro diario.',
  registro_cargar: 'Error al cargar los registros.',
  
  // Catálogo
  producto_cargar: 'Error al cargar productos.',
  producto_guardar: 'Error al guardar el producto.',
  molde_cargar: 'Error al cargar moldes.',
  
  // Conexión
  conexion: 'Error de conexión. Verifica tu conexión a internet.',
  servidor: 'No se pudo conectar con el servidor.',
};

/**
 * Extrae un mensaje de error amigable de una respuesta de error
 * @param {Error|Object} error - Error de axios o error genérico
 * @param {string} context - Contexto opcional para mensaje más específico
 * @returns {string} Mensaje de error amigable
 */
export function getErrorMessage(error, context = null) {
  // Si hay un mensaje de contexto específico disponible
  if (context && CONTEXT_ERROR_MESSAGES[context]) {
    // Agregar detalle del error si existe
    const serverMessage = error?.response?.data?.error;
    if (serverMessage) {
      return `${CONTEXT_ERROR_MESSAGES[context]}: ${serverMessage}`;
    }
    return CONTEXT_ERROR_MESSAGES[context];
  }

  // Si es un error de axios con respuesta del servidor
  if (error?.response) {
    const { status, data } = error.response;
    
    // Si el servidor envió un mensaje específico
    if (data?.error) {
      return data.error;
    }
    
    // Usar mensaje genérico basado en código HTTP
    if (HTTP_ERROR_MESSAGES[status]) {
      return HTTP_ERROR_MESSAGES[status];
    }
    
    return `Error ${status}: Algo salió mal.`;
  }

  // Error de red (sin respuesta del servidor)
  if (error?.request) {
    return CONTEXT_ERROR_MESSAGES.conexion;
  }

  // Error genérico de JavaScript
  if (error?.message) {
    // No exponer mensajes técnicos en producción
    if (import.meta.env.DEV) {
      return error.message;
    }
    return 'Ha ocurrido un error inesperado.';
  }

  return 'Ha ocurrido un error. Por favor, intenta de nuevo.';
}

/**
 * Wrapper para llamadas async que maneja errores consistentemente
 * @param {Promise} promise - Promesa a ejecutar
 * @param {string} context - Contexto del error
 * @returns {Promise<[data, error]>} Tupla [data, error]
 */
export async function handleAsync(promise, context = null) {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    console.error(`Error in ${context || 'async operation'}:`, error);
    return [null, getErrorMessage(error, context)];
  }
}

/**
 * Log de error con contexto adicional
 * @param {string} context - Dónde ocurrió el error
 * @param {Error} error - El error
 * @param {Object} extra - Datos adicionales
 */
export function logError(context, error, extra = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    context,
    message: error?.message || String(error),
    stack: error?.stack,
    ...extra
  };
  
  console.error('[ERROR]', logData);
  
  // En producción, aquí podrías enviar a un servicio de monitoreo
  // sendToErrorTracking(logData);
}
