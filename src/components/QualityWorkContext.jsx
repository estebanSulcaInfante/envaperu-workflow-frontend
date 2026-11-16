import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { visuallyHidden } from '@mui/utils';
import ProductionColorLabel from './ui/ProductionColorLabel';
import { workIsActive } from './qualityPieceModel';

function stateLabel(work) {
  if (!work) return '';
  if (workIsActive(work)) return 'En ejecución';
  return ({ PAUSADO: 'Pausado', PLANIFICADO: 'Planificado', COMPLETADO: 'Completado', ANULADO: 'Anulado' })[work.status] || 'Sin ejecución confirmada';
}

export function WorkColors({ works, selected, onSelect }) {
  return <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
    {works.length > 1 ? <ToggleButtonGroup exclusive size="small" color="primary" aria-label="Color del trabajo" value={selected?.workId ?? null}
      onChange={(_, id) => { if (id != null) onSelect(works.find(work => work.workId === id)); }}
      sx={{ maxWidth: '100%', flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44 } }}>
      {works.map(work => <ToggleButton key={work.key} value={work.workId} aria-label={[work.label,work.ofLabel,stateLabel(work)].filter(Boolean).join(' · ')}>
        <ProductionColorLabel compact name={work.label} hex={work.work?.color_hex} />
        {works.filter(other => other.label === work.label).length > 1 && <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>{work.ofLabel} · {work.work?.codigo || work.workId}</Typography>}
      </ToggleButton>)}
    </ToggleButtonGroup> : selected && <ProductionColorLabel compact name={selected.label} hex={selected.work?.color_hex} />}
    {selected && <Typography variant="caption" color="text.secondary">{[selected.work?.codigo, stateLabel(selected)].filter(Boolean).join(' · ')}</Typography>}
  </Stack>;
}

export function ConfirmedProgress({ confirmed, target }) {
  const hasTarget = target !== '' && target != null;
  return <Stack direction="row" alignItems="baseline" gap={0.75} aria-label="Avance de visitas periódicas">
    <Typography component="span" variant="body2" color="text.secondary">Periódicas confirmadas</Typography>
    <Typography component="span" variant="body2" fontWeight={800}>{hasTarget ? confirmed + '/' + target : confirmed}</Typography>
  </Stack>;
}

export function DraftSaveStatus({ state }) {
  const saving = state === 'pending' || state === 'saving';
  const label = saving ? 'Guardando borrador…' : ({
    saved: 'Guardado', error: 'No se pudo guardar', blocked: 'Cambios sin confirmar',
  })[state];
  if (!label) return null;
  const problem = state === 'error' || state === 'blocked';
  const Icon = problem ? ErrorOutlineIcon : SaveOutlinedIcon;
  return <Box component="span" role="status" aria-live="polite" aria-atomic="true"
    data-testid="quality-autosave-status" title={label}
    sx={{ display: 'inline-flex', alignItems: 'center', color: problem ? 'warning.dark' : saving ? 'primary.main' : 'text.secondary' }}>
    <Icon aria-hidden="true" sx={{
      fontSize: 20,
      ...(saving && { '@media (prefers-reduced-motion: no-preference)': {
        animation: 'qualityDraftSaving .8s ease-in-out infinite alternate',
        '@keyframes qualityDraftSaving': { from: { opacity: .35 }, to: { opacity: 1 } },
      } }),
    }} />
    <Box component="span" sx={visuallyHidden}>{label}</Box>
  </Box>;
}

export function VisitHeader({ title, help, confirmed, target, saveState, onBack }) {
  return <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" gap={1}>
    <Stack direction="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={0.25}>
      <Stack direction="row" alignItems="center">
        <Typography component="h2" variant="h6" fontWeight={850}>{title}</Typography>{help}
      </Stack>
      <ConfirmedProgress confirmed={confirmed} target={target} />
    </Stack>
    <Stack direction="row" alignItems="center" gap={0.5} flexShrink={0}>
      <Box sx={{ width: 20, display: 'inline-flex' }}><DraftSaveStatus state={saveState} /></Box>
      <Button size="small" onClick={onBack}>Volver</Button>
    </Stack>
  </Stack>;
}
