import {
  Alert, Box, Button, Chip, Grid, List, ListItem, ListItemButton, ListItemText,
  Paper, Stack, Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useActorWorkspace, useScmActor } from '../context/ScmActorContext';
import Dashboard from './Dashboard';
import PageHeader from './ui/PageHeader';

function FeatureCard({ feature, primary = false }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        bgcolor: primary ? '#F7FAFD' : 'background.paper',
        borderColor: primary ? 'primary.200' : 'divider',
      }}
    >
      <Stack spacing={0.75} height="100%">
        <Stack direction="row" alignItems="center" spacing={0.75}>
          {feature.pinned && <PushPinOutlinedIcon color="primary" fontSize="small" />}
          <Typography fontWeight={800}>{feature.label}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {feature.description}
        </Typography>
        <Box>
          <Button
            component={RouterLink}
            to={feature.path}
            size="small"
            endIcon={<ArrowForwardOutlinedIcon />}
            aria-label={`Abrir ${feature.label}`}
            sx={{ px: 0 }}
          >
            Abrir
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function RoleHome() {
  const { actor, can } = useScmActor();
  const workspace = useActorWorkspace();
  const {
    configurationWarnings = [],
    experience,
    homeFeatures = [],
    startFeature,
  } = workspace;
  const pinnedFeatures = homeFeatures.filter(
    (item) => item.pinned && item.key !== startFeature?.key,
  );
  const groupedFeatures = (() => {
    const groups = new Map();
    homeFeatures
      .filter((item) => item.key !== startFeature?.key && !item.pinned)
      .forEach((item) => {
        const key = item.areaKey || 'other';
        if (!groups.has(key)) groups.set(key, { key, label: item.areaLabel || 'Otras funciones', items: [] });
        groups.get(key).items.push(item);
      });
    return [...groups.values()];
  })();
  const showPlantOverview = can('WIP_VER') || can('OP_VER');
  const hasAdditionalFeatures = pinnedFeatures.length > 0 || groupedFeatures.length > 0;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title={`Hola, ${actor?.nombre_corto || actor?.nombres || 'equipo'}`}
        description={experience.focus}
      />

      {configurationWarnings.map((item) => (
        <Alert key={`${item.code}-${item.featureKey || ''}`} severity={item.severity || 'info'}>
          {item.message}
        </Alert>
      ))}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" fontWeight={850}>{experience.label}</Typography>
            <Chip size="small" label="Workspace personal" color="primary" variant="outlined" />
          </Stack>

          {startFeature ? (
            <Box component="section" aria-labelledby="primary-access-title">
              <Typography id="primary-access-title" variant="subtitle1" component="h2" fontWeight={850} sx={{ mb: 1 }}>
                Tu acceso principal
              </Typography>
              <Grid container>
                <Grid size={{ xs: 12, md: 8, lg: 6 }}>
                  <FeatureCard feature={startFeature} primary />
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Alert severity="info">
              No hay accesos de trabajo adicionales para esta configuración.
            </Alert>
          )}

          {pinnedFeatures.length > 0 && (
            <Box component="section" aria-labelledby="pinned-access-title">
              <Typography id="pinned-access-title" variant="subtitle1" component="h2" fontWeight={850} sx={{ mb: 1 }}>
                Accesos prioritarios
              </Typography>
              <Grid container spacing={1.5}>
                {pinnedFeatures.map((item) => (
                  <Grid key={item.key} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <FeatureCard feature={item} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {groupedFeatures.length > 0 && (
            <Box component="section" aria-labelledby="more-features-title">
              <Typography id="more-features-title" variant="subtitle1" component="h2" fontWeight={850} sx={{ mb: 1 }}>
                Más funciones
              </Typography>
              <Stack spacing={2}>
                {groupedFeatures.map((group) => (
                  <Box key={group.key}>
                    <Typography component="h3" variant="body2" color="text.secondary" fontWeight={800} sx={{ mb: 1 }}>
                      {group.label}
                    </Typography>
                    <List
                      dense
                      disablePadding
                      aria-label={`Funciones de ${group.label}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1,
                      }}
                    >
                      {group.items.map((item) => (
                        <ListItem key={item.key} disablePadding>
                          <ListItemButton
                            component={RouterLink}
                            to={item.path}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                          >
                            <ListItemText
                              primary={item.label}
                              secondary={item.description}
                              primaryTypographyProps={{ fontWeight: 750 }}
                              secondaryTypographyProps={{ noWrap: true }}
                            />
                            <ArrowForwardOutlinedIcon color="action" fontSize="small" />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {!startFeature && !hasAdditionalFeatures && (
            <Typography variant="body2" color="text.secondary">
              Usa el menú para consultar la información disponible para tu perfil.
            </Typography>
          )}
        </Stack>
      </Paper>

      {showPlantOverview && (
        <Box>
          <Typography variant="h6" component="h2" fontWeight={850} sx={{ mb: 1.5 }}>
            Situación de planta
          </Typography>
          <Dashboard compact />
        </Box>
      )}
    </Stack>
  );
}
