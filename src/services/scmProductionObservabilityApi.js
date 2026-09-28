import api from './api';
import { obtenerActorScm } from './scmEngineeringApi';

const headers = () => ({
  'X-Actor-Id': String(obtenerActorScm()),
});

const definedEntries = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => (
    item !== undefined && item !== null && item !== ''
  )),
);

const productionHistoryParams = (filters = {}, { includeHierarchy = false } = {}) => {
  const {
    signal: _signal, agrupaciones, medidas, incluir_jerarquia: requestedHierarchy, ...rest
  } = filters;
  return {
    ...definedEntries(rest),
    ...(agrupaciones !== undefined ? { agrupaciones: Array.isArray(agrupaciones) ? agrupaciones.join(',') : agrupaciones } : {}),
    ...(medidas !== undefined ? { medidas: Array.isArray(medidas) ? medidas.join(',') : medidas } : {}),
    ...(includeHierarchy || requestedHierarchy !== undefined
      ? { incluir_jerarquia: requestedHierarchy ?? 1 }
      : {}),
  };
};

const filterParams = (filters = {}, { paginated = true } = {}) => definedEntries({
  fecha_desde: filters.desde,
  fecha_hasta: filters.hasta,
  tipo_ot: filters.tipo,
  estado_documental: filters.estado_documental,
  estado_operativo: filters.estado_operativo,
  turno: filters.turno,
  recurso: filters.recurso,
  responsable: filters.responsable,
  op: filters.op,
  orden: filters.orden,
  ot: filters.ot,
  color: filters.color,
  manga: filters.manga,
  estado_manga: filters.estado_manga,
  articulo: filters.articulo,
  q: filters.q,
  quick: filters.quick,
  ...(!paginated ? {
    granularidad: filters.rango === 'MES' ? 'MES' : 'DIA',
  } : {}),
  ...(paginated ? {
    cursor: filters.cursor,
    limit: filters.limit,
  } : {}),
});

const get = async (path, { params, signal } = {}) => (
  await api.get(path, {
    headers: headers(),
    ...(params ? { params } : {}),
    signal,
  })
).data;

export const listarSupervisionOtsScm = (filters = {}) => get(
  '/scm/v1/observabilidad/ots',
  { params: filterParams(filters), signal: filters.signal },
);

export const listarDocumentosPendientesSupervisionScm = (filters = {}) => get(
  '/scm/v1/observabilidad/documentos-pendientes',
  { params: filterParams(filters), signal: filters.signal },
);

export const listarSupervisionMangasScm = (filters = {}) => get(
  '/scm/v1/observabilidad/mangas',
  { params: filterParams(filters), signal: filters.signal },
);

export const obtenerResumenSupervisionOtsScm = (filters = {}) => get(
  '/scm/v1/observabilidad/resumen',
  { params: filterParams(filters, { paginated: false }), signal: filters.signal },
);

export const obtenerDetalleSupervisionOtScm = (publicId, options = {}) => get(
  `/scm/v1/observabilidad/ots/${encodeURIComponent(publicId)}`,
  { signal: options.signal },
);

export const listarAvanceOfScm = (filters = {}) => {
  const { signal, ...params } = filters;
  return get('/scm/v1/observabilidad/avance-of', {
    params: definedEntries(params), signal,
  });
};

export const listarProduccionHistoricaScm = (filters = {}) => get(
  '/scm/v1/observabilidad/produccion-historica',
  { params: productionHistoryParams(filters, { includeHierarchy: true }), signal: filters.signal },
);

export const listarMangasHistoricoScm = (filters = {}, group = []) => get(
  '/scm/v1/observabilidad/produccion-historica/mangas',
  {
    params: {
      ...productionHistoryParams(filters),
      grupo: JSON.stringify(Array.isArray(group) ? group : []),
    },
    signal: filters.signal,
  },
);

export const obtenerDetalleMangaScm = (publicId, options = {}) => get(
  `/scm/v1/observabilidad/mangas/${encodeURIComponent(publicId)}`,
  { signal: options.signal },
);

export const exportarProduccionHistoricaScm = (filters = {}) => api.get(
  '/scm/v1/observabilidad/produccion-historica/export.xlsx',
  {
    headers: headers(), params: productionHistoryParams(filters), responseType: 'blob',
    ...(filters.signal ? { signal: filters.signal } : {}),
  },
);

export { filterParams as construirFiltrosObservabilidadOt };
