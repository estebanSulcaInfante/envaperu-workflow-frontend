import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  buildAreaNavigation,
  getWorkspaceArea,
  getWorkspaceFeature,
} from '../../config/workspaceRegistry';
import { useScmActor } from '../../context/ScmActorContext';

function WorkspaceBreadcrumbs({ location }) {
  const { canAny } = useScmActor();
  const value = `${location.pathname}${location.search || ''}`;
  const registeredArea = getWorkspaceArea(value);
  const feature = getWorkspaceFeature(value);
  const area = buildAreaNavigation({ canAny })
    .find((item) => item.key === registeredArea?.key) || registeredArea;

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
