export const primaryNavigation = [
  { id: 'inicio', label: 'Inicio', path: '/', icon: 'dashboard', exact: true },
  { id: 'planificacion', label: 'Planificación', path: '/planificacion', icon: 'planning', requiredAny: ['OP_VER', 'OP_CREAR', 'OP_APROBAR', 'PLANIFICACION_CALCULAR'] },
  { id: 'materiales', label: 'Materias primas', path: '/materiales/recepciones', icon: 'materials', requiredAny: ['OC_CREAR', 'OC_APROBAR', 'RECEPCION_CONFIRMAR', 'CALIDAD_RESOLVER', 'PROVEEDOR_ADMINISTRAR', 'DOCUMENTO_PROVEEDOR_REGISTRAR'] },
  { id: 'produccion', label: 'Producción', path: '/produccion/kardex', icon: 'production', requiredAny: ['OP_VER', 'OF_VER', 'OA_VER', 'OT_VER', 'WIP_VER', 'INVENTARIO_VER', 'ABASTECIMIENTO_VER', 'RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER', 'MOLIENDA_VER', 'ALERTA_VER'] },
];

export const supportNavigation = [
  { id: 'maestros', label: 'Datos maestros', path: '/datos-maestros', icon: 'catalog', requiredAny: ['ARTICULO_VER', 'ESTRUCTURA_VER', 'RUTA_VER', 'EMPAQUE_VER', 'TIPO_MANGA_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: 'settings', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR', 'AUTORIZACION_SCM_ADMINISTRAR', 'TIPO_MANGA_ADMINISTRAR'] },
  { id: 'guia', label: 'Guía SCM', path: '/guia/scm', icon: 'guide' },
];

