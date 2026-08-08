import { Navigate } from 'react-router-dom';
import CapabilityRoute from './CapabilityRoute';
import { useActorWorkspace } from '../context/ScmActorContext';

function AccessibleAreaTarget({ areaKey }) {
  const workspace = useActorWorkspace();
  const area = workspace.areas.find((item) => item.key === areaKey);
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
