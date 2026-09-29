const text = (value) => String(value ?? '').trim();

const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const activeShapes = (mold) => (mold?.formas || []).filter((shape) => shape.activo !== false);

const outputIsPieceColor = (output) => {
  const article = output?.articulo || output?.articulo_salida || {};
  if (article.clase || article.tipo) return article.clase === 'PIEZA_COLOR' || article.tipo === 'PIEZA_COLOR';
  return article.pieza_id != null || output?.pieza_id != null;
};

export const duplicateEligibility = (order) => {
  if (!order) return { eligible: false, reason: 'No hay una OF fuente seleccionada.' };
  if (order.estado === 'ANULADA' || order.origen_demanda === 'ANULADA') {
    return { eligible: false, reason: 'Una OF anulada no se puede duplicar.' };
  }
  if (order.plan_produccion_id != null || order.propuesta_clave || order.origen_demanda === 'DEMANDA_OP') {
    return { eligible: false, reason: 'Esta OF está vinculada a un plan. Crea la nueva OF desde Planificación.' };
  }
  if (order.origen_demanda === 'REEMPLAZO_OF' || order.es_reemplazo || order.sucesora_de_id) {
    return { eligible: false, reason: 'Una OF de reemplazo no se puede duplicar como reposición excepcional.' };
  }
  if (order.origen_demanda !== 'EXCEPCIONAL') {
    return { eligible: false, reason: 'Sólo las OF excepcionales de PiezaColor pueden duplicarse.' };
  }
  const process = text(order.snapshot_proceso || order.proceso_requerido || order.proceso).toUpperCase();
  if (!['INYECCION', 'SOPLADO'].includes(process)) {
    return { eligible: false, reason: 'La OF no tiene un proceso de fabricación resuelto.' };
  }
  const outputs = (order.corridas || []).flatMap((run) => run.salidas || []);
  if (!outputs.length || outputs.some((output) => !outputIsPieceColor(output))) {
    return { eligible: false, reason: 'La copia de OF con salidas WIP o PT todavía no está disponible.' };
  }
  return { eligible: true, reason: '' };
};

const outputArticleId = (output) => output?.articulo_scm_id
  ?? output?.articulo?.id
  ?? output?.articulo_salida?.id
  ?? output?.articulo_id;

const sourcePieceId = (output) => output?.articulo?.pieza_id
  ?? output?.articulo_salida?.pieza_id
  ?? output?.pieza_id;

const outputPerCycle = (output) => output?.cantidad_por_ciclo_snapshot
  ?? output?.cantidad_por_ciclo
  ?? output?.cantidad_por_ciclo_snapshot;

const outputWeight = (output) => output?.peso_unitario_snapshot_g
  ?? output?.peso_unitario_g
  ?? output?.peso_unitario_snapshot;

const objectiveForRun = (run) => run?.objetivo_neto_kg ?? (
  (run?.salidas || []).reduce((sum, output) => sum + numberOr(output.kg_estandar_objetivo), 0)
    || run?.meta_kg_legacy
    || ''
);

const sourceRecipeForRun = (run) => run?.receta || run?.receta_maestra || run?.recipe || null;

const sourceRouteForRun = (run) => {
  if (run?.operacion_ruta_revision_id == null && !run?.operacion_ruta) return null;
  return {
    ...(run?.operacion_ruta || {}),
    ...(run?.operacion_ruta_revision_id != null
      ? { operacion_ruta_revision_id: run.operacion_ruta_revision_id }
      : {}),
  };
};

const recipeScope = (recipe) => {
  const scope = recipe?.producto_sku ?? recipe?.producto_scope ?? null;
  return scope === '' || scope === '*' ? null : scope;
};

const sameRecipeIdentity = (candidate, source) => (
  Number(candidate?.color_produccion_id) === Number(source?.color_produccion_id)
  && String(recipeScope(candidate) ?? '') === String(recipeScope(source) ?? '')
  && text(candidate?.nombre_variante || candidate?.nombre)
    === text(source?.nombre_variante || source?.nombre)
);

export const resolveCurrentApprovedRecipe = (recipes = [], run = {}) => {
  const source = sourceRecipeForRun(run);
  if (!source?.nombre_variante && !source?.nombre) {
    return { status: 'missing', recipe: null, matches: [] };
  }
  const matches = recipes.filter((recipe) => (
    recipe?.estado === 'APROBADA' && sameRecipeIdentity(recipe, {
      ...source,
      color_produccion_id: source.color_produccion_id ?? run.color_produccion_id,
    })
  ));
  if (!matches.length) return { status: 'missing', recipe: null, matches: [] };
  const latestRevision = Math.max(...matches.map((recipe) => numberOr(recipe.revision, 0)));
  const latest = matches.filter((recipe) => numberOr(recipe.revision, 0) === latestRevision);
  if (latest.length !== 1) return { status: 'ambiguous', recipe: null, matches: latest };
  return { status: 'resolved', recipe: latest[0], matches: latest };
};

