export const OPERATION_TYPES = [
  'INYECCION',
  'SOPLADO',
  'PREARMADO',
  'ENSAMBLE',
  'ACABADO',
  'EMPAQUE',
];

export const OPERATION_TYPE_LABEL = {
  INYECCION: 'INYECCIÓN',
  SOPLADO: 'SOPLADO',
  PREARMADO: 'PREARMADO',
  ENSAMBLE: 'ARMADO',
  ACABADO: 'ACABADO',
  EMPAQUE: 'EMPAQUE',
};

export const EXECUTOR_LABEL = {
  OP_OT: 'Fabricación mediante OF y Trabajo de color',
  ORDEN_OPERACION: 'Prearmado o armado mediante OA / OT de Armado',
};

export const emptyStructureLine = () => ({
  articulo_id: '',
  cantidad: '1',
  merma_tecnica_pct: '0',
});

export const emptyStructureValue = () => ({
  notas: '',
  componentes: [emptyStructureLine()],
});

export const emptyRouteOperation = (sequence = 1) => ({
  clave: `OP${sequence}`,
  secuencia_visible: String(sequence),
  nombre: '',
  tipo: '',
  executor_kind: '',
  centro_trabajo_id: '',
  articulo_salida_id: '',
  estructura_revision_id: '',
  permite_concurrente: false,
});

export const emptyRouteValue = (targetArticle = null) => ({
  notas: '',
  operaciones: [{
    ...emptyRouteOperation(),
    articulo_salida_id: targetArticle?.id ? String(targetArticle.id) : '',
  }],
});

export const emptyPackagingProfileValue = () => ({
  nombre: '',
  descripcion_fisica: '',
});

export const emptyPackagingRuleValue = () => ({
  perfil_empacable_id: '',
  tipo_contenedor_id: '',
  medicion_fisica_probada: false,
  cantidad_objetivo_un: '',
  cantidad_maxima_probada_un: '',
  peso_neto_operativo_max_kg: '',
  margen_seguridad_kg: '0',
  tolerancia_peso_abs_g: '0',
  tolerancia_peso_pct: '0',
  notas: '',
});

