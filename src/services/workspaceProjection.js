import {
  defaultWorkspaceRuntimeFlags,
  featureIsDiscoverable,
  featureIsExecutable,
  featureIsPlaceholder,
  workspaceAreas,
  workspaceFeatures,
} from '../config/workspaceRegistry';

export const WORKSPACE_WARNING = Object.freeze({
  PRIMARY_ROLE_MISSING: 'PRIMARY_ROLE_MISSING',
  START_FEATURE_UNKNOWN: 'START_FEATURE_UNKNOWN',
  START_FEATURE_INELIGIBLE: 'START_FEATURE_INELIGIBLE',
  PREFERENCE_UNKNOWN: 'PREFERENCE_UNKNOWN',
  PREFERENCE_INELIGIBLE: 'PREFERENCE_INELIGIBLE',
});

export const GENERIC_WORKSPACE_EXPERIENCE = Object.freeze({
  label: 'Perfil operativo',
  focus: 'Consulta las funciones disponibles para tu perfil.',
});

export const WORKSPACE_FEATURE_KEY_ALIASES = Object.freeze({
  'warehouse.reservationInbox': 'materials.internalSupply',
});

export const normalizeWorkspaceFeatureKey = (featureKey) => (
  WORKSPACE_FEATURE_KEY_ALIASES[featureKey] || featureKey
);

export const isWorkspacePlaceholder = featureIsPlaceholder;

const normalizePreference = (item = {}) => ({
  featureKey: normalizeWorkspaceFeatureKey(item.feature_key || item.featureKey || ''),
  priority: Number.isFinite(Number(item.prioridad ?? item.priority))
    ? Number(item.prioridad ?? item.priority)
    : null,
  pinned: Boolean(item.fijada ?? item.pinned),
});

const featureComparator = (left, right) => (
  Number(right.pinned) - Number(left.pinned)
  || (left.preferencePriority ?? Number.POSITIVE_INFINITY)
    - (right.preferencePriority ?? Number.POSITIVE_INFINITY)
  || (left.defaultPriority ?? 100) - (right.defaultPriority ?? 100)
  || String(left.label || '').localeCompare(String(right.label || ''), 'es')
);

const projectedFeatureComparator = (left, right) => (
  (left.sectionPriority ?? Number.POSITIVE_INFINITY)
    - (right.sectionPriority ?? Number.POSITIVE_INFINITY)
  || featureComparator(left, right)
);

const warning = (code, message, featureKey = null, severity = 'info') => ({
  code,
  message,
  featureKey,
  severity,
});

const uniqueWarnings = (items) => [...new Map(
  items.map((item) => [`${item.code}:${item.featureKey || ''}`, item]),
).values()];

const featureNotExecutableMessage = (feature, placeholderFallback, standardFallback) => (
  featureIsPlaceholder(feature)
    ? `La función «${feature.label}» está fuera del piloto y no es ejecutable; ${placeholderFallback}.`
    : standardFallback
);

