import { formatKg as formatKgValue } from '../utils/weightDisplay';

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const coverageState = (item) => (
  typeof item?.coverage === 'string' ? item.coverage : item?.coverage?.estado
);

const ATTRIBUTION_REASONS = new Set(['ATRIBUCION_INCOMPLETA', 'KG_SIN_TRAMOS_UN']);

const attributionReasons = (item) => {
  const reasons = Array.isArray(item?.motivos_atribucion)
    ? item.motivos_atribucion
    : Array.isArray(item?.coverage?.motivos) ? item.coverage.motivos : [];
  return reasons.filter((reason) => ATTRIBUTION_REASONS.has(reason));
};

export const getAttributionNotice = (item, measuredOverride, { comparePhysical = true } = {}) => {
  const physical = finiteNumber(item?.peso_fisico_kg ?? item?.kg_fisico_observado);
  const measured = measuredOverride === undefined
    ? finiteNumber(item?.kg_medidos_efectivos ?? item?.avance_medido_kg ?? item?.avance)
    : finiteNumber(measuredOverride);
  const reasons = attributionReasons(item);
  const differs = comparePhysical && physical !== null && (measured === null || Math.abs(physical - measured) > 0.0005);
  if (!reasons.length && !differs) return null;
  const neutralDifference = !reasons.length && differs;
  const text = neutralDifference
    ? 'Diferencia informativa: físico observado y avance atribuible corresponden a alcances distintos.'
    : item?.pendientes_sin_cantidad_un > 0
      ? 'Cantidad UN pendiente; el peso KG observado no se convirtió a unidades.'
      : reasons.includes('KG_SIN_TRAMOS_UN')
        ? 'Peso KG observado sin tramos de unidades; no se convirtió a UN.'
        : 'Atribución incompleta: el peso físico observado queda separado del avance atribuible.';
  return { physical, measured, reasons, differs, neutral: neutralDifference, text };
};

export const formatKg = (value) => {
  const formatted = formatKgValue(value);
  return formatted === '—' ? '—' : `${formatted} kg`;
};

export const progressTone = (percent) => {
  if (percent >= 95) return 'success';
  if (percent >= 80) return 'warning';
  return 'error';
};

export const getProgressState = (item, visibility = {}) => {
  if (visibility.pesaje === false) {
    return { key: 'RESTRINGIDO', label: 'Acceso restringido', color: 'default', target: null, final: null, opened: null, percent: null, physicalObserved: null, attributionNotice: null };
  }
  const target = finiteNumber(item?.objetivo_neto_kg);
  const final = finiteNumber(item?.kg_finalizados_efectivos);
  const opened = finiteNumber(item?.kg_medidos_en_abiertas);
  const hasMeasuredField = Object.prototype.hasOwnProperty.call(item || {}, 'kg_medidos_efectivos')
    || Object.prototype.hasOwnProperty.call(item || {}, 'avance_medido_kg');
  const measured = hasMeasuredField
    ? finiteNumber(item?.kg_medidos_efectivos ?? item?.avance_medido_kg)
    : (final !== null || opened !== null ? (final || 0) + (opened || 0) : null);
  const attribution = getAttributionNotice(item, measured);
  const total = finiteNumber(item?.mangas?.total);
  const known = finiteNumber(item?.mangas?.conocidas);
  const noEvidence = (total === 0 || total === null)
    && (known === 0 || known === null)
    && (measured === null || measured === 0)
    && (opened === null || opened === 0);
  const evidenceLabel = noEvidence
    ? 'Sin pesajes'
    : coverageState(item) === 'COMPLETA' ? 'Evidencia completa' : 'Datos de peso incompletos';
  const visibleFinal = noEvidence ? null : final;
  const visibleOpened = noEvidence ? null : opened;
  if (target === null) return { key: 'META_AUSENTE', label: 'Meta no registrada', evidenceLabel, color: 'warning', target, final: visibleFinal, opened: visibleOpened, measured, percent: null, physicalObserved: attribution?.physical ?? null, attributionNotice: attribution };
  if (!(target > 0)) return { key: 'META_NO_POSITIVA', label: 'Meta no positiva', evidenceLabel, color: 'warning', target, final: visibleFinal, opened: visibleOpened, measured, percent: null, physicalObserved: attribution?.physical ?? null, attributionNotice: attribution };
  if (noEvidence) {
    return { key: 'SIN_PESAJES', label: 'Sin pesajes', color: 'warning', target, final: null, opened: null, measured: null, percent: null, physicalObserved: attribution?.physical ?? null, attributionNotice: attribution };
  }
  if (coverageState(item) !== 'COMPLETA' || (total !== null && known !== null && known < total) || measured === null) {
    return { key: 'INCOMPLETA', label: 'Datos de peso incompletos', color: 'warning', target, final, opened, measured, percent: measured === null ? null : (measured / target) * 100, physicalObserved: attribution?.physical ?? null, attributionNotice: attribution };
  }
  return {
    key: 'CALCULABLE', label: 'Avance calculable', color: 'success', target, final, opened,
    measured,
    percent: (measured / target) * 100,
    physicalObserved: attribution?.physical ?? null,
    attributionNotice: attribution,
  };
};
