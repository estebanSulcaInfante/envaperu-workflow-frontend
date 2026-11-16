import {
  buildAreaNavigation,
  defaultWorkspaceRuntimeFlags,
  featureIsAvailable,
  featureMatches,
  getWorkspaceArea,
  getWorkspaceFeature,
  workspaceAreas,
  workspaceFeatures,
} from './workspaceRegistry';

const areaRequiredAny = (areaKey) => [...new Set(
  workspaceFeatures
    .filter((item) => item.areaKey === areaKey && featureIsAvailable(item))
    .flatMap((item) => item.requiredAny || []),
)];

const areaRequiredAll = (areaKey) => {
  const requirements = workspaceFeatures
    .filter((item) => item.areaKey === areaKey && featureIsAvailable(item))
    .map((item) => item.requiredAll || []);
  if (!requirements.length) return [];
  return requirements.slice(1).reduce(
    (common, current) => common.filter((capability) => current.includes(capability)),
    [...requirements[0]],
  );
};

const areaRequiredCapabilityGroups = (areaKey) => [...new Map(
  workspaceFeatures
    .filter((item) => item.areaKey === areaKey && featureIsAvailable(item))
    .flatMap((item) => item.requiredCapabilityGroups || [])
    .map((group) => [group.join('|'), group]),
).values()];

const areaToNavigationItem = (area) => ({
  id: area.key,
  key: area.key,
  label: area.label,
  path: area.path,
  icon: area.icon,
  exact: area.exact,
  support: area.support,
  requiredAny: areaRequiredAny(area.key),
  requiredAll: areaRequiredAll(area.key),
  requiredCapabilityGroups: areaRequiredCapabilityGroups(area.key),
});

export const primaryNavigation = workspaceAreas
  .filter((area) => !area.support)
  .map(areaToNavigationItem);

export const supportNavigation = workspaceAreas
  .filter((area) => area.support)
  .map(areaToNavigationItem);

export const workspaceNavigation = workspaceAreas.map((area) => ({
  ...areaToNavigationItem(area),
  tabs: workspaceFeatures
    .filter((item) => item.areaKey === area.key && featureIsAvailable(item))
    .map((item) => ({
      ...item,
      id: item.key,
      requiredAny: item.requiredAny || [],
    })),
}));

export const navigationItemIsActive = (value, item) => {
  const area = getWorkspaceArea(value);
  return area?.key === (item.key || item.id);
};

export const getWorkspaceNavigation = (value) => {
  const area = getWorkspaceArea(value);
  return workspaceNavigation.find((item) => item.id === area?.key) || null;
};

export const workspaceTabIsActive = (value, tab) => (
  getWorkspaceFeature(value)?.key === (tab.key || tab.id)
  || featureMatches(value, tab)
);

export const visibleByCapabilities = (
  items,
  canAny,
  canAll = (required = []) => !canAny || required.every((capability) => canAny([capability])),
  runtimeFlags = defaultWorkspaceRuntimeFlags,
) => items.filter((item) => (
  featureIsAvailable(item, runtimeFlags)
  && canAny(item.requiredAny || [])
  && canAll(item.requiredAll || [])
  && (!item.requiredCapabilityGroups?.length || item.requiredCapabilityGroups.some((group) => canAll(group)))
));

export const buildVisibleWorkspaceNavigation = ({ canAny, canAll, runtimeFlags } = {}) => (
  buildAreaNavigation({ canAny, canAll, runtimeFlags })
);
