export const primaryNavigation = [
  { id: 'inicio', label: 'Inicio', path: '/', icon: 'dashboard', exact: true },
  { id: 'planificacion', label: 'Planificación', path: '/planificacion', icon: 'planning' },
  { id: 'materiales', label: 'Materias primas', path: '/materiales/recepciones', icon: 'materials' },
  { id: 'produccion', label: 'Producción', path: '/produccion/ordenes', icon: 'production' },
];

export const supportNavigation = [
  { id: 'maestros', label: 'Datos maestros', path: '/datos-maestros', icon: 'catalog' },
  { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: 'settings' },
  { id: 'guia', label: 'Guía SCM', path: '/guia/scm', icon: 'guide' },
];

export const workspaceNavigation = [
  {
    id: 'materiales',
    label: 'Materias primas',
    matches: ['/materiales', '/ordenes/:numeroOp/materiales'],
    tabs: [
      { label: 'Recepciones', path: '/materiales/recepciones', icon: 'receipts' },
      { label: 'Órdenes de compra', path: '/materiales/compras', icon: 'purchases' },
      { label: 'Calidad', path: '/materiales/calidad', icon: 'quality' },
      { label: 'Lotes e inventario', path: '/materiales/inventario', icon: 'inventory' },
      { label: 'Reservas y entregas', path: '/materiales/preparaciones', icon: 'reservations' },
      { label: 'Documentos', path: '/materiales/documentos', icon: 'documents' },
    ],
  },
  {
    id: 'produccion',
    label: 'Producción',
    matches: ['/produccion', '/ordenes', '/registros', '/pesaje'],
    exclude: ['/ordenes/:numeroOp/materiales'],
    tabs: [
      { label: 'Órdenes de producción', path: '/produccion/ordenes', icon: 'orders' },
      { label: 'Registro diario', path: '/produccion/registros', icon: 'records' },
      { label: 'Avance de planta', path: '/produccion/avance', icon: 'progress' },
      { label: 'Histórico de pesajes', path: '/produccion/pesajes', icon: 'weighing' },
      { label: 'Talonarios OT', path: '/produccion/talonarios', icon: 'documents' },
    ],
  },
  {
    id: 'maestros',
    label: 'Datos maestros',
    matches: ['/datos-maestros', '/catalogo'],
    tabs: [
      { label: 'Resumen', path: '/datos-maestros', icon: 'overview', exact: true },
      { label: 'Productos', path: '/datos-maestros/productos', icon: 'products' },
      { label: 'Piezas y SKU', path: '/datos-maestros/piezas', icon: 'pieces' },
      { label: 'Moldes', path: '/datos-maestros/moldes', icon: 'molds' },
      { label: 'Configuración guiada', path: '/datos-maestros/configuracion-guiada', icon: 'wizard' },
      { label: 'Líneas y familias', path: '/datos-maestros/clasificacion', icon: 'catalog' },
      { label: 'Colores y recetas', path: '/datos-maestros/colores', icon: 'catalog' },
      { label: 'Materias primas', path: '/datos-maestros/materiales', icon: 'materials' },
      { label: 'Trabajadores', path: '/datos-maestros/trabajadores', icon: 'workers' },
      { label: 'Máquinas', path: '/datos-maestros/maquinas', icon: 'machines' },
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