export function buildActorWorkspace({
  registry = workspaceFeatures,
  areas = workspaceAreas,
  actor,
  runtimeFlags = defaultWorkspaceRuntimeFlags,
} = {}) {
  const capabilities = new Set(actor?.capacidades_efectivas || []);
  const registryByKey = new Map(registry.map((item) => [item.key, item]));
  const primaryRole = actor?.rol_principal && actor.rol_principal.activo !== false
    ? actor.rol_principal
    : null;
  const preferences = (primaryRole?.workspace_preferencias || [])
    .map(normalizePreference)
    .filter((item) => item.featureKey);
  const preferencesByKey = new Map(preferences.map((item) => [item.featureKey, item]));
  const warnings = [];

  if (!primaryRole) {
    warnings.push(warning(
      WORKSPACE_WARNING.PRIMARY_ROLE_MISSING,
      'Tu perfil principal aún no está definido. Los accesos disponibles siguen protegidos por tus capacidades efectivas.',
    ));
  }

  const isEligible = (item) => (
    featureIsDiscoverable(item, runtimeFlags)
    && (!(item.requiredAny || []).length
      || (item.requiredAny || []).some((code) => capabilities.has(code)))
  );

  const eligibleByKey = new Map();
  registry.forEach((item) => {
    if (!isEligible(item)) return;
    const preference = preferencesByKey.get(item.key);
    eligibleByKey.set(item.key, {
      ...item,
      // Placeholders are discoverable in their area, but never become a
      // shortcut, homepage task or role-pinned command.
      pinned: isWorkspacePlaceholder(item) ? false : (preference?.pinned || false),
      preferencePriority: isWorkspacePlaceholder(item) ? null : (preference?.priority ?? null),
      areaLabel: areas.find((area) => area.key === item.areaKey)?.label || item.areaKey,
    });
  });

  preferences.forEach((preference) => {
    const registered = registryByKey.get(preference.featureKey);
    if (!registered) {
      warnings.push(warning(
        WORKSPACE_WARNING.PREFERENCE_UNKNOWN,
        `La función configurada «${preference.featureKey}» ya no existe y fue ignorada.`,
        preference.featureKey,
      ));
      return;
    }
    if (!eligibleByKey.has(preference.featureKey) || registered.navigation === false
      || !featureIsExecutable(registered, runtimeFlags)) {
      warnings.push(warning(
        WORKSPACE_WARNING.PREFERENCE_INELIGIBLE,
        featureNotExecutableMessage(
          registered,
          'se ignoró la preferencia',
          `La función configurada «${registered.label}» no está disponible con las capacidades actuales`,
        ),
        preference.featureKey,
      ));
    }
  });

  const projectedAreas = areas
    .map((area) => {
      const areaFeatures = [...eligibleByKey.values()]
        .filter((item) => item.areaKey === area.key && item.navigation !== false)
        .sort(projectedFeatureComparator);
      if (!areaFeatures.length) return null;
      return {
        ...area,
        // Un area con hub conserva su portada organizadora. Las preferencias
        // ordenan sus funciones, pero no deben convertir el acceso general en
        // un enlace directo a un catalogo arbitrario.
        path: area.childMode === 'hub' ? area.path : areaFeatures[0].path,
        features: areaFeatures,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);

  const areaOrder = new Map(areas.map((area) => [area.key, area.order]));
  const features = [...eligibleByKey.values()].sort((left, right) => (
    (areaOrder.get(left.areaKey) ?? 999) - (areaOrder.get(right.areaKey) ?? 999)
    || featureComparator(left, right)
  ));
  const homeFeatures = features
    .filter((item) => item.task === true && item.key !== 'home.workspace'
      && item.navigation !== false && featureIsExecutable(item, runtimeFlags))
    .sort(featureComparator);

  const requestedStartKey = normalizeWorkspaceFeatureKey(primaryRole?.workspace_start_feature || '');
  let startFeature = null;
  if (requestedStartKey) {
    const registered = registryByKey.get(requestedStartKey);
    if (!registered) {
      warnings.push(warning(
        WORKSPACE_WARNING.START_FEATURE_UNKNOWN,
        `El acceso principal configurado «${requestedStartKey}» ya no existe; se aplicó un acceso seguro.`,
        requestedStartKey,
      ));
    } else if (!eligibleByKey.has(requestedStartKey) || registered.navigation === false
      || requestedStartKey === 'home.workspace' || !featureIsExecutable(registered, runtimeFlags)) {
      warnings.push(warning(
        WORKSPACE_WARNING.START_FEATURE_INELIGIBLE,
        featureNotExecutableMessage(
          registered,
          'se aplicó un acceso seguro',
          `El acceso principal «${registered.label}» no está disponible con las capacidades actuales; se aplicó un acceso seguro`,
        ),
        requestedStartKey,
      ));
    } else {
      startFeature = eligibleByKey.get(requestedStartKey);
    }
  }

  if (!startFeature) {
    startFeature = homeFeatures[0]
      || features.find((item) => item.navigation !== false
        && item.key !== 'home.workspace' && featureIsExecutable(item, runtimeFlags))
      || eligibleByKey.get('guide.scm')
      || null;
  }

  return {
    primaryRole,
    experience: primaryRole ? {
      label: primaryRole.nombre || primaryRole.codigo || GENERIC_WORKSPACE_EXPERIENCE.label,
      focus: primaryRole.workspace_focus || GENERIC_WORKSPACE_EXPERIENCE.focus,
    } : { ...GENERIC_WORKSPACE_EXPERIENCE },
    areas: projectedAreas,
    features,
    homeFeatures,
    startFeature,
    configurationWarnings: uniqueWarnings(warnings),
  };
}

export default buildActorWorkspace;