export const workspaceNavigation = [
  {
    id: 'materiales',
    label: 'Materias primas',
    matches: ['/materiales', '/ordenes/:numeroOp/materiales'],
    tabs: [
      { label: 'Recepciones', path: '/materiales/recepciones', icon: 'receipts', requiredAny: ['RECEPCION_CONFIRMAR', 'DOCUMENTO_PROVEEDOR_REGISTRAR'] },
      { label: 'Órdenes de compra', path: '/materiales/compras', icon: 'purchases', requiredAny: ['OC_CREAR', 'OC_APROBAR'] },
      { label: 'Calidad', path: '/materiales/calidad', icon: 'quality', requiredAny: ['CALIDAD_RESOLVER'] },
      { label: 'Lotes e inventario', path: '/materiales/inventario', icon: 'inventory', requiredAny: ['RECEPCION_CONFIRMAR', 'CALIDAD_RESOLVER', 'WIP_VER'] },
      { label: 'Reservas y entregas', path: '/materiales/preparaciones', icon: 'reservations', requiredAny: ['OPERACION_PLANIFICAR', 'WIP_VER'] },
      { label: 'Documentos', path: '/materiales/documentos', icon: 'documents', requiredAny: ['DOCUMENTO_PROVEEDOR_REGISTRAR', 'OC_CREAR'] },
    ],
  },
  {
    id: 'produccion',
    label: 'Producción',
    matches: ['/produccion', '/ordenes', '/registros', '/pesaje'],
    exclude: ['/ordenes/:numeroOp/materiales'],
    tabs: [
      { label: 'Órdenes de producción', path: '/produccion/ordenes', icon: 'orders', requiredAny: ['OP_VER'] },
      { label: 'Órdenes de fabricación', path: '/produccion/ordenes-fabricacion', icon: 'production', requiredAny: ['OF_VER'] },
      { label: 'Órdenes de armado', path: '/produccion/ordenes-armado', icon: 'records', requiredAny: ['OA_VER'] },
      { label: 'Abastecimiento a Armado', path: '/produccion/abastecimiento', icon: 'reservations', requiredAny: ['ABASTECIMIENTO_VER'] },
      { label: 'OT y mangas', path: '/produccion/ots-mangas', icon: 'records', requiredAny: ['OT_VER', 'PLAN_MANGA_VER'] },
      { label: 'Registro diario', path: '/produccion/registros', icon: 'records', requiredAny: ['OT_VER'] },
      { label: 'Avance de planta', path: '/produccion/avance', icon: 'progress', requiredAny: ['WIP_VER'] },
      { label: 'Recepción de mangas', path: '/produccion/recepcion-mangas', icon: 'receipts', requiredAny: ['RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER'] },
      { label: 'Kardex SCM', path: '/produccion/kardex', icon: 'inventory', requiredAny: ['INVENTARIO_VER'] },
      { label: 'Reproceso y molienda', path: '/produccion/reproceso', icon: 'recycling', requiredAny: ['MOLIENDA_VER'] },
      { label: 'Alertas', path: '/produccion/alertas', icon: 'alerts', requiredAny: ['ALERTA_VER'] },
      { label: 'Histórico de pesajes', path: '/produccion/pesajes', icon: 'weighing', requiredAny: ['MANGA_PESAJE_VER'] },
      { label: 'Talonarios OT', path: '/produccion/talonarios', icon: 'documents', requiredAny: ['OT_CREAR'] },
    ],
  },
  {
    id: 'maestros',
    label: 'Datos maestros',
    matches: ['/datos-maestros', '/catalogo'],
    tabs: [
      { label: 'Resumen', path: '/datos-maestros', icon: 'overview', exact: true, requiredAny: ['ARTICULO_VER', 'EMPAQUE_VER', 'CONFIG_RECEPCION_ADMINISTRAR'] },
      { label: 'Productos', path: '/datos-maestros/productos', icon: 'products', requiredAny: ['ARTICULO_VER'] },
      { label: 'Piezas y SKU', path: '/datos-maestros/piezas', icon: 'pieces', requiredAny: ['ARTICULO_VER'] },
      { label: 'Moldes', path: '/datos-maestros/moldes', icon: 'molds', requiredAny: ['ARTICULO_VER', 'RUTA_VER'] },
      { label: 'Configuración guiada', path: '/datos-maestros/configuracion-guiada', icon: 'wizard', requiredAny: ['ARTICULO_ADMINISTRAR'] },
      { label: 'Ingeniería SCM', path: '/datos-maestros/ingenieria-scm', icon: 'production', requiredAny: ['ESTRUCTURA_VER', 'RUTA_VER', 'EMPAQUE_VER'] },
      { label: 'Reproceso', path: '/datos-maestros/reproceso', icon: 'recycling', requiredAny: ['MOLIENDA_VER', 'MOLIENDA_REGLA_ADMINISTRAR'] },
      { label: 'Líneas y familias', path: '/datos-maestros/clasificacion', icon: 'catalog', requiredAny: ['ARTICULO_ADMINISTRAR'] },
      { label: 'Colores y recetas', path: '/datos-maestros/colores', icon: 'catalog', requiredAny: ['ARTICULO_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'] },
      { label: 'Materias primas', path: '/datos-maestros/materiales', icon: 'materials', requiredAny: ['CATALOGO_MATERIAL_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR', 'PROVEEDOR_ADMINISTRAR'] },
      { label: 'Trabajadores', path: '/datos-maestros/trabajadores', icon: 'workers', requiredAny: ['AUTORIZACION_SCM_ADMINISTRAR'] },
      { label: 'Máquinas', path: '/datos-maestros/maquinas', icon: 'machines', requiredAny: ['CATALOGO_PLANTA_ADMINISTRAR', 'OF_EDITAR_BORRADOR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
    ],
  },
];

const normalizePath = (path) => path.replace(/\/+$/, '') || '/';

const patternMatches = (pathname, pattern, exact = false) => {
  const normalizedPath = normalizePath(pathname);
  const normalizedPattern = normalizePath(pattern);
  const expression = normalizedPattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${expression}${exact ? '$' : '(?:/|$)'}`).test(normalizedPath);
};

export const navigationItemIsActive = (pathname, item) => patternMatches(pathname, item.path, item.exact);

export const getWorkspaceNavigation = (pathname) => workspaceNavigation.find((workspace) => {
  const excluded = workspace.exclude?.some((pattern) => patternMatches(pathname, pattern));
  return !excluded && workspace.matches.some((pattern) => patternMatches(pathname, pattern));
});

export const workspaceTabIsActive = (pathname, tab) => patternMatches(pathname, tab.path, tab.exact);

export const visibleByCapabilities = (items, canAny) => (
  items.filter((item) => canAny(item.requiredAny || []))
);
