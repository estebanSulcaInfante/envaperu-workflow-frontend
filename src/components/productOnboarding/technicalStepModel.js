const makeClientId = (prefix) => {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

const asNumberOrEmpty = (value) => (
  value === null || value === undefined || value === '' ? '' : String(value)
);

const unwrapId = (value, keys = ['id']) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'object') return value;
  return keys.map((key) => value[key]).find((candidate) => candidate != null) ?? null;
};

const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const emptyMoldValue = {
    modo: 'NUEVO',
    ref: null,
    nombre: '',
    peso_tiro_gr: '',
    tiempo_ciclo_std: '30',
};

export const newMoldGroupDraft = (clientId = makeClientId('molde')) => ({
  client_id: clientId,
  molde: { ...emptyMoldValue },
  piezas: [],
});

export const emptyComponentsData = {
  moldes: [newMoldGroupDraft('molde-inicial')],
  // Alias de lectura para consumidores antiguos; normalizeComponentsData los
  // deriva siempre del primer grupo.
  molde: { ...emptyMoldValue },
  piezas: [],
};

export const newPieceDraft = () => ({
  client_id: makeClientId('pieza'),
  modo: 'NUEVA',
  ref: null,
  nombre: '',
  cavidades: '1',
  peso_unitario_gr: '',
  molde_pieza_ref: null,
});

export const normalizeComponentsData = (data = {}, references = {}) => {
  const resolved = references?.COMPONENTES || references || {};
  const sourceGroups = Array.isArray(data.moldes) && data.moldes.length
    ? data.moldes
    : [{
      client_id: data.molde_client_id || 'molde-inicial',
      molde: data.molde || {},
      piezas: Array.isArray(data.piezas) ? data.piezas : [],
    }];
  const referenceGroups = Array.isArray(resolved.moldes) && resolved.moldes.length
    ? resolved.moldes
    : [{
      client_id: sourceGroups[0]?.client_id || 'molde-inicial',
      molde_ref: resolved.molde_ref,
      piezas: resolved.piezas || [],
    }];
  const referenceByGroup = new Map(referenceGroups.map((group) => [
    String(group.client_id), group,
  ]));
  const normalizedGroups = sourceGroups.map((group, groupIndex) => {
    const clientId = group.client_id || `molde-importado-${groupIndex + 1}`;
    const groupReference = referenceByGroup.get(String(clientId))
      || (sourceGroups.length === 1 ? referenceGroups[0] : {});
    const moldReference = group.molde?.ref
      || unwrapId(group.molde_ref, ['codigo', 'ref'])
      || unwrapId(groupReference?.molde_ref, ['codigo', 'ref']);
    const resolvedPieces = new Map((groupReference?.piezas || resolved.piezas || []).map((piece) => [
      String(piece.client_id), piece,
    ]));
    const sourcePieces = Array.isArray(group.piezas) ? group.piezas : [];
    return {
      client_id: clientId,
      molde: {
        ...emptyMoldValue,
        ...(group.molde || {}),
        ref: moldReference || null,
        ...(moldReference ? { modo: 'REUTILIZAR' } : {}),
      },
      piezas: sourcePieces.map((piece, index) => {
      const clientId = piece.client_id || `pieza-importada-${index + 1}`;
      const checkpoint = resolvedPieces.get(String(clientId)) || {};
      const pieceRef = piece.ref
        || unwrapId(piece.pieza_ref, ['id', 'pieza_id', 'ref'])
        || unwrapId(checkpoint.pieza_ref, ['id', 'pieza_id', 'ref']);
      return {
        client_id: clientId,
        modo: pieceRef ? 'REUTILIZAR' : (piece.modo || 'NUEVA'),
        ref: pieceRef || null,
        nombre: piece.nombre || piece.pieza_ref?.nombre || '',
        cavidades: asNumberOrEmpty(piece.cavidades ?? 1),
        peso_unitario_gr: asNumberOrEmpty(
          piece.peso_unitario_gr || piece.peso_nominal_gr,
        ),
        molde_pieza_ref: piece.molde_pieza_ref
          || unwrapId(checkpoint.molde_pieza_ref, ['id', 'molde_pieza_id', 'ref'])
          || null,
      };
      }),
    };
  });
  const flatPieces = normalizedGroups.flatMap((group) => group.piezas);
  return {
    ...data,
    moldes: normalizedGroups,
    molde: normalizedGroups[0]?.molde || { ...emptyMoldValue },
    piezas: flatPieces,
  };
};

