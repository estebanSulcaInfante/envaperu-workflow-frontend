const cleanPath = (value = '/') => {
  const [pathname, query = ''] = String(value).split('?');
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return query ? `${normalized}?${query}` : normalized;
};

const pathnameOf = (value = '/') => cleanPath(value).split('?')[0];

const patternToRegExp = (pattern) => {
  const pathname = pathnameOf(pattern);
  const expression = pathname
    .split('/')
    .map((segment) => (segment.startsWith(':')
      ? '[^/]+'
      : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${expression}$`);
};

const matchScore = (pattern) => pathnameOf(pattern)
  .split('/')
  .reduce((score, segment) => score + (segment.startsWith(':') ? 1 : 10), 0);

const feature = ({
  key,
  areaKey,
  sectionKey,
  label,
  description,
  path,
  matches = [],
  aliases = [],
  requiredAny = [],
  maturity = 'PILOTO',
  task = false,
  navigation = true,
  defaultPriority = 100,
  icon = 'catalog',
  keywords = [],
  exact = false,
}) => ({
  key,
  areaKey,
  sectionKey,
  label,
  description,
  path,
  matches: [path, ...matches],
  aliases,
  requiredAny,
  maturity,
  task,
  navigation,
  defaultPriority,
  icon,
  keywords,
  exact,
});

export const workspaceAreas = [
  { key: 'home', label: 'Inicio', order: 0, icon: 'dashboard', path: '/', exact: true },
  { key: 'planning', label: 'Planificación', order: 10, icon: 'planning', path: '/planificacion' },
  { key: 'production', label: 'Producción', order: 20, icon: 'production', path: '/produccion/ordenes-fabricacion' },
  { key: 'materials', label: 'Materiales', order: 30, icon: 'materials', path: '/materiales/preparaciones' },
  { key: 'warehouse', label: 'Almacén e inventario', order: 40, icon: 'warehouse', path: '/produccion/kardex' },
  { key: 'control', label: 'Control', order: 50, icon: 'control', path: '/control/supervision-produccion' },
  { key: 'masters', label: 'Datos maestros', order: 100, icon: 'catalog', path: '/datos-maestros', support: true, childMode: 'hub' },
  { key: 'admin', label: 'Administración', order: 110, icon: 'settings', path: '/configuracion', support: true },
  { key: 'guide', label: 'Guía SCM', order: 120, icon: 'guide', path: '/guia/scm', support: true },
];

export const workspaceFeatures = [
  feature({ key: 'home.workspace', areaKey: 'home', sectionKey: 'home', label: 'Inicio', description: 'Trabajo disponible para el perfil.', path: '/', icon: 'dashboard', defaultPriority: 0, exact: true }),

  feature({ key: 'planning.demand', areaKey: 'planning', sectionKey: 'demand', label: 'Demanda, OP y plan', description: 'Demanda, cobertura, metas y OF/OA generadas.', path: '/planificacion', matches: ['/planificacion/:solicitudId'], requiredAny: ['OP_VER', 'OP_CREAR', 'OP_APROBAR', 'PLANIFICACION_CALCULAR'], icon: 'planning', defaultPriority: 10, task: true }),
  feature({ key: 'planning.exceptionalOp', areaKey: 'planning', sectionKey: 'demand', label: 'OP excepcional', description: 'Alta excepcional y justificada.', path: '/produccion/ordenes/nueva-excepcional', aliases: ['/ordenes/nueva'], requiredAny: ['OP_CREAR'], maturity: 'LEGACY_MARCHA_BLANCA', task: false, icon: 'orders' }),

  feature({ key: 'production.fabrication', areaKey: 'production', sectionKey: 'fabrication', label: 'Fabricación · OF', description: 'Configura y libera órdenes de fabricación.', path: '/produccion/ordenes-fabricacion', requiredAny: ['OF_VER'], icon: 'production', defaultPriority: 20, task: true }),
  feature({ key: 'production.machineWork', areaKey: 'production', sectionKey: 'machine-work', label: 'OTs de planta', description: 'Prepara OT por recurso y entra al trabajo de colores y mangas.', path: '/produccion/ots-planta', matches: ['/produccion/ots-planta/trabajo'], aliases: ['/produccion/ots-mangas'], requiredAny: ['OT_VER'], icon: 'records', defaultPriority: 30, task: true }),
  feature({ key: 'production.assembly', areaKey: 'production', sectionKey: 'assembly', label: 'Armado · OA', description: 'Libera y ejecuta órdenes de armado.', path: '/produccion/ordenes-armado', aliases: ['/produccion/ordenes-ensamble'], requiredAny: ['OA_VER'], icon: 'assembly', defaultPriority: 40, task: true }),

  feature({ key: 'materials.preparation', areaKey: 'materials', sectionKey: 'preparation', label: 'Preparación de materiales', description: 'Requerimientos, reservas, emisiones y devoluciones.', path: '/materiales/preparaciones', matches: ['/materiales/preparaciones/:numeroOp'], aliases: ['/ordenes/:numeroOp/materiales', '/materiales'], requiredAny: ['OPERACION_PLANIFICAR', 'WIP_VER'], icon: 'reservations', defaultPriority: 20, task: true }),
  feature({ key: 'materials.internalSupply', areaKey: 'materials', sectionKey: 'internal-supply', label: 'Abastecimiento interno', description: 'Picking, entrega y retorno hacia Armado.', path: '/produccion/abastecimiento', requiredAny: ['ABASTECIMIENTO_VER'], icon: 'internalSupply', defaultPriority: 30, task: true }),
  feature({ key: 'materials.reprocessing', areaKey: 'materials', sectionKey: 'reprocessing', label: 'Merma, reproceso y molienda', description: 'Gestiona merma y recuperación operativa.', path: '/produccion/reproceso', requiredAny: ['MOLIENDA_VER'], icon: 'recycling', defaultPriority: 40, task: true }),

  feature({ key: 'warehouse.receiving', areaKey: 'warehouse', sectionKey: 'receiving', label: 'Recepción y Calidad', description: 'Recibe mangas, ubica y resuelve Calidad.', path: '/produccion/recepcion-mangas', requiredAny: ['RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER'], icon: 'receipts', defaultPriority: 20, task: true }),
  feature({ key: 'warehouse.kardex', areaKey: 'warehouse', sectionKey: 'inventory', label: 'Kardex y existencias', description: 'Consulta saldos y movimientos trazables.', path: '/produccion/kardex', requiredAny: ['INVENTARIO_VER'], icon: 'inventory', defaultPriority: 10, keywords: ['inventario', 'existencias', 'movimientos'], task: true }),

  feature({ key: 'control.productionSupervision', areaKey: 'control', sectionKey: 'production-supervision', label: 'Supervisión de producción', description: 'Consulta OT, recursos, avance y excepciones sin mezclar acciones operativas.', path: '/control/supervision-produccion', aliases: ['/produccion/supervision'], requiredAny: ['OT_VER'], icon: 'control', defaultPriority: 0, keywords: ['OT', 'supervisión', 'jornadas', 'observabilidad'], task: true }),
  feature({ key: 'control.printJobs', areaKey: 'control', sectionKey: 'printing', label: 'Impresión y etiquetas', description: 'Supervisa la cola central y abre la vista previa en la estación.', path: '/control/impresion-etiquetas', requiredAny: ['OT_VER'], icon: 'documents', defaultPriority: 5, keywords: ['stickers', 'etiquetas', 'impresión', 'prepesaje', 'postpesaje'], task: true }),
  feature({ key: 'control.progress', areaKey: 'control', sectionKey: 'progress', label: 'Avance de planta · legacy', description: 'Seguimiento de cumplimiento y producción desde reportes locales legacy.', path: '/produccion/avance', aliases: ['/pesaje/avance'], requiredAny: ['WIP_VER'], icon: 'progress', defaultPriority: 10, task: true }),
  feature({ key: 'control.alerts', areaKey: 'control', sectionKey: 'alerts', label: 'Alertas operativas', description: 'Excepciones que requieren atención.', path: '/produccion/alertas', requiredAny: ['ALERTA_VER'], icon: 'alerts', defaultPriority: 20, task: true }),
  feature({ key: 'control.weighings', areaKey: 'control', sectionKey: 'weighings', label: 'Pesajes y correcciones · legacy', description: 'Histórico, conciliación y anulaciones de la fuente local legacy.', path: '/produccion/pesajes', aliases: ['/pesaje/ordenes'], requiredAny: ['MANGA_PESAJE_VER'], icon: 'weighing', defaultPriority: 30, task: true }),
  feature({ key: 'control.legacyOrders', areaKey: 'control', sectionKey: 'white-run', label: 'Órdenes legacy', description: 'Compatibilidad temporal de marcha blanca.', path: '/produccion/ordenes', aliases: ['/ordenes'], requiredAny: ['OP_VER'], maturity: 'LEGACY_MARCHA_BLANCA', icon: 'orders', task: false }),
  feature({ key: 'control.dailyRecords', areaKey: 'control', sectionKey: 'white-run', label: 'Registro diario legacy', description: 'Registro paralelo de marcha blanca.', path: '/produccion/registros', aliases: ['/registros'], requiredAny: ['OT_VER'], maturity: 'LEGACY_MARCHA_BLANCA', icon: 'records', task: false }),
  feature({ key: 'control.talonarios', areaKey: 'control', sectionKey: 'white-run', label: 'Talonarios OT', description: 'Control físico de contingencia.', path: '/produccion/talonarios', aliases: ['/registros/talonarios'], requiredAny: ['OT_CREAR'], maturity: 'LEGACY_MARCHA_BLANCA', icon: 'documents', task: false }),

  feature({ key: 'masters.hub', areaKey: 'masters', sectionKey: 'overview', label: 'Resumen de maestros', description: 'Hub canónico de catálogos.', path: '/datos-maestros', requiredAny: ['ARTICULO_VER', 'EMPAQUE_VER', 'CONFIG_RECEPCION_ADMINISTRAR'], icon: 'overview', defaultPriority: 10, exact: true }),
  feature({ key: 'masters.productOnboarding', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Alta integral de producto', description: 'Flujo reanudable desde la identidad hasta la revisi\u00f3n.', path: '/datos-maestros/alta-producto', matches: ['/datos-maestros/alta-producto/:draftId/:stepId'], requiredAny: ['ARTICULO_ADMINISTRAR'], icon: 'wizard', defaultPriority: 5, task: true }),
  feature({ key: 'masters.products', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Productos', description: 'Productos terminados y presentaciones.', path: '/datos-maestros/productos', requiredAny: ['ARTICULO_VER'], icon: 'products', defaultPriority: 10, task: true }),
  feature({ key: 'masters.pieces', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Piezas y SKU', description: 'Pieza, PiezaColor, imágenes y SKU.', path: '/datos-maestros/piezas', requiredAny: ['ARTICULO_VER'], icon: 'pieces', defaultPriority: 20, task: true }),
  feature({ key: 'masters.molds', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Moldes', description: 'Moldes, cavidades y salidas.', path: '/datos-maestros/moldes', aliases: ['/catalogo/moldes'], requiredAny: ['ARTICULO_VER', 'RUTA_VER'], icon: 'molds', defaultPriority: 30, task: true }),
  feature({ key: 'masters.moldDetail', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Detalle de molde', description: 'Configuración editable del molde.', path: '/datos-maestros/moldes/:codigo', aliases: ['/catalogo/moldes/:codigo'], requiredAny: ['ARTICULO_ADMINISTRAR', 'RUTA_ADMINISTRAR'], icon: 'molds', navigation: false, task: false }),
  feature({ key: 'masters.wizard', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Configuraci\u00f3n t\u00e9cnica de molde y piezas', description: 'Herramienta heredada para Molde, Pieza y PiezaColor.', path: '/datos-maestros/configuracion-guiada', aliases: ['/catalogo/configurar', '/datos-maestros/configurar'], requiredAny: ['ARTICULO_ADMINISTRAR'], maturity: 'LEGACY_MARCHA_BLANCA', icon: 'molds', defaultPriority: 40, task: false }),
  feature({ key: 'masters.engineering', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Ingeniería SCM', description: 'WIP, BOM, rutas y empaque.', path: '/datos-maestros/ingenieria-scm', requiredAny: ['ESTRUCTURA_VER', 'RUTA_VER', 'EMPAQUE_VER'], icon: 'production', defaultPriority: 50, task: true }),
  feature({ key: 'masters.classification', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Líneas y familias', description: 'Clasificación N:M de producto.', path: '/datos-maestros/clasificacion', aliases: ['/catalogo/clasificacion'], requiredAny: ['ARTICULO_ADMINISTRAR'], icon: 'catalog', defaultPriority: 60, task: true }),
  feature({ key: 'masters.colors', areaKey: 'masters', sectionKey: 'product-engineering', label: 'Colores y recetas', description: 'Color y formulación versionada.', path: '/datos-maestros/colores', requiredAny: ['ARTICULO_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'], icon: 'catalog', defaultPriority: 70, task: true }),
  feature({ key: 'masters.materials', areaKey: 'masters', sectionKey: 'materials-suppliers', label: 'Materiales y proveedores', description: 'Materias primas, proveedores y reglas.', path: '/datos-maestros/materiales', aliases: ['/materiales/catalogos'], requiredAny: ['CATALOGO_MATERIAL_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR', 'PROVEEDOR_ADMINISTRAR'], icon: 'materials', defaultPriority: 80, task: true }),
  feature({ key: 'masters.machines', areaKey: 'masters', sectionKey: 'plant-logistics', label: 'Máquinas', description: 'Recursos de planta.', path: '/datos-maestros/maquinas', aliases: ['/catalogo/maquinas'], requiredAny: ['CATALOGO_PLANTA_ADMINISTRAR', 'OF_EDITAR_BORRADOR', 'CONFIG_RECEPCION_ADMINISTRAR'], icon: 'machines', defaultPriority: 90, task: true }),
  feature({ key: 'masters.workers', areaKey: 'masters', sectionKey: 'organization', label: 'Trabajadores', description: 'Personas y asignaciones operativas.', path: '/datos-maestros/trabajadores', aliases: ['/catalogo/trabajadores'], requiredAny: ['AUTORIZACION_SCM_ADMINISTRAR'], icon: 'workers', defaultPriority: 100, task: true }),
  feature({ key: 'masters.reprocessingRules', areaKey: 'masters', sectionKey: 'governance', label: 'Reglas de reproceso', description: 'Compatibilidades y reglas maestras.', path: '/datos-maestros/reproceso', requiredAny: ['MOLIENDA_VER', 'MOLIENDA_REGLA_ADMINISTRAR'], icon: 'recycling', defaultPriority: 110, task: true }),
  feature({ key: 'masters.import', areaKey: 'masters', sectionKey: 'governance', label: 'Importar datos', description: 'Carga controlada de catálogo.', path: '/catalogo/importar', requiredAny: ['ARTICULO_ADMINISTRAR', 'CATALOGO_MATERIAL_ADMINISTRAR'], icon: 'documents', defaultPriority: 120, task: true }),
  feature({ key: 'masters.review', areaKey: 'masters', sectionKey: 'governance', label: 'Revisión de datos', description: 'Calidad y pendientes del catálogo.', path: '/catalogo/revision', requiredAny: ['ARTICULO_ADMINISTRAR'], icon: 'quality', defaultPriority: 130, task: true }),

  feature({ key: 'admin.roles', areaKey: 'admin', sectionKey: 'roles', label: 'Roles y capacidades', description: 'Gobierna permisos y experiencia de trabajo por rol.', path: '/administracion/roles-capacidades', requiredAny: ['AUTORIZACION_SCM_ADMINISTRAR'], maturity: 'PILOTO', icon: 'settings', defaultPriority: 10, task: true }),
  feature({ key: 'admin.settings', areaKey: 'admin', sectionKey: 'settings', label: 'Configuración provisional', description: 'Configuración aún no productiva.', path: '/configuracion', aliases: ['/materiales/configuracion'], requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR', 'AUTORIZACION_SCM_ADMINISTRAR'], maturity: 'PROTOTIPO', icon: 'settings', task: false }),
  feature({ key: 'guide.scm', areaKey: 'guide', sectionKey: 'guide', label: 'Guía SCM', description: 'Documentación operativa del piloto.', path: '/guia/scm', icon: 'guide', defaultPriority: 900, task: false }),

  feature({ key: 'external.receiving', areaKey: 'warehouse', sectionKey: 'external-receiving', label: 'Recepción de materiales', description: 'Recepción ordinaria fuera del piloto.', path: '/materiales/recepciones', matches: ['/materiales/recepciones/nueva', '/materiales/recepciones/:recepcionId', '/materiales/recepciones/:recepcionId/editar'], requiredAny: ['RECEPCION_CONFIRMAR'], maturity: 'FUERA_PILOTO', icon: 'receipts', task: false }),
  feature({ key: 'external.purchases', areaKey: 'materials', sectionKey: 'external-supply', label: 'Órdenes de compra', description: 'Abastecimiento externo fuera del piloto.', path: '/materiales/compras', requiredAny: ['OC_CREAR', 'OC_APROBAR'], maturity: 'FUERA_PILOTO', icon: 'purchases', task: false }),
  feature({ key: 'external.quality', areaKey: 'warehouse', sectionKey: 'external-receiving', label: 'Calidad de materiales', description: 'Resolución de proveedor fuera del piloto.', path: '/materiales/calidad', requiredAny: ['CALIDAD_RESOLVER'], maturity: 'FUERA_PILOTO', icon: 'quality', task: false }),
  feature({ key: 'external.inventory', areaKey: 'warehouse', sectionKey: 'external-receiving', label: 'Lotes de proveedor', description: 'Inventario prototipo de recepción.', path: '/materiales/inventario', requiredAny: ['RECEPCION_CONFIRMAR'], maturity: 'PROTOTIPO', icon: 'inventory', task: false }),
  feature({ key: 'external.documents', areaKey: 'materials', sectionKey: 'external-supply', label: 'Documentos de proveedor', description: 'Documentos fuera del piloto.', path: '/materiales/documentos', requiredAny: ['DOCUMENTO_PROVEEDOR_REGISTRAR'], maturity: 'FUERA_PILOTO', icon: 'documents', task: false }),
  feature({ key: 'external.coverage', areaKey: 'materials', sectionKey: 'external-supply', label: 'Cobertura de compras', description: 'Proyección prototipo de abastecimiento.', path: '/materiales/cobertura', requiredAny: ['OC_CREAR'], maturity: 'PROTOTIPO', icon: 'progress', task: false }),
];

export const defaultWorkspaceRuntimeFlags = {
  showLegacy: String(import.meta.env.VITE_SCM_SHOW_LEGACY || '').toLowerCase() === 'true',
  allowPrototype: import.meta.env.DEV
    && String(import.meta.env.VITE_SCM_ENABLE_PROTOTYPES || 'true').toLowerCase() !== 'false',
  allowOutOfPilot: import.meta.env.DEV
    && String(import.meta.env.VITE_SCM_ENABLE_OUT_OF_PILOT || '').toLowerCase() === 'true',
};

export const featureIsAvailable = (item, runtimeFlags = defaultWorkspaceRuntimeFlags) => {
  if (!item?.maturity || ['PILOTO', 'DISPONIBLE'].includes(item.maturity)) return true;
  if (item.maturity === 'LEGACY_MARCHA_BLANCA') return runtimeFlags.showLegacy === true;
  if (item.maturity === 'PROTOTIPO') return runtimeFlags.allowPrototype === true;
  if (item.maturity === 'FUERA_PILOTO') return runtimeFlags.allowOutOfPilot === true;
  return false;
};

export const featureMatches = (value, item) => {
  const pathname = pathnameOf(value);
  return [...(item.matches || []), ...(item.aliases || [])]
    .some((pattern) => patternToRegExp(pattern).test(pathname));
};

export const getWorkspaceFeature = (value) => workspaceFeatures
  .flatMap((item) => [...item.matches, ...item.aliases].map((pattern) => ({
    item,
    pattern,
    score: matchScore(pattern),
  })))
  .filter(({ pattern }) => patternToRegExp(pattern).test(pathnameOf(value)))
  .sort((left, right) => right.score - left.score)[0]?.item || null;

export const getWorkspaceArea = (value) => {
  const item = getWorkspaceFeature(value);
  return workspaceAreas.find((area) => area.key === item?.areaKey) || null;
};

export const visibleWorkspaceFeatures = ({
  canAny,
  runtimeFlags = defaultWorkspaceRuntimeFlags,
  areaKey,
} = {}) => workspaceFeatures.filter((item) => (
  (!areaKey || item.areaKey === areaKey)
  && item.navigation !== false
  && featureIsAvailable(item, runtimeFlags)
  && (!canAny || canAny(item.requiredAny || []))
));

export const buildAreaNavigation = ({
  canAny,
  runtimeFlags = defaultWorkspaceRuntimeFlags,
} = {}) => workspaceAreas
  .filter((area) => visibleWorkspaceFeatures({ canAny, runtimeFlags, areaKey: area.key }).length > 0)
  .sort((left, right) => left.order - right.order)
  .map((area) => {
    const features = visibleWorkspaceFeatures({ canAny, runtimeFlags, areaKey: area.key })
      .sort((left, right) => (
        left.defaultPriority - right.defaultPriority
        || left.label.localeCompare(right.label, 'es')
      ));
    return {
      ...area,
      // Las areas con hub tienen un punto de entrada propio que organiza sus
      // funciones. No debe sustituirse por el primer catalogo ordenado.
      path: area.childMode === 'hub' ? area.path : (features[0]?.path || area.path),
      features,
    };
  });

export const getFeatureByKey = (key) => workspaceFeatures.find((item) => item.key === key) || null;
