import { useMemo } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import {
  scmGlossary,
  scmGuideLegend,
  scmGuideStages,
  scmManagementChecks,
} from '../data/scmGuide';

const stageIcons = {
  guide: MenuBookOutlinedIcon,
  catalog: CategoryOutlinedIcon,
  planning: EventNoteOutlinedIcon,
  receiving: MoveToInboxOutlinedIcon,
  materials: Inventory2OutlinedIcon,
  production: FactoryOutlinedIcon,
  weighing: ScaleOutlinedIcon,
  shipping: LocalShippingOutlinedIcon,
};

const legendIcons = {
  mock: ScienceOutlinedIcon,
  lock: LockOutlinedIcon,
  status: TaskAltOutlinedIcon,
  event: RouteOutlinedIcon,
};

function StageIcon({ stage, fontSize = 'medium' }) {
  const Icon = stageIcons[stage.icon] || MenuBookOutlinedIcon;
  return <Icon fontSize={fontSize} />;
}

function Metric({ label, value, accent }) {
  return (
    <Box sx={{ minHeight: 68, borderLeft: `3px solid ${accent}`, pl: 1.5, py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontWeight: 800, color: '#172B3A' }}>{value}</Typography>
    </Box>
  );
}

function Legend() {
  return (
    <Grid container spacing={0} sx={{ borderTop: '1px solid #E0E4E8', borderBottom: '1px solid #E0E4E8' }}>
      {scmGuideLegend.map((item, index) => {
        const Icon = legendIcons[item.icon];
        return (
          <Grid
            key={item.label}
            size={{ xs: 12, sm: 6, lg: 3 }}
            sx={{
              p: 1.5,
              borderRight: { lg: index < scmGuideLegend.length - 1 ? '1px solid #E0E4E8' : 0 },
              borderBottom: { xs: index < scmGuideLegend.length - 1 ? '1px solid #E0E4E8' : 0, lg: 0 },
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ color: '#1E3A5F', mt: 0.25 }}><Icon fontSize="small" /></Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {item.description}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        );
      })}
    </Grid>
  );
}

function FlowNode({ label, detail, color = '#1E3A5F' }) {
  return (
    <Box sx={{ borderTop: `3px solid ${color}`, bgcolor: '#FFFFFF', px: 1.5, py: 1.25, minHeight: 72 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Box>
  );
}

function FlowMap() {
  return (
    <Box sx={{ bgcolor: '#EEF2F5', p: { xs: 1.5, md: 2 }, mb: 2.5 }}>
      <Typography variant="overline" sx={{ color: '#43515C', fontWeight: 800 }}>Mapa del recorrido</Typography>
      <Box sx={{ mt: 1, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 36px 1.4fr 36px 1fr 36px 1fr' }, alignItems: 'center' }}>
        <FlowNode label="Datos maestros" detail="Identidades y BOM" />
        <ArrowForwardOutlinedIcon sx={{ display: { xs: 'none', md: 'block' }, color: '#71808B', mx: 'auto' }} />
        <Box>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, sm: 6 }}><FlowNode label="Planificación" detail="OP liberada" color="#6B4F83" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><FlowNode label="Recepción" detail="Lotes disponibles" color="#176B52" /></Grid>
          </Grid>
          <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mt: 0.75, color: '#52616C' }}>
            <MergeTypeOutlinedIcon fontSize="small" />
            <Typography variant="caption">Entradas independientes</Typography>
          </Stack>
        </Box>
        <ArrowForwardOutlinedIcon sx={{ display: { xs: 'none', md: 'block' }, color: '#71808B', mx: 'auto' }} />
        <FlowNode label="Preparación" detail="Reserva, emisión y premezcla" color="#9A6A13" />
        <ArrowForwardOutlinedIcon sx={{ display: { xs: 'none', md: 'block' }, color: '#71808B', mx: 'auto' }} />
        <FlowNode label="Producción a despacho" detail="Salida física y genealogía" color="#9A3B26" />
      </Box>
    </Box>
  );
}