export const serializeComponentsData = (value) => {
  const normalized = normalizeComponentsData(value);
  const serializeGroup = (group) => ({
    client_id: group.client_id,
    molde: group.molde.modo === 'REUTILIZAR'
      ? { modo: 'REUTILIZAR', ref: group.molde.ref }
      : {
        modo: 'NUEVO',
        nombre: group.molde.nombre.trim(),
        peso_tiro_gr: Number(group.molde.peso_tiro_gr),
        tiempo_ciclo_std: Number(group.molde.tiempo_ciclo_std || 30),
      },
    piezas: group.piezas.map((piece) => ({
      client_id: piece.client_id,
      modo: piece.modo,
      ...(piece.modo === 'REUTILIZAR'
        ? { ref: Number(piece.ref) }
        : {
          nombre: piece.nombre.trim(),
        }),
      cavidades: Number(piece.cavidades),
      peso_unitario_gr: Number(piece.peso_unitario_gr),
    })),
  });
  const groups = normalized.moldes.map(serializeGroup);
  // Conserva el contrato histórico para sesiones de un solo molde.
  if (groups.length === 1) {
    return { molde: groups[0].molde, piezas: groups[0].piezas };
  }
  return {
    moldes: groups,
  };
};

export const validateComponents = (value) => {
  const data = normalizeComponentsData(value);
  const errors = { molde: {}, piezas: {}, moldes: {} };
  const seenReferences = new Set();
  const seenMolds = new Set();
  data.moldes.forEach((group) => {
    const groupErrors = { molde: {}, piezas: {} };
    if (group.molde.modo === 'REUTILIZAR') {
      if (!group.molde.ref) groupErrors.molde.ref = 'Selecciona un molde existente.';
      if (group.molde.ref && seenMolds.has(String(group.molde.ref))) {
        groupErrors.molde.ref = 'El molde está repetido.';
      }
      if (group.molde.ref) seenMolds.add(String(group.molde.ref));
    } else {
      if (!group.molde.nombre.trim()) groupErrors.molde.nombre = 'Ingresa el nombre del molde.';
      if (!positiveNumber(group.molde.peso_tiro_gr)) {
        groupErrors.molde.peso_tiro_gr = 'El peso de tiro debe ser mayor que cero.';
      }
      if (!positiveNumber(group.molde.tiempo_ciclo_std)) {
        groupErrors.molde.tiempo_ciclo_std = 'El ciclo debe ser mayor que cero.';
      }
    }
    if (!group.piezas.length) groupErrors.piezas.general = 'Añade al menos una pieza.';
    group.piezas.forEach((piece) => {
    const item = {};
    if (piece.modo === 'REUTILIZAR') {
      if (!piece.ref) item.ref = 'Selecciona una pieza existente.';
      if (piece.ref && seenReferences.has(String(piece.ref))) item.ref = 'La pieza está repetida.';
      if (piece.ref) seenReferences.add(String(piece.ref));
    } else {
      if (!piece.nombre.trim()) item.nombre = 'Ingresa el nombre de la pieza.';
    }
    if (!Number.isInteger(Number(piece.cavidades)) || Number(piece.cavidades) <= 0) {
      item.cavidades = 'Usa un entero mayor que cero.';
    }
    if (!positiveNumber(piece.peso_unitario_gr)) {
      item.peso_unitario_gr = 'El peso debe ser mayor que cero.';
    }
      if (Object.keys(item).length) groupErrors.piezas[piece.client_id] = item;
    });
    if (Object.keys(groupErrors.molde).length || Object.keys(groupErrors.piezas).length) {
      errors.moldes[group.client_id] = groupErrors;
    }
  });
  const firstErrors = errors.moldes[data.moldes[0]?.client_id] || {};
  errors.molde = firstErrors.molde || {};
  errors.piezas = firstErrors.piezas || {};
  return errors;
};

export const componentsAreComplete = (value) => {
  const errors = validateComponents(value);
  return !Object.keys(errors.moldes).length;
};

