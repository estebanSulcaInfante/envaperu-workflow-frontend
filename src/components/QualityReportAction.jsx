import { useState } from 'react';
import { Button, Stack } from '@mui/material';
import QualityIncidentDialog from './QualityIncidentDialog';
import { CHECK_LABELS, weightResult } from './qualityPieceModel';
import { WEIGHT_OPTIONS, CYCLE_OPTIONS, COLOR_INCIDENT_OPTIONS, INJECTION_INCIDENT_OPTIONS, FUNCTIONAL_INCIDENT_OPTIONS } from './qualityIncidentOptions';

const optionsByFamily = {
  peso: WEIGHT_OPTIONS, ciclo: CYCLE_OPTIONS, color: COLOR_INCIDENT_OPTIONS,
  inyeccion: INJECTION_INCIDENT_OPTIONS, funcional: FUNCTIONAL_INCIDENT_OPTIONS,
};

export default function QualityReportAction({ family, work, label, value = {}, onChange, disabled = false }) {
  const [form, setForm] = useState(null);
  const measured = family === 'peso' || family === 'ciclo';
  const result = weightResult(value.netGrams, value.quantity);
  const name = label || work.mouldLabel || work.label;
  const hasIncident = measured ? Boolean(value.classification && value.classification !== 'CORRECTO') : value.status === 'INCIDENCIA';
  const conforms = measured ? value.classification === 'CORRECTO' : value.status === 'OK';
  const invalid = family === 'peso' ? result == null : family === 'ciclo' && !(Number(value.seconds) > 0);
  const byValue = new Map(optionsByFamily[family].map(option => [option.value, option.label]));
  const resolvedLabels = (measured ? [value.classification] : value.incidentOptions || []).map(code => byValue.get(code)).filter(Boolean);
  const setNormal = status => onChange({
    status: measured ? 'MEDIDO' : status, classification: measured ? 'CORRECTO' : '',
    incidentOptions: [], description: '', otherText: '', affectedMangas: [], evidence: '', owner: '', action: '',
  });
  const open = () => setForm({
    ...value, result, classification: hasIncident ? value.classification : '', type: '',
    colorOptions: family === 'color' ? (value.incidentOptions || []) : [],
    incidentOptions: value.incidentOptions || [], evidence: value.evidence || '', owner: value.owner || '', action: value.action || '',
  });
  const save = () => {
    onChange({
      status: measured ? 'MEDIDO' : 'INCIDENCIA',
      classification: measured ? form.classification : '', description: form.description || '',
      incidentOptions: family === 'color' ? form.colorOptions : form.incidentOptions,
      otherText: form.otherText || '', evidence: form.evidence, owner: form.owner, action: form.action,
    });
    setForm(null);
  };
  return <Stack spacing={0.5} alignItems="flex-start">
    <Stack role="group" direction="row" aria-label={'Resultado de ' + CHECK_LABELS[family]}
      sx={{ width: '100%', flexWrap: 'wrap', gap: 0.5, '& .MuiButton-root': { minHeight: 44, px: 1.1, whiteSpace: 'normal' } }}>
      <Button size="small" disabled={disabled || invalid} aria-pressed={conforms} aria-label={measured ? (family === 'peso' ? 'Peso correcto · ' + name : 'Ciclo correcto') : 'Dar conforme'}
        variant={conforms ? 'contained' : 'outlined'} onClick={() => setNormal('OK')}>Dar conforme</Button>
      <Button size="small" disabled={disabled || invalid} variant="outlined" color="primary" aria-label={'Reportar incidencia de ' + CHECK_LABELS[family] + ' · ' + name}
        onClick={open}>{hasIncident ? 'Editar incidencia' : 'Reportar'}</Button>
      {family === 'funcional' && <Button size="small" disabled={disabled} aria-pressed={value.status === 'NA'} variant={value.status === 'NA' ? 'contained' : 'outlined'} onClick={() => setNormal('NA')}>No aplica</Button>}
    </Stack>
    {hasIncident && resolvedLabels.length > 0 && <small>{resolvedLabels.join(' · ')}</small>}
    {form && <QualityIncidentDialog context={{ checkId: family, label: name, scopeId: name, workCycle: true }}
      draft={form} setDraft={setForm} onClose={() => setForm(null)} onSave={save} />}
  </Stack>;
}
