const ROUTE_PROCESSES = new Set(['INYECCION', 'SOPLADO']);

export const normalizeFabricationProcess = (value) => String(value || '').trim().toUpperCase();

const articleIdOf = (article) => article?.id ?? article?.articulo_scm_id ?? article?.articulo_salida_id;

const isExactOutput = (operation, articleId) => {
  const output = operation?.articulo_salida;
  const outputId = output?.id ?? operation?.articulo_salida_id;
  return outputId != null && String(outputId) === String(articleId);
};

/**
 * Flatten route revisions into the small selector contract used by OF.
 * The API returns complete routes because the operation id and route hash must
 * travel together when the server freezes an OF objective.
 */
export const routeOperationsForArticle = (routes, article) => {
  const articleId = articleIdOf(article);
  if (articleId == null) return [];
  return (routes || []).flatMap((route) => {
    const routeState = normalizeFabricationProcess(route?.estado);
    if (routeState !== 'APROBADA') return [];
    return (route?.operaciones || []).filter((operation) => (
      normalizeFabricationProcess(operation?.executor_kind) === 'OP_OT'
      && ROUTE_PROCESSES.has(normalizeFabricationProcess(operation?.tipo))
      && isExactOutput(operation, articleId)
    )).map((operation) => ({
      id: operation.id,
      operacion_ruta_revision_id: operation.id,
      ruta_revision_id: route.id,
      ruta_numero_revision: route.numero_revision ?? route.revision ?? null,
      ruta_hash: route.content_hash ?? route.hash ?? null,
      proceso: normalizeFabricationProcess(operation.tipo),
      nombre: operation.nombre || operation.clave || `Operación ${operation.id}`,
      route_codigo: route.codigo || route.nombre || `Ruta ${route.id}`,
      articulo_salida: operation.articulo_salida || { id: articleId },
    }));
  });
};

export const routeOptionsForRun = (run, routesByArticle = {}) => {
  const seen = new Set();
  return (run?.salidas || []).flatMap((output) => {
    const externalArticleId = output?.articulo_scm_id ?? output?.articulo_id ?? output?.articulo_salida_id;
    const article = output?.articulo
      ? { ...output.articulo, id: output.articulo.id ?? externalArticleId }
      : output?.articulo_salida
        ? { ...output.articulo_salida, id: output.articulo_salida.id ?? externalArticleId }
        : { id: externalArticleId };
    return routeOperationsForArticle(routesByArticle[String(articleIdOf(article))] || [], article);
  }).filter((option) => {
    if (seen.has(String(option.operacion_ruta_revision_id))) return false;
    seen.add(String(option.operacion_ruta_revision_id));
    return true;
  });
};

export const resolveFabricationProcess = (explicitProcess, runs, routesByArticle = {}) => {
  const explicit = normalizeFabricationProcess(explicitProcess);
  const selections = (runs || []).map((run) => {
    const selectedId = run?.operacion_ruta_revision_id;
    const options = routeOptionsForRun(run, routesByArticle);
    const selected = selectedId === null || selectedId === undefined || selectedId === ''
      ? null
      : options.find((option) => String(option.operacion_ruta_revision_id) === String(selectedId));
    // A detail DTO can preserve a previously frozen route whose revision was
    // later retired. It remains valid for editing the draft; new selections
    // come only from the APROBADA/OP_OT catalog above.
    const preserved = !selected && run?.operacion_ruta
      && String(run.operacion_ruta_revision_id) === String(selectedId)
      ? {
        ...run.operacion_ruta,
        operacion_ruta_revision_id: selectedId,
        proceso: normalizeFabricationProcess(run.operacion_ruta.tipo || run.operacion_ruta.proceso),
      }
      : null;
    return {
      selectedId,
      option: selected || preserved,
      validSelection: selectedId === null || selectedId === undefined || selectedId === '' || Boolean(selected || preserved),
    };
  });
  const selected = selections.filter((item) => item.selectedId !== null
    && item.selectedId !== undefined && item.selectedId !== '');
  const linked = selected.map((item) => item.option).filter(Boolean);
  const processes = new Set(linked.map((option) => option.proceso));
  const allLinked = (runs || []).length > 0
    && selected.length === (runs || []).length
    && selected.every((item) => item.validSelection);
  const resolved = explicit || (allLinked && processes.size === 1
    ? [...processes][0]
    : '');
  return {
    process: resolved,
    explicit,
    linked,
    complete: allLinked,
    valid: ROUTE_PROCESSES.has(resolved)
      && selections.every((item) => item.validSelection)
      && (!explicit || processes.size === 0 || (processes.size === 1 && processes.has(explicit))),
    requiresExplicit: !allLinked,
  };
};

export const compatibleProcessMachines = (machines, process) => {
  const normalized = normalizeFabricationProcess(process);
  return (machines || []).filter((machine) => {
    if (machine.estado && machine.estado !== 'OPERATIVA') return false;
    if (!normalized) return true;
    const type = machine.tipo_maquina || {};
    return [type.proceso, type.codigo, type.nombre, machine.tipo_legacy, machine.tipo]
      .map(normalizeFabricationProcess)
      .includes(normalized);
  });
};

export const fabricationProcessLabel = (process) => {
  const normalized = normalizeFabricationProcess(process);
  return normalized === 'SOPLADO' ? 'Soplado' : normalized === 'INYECCION' ? 'Inyección' : 'Sin resolver';
};