function DesktopNavigation({ selectedIndex, onSelect }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, position: 'sticky', top: 24, overflow: 'hidden' }}>
      <Box sx={{ px: 1.75, py: 1.5, bgcolor: '#EEF2F5', borderBottom: '1px solid #D9E0E5' }}>
        <Typography variant="overline" sx={{ fontWeight: 800, color: '#43515C' }}>Recorrido completo</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>20 a 25 minutos</Typography>
      </Box>
      <List disablePadding aria-label="Etapas de la guía SCM">
        {scmGuideStages.map((stage, index) => (
          <ListItemButton
            key={stage.id}
            selected={selectedIndex === index}
            onClick={() => onSelect(index)}
            data-testid={`guide-stage-${stage.id}`}
            sx={{
              minHeight: 58,
              borderLeft: selectedIndex === index ? '3px solid #1E3A5F' : '3px solid transparent',
              borderBottom: index < scmGuideStages.length - 1 ? '1px solid #EDF0F2' : 0,
              '&.Mui-selected': { bgcolor: '#E8EEF3' },
              '&.Mui-selected:hover': { bgcolor: '#E1E9EF' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: selectedIndex === index ? '#1E3A5F' : '#6B7780' }}>
              <StageIcon stage={stage} fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={`${index + 1}. ${stage.shortLabel}`}
              secondary={stage.maturity.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: selectedIndex === index ? 800 : 600 }}
              secondaryTypographyProps={{ fontSize: 11 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}

function MobileNavigation({ selectedIndex, onSelect }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, mb: 2 }}>
      <Tabs
        value={selectedIndex}
        onChange={(_, value) => onSelect(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Etapas de la guía SCM"
      >
        {scmGuideStages.map((stage, index) => (
          <Tab
            key={stage.id}
            data-testid={`guide-stage-${stage.id}`}
            icon={<StageIcon stage={stage} fontSize="small" />}
            iconPosition="start"
            label={`${index + 1}. ${stage.shortLabel}`}
            sx={{ minHeight: 52, letterSpacing: 0 }}
          />
        ))}
      </Tabs>
    </Paper>
  );
}

function Anatomy({ items }) {
  return (
    <Grid container columnSpacing={3}>
      {items.map((item, index) => (
        <Grid key={item.title} size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: 1.25, py: 1.5, borderTop: '1px solid #E3E7EA' }}>
            <Box
              aria-hidden="true"
              sx={{ width: 30, height: 30, display: 'grid', placeItems: 'center', bgcolor: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 800, borderRadius: '50%' }}
            >
              {index + 1}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{item.description}</Typography>
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

function BulletSection({ title, items, icon, background }) {
  const SectionIcon = icon;
  return (
    <Box sx={{ bgcolor: background, borderLeft: '3px solid #1E3A5F', px: 2, py: 1.5, height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <SectionIcon fontSize="small" sx={{ color: '#1E3A5F' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
      </Stack>
      <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
        {items.map((item) => (
          <Typography component="li" variant="body2" key={item} sx={{ mb: 0.75, '&:last-child': { mb: 0 } }}>
            {item}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function StageDetail({ stage, index, onPrevious, onNext }) {
  const previousStage = scmGuideStages[index - 1];
  const nextStage = scmGuideStages[index + 1];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 1.75, md: 2.5 }, py: 2.25, borderTop: '4px solid #1E3A5F' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} alignItems="flex-start">
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 800, color: '#5C6972' }}>
              Etapa {index + 1} de {scmGuideStages.length} · {stage.scope}
            </Typography>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.25 }}>
              <Box sx={{ color: '#1E3A5F', display: 'flex' }}><StageIcon stage={stage} /></Box>
              <Typography component="h2" variant="h5" sx={{ fontSize: 22, fontWeight: 800, color: '#172B3A' }}>
                {stage.title}
              </Typography>
            </Stack>
          </Box>
          <Chip label={stage.maturity.label} color={stage.maturity.color} variant={stage.maturity.color === 'default' ? 'outlined' : 'filled'} />
        </Stack>
        <Typography variant="body1" sx={{ mt: 1.5, maxWidth: 880 }}>{stage.purpose}</Typography>
      </Box>

      <Divider />

      <Grid container spacing={0}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ p: 2, borderRight: { md: '1px solid #E3E7EA' }, borderBottom: { xs: '1px solid #E3E7EA', md: 0 } }}>
          <Typography variant="caption" color="text.secondary">Responsables</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{stage.owner}</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }} sx={{ p: 2, borderRight: { md: '1px solid #E3E7EA' }, borderBottom: { xs: '1px solid #E3E7EA', md: 0 } }}>
          <Typography variant="caption" color="text.secondary">Entrada</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>{stage.input}</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }} sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">Resultado entregado</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>{stage.output}</Typography>
        </Grid>
      </Grid>

      <Alert severity="info" icon={<AccountTreeOutlinedIcon />} sx={{ borderRadius: 0, borderTop: '1px solid #D9E8F1', borderBottom: '1px solid #D9E8F1' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Decisión que debe quedar clara</Typography>
        <Typography variant="body2">{stage.decision}</Typography>
      </Alert>

      <Box sx={{ px: { xs: 1.75, md: 2.5 }, py: 2.5 }}>
        {stage.id === 'lectura' && <FlowMap />}

        <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 800, mb: 0.5 }}>Anatomía de la pantalla</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Los números siguen el orden recomendado para explicar la etapa durante la reunión.
        </Typography>
        <Anatomy items={stage.anatomy} />

        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <BulletSection title="Reglas que esta etapa protege" items={stage.invariants} icon={CheckCircleOutlineIcon} background="#F2F7F4" />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <BulletSection title="Guion sugerido para la demostración" items={stage.talkTrack} icon={MenuBookOutlinedIcon} background="#F4F6F8" />
          </Grid>
        </Grid>

        <Alert severity={stage.route ? 'success' : 'warning'} sx={{ mt: 2, alignItems: 'center' }}>
          {stage.statusNote}
        </Alert>
      </Box>

      <Divider />

      <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' }, gap: 1, alignItems: 'center' }}>
        <Box>
          {previousStage && (
            <Button startIcon={<ArrowBackOutlinedIcon />} onClick={onPrevious}>
              {previousStage.shortLabel}
            </Button>
          )}
        </Box>
        <Box sx={{ justifySelf: { xs: 'stretch', sm: 'center' } }}>
          {stage.route ? (
            <Button
              component={RouterLink}
              to={stage.route}
              variant="contained"
              startIcon={<OpenInNewOutlinedIcon />}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {stage.routeLabel}
            </Button>
          ) : (
            <Tooltip title="Esta vista todavía no está implementada" arrow>
              <span>
                <Button disabled variant="outlined" startIcon={<LockOutlinedIcon />} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  Vista pendiente
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ justifySelf: { xs: 'start', sm: 'end' } }}>
          {nextStage && (
            <Button endIcon={<ArrowForwardOutlinedIcon />} onClick={onNext}>
              {nextStage.shortLabel}
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

function ManagementClose() {
  return (
    <Paper variant="outlined" sx={{ mt: 2, borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: '#172B3A', color: 'white' }}>
        <Typography component="h2" variant="h6" sx={{ fontSize: 18, fontWeight: 800 }}>Cierre de la reunión</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.78)' }}>
          Estas decisiones convierten la demostración en políticas implementables; los nombres reales pueden configurarse durante el piloto.
        </Typography>
      </Box>
      <Grid container>
        {scmManagementChecks.map((item, index) => (
          <Grid key={item} size={{ xs: 12, md: 6 }} sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E3E7EA', borderRight: { md: index % 2 === 0 ? '1px solid #E3E7EA' : 0 } }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ width: 26, height: 26, flex: '0 0 auto', display: 'grid', placeItems: 'center', border: '1px solid #9EABB4', color: '#43515C', fontSize: 12, fontWeight: 800 }}>
                {index + 1}
              </Box>
              <Typography variant="body2">{item}</Typography>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

function Glossary() {
  return (
    <Box id="glosario" sx={{ mt: 3, scrollMarginTop: 24 }}>
      <Typography component="h2" variant="h6" sx={{ fontSize: 18, fontWeight: 800 }}>Glosario rápido</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.25 }}>
        Términos que deben utilizarse de la misma forma durante toda la validación.
      </Typography>
      <Grid container columnSpacing={3}>
        {scmGlossary.map((item) => (
          <Grid key={item.term} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Box sx={{ py: 1.25, borderTop: '1px solid #DDE2E6' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{item.term}</Typography>
              <Typography variant="body2" color="text.secondary">{item.definition}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function ScmGuide() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStage = searchParams.get('etapa');
  const selectedIndex = useMemo(() => {
    const index = scmGuideStages.findIndex((stage) => stage.id === requestedStage);
    return index >= 0 ? index : 0;
  }, [requestedStage]);
  const selectedStage = scmGuideStages[selectedIndex];

  const selectStage = (index) => {
    setSearchParams({ etapa: scmGuideStages[index].id });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1560, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 800, color: '#172B3A' }}>
            Guía operativa SCM
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Recorrido gerencial desde los datos maestros hasta la trazabilidad de despacho
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip icon={<MenuBookOutlinedIcon />} label="Modo reunión" color="primary" variant="outlined" />
          <Chip icon={<ScienceOutlinedIcon />} label="3 etapas con mock" color="info" variant="outlined" />
          <Button component="a" href="#glosario" variant="outlined" startIcon={<MenuBookOutlinedIcon />}>Glosario</Button>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Duración sugerida" value="20-25 min" accent="#1E3A5F" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Etapas del recorrido" value={scmGuideStages.length} accent="#176B52" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Mocks conectados" value="US-010A / P / B" accent="#6B4F83" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Objetivo" value="Validar decisiones" accent="#9A3B26" /></Grid>
        </Grid>
      </Paper>

      <Legend />

      <Box sx={{ mt: 2, display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '244px minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
        {isMobile ? (
          <MobileNavigation selectedIndex={selectedIndex} onSelect={selectStage} />
        ) : (
          <DesktopNavigation selectedIndex={selectedIndex} onSelect={selectStage} />
        )}

        <Box minWidth={0}>
          <StageDetail
            stage={selectedStage}
            index={selectedIndex}
            onPrevious={() => selectStage(selectedIndex - 1)}
            onNext={() => selectStage(selectedIndex + 1)}
          />
          <ManagementClose />
        </Box>
      </Box>

      <Glossary />
    </Box>
  );
}

export default ScmGuide;
