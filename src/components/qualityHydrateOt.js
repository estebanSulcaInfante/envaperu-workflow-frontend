import { obtenerOrdenFabricacionScm } from '../services/scmOtApi';

const journeyWorks = (ot) => Array.isArray(ot?.trabajos_color)
  ? ot.trabajos_color
  : Array.isArray(ot?.trabajos_color_resumen) ? ot.trabajos_color_resumen : [];

const hasHumanMold = (work) => Boolean(work?.molde_nombre || work?.molde?.nombre || work?.molde?.name);

const moldFromOrder = (order) => ({
  id: order?.molde_id ?? order?.molde?.id ?? order?.molde?.codigo,
  codigo: order?.molde?.codigo ?? order?.molde_id,
  nombre: order?.molde?.nombre ?? order?.molde?.name,
});

/**
 * Journey summaries deliberately carry the OF identity but omit the mould.
 * Resolve each OF at most once for the current board turn; callers keep the
 * cache across refreshes/filters and pass an AbortSignal when leaving it.
 */
export async function hydrateQualityJourneyMolds(ots = [], { cache = new Map(), pending = new Map(), moldCatalog = [], signal } = {}) {
  const works = ots.flatMap(journeyWorks);
  const catalogById = new Map(moldCatalog.flatMap((mold) => [
    [mold?.id, mold], [mold?.public_id, mold], [mold?.codigo, mold], [mold?.code, mold],
  ].filter(([key]) => key != null && key !== '').map(([key, value]) => [String(key), value])));
  const orderIds = [...new Set(works
    .filter((work) => {
      if (hasHumanMold(work) || !work?.orden_fabricacion_id) return false;
      const moldRef = work?.molde_id ?? work?.molde_codigo;
      return !moldRef || !catalogById.has(String(moldRef));
    })
    .map((work) => String(work.orden_fabricacion_id)))];
  const getOrder = (id) => {
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    const current = pending.get(id);
    if (current && !current.signal?.aborted) return current.promise || current;
    const promise = obtenerOrdenFabricacionScm(id, { signal });
    pending.set(id, { promise, signal });
    return promise;
  };
  const settledOrders = [];
  const failedOrderIds = new Set();
  let cursor = 0;
  const worker = async () => {
    while (cursor < orderIds.length) {
      const id = orderIds[cursor++];
      try {
        const request = getOrder(id);
        const order = await request;
        cache.set(id, order);
        const current = pending.get(id);
        if (!current || current.promise === request || current === request) pending.delete(id);
        settledOrders.push([id, order]);
      } catch (error) {
        const current = pending.get(id);
        if (!current || current.signal === signal) pending.delete(id);
        if (error?.name === 'AbortError' || signal?.aborted) throw error;
        failedOrderIds.add(id);
        settledOrders.push([id, null]);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, orderIds.length) }, worker));
  const orders = new Map(settledOrders);
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const enrich = (work) => {
    if (hasHumanMold(work)) return work;
    const orderId = String(work?.orden_fabricacion_id || '');
    const order = orders.get(orderId);
    const orderMold = moldFromOrder(order);
    const catalogMold = catalogById.get(String(work?.molde_id ?? orderMold.id ?? ''));
    const mold = catalogMold || orderMold;
    return {
      ...work,
      ...(failedOrderIds.has(orderId) ? { moldLoadFailed: true } : {}),
      ...(mold.id != null ? { molde_id: work?.molde_id ?? mold.id } : {}),
      ...(mold.codigo ? { molde_codigo: work?.molde_codigo ?? mold.codigo } : {}),
      ...(mold.nombre ? { molde_nombre: mold.nombre } : {}),
    };
  };
  return ots.map((ot) => {
    const key = Array.isArray(ot?.trabajos_color) ? 'trabajos_color' : 'trabajos_color_resumen';
    if (!Array.isArray(ot?.[key])) return ot;
    return { ...ot, [key]: ot[key].map(enrich) };
  });
}

// OT outputs identify piece-color articles. Resolve the physical piece only
// against its released OF run; never merge by the printed article name.
export async function hydrateQualityOt(ot, options = {}) {
  const works = ot?.trabajos_color || ot?.trabajos_color_resumen || [];
  const ids = [...new Set(works.map(w => w.orden_fabricacion_id).filter(Boolean))];
  const orders = new Map(await Promise.all(ids.map(async id =>
    [id, await obtenerOrdenFabricacionScm(id, options)])));
  const enriched = works.map(work => {
    const order = orders.get(work.orden_fabricacion_id);
    const run = order?.corridas?.find(r => String(r.id) === String(work.corrida_fabricacion_id));
    const articles = work.articulos_salida || work.salidas || work.salidas_produccion || work.salidas_color || work.salidas_pieza || [];
    return {
      ...work,
      color_hex: work.color?.hex ?? work.color_hex ?? run?.color_identidad?.hex ?? run?.color_hex ?? run?.color_produccion?.hex_referencia,
      molde_id: work.molde_id ?? order?.molde_id,
      molde_nombre: work.molde_nombre || order?.molde?.nombre,
      snapshot_tiempo_ciclo_seg: work.snapshot_tiempo_ciclo_seg ?? order?.snapshot_tiempo_ciclo_seg,
      articulos_salida: articles.map(article => {
        const match = run?.salidas?.find(o => String(o.articulo_scm_id) === String(article.id));
        return { ...article, pieza_id: article.pieza_id ?? match?.articulo?.pieza_id };
      }),
    };
  });
  return { ...ot, trabajos_color: enriched };
}
