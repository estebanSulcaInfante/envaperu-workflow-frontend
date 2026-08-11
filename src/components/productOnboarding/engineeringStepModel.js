import {
  buildPackagingProfilePayload,
  buildPackagingRulePayload,
  buildRoutePayload,
  buildStructurePayload,
  emptyPackagingProfileValue,
  emptyPackagingRuleValue,
  emptyRouteValue,
  emptyStructureValue,
  validatePackagingProfileValue,
  validatePackagingRuleValue,
  validateRouteValue,
  validateStructureValue,
} from '../scmEngineering/editors';

export const PENDING_PROFILE_REF = '__NEW_PROFILE__';

const stringValue = (value) => (
  value === null || value === undefined ? '' : String(value)
);

const numberOrUndefined = (value) => (
  value === '' || value === null || value === undefined ? undefined : Number(value)
);

export const structureEditorValue = (payload) => {
  if (!payload?.componentes?.length) return emptyStructureValue();
  return {
    notas: payload.notas || '',
    componentes: payload.componentes.map((item) => ({
      articulo_id: item.articulo_client_id
        ? `wip:${item.articulo_client_id}`
        : Number(item.articulo_id) > 0 ? stringValue(item.articulo_id) : '',
      cantidad: stringValue(item.cantidad),
      merma_tecnica_pct: stringValue(item.merma_tecnica_pct || 0),
    })),
  };
};

