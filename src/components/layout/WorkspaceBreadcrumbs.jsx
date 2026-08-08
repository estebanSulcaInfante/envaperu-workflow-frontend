import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getWorkspaceFeature } from '../../config/workspaceRegistry';
import { useActorWorkspace } from '../../context/ScmActorContext';

function WorkspaceBreadcrumbs({ location }) {
  const workspace = useActorWorkspace();
  const value = `${location.pathname}${location.search || ''}`;
  const registeredFeature = getWorkspaceFeature(value);
  const feature = workspace.features.find((item) => item.key === registeredFeature?.key) || null;
  const area = workspace.areas.find((item) => item.key === feature?.areaKey) || null;

  if (!area || area.key === 'home') return null;

  const areaHasSections = area.childMode !== 'hub' && area.features?.length > 1;

  return (
    <Breadcrumbs aria-label="Ubicación" sx={{ mb: 1 }}>
      {areaHasSections ? (
        <Typography color="text.secondary">{area.label}</Typography>
      ) : (
        <Link component={RouterLink} to={area.path} underline="hover" color="inherit">
          {area.label}
        </Link>
      )}
      {feature && feature.label !== area.label && (
        <Typography color="text.primary" sx={{ fontWeight: 650 }}>
          {feature.label}
        </Typography>
      )}
    </Breadcrumbs>
  );
}

export default WorkspaceBreadcrumbs;
