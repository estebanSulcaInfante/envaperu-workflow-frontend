import CapabilityRoute from './CapabilityRoute';
import FeatureAvailabilityRoute from './FeatureAvailabilityRoute';
import WorkspacePlaceholderRoute from './WorkspacePlaceholderRoute';
import { featureIsPlaceholder, getFeatureByKey } from '../config/workspaceRegistry';

function WorkspaceFeatureRoute({
  featureKey,
  runtimeFlags,
  children,
}) {
  const feature = getFeatureByKey(featureKey);

  if (featureIsPlaceholder(feature)) {
    return <WorkspacePlaceholderRoute featureKey={featureKey} />;
  }

  return (
    <FeatureAvailabilityRoute featureKey={featureKey} runtimeFlags={runtimeFlags}>
      <CapabilityRoute any={feature?.requiredAny || []}>
        {children}
      </CapabilityRoute>
    </FeatureAvailabilityRoute>
  );
}

export default WorkspaceFeatureRoute;
