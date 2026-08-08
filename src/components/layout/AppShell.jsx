import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ActorWorkspaceBar from './ActorWorkspaceBar';
import WorkspaceBreadcrumbs from './WorkspaceBreadcrumbs';
import { useScmActor } from '../../context/ScmActorContext';

function AppShell({ children }) {
  const location = useLocation();
  const { actorId } = useScmActor();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 1.5, sm: 2, md: 3 },
          pb: 3,
          pt: { xs: 9, md: 3 },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
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
