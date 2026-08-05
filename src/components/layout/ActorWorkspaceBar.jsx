import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useScmActor } from '../../context/ScmActorContext';
import { SCM_AUTH_MODE, SCM_PROFILE_SWITCH_ENABLED } from '../../config/runtime';
import { useAuth } from '../../context/AuthContext';

const initials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

export default function ActorWorkspaceBar() {
  const { signOut } = useAuth();
  const {
    actor, actorId, actors, applyActor, error, experience, loading, refreshActors,
  } = useScmActor();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(actorId);
  const selectedActor = useMemo(
    () => actors.find((item) => Number(item.id) === Number(selectedId)),
    [actors, selectedId],
  );

  if (loading && !actor) {
    return <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />;
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          mb: 2,
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          borderColor: 'primary.100',
          bgcolor: '#F7FAFD',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={1.25}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: 14 }}>
              {initials(actor?.nombre_corto || actor?.nombre_completo) || <BadgeOutlinedIcon />}
            </Avatar>
            <Box minWidth={0}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">Trabajando como</Typography>
                <Chip label="Operación SCM" size="small" variant="outlined" color="info" />
              </Stack>
              <Typography variant="subtitle2" fontWeight={800} noWrap>
                {actor?.nombre_completo || `Actor #${actorId}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {experience.label} · {experience.focus}
              </Typography>
            </Box>
          </Stack>
          {SCM_PROFILE_SWITCH_ENABLED && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<SwapHorizOutlinedIcon />}
              onClick={async () => {
                await refreshActors();
                setSelectedId(actorId);
                setOpen(true);
              }}
            >
              Cambiar perfil
            </Button>
          )}
          {SCM_AUTH_MODE === 'supabase' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutOutlinedIcon />}
              onClick={signOut}
            >
              Cerrar sesión
            </Button>
          )}
        </Stack>
        {error && <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert>}
      </Paper>

      <Dialog
        open={SCM_PROFILE_SWITCH_ENABLED && open}
        onClose={() => setOpen(false)}
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
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!selectedActor || Number(selectedId) === Number(actorId)}
            onClick={() => {
              applyActor(selectedId);
              setOpen(false);
            }}
          >
            Usar este perfil
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
