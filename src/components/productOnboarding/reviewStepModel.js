export const REVIEWED_PHASES = [
  'IDENTIDAD', 'COMPONENTES', 'COLORES', 'ESTRUCTURA', 'RUTA_EMPAQUE',
];

const approvalMarker = (item = {}) => [
  item.code,
  item.codigo,
  item.result,
  item.status,
  item.action,
  item.message,
  item.mensaje,
].filter(Boolean).join(' ').toLocaleUpperCase('es');

export const readinessHasPendingApproval = (readiness = {}) => {
  if (readiness?.status === 'PENDING_APPROVAL') return true;
  if ((readiness?.handoffs || []).length > 0) return true;
  return (readiness?.items || []).some((item) => {
    const marker = approvalMarker(item);
    return marker.includes('PENDING_APPROVAL')
      || marker.includes('APPROVAL_REQUIRED')
      || marker.includes('REQUEST_APPROVAL')
      || marker.includes('PENDIENTE DE APROB')
      || marker.includes('APROBACIÓN PENDIENTE');
  });
};

const currentRevisionSnapshot = (readiness = {}) => (
  Array.isArray(readiness?.revision_snapshot) ? readiness.revision_snapshot : []
);

export const normalizeReviewData = (value = {}, readiness = {}) => ({
  confirmaciones: {
    datos_fuente_revisados: false,
    entiende_que_no_crea_op: false,
    pendientes_aceptados: false,
    ...(value.confirmaciones || {}),
  },
  pasos_revisados: REVIEWED_PHASES,
  // El snapshot del servidor es la autoridad TOCTOU. Nunca reutilizamos una
  // lista guardada si readiness acaba de detectar una revisión más nueva.
  revisiones_revisadas: currentRevisionSnapshot(readiness),
  notas: value.notas || '',
});

export const reviewIsConfirmed = (value = {}, readiness = {}) => {
  const data = normalizeReviewData(value, readiness);
  return data.confirmaciones.datos_fuente_revisados
    && data.confirmaciones.entiende_que_no_crea_op
    && (!readinessHasPendingApproval(readiness)
      || data.confirmaciones.pendientes_aceptados);
};
