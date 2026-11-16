import { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormGroup, FormHelperText, FormLabel, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { physicalName } from './QualityPieceNavigation';
import { COLOR_INCIDENT_OPTIONS, CYCLE_INCIDENT_OPTIONS, FUNCTIONAL_INCIDENT_OPTIONS, INJECTION_INCIDENT_OPTIONS, WEIGHT_INCIDENT_OPTIONS } from './qualityIncidentOptions';

export default function IncidentDialog({ context, draft, setDraft, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const primaryFocusRef = useRef(null);
  const interactedRef = useRef(false);
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));
  const isWeight = context?.checkId === 'peso';
  const isCycle = context?.checkId === 'ciclo';
  const isColor = context?.checkId === 'color';
  const isInjection = context?.checkId === 'inyeccion';
  const isFunctional = context?.checkId === 'funcional';
  const isStructured = isCycle || isInjection || isFunctional;
  const colorOptions = Array.isArray(draft.colorOptions) ? draft.colorOptions : [];
  const incidentOptions = Array.isArray(draft.incidentOptions) ? draft.incidentOptions : [];
  const structuredOptions = isInjection ? INJECTION_INCIDENT_OPTIONS : FUNCTIONAL_INCIDENT_OPTIONS;
  const colorFocusValue = colorOptions[0] || COLOR_INCIDENT_OPTIONS[0].value;
  const structuredFocusValue = incidentOptions[0] || structuredOptions[0]?.value;
  useEffect(() => {
    interactedRef.current = false;
    if (!context) return undefined;
    const timer = window.setTimeout(() => {
      if (!interactedRef.current) primaryFocusRef.current?.focus();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [context?.scopeId, context?.piece?.key, context?.checkId]);
  const toggleFinding = (field, value) => setDraft(current => {
    const selected = current[field] || [];
    return { ...current, [field]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] };
  });
  const canSave = isWeight
    ? WEIGHT_INCIDENT_OPTIONS.some((option) => option.value === draft.classification)
    : isCycle
      ? CYCLE_INCIDENT_OPTIONS.some((option) => option.value === draft.classification)
    : isColor
      ? colorOptions.length > 0 && (!colorOptions.includes('OTROS') || String(draft.otherText || '').trim())
      : isStructured
        ? incidentOptions.length > 0 && (!incidentOptions.includes('OTROS') || String(draft.otherText || '').trim())
      : draft.type.trim() && draft.description.trim();
  return (
    <Dialog open={Boolean(context)} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="quality-piece-incident-title">
      <DialogTitle id="quality-piece-incident-title">Registrar incidencia</DialogTitle>
      {context && <Box sx={{ px: 3, pb: 1.5, mt: -1 }}>
        <Typography variant="body2" color="text.secondary">{context.label ?? (context.piece.workLabel + ' · ' + physicalName(context.piece))}</Typography>
        {isWeight && <Typography variant="body2" color="text.secondary">{draft.netGrams || '—'} g netos · {draft.quantity || '—'} {Number(draft.quantity) === 1 ? 'pieza' : 'piezas'} · {draft.result?.toLocaleString('es-PE', { maximumFractionDigits: 3 }) ?? '—'} g/pieza</Typography>}
        {isCycle && <Typography variant="body2" color="text.secondary">{draft.seconds || '—'} s {context.workCycle ? 'por ciclo del molde' : 'por pieza'}</Typography>}
      </Box>}
      <DialogContent dividers onPointerDownCapture={() => { interactedRef.current = true; }} onKeyDownCapture={() => { interactedRef.current = true; }}><Stack spacing={1.25} sx={{ pt: 0.25 }}>
        {isWeight && <>
          <FormControl required component="fieldset">
            <FormLabel component="legend">Clasificación del peso</FormLabel>
            <RadioGroup row value={draft.classification || ''} onChange={(event) => setDraft((current) => ({ ...current, classification: event.target.value }))}>
              {WEIGHT_INCIDENT_OPTIONS.map((option) => <FormControlLabel key={option.value} value={option.value} control={<Radio inputRef={option.value === (draft.classification || WEIGHT_INCIDENT_OPTIONS[0].value) ? primaryFocusRef : undefined} autoFocus={option.value === (draft.classification || WEIGHT_INCIDENT_OPTIONS[0].value)} />} label={option.label} />)}
            </RadioGroup>
            {!draft.classification && <FormHelperText error>Selecciona una clasificación.</FormHelperText>}
          </FormControl>
          <TextField label="Descripción del peso (opcional)" value={draft.description ?? ''} onChange={update('description')} multiline minRows={2} fullWidth />
        </>}
        {isCycle && <>
          <FormControl required component="fieldset">
            <FormLabel component="legend">Ciclo</FormLabel>
            <RadioGroup row value={draft.classification || ''} onChange={(event) => setDraft((current) => ({ ...current, classification: event.target.value }))}>
              {CYCLE_INCIDENT_OPTIONS.map((option) => <FormControlLabel key={option.value} value={option.value} control={<Radio inputRef={option.value === (draft.classification || CYCLE_INCIDENT_OPTIONS[0].value) ? primaryFocusRef : undefined} autoFocus={option.value === (draft.classification || CYCLE_INCIDENT_OPTIONS[0].value)} />} label={option.label} />)}
            </RadioGroup>
            {!draft.classification && <FormHelperText error>Selecciona una clasificación.</FormHelperText>}
          </FormControl>
          <TextField label="Descripción del ciclo (opcional)" value={draft.description ?? ''} onChange={update('description')} multiline minRows={2} fullWidth />
        </>}
        {isColor && <>
          <FormControl required component="fieldset">
            <FormLabel component="legend">Incidencia de color</FormLabel>
            <FormGroup>
              {COLOR_INCIDENT_OPTIONS.map((option) => <FormControlLabel key={option.value} control={<Checkbox inputRef={colorFocusValue === option.value ? primaryFocusRef : undefined} autoFocus={colorFocusValue === option.value} checked={colorOptions.includes(option.value)} onChange={() => toggleFinding('colorOptions', option.value)} />} label={option.label} />)}
            </FormGroup>
            {!colorOptions.length && <FormHelperText error>Selecciona una opción.</FormHelperText>}
          </FormControl>
          {colorOptions.includes('OTROS') && <TextField required label="Describe Otros" value={draft.otherText ?? ''} onChange={update('otherText')} multiline minRows={2} />}
          <TextField label="Descripción (opcional)" value={draft.description ?? ''} onChange={update('description')} multiline minRows={2} />
        </>}
        {isInjection && <>
          <FormControl required component="fieldset">
            <FormLabel component="legend">Incidencia de inyección</FormLabel>
            <FormGroup>
              {structuredOptions.map((option) => <FormControlLabel key={option.value} control={<Checkbox inputRef={structuredFocusValue === option.value ? primaryFocusRef : undefined} autoFocus={structuredFocusValue === option.value} checked={incidentOptions.includes(option.value)} onChange={() => toggleFinding('incidentOptions', option.value)} />} label={option.label} />)}
            </FormGroup>
            {!incidentOptions.length && <FormHelperText error>Selecciona una opción.</FormHelperText>}
          </FormControl>
          {incidentOptions.includes('OTROS') && <TextField required label="Describe Otros" value={draft.otherText ?? ''} onChange={update('otherText')} multiline minRows={2} />}
          <TextField label="Descripción de la inyección (opcional)" value={draft.description ?? ''} onChange={update('description')} multiline minRows={2} fullWidth />
        </>}
        {isFunctional && <>
          <FormControl required component="fieldset">
            <FormLabel component="legend">Incidencia funcional</FormLabel>
            <FormGroup>
              {structuredOptions.map((option) => <FormControlLabel key={option.value} control={<Checkbox inputRef={structuredFocusValue === option.value ? primaryFocusRef : undefined} autoFocus={structuredFocusValue === option.value} checked={incidentOptions.includes(option.value)} onChange={() => toggleFinding('incidentOptions', option.value)} />} label={option.label} />)}
            </FormGroup>
            {!incidentOptions.length && <FormHelperText error>Selecciona una opción.</FormHelperText>}
          </FormControl>
          {incidentOptions.includes('OTROS') && <TextField required label="Describe Otros" value={draft.otherText ?? ''} onChange={update('otherText')} multiline minRows={2} />}
          <TextField label="Descripción funcional (opcional)" value={draft.description ?? ''} onChange={update('description')} multiline minRows={2} fullWidth />
        </>}
        {!isWeight && !isColor && !isStructured && <>
          <TextField required label="Tipo o familia" value={draft.type} onChange={update('type')} autoFocus />
          <TextField required label="Descripción" value={draft.description} onChange={update('description')} multiline minRows={2} />
        </>}
        {!isWeight && <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Seguimiento opcional</AccordionSummary>
          <AccordionDetails><Stack spacing={1.25}>
            <TextField label="Evidencia" value={draft.evidence} onChange={update('evidence')} placeholder="Foto, archivo o referencia local" />
            <TextField label="Responsable de seguimiento" value={draft.owner} onChange={update('owner')} />
            <TextField label="Acción propuesta" value={draft.action} onChange={update('action')} multiline minRows={2} />
          </Stack></AccordionDetails>
        </Accordion>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" disabled={!canSave || saving} onClick={() => { setSaving(true); onSave(); }}>{saving ? 'Guardando…' : 'Guardar incidencia'}</Button></DialogActions>
    </Dialog>
  );
}
