import OperationNotice from "../ui/OperationNotice";
import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from '@mui/material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useScmActor } from '../../context/ScmActorContext';
import { SCM_AUTH_MODE, SCM_PERSONAL_AGENT_ENABLED, SCM_PROFILE_SWITCH_ENABLED } from '../../config/runtime';
import { useAuth } from '../../context/AuthContext';

const initials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

function AccountTrigger({ mobile, actor, actorId, onClick }) {
  const name = actor?.nombre_completo || `Actor #${actorId}`;
  const shortName = actor?.nombre_corto || name;

  if (mobile) {
    return (
      <IconButton
        color="inherit"
        onClick={onClick}
        aria-label={`Abrir cuenta de trabajo: ${name}`}
        aria-haspopup="menu"
        sx={{ ml: 0.5, p: 0.75, minWidth: 44, minHeight: 44 }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#68B984', color: '#17324D', fontSize: 12, fontWeight: 800 }}>
          {initials(actor?.nombre_corto || actor?.nombre_completo) || <BadgeOutlinedIcon fontSize="small" />}
        </Avatar>
      </IconButton>
    );
  }

  return (
    <Button
      variant="text"
      color="inherit"
      onClick={onClick}
      aria-label={`Abrir cuenta de trabajo: ${name}`}
      aria-haspopup="menu"
      endIcon={<ExpandMoreRoundedIcon fontSize="small" />}
      sx={{
        minHeight: 44,
        px: 0.75,
        py: 0.5,
        borderRadius: 1.5,
        color: 'text.primary',
        justifyContent: 'flex-start',
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main', fontSize: 12, fontWeight: 800 }}>
        {initials(actor?.nombre_corto || actor?.nombre_completo) || <BadgeOutlinedIcon fontSize="small" />}
      </Avatar>
      <Box sx={{ minWidth: 0, maxWidth: { sm: 190, lg: 240 } }}>
        <Typography variant="body2" fontWeight={800} noWrap>{shortName}</Typography>
        {actor?.roles?.[0]?.nombre && actor.roles[0].nombre !== shortName && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {actor.roles[0].nombre}
          </Typography>
        )}
      </Box>
    </Button>
  );
}

export default function ActorWorkspaceBar({ mobile = false }) {
  const { signOut, session } = useAuth();
  const {
    actor, actorId, actors, applyActor, error, experience, loading, refreshActors, can,
  } = useScmActor();
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(actorId);
  const selectedActor = useMemo(
    () => actors.find((item) => Number(item.id) === Number(selectedId)),
    [actors, selectedId],
  );
  const accountName = actor?.nombre_completo || `Actor #${actorId}`;
  const agentAvailable = SCM_PERSONAL_AGENT_ENABLED
    && SCM_AUTH_MODE === 'supabase'
    && Boolean(session?.access_token)
    && !loading
    && !error
    && can('ASISTENTE_PRODUCCION_USAR');

  if (loading && !actor) {
    return mobile
      ? <Skeleton variant="circular" width={36} height={36} sx={{ ml: 1 }} />
      : <Skeleton variant="rounded" width={190} height={44} />;
  }

  const closeMenu = () => setAnchorEl(null);
  const openProfileDialog = async () => {
    closeMenu();
    await refreshActors();
    setSelectedId(actorId);
    setProfileDialogOpen(true);
  };

  return (
    <>
      <Box
        component={mobile ? 'div' : 'section'}
        aria-label="Sesión de trabajo"
        sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
      >
        <AccountTrigger
          mobile={mobile}
          actor={actor}
          actorId={actorId}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        />
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={closeMenu}
          MenuListProps={{ 'aria-label': 'Acciones de cuenta' }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 252, maxWidth: 'min(360px, calc(100vw - 24px))' } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="caption" color="text.secondary">Sesión de trabajo</Typography>
            <Typography variant="body2" fontWeight={800} noWrap>{accountName}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {experience.label} · {experience.focus}
            </Typography>
            {error && (
              <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                {error}
              </Alert>
            )}
          </Box>
          <Divider />
          {SCM_PROFILE_SWITCH_ENABLED && (
            <MenuItem onClick={openProfileDialog}>
              <ListItemIcon><SwapHorizOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Cambiar perfil" />
            </MenuItem>
          )}
          {agentAvailable && (
            <MenuItem component={RouterLink} to="/mi-agente" onClick={closeMenu}>
              <ListItemIcon><ForwardToInboxOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Mi agente" secondary="Consultas de solo lectura" />
            </MenuItem>
          )}
          {SCM_AUTH_MODE === 'supabase' && (
            <MenuItem onClick={() => { closeMenu(); signOut(); }}>
              <ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Cerrar sesión" />
            </MenuItem>
          )}
        </Menu>
      </Box>
      <OperationNotice message={error} severity="warning" />
      {!mobile && error && (
        <Alert severity="warning" sx={{ mt: 0.75, maxWidth: 520 }}>{error}</Alert>
      )}

      <Dialog
        open={SCM_PROFILE_SWITCH_ENABLED && profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>¿Quién está realizando esta tarea?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            En el piloto este selector simula la identidad. En producción vendrá de la sesión iniciada.
          </Typography>
          <List disablePadding>
            {actors.map((item) => (
              <ListItemButton
                key={item.id}
                selected={Number(selectedId) === Number(item.id)}
                onClick={() => setSelectedId(item.id)}
                sx={{ borderRadius: 1.5, mb: 0.75, border: '1px solid', borderColor: 'divider' }}
              >
                <Avatar sx={{ mr: 1.5, width: 36, height: 36 }}>
                  {initials(item.nombre_corto || item.nombre_completo)}
                </Avatar>
                <ListItemText
                  primary={item.nombre_completo}
                  secondary={(item.roles || []).map((role) => role.nombre).join(' · ') || 'Sin rol operativo'}
                  primaryTypographyProps={{ fontWeight: 750 }}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!selectedActor || Number(selectedId) === Number(actorId)}
            onClick={() => {
              applyActor(selectedId);
              setProfileDialogOpen(false);
            }}
          >
            Usar este perfil
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