export const emptyColorsData = {
  color_molde_ref: null,
  colores: [],
  matriz: [],
  formulaciones: [],
};

export const newColorDraft = () => ({
  client_id: makeClientId('color'),
  modo: 'NUEVO',
  color_ref: null,
  nombre: '',
  familia_color_id: '',
  hex: '',
});

export const defaultFormulation = (color) => ({
  color_ref: color.color_ref || undefined,
  color_client_id: color.client_id,
  tipo: 'PENDIENTE',
  receta_ref: null,
  base_virgen_kg: '1',
  componentes: [],
  motivo_pendiente: '',
  estado: null,
});

export const normalizeColorsData = (data = {}, references = {}) => {
  const resolved = references?.COLORES || references || {};
  const resolvedColors = new Map((resolved.colores || []).map((color) => [
    String(color.client_id), color,
  ]));
  const resolvedMatrix = new Map((resolved.matriz || []).map((cell) => [
    `${cell.pieza_ref || cell.pieza_client_id}:${cell.color_ref || cell.color_client_id}`,
    cell,
  ]));
  const resolvedFormulations = new Map((resolved.formulaciones || []).map((item) => [
    String(item.color_ref || item.color_client_id), item,
  ]));
  const colors = (data.colores || []).map((color, index) => {
    const clientId = color.client_id || `color-importado-${index + 1}`;
    const checkpoint = resolvedColors.get(String(clientId)) || {};
    const colorRef = color.color_ref
      || unwrapId(checkpoint.color_ref, ['id', 'color_ref'])
      || null;
    return {
      client_id: clientId,
      modo: colorRef ? 'REUTILIZAR' : (color.modo || 'NUEVO'),
      color_ref: colorRef,
      nombre: color.nombre || '',
      familia_color_id: color.familia_color_id || '',
      hex: color.hex || color.hex_referencia || '',
    };
  });
  const formulationsByColor = new Map((data.formulaciones || []).map((item) => [
    String(item.color_ref || item.color_client_id), item,
  ]));

  return {
    ...emptyColorsData,
    ...data,
    color_molde_ref: data.color_molde_ref || resolved.color_molde_ref || null,
    colores: colors,
    matriz: (data.matriz || []).map((cell) => {
      const key = `${cell.pieza_ref || cell.pieza_client_id}:${cell.color_ref || cell.color_client_id}`;
      const checkpoint = resolvedMatrix.get(key) || {};
      return {
        pieza_ref: cell.pieza_ref || checkpoint.pieza_ref || undefined,
        pieza_client_id: cell.pieza_client_id || checkpoint.pieza_client_id || undefined,
        color_ref: cell.color_ref || checkpoint.color_ref || undefined,
        color_client_id: cell.color_client_id || checkpoint.color_client_id || undefined,
        seleccionada: cell.seleccionada !== false,
        pieza_color_ref: cell.pieza_color_ref || checkpoint.pieza_color_ref || null,
        receta_ref: Object.prototype.hasOwnProperty.call(cell, 'receta_ref')
          ? cell.receta_ref
          : checkpoint.receta_ref || null,
      };
    }),
    formulaciones: colors.map((color) => {
      const key = String(color.color_ref || color.client_id);
      const source = formulationsByColor.get(key)
        || formulationsByColor.get(String(color.client_id))
        || defaultFormulation(color);
      const checkpoint = resolvedFormulations.get(key)
        || resolvedFormulations.get(String(color.client_id))
        || {};
      return {
        ...defaultFormulation(color),
        ...source,
        color_ref: color.color_ref || source.color_ref || checkpoint.color_ref || undefined,
        color_client_id: color.client_id,
        tipo: checkpoint.receta_ref && checkpoint.estado !== 'PENDIENTE'
          ? 'EXISTENTE'
          : source.tipo,
        receta_ref: source.receta_ref || checkpoint.receta_ref || null,
        estado: source.estado || checkpoint.estado || null,
        componentes: (source.componentes || []).map((component) => ({
          material_id: component.material_id || '',
          tipo_componente: component.tipo_componente || 'MATERIA_PRIMA',
          cantidad: asNumberOrEmpty(component.cantidad),
          base_kg: asNumberOrEmpty(component.base_kg),
        })),
      };
    }),
  };
};