export const buildExceptionalDuplicateDraft = (source) => ({
  motivo: `${text(source?.motivo) || 'Duplicación como borrador'} · copia de ${source?.codigo || source?.id || 'OF fuente'}`,
  molde_id: source?.molde_id || source?.molde?.codigo || '',
  corridas: (source?.corridas || []).map((run) => ({
    color_produccion_id: run.color_produccion_id ?? run.color_produccion?.id ?? '',
    ...(sourceRecipeForRun(run) ? { source_receta: sourceRecipeForRun(run) } : {}),
    ...(sourceRouteForRun(run) ? { source_ruta: sourceRouteForRun(run) } : {}),
    ciclos_objetivo: run.ciclos_objetivo ?? '',
    objetivo_neto_kg: objectiveForRun(run),
    salidas: (run.salidas || []).filter(outputIsPieceColor).map((output) => ({
      articulo_scm_id: outputArticleId(output),
      pieza_id: sourcePieceId(output),
      cantidad_por_ciclo: outputPerCycle(output),
      peso_unitario_g: outputWeight(output),
    })),
  })),
});

export const compareMoldComposition = (source, currentMold) => {
  const expectedRows = (source?.corridas || []).flatMap((run) => run.salidas || [])
    .filter(outputIsPieceColor)
    .map((output) => ({
      pieceId: String(sourcePieceId(output) ?? ''),
      cavities: numberOr(output.cantidad_por_ciclo_snapshot ?? output.cantidad_por_ciclo),
      weight: numberOr(output.peso_unitario_snapshot_g ?? output.peso_unitario_g ?? output.peso_unitario_snapshot),
    }))
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
  const expected = [...new Map(expectedRows.map((item) => [
    `${item.pieceId}:${item.cavities}:${item.weight}`, item,
  ])).values()];
  const actual = activeShapes(currentMold)
    .map((shape) => ({ pieceId: String(shape.pieza_id ?? ''), cavities: numberOr(shape.cavidades), weight: numberOr(shape.peso_unitario_gr) }))
    .sort((a, b) => a.pieceId.localeCompare(b.pieceId));
  const messages = [];
  if (expected.length !== actual.length || expected.some((item, index) => item.pieceId !== actual[index]?.pieceId)) {
    messages.push('La composición de piezas del molde cambió.');
  }
  if (expected.some((item, index) => item.cavities !== actual[index]?.cavities)) messages.push('Las cavidades cambiaron.');
  if (expected.some((item, index) => item.weight !== actual[index]?.weight)) messages.push('Los pesos unitarios cambiaron.');
  return { changed: messages.length > 0, messages, expected, actual };
};

const fitName = (name) => text(name).slice(0, 120).trim();

const uniqueRecipeName = (baseName, recipes = []) => {
  const names = new Set(recipes.map((item) => text(item.nombre_variante).toLocaleLowerCase()));
  const base = fitName(baseName) || 'Copia de receta';
  if (!names.has(base.toLocaleLowerCase())) return base;
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? ' (copia)' : ` (copia ${index})`;
    const candidate = fitName(`${base.slice(0, 120 - suffix.length)}${suffix}`);
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return fitName(`${base.slice(0, 110)} (nueva)`);
};

export const buildRecipeDuplicateDraft = (source, existingRecipes = [], sourceRef = '') => ({
  color_produccion_id: source?.color_produccion_id,
  nombre_variante: uniqueRecipeName(source?.nombre_variante, existingRecipes),
  producto_sku: source?.producto_sku || null,
  estado: 'BORRADOR',
  es_default: false,
  base_virgen_kg: numberOr(source?.base_virgen_kg),
  notas: [sourceRef ? `Fuente ${sourceRef}` : '', source?.revision != null ? `rev. ${source.revision}` : '', text(source?.notas), `Copia de ${source?.nombre_variante || 'receta'}`]
    .filter(Boolean).join(' · '),
  lineas: (source?.lineas || []).map((line) => ({
    material_id: line.material_id,
    tipo_componente: line.tipo_componente,
    cantidad: line.tipo_componente === 'MATERIA_PRIMA' ? numberOr(line.cantidad) : numberOr(line.cantidad),
    base_kg: line.tipo_componente === 'MATERIA_PRIMA' ? null : numberOr(line.base_kg || source?.base_virgen_kg),
  })),
});

export { outputIsPieceColor, uniqueRecipeName };
