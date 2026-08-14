import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ActorWorkspaceBar from './ActorWorkspaceBar';
import WorkspaceBreadcrumbs from './WorkspaceBreadcrumbs';
import { useScmActor } from '../../context/ScmActorContext';
import { PORTFOLIO_DEMO_ENABLED } from '../../config/runtime';
import PortfolioDemoBar from '../portfolioDemo/PortfolioDemoBar';

function AppShell({ children }) {
  const location = useLocation();
  const { actorId } = useScmActor();
  const mainRef = useRef(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        component="a"
        href="#workspace-main"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 2000,
          px: 1.5,
          py: 1,
          bgcolor: 'background.paper',
          color: 'primary.main',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          transform: 'translateY(-160%)',
          '&:focus': { transform: 'translateY(0)' },
        }}
      >
        Saltar al contenido
      </Box>
      <Sidebar />
      <Box
        component="main"
        id="workspace-main"
        ref={mainRef}
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 1.5, sm: 2, md: 3 },
          pb: 3,
          pt: { xs: 9, md: 2 },
          outline: 'none',
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        {PORTFOLIO_DEMO_ENABLED && <PortfolioDemoBar />}
        <ActorWorkspaceBar />
        <Box key={actorId}>
          <WorkspaceBreadcrumbs location={location} />
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