export const createMatrix = (pieces, colors, current = []) => {
  const existing = new Map(current.map((cell) => [
    `${cell.pieza_ref || cell.pieza_client_id}:${cell.color_ref || cell.color_client_id}`,
    cell,
  ]));
  return pieces.flatMap((piece) => colors.map((color) => {
    const pieceRef = unwrapId(piece.ref || piece.pieza_ref, ['id', 'pieza_ref']);
    const pieceClientId = piece.client_id;
    const colorRef = color.color_ref;
    const key = `${pieceRef || pieceClientId}:${colorRef || color.client_id}`;
    return existing.get(key) || {
      ...(pieceRef ? { pieza_ref: Number(pieceRef) } : { pieza_client_id: pieceClientId }),
      ...(colorRef ? { color_ref: Number(colorRef) } : { color_client_id: color.client_id }),
      seleccionada: true,
      pieza_color_ref: null,
    };
  }));
};

export const newRecipeComponent = () => ({
  material_id: '',
  tipo_componente: 'MATERIA_PRIMA',
  cantidad: '',
  base_kg: '',
});

export const serializeColorsData = (value) => {
  const data = normalizeColorsData(value);
  return {
    ...(data.color_molde_ref ? { color_molde_ref: data.color_molde_ref } : {}),
    colores: data.colores.map((color) => ({
      client_id: color.client_id,
      modo: color.modo,
      ...(color.modo === 'REUTILIZAR'
        ? { color_ref: Number(color.color_ref) }
        : {
          nombre: color.nombre.trim(),
          familia_color_id: Number(color.familia_color_id),
          hex: color.hex?.trim() || null,
        }),
    })),
    matriz: data.matriz.map((cell) => ({
      ...(cell.pieza_ref ? { pieza_ref: Number(cell.pieza_ref) } : { pieza_client_id: cell.pieza_client_id }),
      ...(cell.color_ref ? { color_ref: Number(cell.color_ref) } : { color_client_id: cell.color_client_id }),
      seleccionada: cell.seleccionada !== false,
      ...(cell.receta_ref ? { receta_ref: Number(cell.receta_ref) } : {}),
    })),
    formulaciones: data.formulaciones.map((formulation) => ({
      ...(formulation.color_ref
        ? { color_ref: Number(formulation.color_ref) }
        : { color_client_id: formulation.color_client_id }),
      tipo: formulation.tipo,
      ...(formulation.tipo === 'EXISTENTE' ? { receta_ref: Number(formulation.receta_ref) } : {}),
      ...(['NUEVA', 'SIN_PIGMENTO'].includes(formulation.tipo) ? {
        base_virgen_kg: Number(formulation.base_virgen_kg),
        componentes: formulation.componentes.map((component) => ({
          material_id: Number(component.material_id),
          tipo_componente: component.tipo_componente,
          cantidad: Number(component.cantidad),
          ...(component.tipo_componente === 'MATERIA_PRIMA' || !component.base_kg
            ? {}
            : { base_kg: Number(component.base_kg) }),
        })),
      } : {}),
      ...(formulation.tipo === 'PENDIENTE'
        ? { motivo_pendiente: formulation.motivo_pendiente.trim() }
        : {}),
    })),
  };
};

const validHex = (value) => !value || /^#[0-9A-F]{6}$/i.test(value.trim());

const matrixPieceKey = (value) => String(
  unwrapId(value?.ref || value?.pieza_ref, ['id', 'pieza_ref'])
  || value?.client_id
  || value?.pieza_client_id,
);