export const compactDecimal = (value) => {
  const text = String(value ?? '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
};

export const executorKindForOperationType = (type) => {
  if (['INYECCION', 'SOPLADO'].includes(type)) return 'OP_OT';
  if (['PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].includes(type)) {
    return 'ORDEN_OPERACION';
  }
  return '';
};

export const nextOperationKey = (operations = []) => {
  const last = operations.reduce((maximum, operation) => {
    const match = /^OP(\d+)$/.exec(operation.clave);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `OP${last + 1}`;
};

export const normalizeRouteOutputs = (operations = [], targetArticle = null, articles = []) => {
  const targetId = targetArticle?.id ? String(targetArticle.id) : '';
  const articlesById = new Map(articles.map((article) => [Number(article.id), article]));
  return operations.map((operation, index) => {
    const isTerminal = index === operations.length - 1;
    if (isTerminal) return { ...operation, articulo_salida_id: targetId };
    const currentOutput = articlesById.get(Number(operation.articulo_salida_id));
    return currentOutput?.clase === 'PRODUCTO_TERMINADO'
      ? { ...operation, articulo_salida_id: '', estructura_revision_id: '' }
      : operation;
  });
};

export const normalizeStructureRevision = (revision) => ({
  notas: revision?.notas || '',
  componentes: revision?.componentes?.length
    ? revision.componentes.map((line) => ({
      articulo_id: String(line.articulo_id),
      cantidad: compactDecimal(line.cantidad),
      merma_tecnica_pct: compactDecimal(line.merma_tecnica_pct || 0),
    }))
    : [emptyStructureLine()],
});

export const normalizeRouteRevision = (revision, targetArticle, articles = []) => {
  if (!revision) return emptyRouteValue(targetArticle);
  const keysById = new Map(
    (revision.operaciones || []).map((operation) => [operation.id, operation.clave]),
  );
  return {
    notas: revision.notas || '',
    operaciones: normalizeRouteOutputs((revision.operaciones || []).map((operation) => ({
      clave: operation.clave,
      secuencia_visible: String(operation.secuencia_visible),
      nombre: operation.nombre,
      tipo: operation.tipo,
      executor_kind: operation.executor_kind,
      centro_trabajo_id: String(operation.centro_trabajo_id),
      articulo_salida_id: String(operation.articulo_salida_id),
      estructura_revision_id: operation.estructura_revision_id
        ? String(operation.estructura_revision_id)
        : '',
      permite_concurrente: Boolean(operation.permite_concurrente),
    })), targetArticle, articles),
    precedencias: (revision.precedencias || []).map((edge) => ({
      anterior_clave: keysById.get(edge.anterior_id ?? edge.operacion_anterior_id),
      siguiente_clave: keysById.get(edge.siguiente_id ?? edge.operacion_siguiente_id),
    })),
  };
};

export const validateStructureValue = (value = {}) => {
  const lines = value.componentes || [];
  if (!lines.length) return ['Agrega al menos un componente.'];
  return lines.flatMap((line, index) => [
    !line.articulo_id ? `Selecciona el artículo del componente ${index + 1}.` : '',
    Number(line.cantidad) <= 0 ? `La cantidad del componente ${index + 1} debe ser mayor que cero.` : '',
    Number(line.merma_tecnica_pct || 0) < 0
      ? `La pérdida del componente ${index + 1} no puede ser negativa.`
      : '',
  ].filter(Boolean));
};

export const buildStructurePayload = (value = {}) => ({
  notas: value.notas?.trim() || null,
  componentes: (value.componentes || []).map((line, index) => ({
    secuencia: index + 1,
    articulo_id: Number(line.articulo_id),
    cantidad: Number(line.cantidad),
    unidad: 'UN',
    merma_tecnica_pct: Number(line.merma_tecnica_pct || 0),
  })),
});

export const validateRouteValue = (value = {}, targetArticle = null, articles = []) => {
  const operations = normalizeRouteOutputs(value.operaciones || [], targetArticle, articles);
  if (!targetArticle?.id) return ['No se resolvió el producto terminado objetivo.'];
  if (!operations.length) return ['Agrega al menos una operación.'];
  return operations.flatMap((operation, index) => {
    const step = `Paso ${index + 1}`;
    return [
      !operation.clave?.trim() ? `Falta la clave del ${step}.` : '',
      !operation.nombre?.trim() ? `Escribe un nombre para el ${step}.` : '',
      !operation.tipo ? `Selecciona el tipo de operación del ${step}.` : '',
      !operation.executor_kind ? `Selecciona la forma de ejecución del ${step}.` : '',
      !operation.centro_trabajo_id ? `Selecciona el centro de trabajo del ${step}.` : '',
      !operation.articulo_salida_id ? `Define la salida del ${step}.` : '',
      operation.executor_kind === 'ORDEN_OPERACION' && !operation.estructura_revision_id
        ? `Selecciona una estructura aprobada compatible para el ${step}.`
        : '',
    ].filter(Boolean);
  });
};

export const buildRoutePayload = (value = {}, targetArticle = null, articles = []) => {
  const operations = normalizeRouteOutputs(value.operaciones || [], targetArticle, articles);
  return {
    notas: value.notas?.trim() || null,
    operaciones: operations.map((operation, index) => ({
      clave: operation.clave,
      secuencia_visible: index + 1,
      nombre: operation.nombre.trim(),
      tipo: operation.tipo,
      executor_kind: operation.executor_kind,
      centro_trabajo_id: Number(operation.centro_trabajo_id),
      articulo_salida_id: Number(operation.articulo_salida_id),
      estructura_revision_id: operation.executor_kind === 'ORDEN_OPERACION'
        ? Number(operation.estructura_revision_id)
        : null,
      permite_concurrente: Boolean(operation.permite_concurrente),
    })),
    precedencias: operations.slice(1).map((operation, index) => ({
      anterior_clave: operations[index].clave,
      siguiente_clave: operation.clave,
    })),
  };
};

export const validatePackagingProfileValue = (value = {}) => (
  value.nombre?.trim() ? [] : ['Escribe un nombre para el perfil empacable.']
);

export const buildPackagingProfilePayload = (value = {}) => ({
  nombre: value.nombre?.trim() || '',
  descripcion_fisica: value.descripcion_fisica?.trim() || null,
});

export const validatePackagingRuleValue = (value = {}) => [
  !value.perfil_empacable_id ? 'Selecciona un perfil empacable.' : '',
  !value.tipo_contenedor_id ? 'Selecciona un tipo de contenedor.' : '',
  Number(value.cantidad_objetivo_un) <= 0
    ? 'La cantidad operativa objetivo debe ser mayor que cero.'
    : '',
  Number(value.cantidad_maxima_probada_un) <= 0
    ? 'El máximo físico debe ser mayor que cero.'
    : '',
  Number(value.cantidad_objetivo_un) > Number(value.cantidad_maxima_probada_un)
    ? 'La cantidad objetivo no puede superar el máximo físico.'
    : '',
  Number(value.peso_neto_operativo_max_kg) <= 0
    ? 'El límite neto operativo debe ser mayor que cero.'
    : '',
  Number(value.margen_seguridad_kg || 0) < 0
    ? 'El margen de seguridad no puede ser negativo.'
    : '',
  Number(value.tolerancia_peso_abs_g || 0) < 0
    ? 'La tolerancia absoluta no puede ser negativa.'
    : '',
  Number(value.tolerancia_peso_pct || 0) < 0
    ? 'La tolerancia porcentual no puede ser negativa.'
    : '',
].filter(Boolean);

export const buildPackagingRulePayload = (value = {}) => ({
  perfil_empacable_id: Number(value.perfil_empacable_id),
  tipo_contenedor_id: Number(value.tipo_contenedor_id),
  medicion_fisica_probada: Boolean(value.medicion_fisica_probada),
  cantidad_objetivo_un: Number(value.cantidad_objetivo_un),
  cantidad_maxima_probada_un: Number(value.cantidad_maxima_probada_un),
  peso_neto_operativo_max_kg: Number(value.peso_neto_operativo_max_kg),
  margen_seguridad_kg: Number(value.margen_seguridad_kg || 0),
  tolerancia_peso_abs_g: Number(value.tolerancia_peso_abs_g || 0),
  tolerancia_peso_pct: Number(value.tolerancia_peso_pct || 0),
  notas: value.notas?.trim() || null,
});

export const revisionEditPolicy = (revision) => {
  const status = revision?.estado || 'BORRADOR';
  if (status === 'BORRADOR') {
    return { editable: true, status, guidance: '' };
  }
  if (['PENDIENTE', 'PENDIENTE_APROBACION'].includes(status)) {
    return {
      editable: false,
      status,
      guidance: 'Esta revisión está pendiente de aprobación. Retírala mediante la acción canónica antes de editar.',
    };
  }
  if (status === 'APROBADA') {
    return {
      editable: false,
      status,
      guidance: 'Esta revisión está aprobada. Crea una nueva revisión basada en ella para cambiarla.',
    };
  }
  return {
    editable: false,
    status,
    guidance: `La revisión ${String(status).replaceAll('_', ' ').toLowerCase()} no se puede editar.`,
  };
};
