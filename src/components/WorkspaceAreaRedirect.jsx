import { Navigate } from 'react-router-dom';
import CapabilityRoute from './CapabilityRoute';
import { buildAreaNavigation } from '../config/workspaceRegistry';
import { useScmActor } from '../context/ScmActorContext';

function AccessibleAreaTarget({ areaKey }) {
  const { canAny } = useScmActor();
  const area = buildAreaNavigation({ canAny }).find((item) => item.key === areaKey);
  return <Navigate to={area?.path || '/'} replace />;
}

function WorkspaceAreaRedirect({ areaKey }) {
  return (
    <CapabilityRoute>
      <AccessibleAreaTarget areaKey={areaKey} />
    </CapabilityRoute>
  );
}

export default WorkspaceAreaRedirect;