export const validateColors = (value, pieces = [], moldGroups = []) => {
  const data = normalizeColorsData(value);
  const errors = { colores: {}, matriz: [], formulaciones: {} };
  if (!data.colores.length) errors.colores.general = 'Añade al menos un color.';
  data.colores.forEach((color) => {
    const item = {};
    if (color.modo === 'REUTILIZAR' && !color.color_ref) item.color_ref = 'Selecciona un color.';
    if (color.modo === 'NUEVO') {
      if (!color.nombre.trim()) item.nombre = 'Ingresa el nombre del color.';
      if (!color.familia_color_id) item.familia_color_id = 'Selecciona el Acabado.';
      if (!validHex(color.hex)) item.hex = 'Usa el formato #RRGGBB.';
    }
    if (Object.keys(item).length) errors.colores[color.client_id] = item;
  });

  const expectedMatrix = createMatrix(pieces, data.colores, data.matriz);
  const selectedCells = expectedMatrix.filter((cell) => cell.seleccionada !== false);
  const selectedPieceKeys = new Set(selectedCells.map((cell) => String(
    cell.pieza_ref || cell.pieza_client_id,
  )));
  const selectedColorKeys = new Set(selectedCells.map((cell) => String(
    cell.color_ref || cell.color_client_id,
  )));
  const groups = moldGroups.length
    ? moldGroups.map((group) => group.piezas || []).filter((groupPieces) => groupPieces.length)
    : (pieces.length ? [pieces] : []);

  if (pieces.some((piece) => !selectedPieceKeys.has(matrixPieceKey(piece)))) {
    errors.matriz.push('Cada pieza debe tener al menos un color de producción.');
  }
  if (data.colores.some((color) => (
    !selectedColorKeys.has(String(color.color_ref || color.client_id))
  ))) {
    errors.matriz.push('Cada color declarado debe asociarse al menos a una pieza.');
  }
  const hasIncompleteMoldCoverage = groups.some((groupPieces) => {
    const groupPieceKeys = new Set(groupPieces.map(matrixPieceKey));
    const groupColorKeys = new Set(selectedCells
      .filter((cell) => groupPieceKeys.has(String(cell.pieza_ref || cell.pieza_client_id)))
      .map((cell) => String(cell.color_ref || cell.color_client_id)));
    return [...groupColorKeys].some((colorKey) => groupPieces.some((piece) => (
      !selectedCells.some((cell) => (
        String(cell.pieza_ref || cell.pieza_client_id) === matrixPieceKey(piece)
        && String(cell.color_ref || cell.color_client_id) === colorKey
      ))
    )));
  });
  if (hasIncompleteMoldCoverage) {
    errors.matriz.push('Cada color del molde debe cubrir todas sus piezas activas.');
  }
  if (pieces.length && data.colores.length && expectedMatrix.length !== data.matriz.length) {
    errors.matriz.push('Confirma la matriz completa de Pieza × Color.');
  }

  data.formulaciones.forEach((formulation) => {
    const item = {};
    if (formulation.tipo === 'EXISTENTE' && !formulation.receta_ref) {
      item.receta_ref = 'Selecciona una receta existente.';
    }
    if (['NUEVA', 'SIN_PIGMENTO'].includes(formulation.tipo)) {
      if (!positiveNumber(formulation.base_virgen_kg)) item.base_virgen_kg = 'Indica una base positiva.';
      if (!formulation.componentes.length) item.componentes = 'Agrega ingredientes explícitos o marca Pendiente.';
      if (formulation.componentes.some((component) => (
        !component.material_id || !positiveNumber(component.cantidad)
      ))) item.componentes = 'Completa material y cantidad en cada ingrediente.';
    }
    if (formulation.tipo === 'SIN_PIGMENTO') {
      if (formulation.componentes.some((item) => item.tipo_componente !== 'MATERIA_PRIMA')) {
        item.componentes = 'Sin pigmento solo admite materias primas.';
      }
      const resinFraction = formulation.componentes.reduce(
        (sum, component) => sum + Number(component.cantidad || 0), 0,
      );
      if (Math.abs(resinFraction - 1) > 0.0001) {
        item.componentes = 'Las fracciones de materia prima deben sumar 1.';
      }
    }
    if (formulation.tipo === 'PENDIENTE' && !formulation.motivo_pendiente.trim()) {
      item.motivo_pendiente = 'Explica qué dato falta para retomarlo.';
    }
    if (Object.keys(item).length) {
      errors.formulaciones[formulation.color_client_id || formulation.color_ref] = item;
    }
  });
  return errors;
};

export const colorsAreComplete = (value, pieces, moldGroups = []) => {
  const errors = validateColors(value, pieces, moldGroups);
  return !Object.keys(errors.colores).length
    && !errors.matriz.length
    && !Object.keys(errors.formulaciones).length;
};
