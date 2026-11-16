import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function QualityStationBreadcrumbs({ trail = [['Control de Calidad']], beforeNavigate }) {
  return (
    <Breadcrumbs aria-label="Ubicación" sx={{ minHeight: 44, display: 'flex', alignItems: 'center', overflowWrap: 'anywhere', '& li': { maxWidth: '100%' } }}>
        {trail.map(([name, to], index) => index === trail.length - 1
          ? <Typography key={index} aria-current="page" fontWeight={650}>{name}</Typography>
          : <Link key={index} component={RouterLink} to={to} underline="hover" onClick={event => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && beforeNavigate?.() === false) event.preventDefault();
          }} sx={{ display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>{name}</Link>)}
      </Breadcrumbs>
  );
}
