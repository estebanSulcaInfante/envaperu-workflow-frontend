import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getWorkspaceArea, getWorkspaceFeature } from '../../config/workspaceRegistry';

function WorkspaceBreadcrumbs({ location }) {
  const value = `${location.pathname}${location.search || ''}`;
  const area = getWorkspaceArea(value);
  const feature = getWorkspaceFeature(value);

  if (!area || area.key === 'home') return null;

  return (
    <Breadcrumbs aria-label="Ubicación" sx={{ mb: 1.5 }}>
      <Link component={RouterLink} to={area.path} underline="hover" color="inherit">
        {area.label}
      </Link>
      {feature && feature.label !== area.label && (
        <Typography color="text.primary" sx={{ fontWeight: 650 }}>
          {feature.label}
        </Typography>
      )}
    </Breadcrumbs>
  );
}

export default WorkspaceBreadcrumbs;
