import CapabilityRoute from './CapabilityRoute';
import LockedFeaturePage from './LockedFeaturePage';
import { getFeatureByKey } from '../config/workspaceRegistry';

function WorkspacePlaceholderRoute({ featureKey }) {
  const feature = getFeatureByKey(featureKey);

  return (
    <CapabilityRoute any={feature?.requiredAny || []}>
      <LockedFeaturePage feature={feature} />
    </CapabilityRoute>
  );
}

export default WorkspacePlaceholderRoute;
