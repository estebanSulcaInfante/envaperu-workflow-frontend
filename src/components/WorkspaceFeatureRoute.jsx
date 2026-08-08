import CapabilityRoute from './CapabilityRoute';
import FeatureAvailabilityRoute from './FeatureAvailabilityRoute';
import { getFeatureByKey } from '../config/workspaceRegistry';

function WorkspaceFeatureRoute({
  featureKey,
  runtimeFlags,
  children,
}) {
  const feature = getFeatureByKey(featureKey);

  return (
    <FeatureAvailabilityRoute featureKey={featureKey} runtimeFlags={runtimeFlags}>
      <CapabilityRoute any={feature?.requiredAny || []}>
        {children}
      </CapabilityRoute>
    </FeatureAvailabilityRoute>
  );
}

export default WorkspaceFeatureRoute;