export const normalizeStructureStepData = (data = {}, references = {}) => {
  const source = data.estructura || {};
  const revisionRef = source.revision_ref || references.estructura_revision_ref || null;
  const revisionVersion = source.expected_version
    || references.estructura_revision_version
    || null;
  return {
    target_article_ref: data.target_article_ref || null,
    wips_nuevos: (data.wips_nuevos || []).map((item) => ({
      requiere_calidad: false,
      ...item,
    })),
    estructura: {
      modo: revisionRef
        ? source.modo === 'REUTILIZAR' ? 'REUTILIZAR' : 'EDITAR'
        : source.modo || 'NUEVA',
      revision_ref: revisionRef,
      expected_version: revisionVersion,
      accion: source.accion || (source.modo === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR'),
      payload: source.payload || buildStructurePayload(emptyStructureValue()),
    },
  };
};

export const serializeStructureStepData = (data = {}) => {
  const normalized = normalizeStructureStepData(data);
  const structure = normalized.estructura;
  return {
    target_article_ref: Number(normalized.target_article_ref),
    ...(normalized.wips_nuevos.length ? { wips_nuevos: normalized.wips_nuevos } : {}),
    estructura: {
      modo: structure.modo,
      ...(structure.revision_ref ? { revision_ref: Number(structure.revision_ref) } : {}),
      ...(structure.expected_version != null
        ? { expected_version: Number(structure.expected_version) }
        : {}),
      accion: structure.accion,
      ...(!['REUTILIZAR'].includes(structure.modo) || structure.accion !== 'VINCULAR'
        ? { payload: structure.payload }
        : {}),
    },
  };
};

export const structureStepErrors = (data = {}) => {
  const normalized = normalizeStructureStepData(data);
  const errors = [];
  if (!normalized.target_article_ref) errors.push('No se resolvió el artículo PT objetivo.');
  if (normalized.estructura.modo === 'REUTILIZAR' && !normalized.estructura.revision_ref) {
    errors.push('Selecciona una revisión de estructura.');
  } else {
    errors.push(...validateStructureValue(structureEditorValue(normalized.estructura.payload)));
  }
  normalized.wips_nuevos.forEach((wip, index) => {
    if (!wip.client_id) errors.push(`Falta la identidad local del WIP ${index + 1}.`);
    if (!wip.nombre?.trim()) errors.push(`Escribe el nombre del WIP ${index + 1}.`);
  });
  return errors;
};

export const routeEditorValue = (payload, targetArticle = null) => {
  if (!payload?.operaciones?.length) return emptyRouteValue(targetArticle);
  return {
    notas: payload.notas || '',
    operaciones: payload.operaciones.map((item, index) => ({
      clave: item.clave || `OP${index + 1}`,
      secuencia_visible: stringValue(item.secuencia_visible || index + 1),
      nombre: item.nombre || '',
      tipo: item.tipo || '',
      executor_kind: item.executor_kind || '',
      centro_trabajo_id: stringValue(item.centro_trabajo_id),
      articulo_salida_id: stringValue(item.articulo_salida_id),
      estructura_revision_id: stringValue(item.estructura_revision_id),
      permite_concurrente: Boolean(item.permite_concurrente),
    })),
    precedencias: payload.precedencias || [],
  };
};

export const profileEditorValue = (payload) => ({
  ...emptyPackagingProfileValue(),
  ...(payload || {}),
});

export const ruleEditorValue = (payload, profileMode = 'NUEVO') => ({
  ...emptyPackagingRuleValue(),
  ...(payload || {}),
  perfil_empacable_id: payload?.perfil_empacable_id != null
    ? stringValue(payload.perfil_empacable_id)
    : profileMode === 'NUEVO' ? PENDING_PROFILE_REF : '',
  tipo_contenedor_id: stringValue(payload?.tipo_contenedor_id),
  cantidad_objetivo_un: stringValue(payload?.cantidad_objetivo_un),
  cantidad_maxima_probada_un: stringValue(payload?.cantidad_maxima_probada_un),
  peso_neto_operativo_max_kg: stringValue(payload?.peso_neto_operativo_max_kg),
  margen_seguridad_kg: stringValue(payload?.margen_seguridad_kg ?? 0),
  tolerancia_peso_abs_g: stringValue(payload?.tolerancia_peso_abs_g ?? 0),
  tolerancia_peso_pct: stringValue(payload?.tolerancia_peso_pct ?? 0),
});

export const routeOutputArticleIds = (routePayload = {}, targetArticleRef = null) => {
  const ids = (routePayload?.operaciones || [])
    .map((operation) => Number(operation.articulo_salida_id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0 && Number(targetArticleRef) > 0) ids.push(Number(targetArticleRef));
  return [...new Set(ids)];
};

const defaultPackagingAssignment = (articleRef) => ({
  client_id: `empaque-${articleRef}`,
  articulo_ref: Number(articleRef),
  perfil_empacable: {
    modo: 'NUEVO',
    ref: null,
    expected_version: null,
    payload: buildPackagingProfilePayload(emptyPackagingProfileValue()),
    asignar_predeterminado: true,
  },
  regla_empaque: {
    modo: 'NUEVA',
    revision_ref: null,
    expected_version: null,
    accion: 'GUARDAR_BORRADOR',
    payload: null,
  },
});

const normalizePackagingAssignment = (assignment = {}, reference = {}) => {
  const articleRef = Number(assignment.articulo_ref || reference.articulo_ref);
  const profile = assignment.perfil_empacable || {};
  const rule = assignment.regla_empaque || {};
  const profileRef = profile.ref || reference.perfil_empacable_ref || null;
  const ruleRef = rule.revision_ref || reference.regla_empaque_revision_ref || null;
  return {
    ...defaultPackagingAssignment(articleRef),
    ...assignment,
    client_id: assignment.client_id || reference.client_id || `empaque-${articleRef}`,
    articulo_ref: articleRef,
    perfil_empacable: {
      ...defaultPackagingAssignment(articleRef).perfil_empacable,
      ...profile,
      modo: profileRef
        ? profile.modo === 'REUTILIZAR' ? 'REUTILIZAR' : 'EDITAR'
        : profile.modo || 'NUEVO',
      ref: profileRef,
      expected_version: profile.expected_version || null,
      asignar_predeterminado: profile.asignar_predeterminado !== false,
    },
    regla_empaque: {
      ...defaultPackagingAssignment(articleRef).regla_empaque,
      ...rule,
      modo: ruleRef
        ? rule.modo === 'REUTILIZAR' ? 'REUTILIZAR' : 'EDITAR'
        : rule.modo || 'NUEVA',
      revision_ref: ruleRef,
      expected_version: rule.expected_version
        || reference.regla_empaque_revision_version
        || null,
      accion: rule.accion || (rule.modo === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR'),
    },
  };
};

export const normalizeRoutePackagingStepData = (
  data = {}, references = {}, { targetProductRef = null, targetArticleRef = null } = {},
) => {
  const route = data.ruta || {};
  const routeRef = route.revision_ref || references.ruta_revision_ref || null;
  const outputIds = routeOutputArticleIds(route.payload, data.target_article_ref || targetArticleRef);
  const legacyAssignment = data.perfil_empacable || data.regla_empaque ? [{
    client_id: `empaque-${data.target_article_ref || targetArticleRef}`,
    articulo_ref: data.target_article_ref || targetArticleRef,
    perfil_empacable: data.perfil_empacable,
    regla_empaque: data.regla_empaque,
  }] : [];
  const sourceAssignments = data.empaques?.length ? data.empaques : legacyAssignment;
  const referenceAssignments = references.empaques || (references.perfil_empacable_ref ? [{
    client_id: `empaque-${data.target_article_ref || targetArticleRef}`,
    articulo_ref: data.target_article_ref || targetArticleRef,
    perfil_empacable_ref: references.perfil_empacable_ref,
    regla_empaque_revision_ref: references.regla_empaque_revision_ref,
    regla_empaque_revision_version: references.regla_empaque_revision_version,
  }] : []);
  const assignmentByArticle = new Map(
    sourceAssignments.map((item) => [Number(item.articulo_ref), item]),
  );
  const referenceByArticle = new Map(
    referenceAssignments.map((item) => [Number(item.articulo_ref), item]),
  );
  return {
    target_product_ref: data.target_product_ref || targetProductRef,
    target_article_ref: data.target_article_ref || targetArticleRef,
    ruta: {
      modo: routeRef ? (route.modo === 'REUTILIZAR' ? 'REUTILIZAR' : 'EDITAR') : route.modo || 'NUEVA',
      revision_ref: routeRef,
      expected_version: route.expected_version || references.ruta_revision_version || null,
      accion: route.accion || (route.modo === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR'),
      payload: route.payload || null,
    },
    empaques: outputIds.map((articleRef) => normalizePackagingAssignment(
      assignmentByArticle.get(articleRef) || { articulo_ref: articleRef },
      referenceByArticle.get(articleRef),
    )),
  };
};

export const serializeRoutePackagingStepData = (data = {}) => {
  const normalized = normalizeRoutePackagingStepData(data);
  const route = normalized.ruta;
  return {
    target_product_ref: normalized.target_product_ref,
    target_article_ref: Number(normalized.target_article_ref),
    ruta: {
      modo: route.modo,
      ...(route.revision_ref ? { revision_ref: Number(route.revision_ref) } : {}),
      ...(route.expected_version != null ? { expected_version: Number(route.expected_version) } : {}),
      accion: route.accion,
      ...(route.payload ? { payload: route.payload } : {}),
    },
    empaques: normalized.empaques.map((assignment) => {
      const profile = assignment.perfil_empacable;
      const rule = assignment.regla_empaque;
      const rulePayload = rule.payload ? { ...rule.payload } : null;
      if (profile.modo === 'NUEVO' && rulePayload) delete rulePayload.perfil_empacable_id;
      return {
        client_id: assignment.client_id,
        articulo_ref: Number(assignment.articulo_ref),
        perfil_empacable: {
          modo: profile.modo,
          ...(profile.ref ? { ref: Number(profile.ref) } : {}),
          ...(profile.expected_version != null
            ? { expected_version: Number(profile.expected_version) }
            : {}),
          ...(profile.modo !== 'REUTILIZAR' ? { payload: profile.payload } : {}),
          asignar_predeterminado: profile.asignar_predeterminado !== false,
        },
        regla_empaque: {
          modo: rule.modo,
          ...(rule.revision_ref ? { revision_ref: Number(rule.revision_ref) } : {}),
          ...(rule.expected_version != null
            ? { expected_version: Number(rule.expected_version) }
            : {}),
          accion: rule.accion,
          ...(rule.modo !== 'REUTILIZAR' && rulePayload ? { payload: rulePayload } : {}),
        },
      };
    }),
  };
};

export const routePackagingStepErrors = (data, targetArticle, articles = []) => {
  const normalized = normalizeRoutePackagingStepData(data);
  const errors = [];
  if (!normalized.target_product_ref || !normalized.target_article_ref || !targetArticle) {
    errors.push('No se resolvió el Producto Terminado objetivo.');
  }
  if (normalized.ruta.modo === 'REUTILIZAR' && !normalized.ruta.revision_ref) {
    errors.push('Selecciona una ruta existente.');
  } else if (normalized.ruta.modo !== 'REUTILIZAR') {
    errors.push(...validateRouteValue(
      routeEditorValue(normalized.ruta.payload, targetArticle),
      targetArticle,
      articles,
    ));
  }
  const outputIds = routeOutputArticleIds(normalized.ruta.payload, normalized.target_article_ref);
  const packagedIds = normalized.empaques.map((item) => Number(item.articulo_ref));
  if (outputIds.length !== packagedIds.length
    || outputIds.some((articleRef) => !packagedIds.includes(articleRef))) {
    errors.push('Configura el empaque de cada salida de la ruta.');
  }
  normalized.empaques.forEach((assignment) => {
    const article = articles.find((item) => Number(item.id) === Number(assignment.articulo_ref));
    const label = article?.codigo || `artículo #${assignment.articulo_ref}`;
    const profile = assignment.perfil_empacable;
    const rule = assignment.regla_empaque;
    if (profile.modo === 'REUTILIZAR') {
      if (!profile.ref) errors.push(`Selecciona un perfil empacable para ${label}.`);
    } else {
      errors.push(...validatePackagingProfileValue(profileEditorValue(profile.payload))
        .map((message) => `${label}: ${message}`));
    }
    if (rule.modo === 'REUTILIZAR') {
      if (!rule.revision_ref) errors.push(`Selecciona una regla de empaque para ${label}.`);
    } else {
      errors.push(...validatePackagingRuleValue(ruleEditorValue(rule.payload, profile.modo))
        .map((message) => `${label}: ${message}`));
    }
  });
  return errors;
};

export const buildRoutePayloadFromEditor = (value, targetArticle, articles) => (
  buildRoutePayload(value, targetArticle, articles)
);

export const buildProfilePayloadFromEditor = (value) => buildPackagingProfilePayload(value);

export const buildRulePayloadFromEditor = (value, profileMode) => {
  const payload = buildPackagingRulePayload(value);
  if (profileMode === 'NUEVO') delete payload.perfil_empacable_id;
  return payload;
};

export const buildStructurePayloadFromEditor = (value) => {
  const payload = buildStructurePayload(value);
  return {
    ...payload,
    componentes: payload.componentes.map((item, index) => {
      const editorRef = String(value.componentes?.[index]?.articulo_id || '');
      if (!editorRef.startsWith('wip:')) return item;
      const { articulo_id: _ignored, ...rest } = item;
      return { ...rest, articulo_client_id: editorRef.slice(4) };
    }),
  };
};

export const normalizeReadiness = (readiness = {}) => {
  if (readiness.status && Array.isArray(readiness.items)) return readiness;
  const blockers = readiness.bloqueos || [];
  const warnings = readiness.advertencias || [];
  const handoffs = readiness.handoffs || [];
  const items = [
    ...blockers.map((item) => ({
      code: item.code || item.codigo || 'BLOCKER',
      severity: 'BLOCKER',
      paso: item.paso || 'REVISION',
      message: item.message || item.mensaje || 'Existe un bloqueo pendiente.',
      action: 'OPEN_STEP',
    })),
    ...warnings.map((item) => ({
      code: item.code || item.codigo || 'WARNING',
      severity: 'WARNING',
      paso: item.paso || 'REVISION',
      message: item.message || item.mensaje || 'Existe una advertencia pendiente.',
      action: item.action || 'OPEN_STEP',
    })),
    ...handoffs.map((item) => ({
      code: item.code || item.tipo || 'APPROVAL_REQUIRED',
      severity: 'WARNING',
      paso: item.paso || 'REVISION',
      message: item.message || item.mensaje
        || `La fase ${item.paso || ''} requiere aprobación de otro actor.`,
      action: 'OPEN_STEP',
    })),
  ];
  return {
    ...readiness,
    status: blockers.length
      ? 'BLOCKED'
      : handoffs.length ? 'PENDING_APPROVAL'
        : readiness.lista_para_finalizar ? 'READY' : 'NOT_CHECKED',
    checked_at: readiness.checked_at || null,
    items,
  };
};

export const toOptionalNumber = numberOrUndefined;
