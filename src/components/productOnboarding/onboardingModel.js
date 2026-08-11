export const ONBOARDING_STEPS = [
  {
    code: 'IDENTIDAD',
    slug: 'identidad',
    shortLabel: 'Identidad',
    label: 'Identidad y fuente',
    description: 'Producto Terminado, clasificaci\u00f3n y procedencia.',
  },
  {
    code: 'COMPONENTES',
    slug: 'componentes',
    shortLabel: 'Componentes',
    label: 'Componentes y moldes',
    description: 'Piezas, moldes y salidas productivas.',
  },
  {
    code: 'COLORES',
    slug: 'colores',
    shortLabel: 'Colores',
    label: 'Colores, recetas y SKU',
    description: 'Variantes producibles y formulaciones.',
  },
  {
    code: 'ESTRUCTURA',
    slug: 'estructura',
    shortLabel: 'BOM / WIP',
    label: 'BOM y WIP',
    description: 'Estructura multinivel y consumos.',
  },
  {
    code: 'RUTA_EMPAQUE',
    slug: 'ruta-empaque',
    shortLabel: 'Ruta / Empaque',
    label: 'Ruta y empaque',
    description: 'Operaciones, recursos y unidad empacable.',
  },
  {
    code: 'REVISION',
    slug: 'revision',
    shortLabel: 'Revisi\u00f3n',
    label: 'Revisi\u00f3n',
    description: 'Consistencia, pendientes y publicaci\u00f3n.',
  },
];

export const stepByCode = (code) => ONBOARDING_STEPS.find((step) => step.code === code);
export const stepBySlug = (slug) => ONBOARDING_STEPS.find((step) => step.slug === slug);

export const prerequisiteBlocker = (session, stepCode) => {
  const targetIndex = ONBOARDING_STEPS.findIndex((step) => step.code === stepCode);
  if (targetIndex <= 0) return null;
  const states = new Map((session?.pasos || []).map((step) => [step.codigo, step.estado]));
  const records = new Map((session?.pasos || []).map((step) => [step.codigo, step]));
  const references = session?.referencias || {};
  const isAuthoritativelyComplete = (step) => {
    const record = records.get(step.code);
    if (record?.estado !== 'COMPLETADO') return false;
    if (step.code === 'REVISION') return true;
    const applicationStatus = record?.application_status?.status;
    const refs = references[step.code]
      || (step.code === 'IDENTIDAD' && references.producto_terminado_id ? references : {});
    return ['APPLIED', 'REPLAYED'].includes(applicationStatus)
      && Object.keys(refs || {}).length > 0;
  };
  const missing = ONBOARDING_STEPS
    .slice(0, targetIndex)
    .find((step) => states.get(step.code) !== 'COMPLETADO' || !isAuthoritativelyComplete(step));
  return missing ? {
    code: missing.code,
    label: missing.label,
    message: `Completa primero ${missing.label} antes de aplicar esta fase. Puedes inspeccionarla y guardar notas mientras tanto.`,
  } : null;
};

export const statusLabel = (status) => ({
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completo',
  INVALIDADO: 'Revisar de nuevo',
}[status] || 'Pendiente');

export const statusColor = (status) => ({
  COMPLETADO: 'success',
  EN_PROGRESO: 'primary',
  INVALIDADO: 'warning',
}[status] || 'default');

export const emptyIdentityData = {
  modo: 'NUEVO',
  producto_ref: null,
  producto_fuente_ref: null,
  producto: {
    cod_sku_pt: '',
    producto: '',
    linea_id: '',
    familia_id: '',
    peso_g: '',
    marca: '',
  },
  procedencia: {
    tipo: 'EXCEL',
    referencia: '',
    hoja: '',
    fila: '',
    notas: '',
  },
};

export const normalizeIdentityData = (data = {}) => ({
  ...emptyIdentityData,
  ...data,
  producto: { ...emptyIdentityData.producto, ...(data.producto || {}) },
  procedencia: { ...emptyIdentityData.procedencia, ...(data.procedencia || {}) },
});

const normalizeText = (value) => String(value || '').trim().toLocaleUpperCase('es-PE');

export const findExactProductDuplicate = (identity, products = []) => {
  if (identity.modo === 'SELECCIONAR') return null;
  const name = normalizeText(identity.producto?.producto);
  if (!name) return null;
  return products.find((product) => (
    normalizeText(product.producto || product.nombre) === name
    && String(product.cod_sku_pt || product.sku || '')
      !== String(identity.producto_ref?.cod_sku_pt || '')
  )) || null;
};

export const validateIdentity = (identity, products = []) => {
  const errors = {};
  if (identity.modo === 'SELECCIONAR' && !identity.producto_ref?.cod_sku_pt) {
    errors.producto_ref = 'Selecciona un producto existente.';
  }
  if (!String(identity.producto?.producto || '').trim()) {
    errors.producto = 'El nombre es obligatorio.';
  }
  if (!identity.producto?.linea_id) errors.linea_id = 'Selecciona una L\u00ednea.';
  if (!identity.producto?.familia_id) errors.familia_id = 'Selecciona una Familia.';
  if (!String(identity.procedencia?.referencia || '').trim()) {
    errors.referencia = 'Indica de d\u00f3nde proviene este dato.';
  }
  const duplicate = findExactProductDuplicate(identity, products);
  if (duplicate) errors.duplicate = duplicate;
  return errors;
};

export const identityIsComplete = (identity, products = []) => (
  Object.keys(validateIdentity(identity, products)).length === 0
);
