import { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import ActorWorkspaceBar from './ActorWorkspaceBar';
import WorkspaceBreadcrumbs from './WorkspaceBreadcrumbs';
import { useScmActor } from '../../context/ScmActorContext';
import { SCM_ASSISTANT_V2_ENABLED } from '../../config/runtime';
import AssistantV2Orb from '../assistantV2/AssistantV2Orb';

function AppShell({ children }) {
  const location = useLocation();
  const { actorId, actor, can, error, loading } = useScmActor();
  const mainRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  const showAssistantV2 = useMemo(() => {
    if (!SCM_ASSISTANT_V2_ENABLED || loading || error || !actor || fullscreen) return false;
    if (location.pathname.replace(/\/+$/, '') === '/control/avance-of-tv') return false;
    return can('ASISTENTE_PRODUCCION_USAR')
      && can('OT_VER')
      && can('MANGA_PESAJE_VER');
  }, [actor, can, error, fullscreen, loading, location.pathname]);
  const canReviewAssistant = useMemo(() => can('AUTORIZACION_SCM_ADMINISTRAR'), [can]);

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
        <ActorWorkspaceBar />
        <Box key={actorId}>
          <WorkspaceBreadcrumbs location={location} />
          {children}
        </Box>
      </Box>
      {showAssistantV2 && <AssistantV2Orb actorId={actorId} canReview={canReviewAssistant} />}
    </Box>
  );
}

export default AppShell;
