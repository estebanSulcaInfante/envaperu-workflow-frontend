import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel,
  Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import PageHeader from './ui/PageHeader';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { createUuid } from '../services/scmProductOnboardingApi';
import {
  confirmarFaltanteInventario,
  obtenerRevisionFaltantes,
  registrarRevisionFaltante,
} from '../services/scmInventoryC66Api';

const EMPTY_STATE = { revision: { candidatas: [], activas: {} }, movimientos: [] };

const clean = (value) => String(value ?? '').trim();

function errorMessage(error, fallback) {
  if (error?.response?.status >= 500 || !error?.response) return `${fallback} Revisa la conexión y reintenta.`;
  return mensajeErrorScm(error, fallback);
}

function newKey() {
  return createUuid();
}

function candidateLabel(candidate) {
  return [candidate.pieza, candidate.color].filter(Boolean).join(' · ') || 'Pieza sin detalle';
}

export default function InventoryMissingReviewScm() {
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [checks, setChecks] = useState({ cobertura: false, movimientos_revisados: false, busqueda: false });
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const codeInputRef = useRef(null);
  const operationKeys = useRef(new Map());

  const candidates = useMemo(() => (Array.isArray(state.revision?.candidatas) ? state.revision.candidatas : []), [state.revision?.candidatas]);
  const movements = useMemo(() => (Array.isArray(state.movimientos) ? state.movimientos : []), [state.movimientos]);
  const selected = useMemo(
    () => candidates.find((item) => clean(item.codigo) === selectedCode) || null,
    [candidates, selectedCode],
  );
  const activeReview = review || selected?.revision || null;
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((item) => [item.codigo, item.pieza, item.color, item.zona]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized));
  }, [candidates, query]);
  const checksComplete = Object.values(checks).every(Boolean);
  const adjustmentEnabled = state.revision?.ajuste_habilitado === true
    && state.revision?.movimientos_habilitados === true
    && state.revision?.puede_ajustar === true;
  const canAdjust = state.revision?.puede_ajustar === true;
  const coverageConfirmed = selected?.cobertura_pieza?.completa === true;
  const candidateCanReview = selected?.vigente !== false && coverageConfirmed;
  const missingZones = Array.isArray(selected?.cobertura_pieza?.zonas_faltantes) ? selected.cobertura_pieza.zonas_faltantes : [];
  const staleReason = selected?.motivo_bloqueo || 'La evidencia ya no está vigente.';
  const selectedCountSessions = useMemo(() => {
    if (!selected) return [];
    const linked = [
      ...(Array.isArray(selected.conteos) ? selected.conteos : []),
      ...(selected.conteo ? [selected.conteo] : []),
    ];
    const fromSessions = (Array.isArray(state.sesiones) ? state.sesiones : [])
      .filter((session) => Array.isArray(session.lecturas)
        && session.lecturas.some((reading) => clean(reading.codigo) === selectedCode));
    const seen = new Set();
    return [...linked, ...fromSessions].filter((session) => {
      const key = session.id || `${session.nombre || ''}:${session.zona || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selected, selectedCode, state.sesiones]);
  const selectedMovements = useMemo(
    () => selectedCode ? movements.filter((movement) => clean(movement.codigo) === selectedCode) : [],
    [movements, selectedCode],
  );

  const keyFor = (name) => {
    if (!operationKeys.current.has(name)) operationKeys.current.set(name, newKey());
    return operationKeys.current.get(name);
  };

  const clearKey = (name) => operationKeys.current.delete(name);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await obtenerRevisionFaltantes();
      setState({ ...EMPTY_STATE, ...result, revision: { ...EMPTY_STATE.revision, ...(result?.revision || {}) } });
      return result;
    } catch (error) {
      setLoadError(errorMessage(error, 'No pudimos cargar la revisión de faltantes.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chooseCandidate = (candidate) => {
    const code = clean(candidate.codigo);
    setSelectedCode(code);
    setReview(candidate.revision || null);
    setChecks({ cobertura: false, movimientos_revisados: false, busqueda: false });
    setReason('');
    setFeedback(null);
  };

  const selectByCode = (event) => {
    event.preventDefault();
    const code = clean(event.currentTarget.elements.codigo.value);
    const candidate = candidates.find((item) => clean(item.codigo).toLocaleLowerCase() === code.toLocaleLowerCase());
    if (!candidate) {
      setFeedback({ severity: 'warning', text: 'No encontramos una manga activa con ese código.' });
      return;
    }
    chooseCandidate(candidate);
  };

  const registerReview = async () => {
    if (!selectedCode || !checksComplete || busy || activeReview || !candidateCanReview) return;
    setBusy('review');
    setFeedback(null);
    try {
      const result = await registrarRevisionFaltante({
        codigo: selectedCode,
        cobertura: true,
        movimientos_revisados: true,
        busqueda: true,
      }, keyFor(`review:${selectedCode}`));
      setReview(result);
      setFeedback({ severity: 'success', text: 'Revisión registrada. Ya puedes confirmar el faltante si corresponde.' });
      await load();
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo registrar la revisión.') });
    } finally {
      setBusy('');
    }
  };

  const confirmMissing = async () => {
    if (!selectedCode || selected?.vigente === false || !activeReview?.token || !reason.trim() || busy || !adjustmentEnabled) return;
    setBusy('missing');
    setFeedback(null);
    try {
      const operationId = keyFor(`missing:${selectedCode}:${activeReview.token}`);
      const result = await confirmarFaltanteInventario({
        codigo: selectedCode,
        token: activeReview.token,
        motivo: reason.trim(),
        clave: operationId,
      }, operationId);
      clearKey(`missing:${selectedCode}:${activeReview.token}`);
      setFeedback({ severity: 'success', text: `Ajuste registrado: ${result?.comprobante || 'confirmación completada'}.` });
      setSelectedCode('');
      setReview(null);
      setReason('');
      setChecks({ cobertura: false, movimientos_revisados: false, busqueda: false });
      await load();
      codeInputRef.current?.focus();
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo confirmar el faltante.') });
    } finally {
      setBusy('');
    }
  };

  if (loading && !candidates.length && !loadError) {
    return <Stack spacing={2}><PageHeader title="Revisión de faltantes" description="Confirma la búsqueda antes de ajustar el Kardex." /><Skeleton variant="rounded" height={260} /><Skeleton variant="rounded" height={180} /></Stack>;
  }

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ maxWidth: 1180, mx: 'auto' }}>
      <PageHeader
        title="Revisión de faltantes"
        description="Revisa cobertura, movimientos y búsqueda dirigida antes de marcar una manga como faltante. La confirmación se habilita según el estado del entorno."
        actions={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading || Boolean(busy)}>Actualizar estado</Button>}
      />
      {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Reintentar</Button>}>{loadError}</Alert>}
      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(320px, .9fr)' }, gap: 2 }}>
        <Paper component="section" aria-labelledby="missing-candidates-title" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Box>
              <Typography id="missing-candidates-title" component="h2" variant="h6" fontWeight={850}>Mangas disponibles para revisión</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Selecciona una manga que no apareció durante el conteo y comprueba su contexto antes de descontarla.</Typography>
            </Box>
            <form onSubmit={selectByCode}>
              <TextField
                inputRef={codeInputRef}
                name="codigo"
                label="Código de manga"
                placeholder="Escribe el código visible"
                fullWidth
                autoComplete="off"
                InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
                helperText="El código debe corresponder a una manga activa del inventario."
              />
            </form>
            <TextField label="Buscar en la lista" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, pieza, color o zona" fullWidth size="small" />
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, maxHeight: 430, overflowY: 'auto' }}>
              {filteredCandidates.map((candidate) => {
                const code = clean(candidate.codigo);
                const isSelected = selectedCode === code;
                return <Box component="li" key={code}>
                  <Button
                    fullWidth
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'primary' : 'inherit'}
                    onClick={() => chooseCandidate(candidate)}
                    aria-label={`Seleccionar ${code}`}
                    sx={{ justifyContent: 'space-between', textAlign: 'left', py: 1.25, px: 1.5, gap: 1 }}
                  >
                    <Box sx={{ minWidth: 0 }}><Typography component="span" variant="body2" fontWeight={800} display="block" noWrap>{code}</Typography><Typography component="span" variant="caption" color={isSelected ? 'inherit' : 'text.secondary'} display="block" noWrap>{candidateLabel(candidate)} · {candidate.zona || 'Zona no informada'}{candidate.vigente === false ? ` · ${candidate.motivo_bloqueo || 'Evidencia no vigente'}` : candidate.cobertura_pieza?.completa === false ? ' · Cobertura pendiente' : ''}</Typography></Box>
                    <Typography component="span" variant="body2" fontWeight={800} sx={{ flexShrink: 0 }}>{candidate.neto ? `${candidate.neto} kg` : 'Sin neto'}</Typography>
                  </Button>
                </Box>;
              })}
              {!filteredCandidates.length && <Typography variant="body2" color="text.secondary">No hay mangas activas que coincidan con la búsqueda.</Typography>}
            </Stack>
          </Stack>
        </Paper>

        <Paper component="section" aria-labelledby="missing-review-title" variant="outlined" sx={{ p: { xs: 2, md: 3 }, alignSelf: 'start' }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Box><Typography id="missing-review-title" component="h2" variant="h6" fontWeight={850}>Evidencia de revisión</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{selected ? selected.codigo : 'Selecciona una manga para empezar'}</Typography></Box>
              {selected && <FactCheckOutlinedIcon color={activeReview ? 'success' : 'action'} aria-hidden="true" />}
            </Stack>
            {selected ? <>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
                <Typography variant="body2" fontWeight={800}>{candidateLabel(selected)}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Zona registrada: {selected.zona || 'No informada'}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Neto vigente: {selected.neto ? `${selected.neto} kg` : 'No informado'}</Typography>
              </Paper>
              {!activeReview && !candidateCanReview && <Alert severity="warning">{selected?.vigente === false ? `${staleReason} Actualiza el estado antes de revisar una nueva evidencia.` : `Falta completar la cobertura${missingZones.length ? ` de ${missingZones.join(', ')}` : ''} antes de registrar la revisión.`}</Alert>}
              {!activeReview && candidateCanReview && <>
                <Typography variant="subtitle2" fontWeight={800}>Antes de registrar la revisión</Typography>
                <Stack>
                  <FormControlLabel control={<Checkbox checked={checks.cobertura} onChange={(event) => setChecks((current) => ({ ...current, cobertura: event.target.checked }))} />} label="Cobertura revisada" />
                  <FormControlLabel control={<Checkbox checked={checks.movimientos_revisados} onChange={(event) => setChecks((current) => ({ ...current, movimientos_revisados: event.target.checked }))} />} label="Revisé los ajustes locales y el acceso a Kardex" />
                  <FormControlLabel control={<Checkbox checked={checks.busqueda} onChange={(event) => setChecks((current) => ({ ...current, busqueda: event.target.checked }))} />} label="Búsqueda dirigida completada" />
                </Stack>
                <Button variant="contained" startIcon={busy === 'review' ? <CircularProgress size={18} color="inherit" /> : <FactCheckOutlinedIcon />} onClick={registerReview} disabled={!checksComplete || Boolean(busy)}>{busy === 'review' ? 'Registrando…' : 'Registrar revisión'}</Button>
              </>}
              {activeReview && <>
                <Alert severity="info">Revisión registrada. Neto a descontar: {activeReview.neto || selected.neto || '—'} kg.</Alert>
                {!coverageConfirmed && <Alert severity="warning">Falta completar la cobertura{missingZones.length ? ` de ${missingZones.join(', ')}` : ''} antes de registrar la revisión.</Alert>}
                <Divider />
                <TextField label="Motivo del faltante" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. búsqueda física completada sin hallazgo" multiline minRows={3} required fullWidth helperText="El motivo queda en el movimiento de Kardex." />
                {!adjustmentEnabled && <Alert severity="warning">
                  {state.revision?.ajuste_habilitado === false && state.revision?.movimientos_habilitados !== true
                    ? 'La confirmación de faltantes está cerrada en este entorno.'
                    : state.revision?.ajuste_habilitado === false && !canAdjust
                      ? 'Tu perfil puede revisar la evidencia, pero no tiene permiso para ajustar el Kardex.'
                      : 'La API todavía no habilitó la confirmación de faltantes para esta pantalla.'}
                </Alert>}
                <Button variant="contained" color="warning" startIcon={busy === 'missing' ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineRoundedIcon />} onClick={confirmMissing} disabled={!reason.trim() || selected?.vigente === false || Boolean(busy) || !adjustmentEnabled || !coverageConfirmed}>{busy === 'missing' ? 'Confirmando…' : 'Confirmar faltante'}</Button>
              </>}
            </> : <Alert severity="info">La revisión requiere una manga seleccionada. Escribe su código visible o elígela en la lista.</Alert>}
            <Divider />
            <Box>
              <Typography component="h3" variant="subtitle2" fontWeight={850}>Contexto del inventario</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: .5 }}>Evidencia vinculada a la manga seleccionada.</Typography>
              <Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 1 }}>Conteos registrados</Typography>
              {selectedCountSessions.length ? <Stack spacing={.5}>{selectedCountSessions.slice(-5).map((session) => {
                const coverage = session.cobertura_confirmada ?? session.cobertura;
                const closedAt = session.cerrado_at || session.cerrado_en || session.closed_at;
                return <Typography variant="body2" key={session.id || `${session.nombre}:${session.zona}`}>
                  {session.nombre || 'Conteo sin nombre'} · {session.zona || 'Zona no informada'} · Cobertura {coverage === true ? 'confirmada' : 'no confirmada'}{closedAt ? ` · Cerrado ${closedAt}` : ''}
                </Typography>;
              })}</Stack> : <Typography variant="body2" color="text.secondary">No hay conteos vinculados a esta manga.</Typography>}
              <Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 1 }}>Ajustes locales de inventario</Typography>
              {selectedMovements.length ? <Stack spacing={.5}>{selectedMovements.slice(-5).map((movement) => <Typography variant="body2" key={movement.id || `${movement.codigo}:${movement.tipo}:${movement.fecha || ''}`}>{movement.tipo} · {movement.delta || '0'} kg</Typography>)}</Stack> : <Typography variant="body2" color="text.secondary">No hay movimientos ni ajustes históricos para esta manga.</Typography>}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Las salidas, retornos y otros movimientos canónicos se consultan en Kardex.</Typography>
              <Button href="/almacen/kardex?tab=movements" size="small" sx={{ alignSelf: 'flex-start', mt: .5 }}>Abrir movimientos de Kardex</Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
      <Alert icon={<CheckCircleOutlineRoundedIcon />} severity="info">
        {adjustmentEnabled
          ? 'Registrar una revisión no mueve kilos. Solo «Confirmar faltante» genera el ajuste auditado y marca la manga como baja comprobada.'
          : 'Registrar una revisión no mueve kilos. La confirmación está cerrada en este entorno.'}
      </Alert>
    </Stack>
  );
}
