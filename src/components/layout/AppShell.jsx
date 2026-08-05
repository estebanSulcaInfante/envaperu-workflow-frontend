import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ModuleTabs from '../ui/ModuleTabs';
import ActorWorkspaceBar from './ActorWorkspaceBar';
import { useScmActor } from '../../context/ScmActorContext';
import {
  getWorkspaceNavigation,
  workspaceTabIsActive,
} from '../../config/navigation';

function AppShell({ children }) {
  const location = useLocation();
  const { actorId } = useScmActor();
  const workspace = getWorkspaceNavigation(location.pathname);

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
          {workspace && (
            <ModuleTabs
              workspace={workspace}
              pathname={location.pathname}
              isActive={workspaceTabIsActive}
            />
          )}
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
