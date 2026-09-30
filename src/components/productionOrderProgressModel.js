import { formatKg as formatKgValue } from '../utils/weightDisplay';

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const coverageState = (item) => (
  typeof item?.coverage === 'string' ? item.coverage : item?.coverage?.estado
);

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
    return { key: 'RESTRINGIDO', label: 'Acceso restringido', color: 'default', target: null, final: null, opened: null, percent: null };
  }
  const target = finiteNumber(item?.objetivo_neto_kg);
  const final = finiteNumber(item?.kg_finalizados_efectivos);
  const opened = finiteNumber(item?.kg_medidos_en_abiertas);
  const total = finiteNumber(item?.mangas?.total);
  const known = finiteNumber(item?.mangas?.conocidas);
  const noEvidence = (total === 0 || total === null)
    && (known === 0 || known === null)
    && (final === null || final === 0)
    && (opened === null || opened === 0);
  const evidenceLabel = noEvidence
    ? 'Sin pesajes'
    : coverageState(item) === 'COMPLETA' ? 'Evidencia completa' : 'Datos de peso incompletos';
  const visibleFinal = noEvidence ? null : final;
  const visibleOpened = noEvidence ? null : opened;
  if (target === null) return { key: 'META_AUSENTE', label: 'Meta no registrada', evidenceLabel, color: 'warning', target, final: visibleFinal, opened: visibleOpened, percent: null };
  if (!(target > 0)) return { key: 'META_NO_POSITIVA', label: 'Meta no positiva', evidenceLabel, color: 'warning', target, final: visibleFinal, opened: visibleOpened, percent: null };
  if (noEvidence) {
    return { key: 'SIN_PESAJES', label: 'Sin pesajes', color: 'warning', target, final: null, opened: null, percent: null };
  }
  if (coverageState(item) !== 'COMPLETA' || (total !== null && known !== null && known < total) || final === null) {
    return { key: 'INCOMPLETA', label: 'Datos de peso incompletos', color: 'warning', target, final, opened, percent: null };
  }
  return {
    key: 'CALCULABLE', label: 'Avance calculable', color: 'success', target, final, opened,
    percent: (final / target) * 100,
  };
};
