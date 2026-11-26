import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, IconButton, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography, useMediaQuery,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PageHeader from './ui/PageHeader';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { createUuid } from '../services/scmProductOnboardingApi';
import {
  confirmarFaltanteInventario,
  obtenerRevisionFaltantes,
  registrarRevisionFaltante,
} from '../services/scmInventoryC66Api';
import * as inventoryC66Api from '../services/scmInventoryC66Api';

const EMPTY_STATE = { revision: { candidatas: [], activas: {} }, movimientos: [] };

function normalizeLegacyState(result) {
  return { ...EMPTY_STATE, ...result, revision: { ...EMPTY_STATE.revision, ...(result?.revision || {}) } };
}

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

const PHYSICAL_ZONES = {
  'ALM-PZ': 'Almacén de piezas general',
  'Z-ALMACEN-PIEZAS': 'Almacén de piezas general',
  'ALM-ARM-3': 'Almacén de armado – 2.º piso',
  'Z-ALMACEN-ARMADO-3P': 'Almacén de armado – 2.º piso',
  'ALM-LLANTAS-3': 'Almacén de llantas – 2.º piso',
  'Z-ALMACEN-LLANTAS-3P': 'Almacén de llantas – 2.º piso',
  'ALM-ARM-4': 'Almacén de armado – 3.er piso',
  'Z-ALMACEN-ARMADO-4P': 'Almacén de armado – 3.er piso',
};

function physicalZoneName(session) {
  return session?.zona_nombre || PHYSICAL_ZONES[session?.zona] || session?.zona || 'Zona no informada';
}

function LegacyInventoryMissingReviewScm({ initialResult = null, requestSessionIds = [] }) {
  const [state, setState] = useState(() => initialResult ? normalizeLegacyState(initialResult) : EMPTY_STATE);
  const [loading, setLoading] = useState(!initialResult);
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
  const historicalCode = useMemo(() => new URLSearchParams(window.location.search).get('codigo') || '', []);
  const initialHistoricalCandidate = useMemo(
    () => legacyCandidates(initialResult).find((item) => clean(item.codigo) === clean(historicalCode)),
    [historicalCode, initialResult],
  );

  useEffect(() => {
    if (!initialHistoricalCandidate) return;
    setSelectedCode(clean(initialHistoricalCandidate.codigo));
    setReview(initialHistoricalCandidate.revision || null);
  }, [initialHistoricalCandidate]);

  const candidates = useMemo(() => (Array.isArray(state.revision?.candidatas) ? state.revision.candidatas : []), [state.revision?.candidatas]);
  const historicalCandidates = useMemo(() => legacyCandidates(state), [state]);
  const requestSessionSet = useMemo(() => new Set(requestSessionIds.map((id) => String(id))), [requestSessionIds]);
  const movements = useMemo(() => (Array.isArray(state.movimientos) ? state.movimientos : []), [state.movimientos]);
  const selected = useMemo(
    () => candidates.find((item) => clean(item.codigo) === selectedCode)
      || historicalCandidates.find((item) => clean(item.codigo) === selectedCode)
      || null,
    [candidates, historicalCandidates, selectedCode],
  );
  const historicalSelected = Boolean(selected && !candidates.some((item) => clean(item.codigo) === clean(selected.codigo)));
  const historicalEntryReadOnly = Boolean(historicalCode && selected
    && linkedSessionIds(selected).some((id) => requestSessionSet.has(String(id))));
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
  const canAdjust = !historicalSelected && !historicalEntryReadOnly && state.revision?.puede_ajustar === true;
  const coverageConfirmed = selected?.cobertura_pieza?.completa === true;
  const candidateCanReview = !historicalSelected && !historicalEntryReadOnly && selected?.vigente !== false && coverageConfirmed;
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
      setState(normalizeLegacyState(result));
      const historicalCandidate = legacyCandidates(result).find((item) => clean(item.codigo) === clean(historicalCode));
      if (historicalCandidate) {
        setSelectedCode(clean(historicalCandidate.codigo));
        setReview(historicalCandidate.revision || null);
      }
      return result;
    } catch (error) {
      setLoadError(errorMessage(error, 'No pudimos cargar la revisión de faltantes.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [historicalCode]);

  useEffect(() => {
    if (!initialResult) load();
  }, [initialResult, load]);

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
    if (!selectedCode || historicalSelected || historicalEntryReadOnly || selected?.vigente === false || !activeReview?.token || !reason.trim() || busy || !adjustmentEnabled) return;
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
              {(historicalSelected || historicalEntryReadOnly) && <Alert severity="info">Esta manga pertenece al historial de una solicitud; la consulta es solo de lectura.</Alert>}
              {!activeReview && !historicalSelected && !historicalEntryReadOnly && !candidateCanReview && <Alert severity="warning">{selected?.vigente === false ? `${staleReason} Actualiza el estado antes de revisar una nueva evidencia.` : `Falta completar la cobertura${missingZones.length ? ` de ${missingZones.join(', ')}` : ''} antes de registrar la revisión.`}</Alert>}
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
                {!historicalEntryReadOnly && <>
                  {!coverageConfirmed && <Alert severity="warning">Falta completar la cobertura{missingZones.length ? ` de ${missingZones.join(', ')}` : ''} antes de registrar la revisión.</Alert>}
                  <Divider />
                  <TextField label="Motivo del faltante" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. búsqueda física completada sin hallazgo" multiline minRows={3} required fullWidth helperText="El motivo queda en el movimiento de Kardex." />
                  {!adjustmentEnabled && <Alert severity="warning">
                    {state.revision?.ajuste_habilitado === false && state.revision?.movimientos_habilitados !== true
                      ? 'La confirmación de faltantes está cerrada en este entorno.'
                      : state.revision?.ajuste_habilitado === false && !canAdjust
                        ? 'Tu perfil puede revisar la evidencia, pero no tiene permiso para ajustar el Kardex.'
                        : 'La confirmación de faltantes aún no está disponible para esta pantalla.'}
                  </Alert>}
                  <Button variant="contained" color="warning" startIcon={busy === 'missing' ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineRoundedIcon />} onClick={confirmMissing} disabled={!reason.trim() || historicalSelected || historicalEntryReadOnly || selected?.vigente === false || Boolean(busy) || !adjustmentEnabled || !coverageConfirmed}>{busy === 'missing' ? 'Confirmando…' : 'Confirmar faltante'}</Button>
                </>}
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

const SESSION_EMPTY = { sesiones: [] };
const STATUS_LABELS = {
  ENCONTRADA: { label: 'Encontrada (OK)', color: 'success' },
  NO_HABIDA: { label: 'No habida', color: 'warning' },
  PENDIENTE: { label: 'Pendiente', color: 'info' },
  FUERA_DE_AJUSTE: { label: 'Fuera de ajuste', color: 'error' },
  AJUSTADA: { label: 'Ajustada', color: 'default' },
  SOLICITADA: { label: 'Solicitada', color: 'warning' },
};

function sessionStatus(session) {
  const value = String(session?.estado || 'PENDIENTE').toUpperCase();
  return STATUS_LABELS[value] || { label: value, color: 'default' };
}

function kg(value) {
  return value === null || value === undefined || value === '' ? '—' : `${value} kg`;
}

function grossKg(value) {
  return value === null || value === undefined || value === '' ? 'Sin registro' : kg(value);
}

function signedKg(value) {
  const grams = Math.round(Number(value) * 1000);
  const sign = grams > 0 ? '+' : grams < 0 ? '−' : '';
  return `${sign}${(Math.abs(grams) / 1000).toFixed(3)} kg`;
}

function proposedDelta(manga) {
  if (manga.estado === 'NO_HABIDA') return -Number(manga.neto_kg || 0);
  if (manga.aprobable && manga.diferencia_repesaje_kg != null) return Number(manga.diferencia_repesaje_kg);
  return 0;
}

function localDateTime(value) {
  if (!value) return 'No informado';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function sessionSearchText(session) {
  return [session?.nombre, session?.zona, session?.zona_nombre, ...(Array.isArray(session?.piezas) ? session.piezas : [])]
    .filter(Boolean).join(' ').toLocaleLowerCase();
}

function revisionStateLabel(manga) {
  const state = STATUS_LABELS[String(manga?.estado || '').toUpperCase()];
  return state?.label || String(manga?.estado || 'PENDIENTE').toUpperCase();
}

function mangaExplanation(manga) {
  if (manga?.motivo_bloqueo) return manga.motivo_bloqueo;
  if (manga.neto_repesado_kg != null) return 'Repesada en Estación 2.';
  switch (String(manga?.estado || '').toUpperCase()) {
    case 'ENCONTRADA': return 'Sin descuento: encontrada en el corte.';
    case 'AJUSTADA': return 'Ajustada previamente; no se vuelve a descontar.';
    case 'FUERA_DE_AJUSTE': return 'El estado cambió después del corte; no se descuenta.';
    case 'NO_HABIDA': return manga?.bloquea_sesion === true || manga?.aprobable === true
      ? 'Ausente con cobertura vigente; se incluye en el descuento de la sesión.'
      : 'Ausente sin cobertura vigente; la sesión queda solicitada.';
    default: return 'Pendiente de confirmar antes de aprobar.';
  }
}

function MangaWeights({ manga, table = false }) {
  if (manga.neto_repesado_kg != null) {
    return <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto auto', gap: '.2rem .75rem', textAlign: 'left', '& dd': { m: 0, textAlign: 'right', whiteSpace: 'nowrap' } }}>
      {[
        ['Neto anterior', kg(manga.neto_anterior_kg)],
        ['Bruto en balanza', grossKg(manga.bruto_repesado_kg)],
        ['Neto repesado', kg(manga.neto_repesado_kg)],
        ['Diferencia', signedKg(manga.diferencia_repesaje_kg)],
      ].map(([label, value]) => <Fragment key={label}>
        <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
        <Typography component="dd" variant="body2" fontWeight={label === 'Diferencia' ? 800 : 600}>{value}</Typography>
      </Fragment>)}
    </Box>;
  }
  return <Stack direction={table ? 'column' : 'row'} spacing={table ? .25 : 2} alignItems={table ? 'flex-end' : 'flex-start'}>
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">Neto</Typography>
      <Typography variant={table ? 'body1' : 'h6'} fontWeight={900} sx={{ lineHeight: 1.15, whiteSpace: 'nowrap' }}>{kg(manga.neto_kg)}</Typography>
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">Bruto</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{grossKg(manga.bruto_kg)}</Typography>
    </Box>
  </Stack>;
}

function RevisionSessionsInbox({ initialSessions = null, initialSessionId = '' }) {
  const [sessions, setSessions] = useState(() => initialSessions || SESSION_EMPTY.sesiones);
  const [selectedId, setSelectedId] = useState(initialSessionId ? String(initialSessionId) : '');
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!initialSessions);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [approvalReceipts, setApprovalReceipts] = useState({});
  const operationKeys = useRef(new Map());
  const detailRequestRef = useRef(0);
  const initialOpenRef = useRef(false);
  const mobile = useMediaQuery('(max-width:899px)');

  const keyFor = (name) => {
    if (!operationKeys.current.has(name)) operationKeys.current.set(name, newKey());
    return operationKeys.current.get(name);
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await inventoryC66Api.obtenerSesionesRevision();
      setSessions(Array.isArray(result?.sesiones) ? result.sesiones : []);
    } catch (loadError) {
      setError(errorMessage(loadError, 'No pudimos cargar las solicitudes de revisión.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSessions) loadSessions();
  }, [initialSessions, loadSessions]);

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return sessions.filter((session) => !normalized || sessionSearchText(session).includes(normalized));
  }, [query, sessions]);

  const openSession = useCallback(async (session) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedId(String(session.id));
    setDetail(null);
    setDetailError('');
    setReason('');
    setFeedback(null);
    setDetailLoading(true);
    try {
      const result = await inventoryC66Api.obtenerDetalleRevisionSesion(session.id);
      if (requestId !== detailRequestRef.current) return;
      setDetail(result);
    } catch (loadError) {
      if (requestId !== detailRequestRef.current) return;
      setDetailError(loadError?.response?.status === 409
        ? 'La sesión cambió mientras la abrías. Vuelve a intentar para leer la versión vigente.'
        : errorMessage(loadError, 'No pudimos cargar el detalle de la sesión.'));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    if (busy === 'approve') return;
    detailRequestRef.current += 1;
    setSelectedId('');
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
    setReason('');
    setFeedback(null);
  };

  useEffect(() => {
    if (initialOpenRef.current || !initialSessionId || !sessions.length) return;
    const session = sessions.find((item) => String(item.id) === String(initialSessionId));
    if (!session) return;
    initialOpenRef.current = true;
    openSession(session);
  }, [initialSessionId, sessions, openSession]);

  const mangas = useMemo(() => (Array.isArray(detail?.mangas) ? detail.mangas : []), [detail?.mangas]);
  const selectedSession = detail?.sesion || sessions.find((session) => String(session.id) === selectedId);
  const approvalReceipt = approvalReceipts[selectedId] || null;
  const isApproved = String(selectedSession?.estado || '').toUpperCase() === 'APROBADA'
    || Boolean(approvalReceipt?.comprobante || detail?.comprobante || selectedSession?.comprobante);
  const blockedMangas = mangas.filter((manga) => manga.bloquea_sesion === true
    || (String(manga.estado || '').toUpperCase() === 'NO_HABIDA' && manga.bloquea_sesion == null && manga.aprobable === false));
  const adjustmentRows = mangas.filter((manga) => manga.estado === 'NO_HABIDA' || proposedDelta(manga) !== 0);
  const proposedKg = adjustmentRows.reduce((grams, manga) => grams + Math.round(proposedDelta(manga) * 1000), 0) / 1000;
  const canApprove = detail?.puede_aprobar === true && blockedMangas.length === 0
    && (!adjustmentRows.length || detail.movimientos_habilitados === true);
  const groupedMangas = useMemo(() => mangas.reduce((groups, manga) => {
    const piece = manga.pieza || 'Pieza no informada';
    const existing = groups.find((group) => group.pieza === piece);
    if (existing) existing.mangas.push(manga);
    else groups.push({ pieza: piece, mangas: [manga] });
    return groups;
  }, []), [mangas]);

  const rawReceipt = approvalReceipt || detail?.comprobante || selectedSession?.comprobante;
  const receipt = rawReceipt ? {
    comprobante: typeof rawReceipt === 'string' ? rawReceipt : rawReceipt.comprobante,
    aprobada_at: detail?.aprobada_at || selectedSession?.aprobada_at || approvalReceipt?.aprobada_at,
    movimientos: approvalReceipt?.movimientos || detail?.movimientos || [],
    kg_descontados: detail?.kg_descontados ?? approvalReceipt?.kg_descontados,
  } : null;
  const receiptMovements = Array.isArray(receipt?.movimientos) ? receipt.movimientos : [];
  const adjustedKg = receiptMovements.length
    ? receiptMovements.reduce((grams, movement) => grams + Math.round(Number(movement.delta_kg) * 1000), 0) / 1000
    : -Math.abs(Number(receipt?.kg_descontados) || 0);

  const approve = async () => {
    if (!detail?.sesion?.id || !canApprove || busy) return;
    setBusy('approve');
    setFeedback(null);
    const approvingSessionId = detail.sesion.id;
    const payload = {
      version_revision: detail.version_revision,
      codigos: adjustmentRows.map((manga) => manga.codigo),
      motivo: reason.trim(),
    };
    try {
      const result = await inventoryC66Api.aprobarRevisionSesion(approvingSessionId, payload, keyFor(`approve:${approvingSessionId}:${JSON.stringify(payload)}`));
      if (String(selectedId) !== String(approvingSessionId)) return;
      setApprovalReceipts((current) => ({ ...current, [String(approvingSessionId)]: result }));
      setReason('');
      setFeedback({ severity: 'success', text: `Aprobación registrada: ${result?.comprobante || 'comprobante disponible'}.` });
      try {
        const refreshed = await inventoryC66Api.obtenerDetalleRevisionSesion(approvingSessionId);
        if (String(selectedId) === String(approvingSessionId)) {
          setDetail({
            ...refreshed,
            comprobante: refreshed?.comprobante || result?.comprobante,
            movimientos: refreshed?.movimientos || result?.movimientos || [],
            kg_descontados: refreshed?.kg_descontados ?? result?.kg_descontados,
            aprobada_at: refreshed?.aprobada_at || result?.aprobada_at,
            sesion: { ...refreshed?.sesion, estado: refreshed?.sesion?.estado || 'APROBADA', comprobante: refreshed?.sesion?.comprobante || result?.comprobante, aprobada_at: refreshed?.sesion?.aprobada_at || result?.aprobada_at },
          });
        }
      } catch {
        setDetail((current) => current && String(selectedId) === String(approvingSessionId) ? {
          ...current,
          comprobante: result?.comprobante,
          movimientos: result?.movimientos || [],
          kg_descontados: result?.kg_descontados,
          aprobada_at: result?.aprobada_at,
          sesion: { ...current.sesion, estado: 'APROBADA', comprobante: result?.comprobante, aprobada_at: result?.aprobada_at },
        } : current);
      }
      await loadSessions();
    } catch (approveError) {
      const message = errorMessage(approveError, 'No se pudo aprobar la sesión. Actualiza el detalle y reintenta.');
      if (approveError?.response?.status === 409 && String(selectedId) === String(approvingSessionId)) {
        await openSession(selectedSession);
        setFeedback({ severity: 'error', text: message });
      } else {
        setFeedback({ severity: 'error', text: message });
      }
    } finally {
      setBusy('');
    }
  };

  if (loading && !sessions.length) {
    return <Stack spacing={2}><PageHeader title="Solicitudes de revisión" description="Revisa una sesión completa antes de afectar el inventario." /><Skeleton variant="rounded" height={220} /></Stack>;
  }

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ maxWidth: 1240, mx: 'auto' }}>
      <PageHeader
        title="Solicitudes de revisión"
        description="Bandeja de sesiones C66: consulta el corte, todos los estados de manga y aprueba solo con evidencia completa."
        actions={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => {
          loadSessions();
          if (selectedSession) openSession(selectedSession);
        }} disabled={loading || detailLoading || Boolean(busy)}>Actualizar estado</Button>}
      />
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadSessions}>Reintentar</Button>}>{error}</Alert>}
      {feedback && !selectedId && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2, minWidth: 0, width: '100%' }}>
        <Paper component="section" aria-labelledby="revision-sessions-title" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, alignSelf: 'start', minWidth: 0 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography id="revision-sessions-title" component="h2" variant="h6" fontWeight={850}>Sesiones solicitadas</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Busca por nombre, zona o pieza.</Typography>
            </Box>
            <TextField label="Buscar solicitudes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, zona o pieza" size="small" fullWidth />
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, maxHeight: { xs: 330, lg: 560 }, overflowY: 'auto' }}>
              {filteredSessions.map((session) => {
                const status = sessionStatus(session);
                const isSelected = String(session.id) === selectedId;
                return <Box component="li" key={session.id}>
                  <Button fullWidth variant={isSelected ? 'contained' : 'outlined'} color={isSelected ? 'primary' : 'inherit'} onClick={() => openSession(session)} disabled={busy === 'approve'} aria-label={`Abrir ${session.nombre || session.id}`} sx={{ justifyContent: 'space-between', textAlign: 'left', alignItems: 'flex-start', gap: 1, py: 1.25, minWidth: 0 }}>
                    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Typography component="span" variant="body2" fontWeight={800} display="block" sx={{ overflowWrap: 'anywhere' }}>{session.nombre || session.id}</Typography><Typography component="span" variant="caption" color={isSelected ? 'inherit' : 'text.secondary'} display="block" sx={{ overflowWrap: 'anywhere' }}>{physicalZoneName(session)} · {session.piezas?.join(', ') || 'Piezas no informadas'}</Typography><Typography component="span" variant="caption" color={isSelected ? 'inherit' : 'text.secondary'} display="block">Solicitada: {localDateTime(session.solicitada_at)}</Typography></Box>
                    <Chip size="small" label={status.label} color={status.color} sx={{ flexShrink: 0 }} />
                  </Button>
                </Box>;
              })}
              {!filteredSessions.length && <Typography variant="body2" color="text.secondary">No hay solicitudes que coincidan.</Typography>}
            </Stack>
          </Stack>
        </Paper>

        <Dialog
          open={Boolean(selectedId)}
          onClose={closeDetail}
          fullWidth
          maxWidth="lg"
          fullScreen={mobile}
          scroll="paper"
          aria-labelledby="revision-session-detail-title"
        >
          <DialogTitle id="revision-session-detail-title" sx={{ pb: 1 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" variant="h6" fontWeight={850}>Detalle de la solicitud</Typography>
                {selectedSession && <Typography variant="body2" color="text.secondary" sx={{ mt: .5, overflowWrap: 'anywhere' }}>{selectedSession.nombre || selectedSession.id} · {physicalZoneName(selectedSession)}</Typography>}
              </Box>
              <IconButton aria-label="Cerrar detalle de sesión" onClick={closeDetail} disabled={busy === 'approve'} edge="end" size="small">
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={{ minWidth: 0 }}>
          {feedback && selectedId && <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>{feedback.text}</Alert>}
          {detailLoading && <Stack spacing={2}><Skeleton variant="rounded" height={100} /><Skeleton variant="rounded" height={240} /></Stack>}
          {!detailLoading && !detail && (detailError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => selectedSession && openSession(selectedSession)}>Reintentar detalle</Button>}>{detailError}</Alert> : <Alert severity="info">Selecciona una sesión para consultar su corte y estado vigente.</Alert>)}
          {!detailLoading && detail && <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" gap={1}>
              <Box><Typography variant="body2" color="text.secondary">Consulta el corte y confirma el estado vigente de cada manga.</Typography></Box>
              <Chip label={sessionStatus(selectedSession).label} color={sessionStatus(selectedSession).color} />
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1} aria-label="Resumen de sesión">
              <Chip variant="outlined" label={`Esperadas: ${selectedSession?.esperadas ?? 0}`} />
              <Chip variant="outlined" label={`Encontradas: ${selectedSession?.encontradas ?? 0}`} />
              <Chip variant="outlined" label={`No habidas: ${selectedSession?.no_habidas ?? 0}`} />
              <Chip variant="outlined" label={`Corte: ${localDateTime(selectedSession?.corte_at || selectedSession?.solicitada_at)}`} />
              <Chip variant="outlined" color={isApproved ? 'success' : adjustmentRows.length ? 'warning' : 'default'} label={`${isApproved ? 'Ajuste aplicado' : 'Ajuste propuesto'} · ${signedKg(isApproved ? adjustedKg : proposedKg)}`} />
            </Stack>
            <Box>
              <Typography component="h3" variant="subtitle1" fontWeight={850}>Mangas por pieza y color</Typography>
              {mobile && <Stack spacing={1} sx={{ mt: 1 }}>
                {groupedMangas.map((group) => <Box key={group.pieza}><Typography variant="subtitle2" fontWeight={850} sx={{ mb: .75 }}>{group.pieza}</Typography><Stack spacing={1}>{group.mangas.map((manga) => { const status = sessionStatus(manga); return <Paper key={manga.codigo} variant="outlined" sx={{ p: 1.25 }}><Stack spacing={.75}><Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={850} sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}>{manga.codigo}</Typography><Chip size="small" label={revisionStateLabel(manga)} color={status.color} /></Stack><Typography variant="body2">{manga.color || 'Color no informado'}</Typography><MangaWeights manga={manga} /><Typography variant="caption" color="text.secondary">{mangaExplanation(manga)}</Typography></Stack></Paper>; })}</Stack></Box>)}
                {!groupedMangas.length && <Typography color="text.secondary">No hay mangas para esta sesión.</Typography>}
              </Stack>}
              {!mobile && <Box sx={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0, mt: 1 }}>
                <Table size="small" aria-label="Mangas de la sesión" sx={{ minWidth: 680 }}><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Pieza / color</TableCell><TableCell>Estado vigente</TableCell><TableCell align="right">Pesos</TableCell></TableRow></TableHead><TableBody>
                  {groupedMangas.map((group) => <Fragment key={group.pieza}><TableRow><TableCell colSpan={4} sx={{ bgcolor: 'background.default', fontWeight: 850 }}>{group.pieza}</TableCell></TableRow>{group.mangas.map((manga) => { const status = sessionStatus(manga); return <TableRow key={manga.codigo}><TableCell sx={{ fontWeight: 800 }}><Typography component="span" variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}>{manga.codigo}</Typography></TableCell><TableCell>{manga.color || 'Color no informado'}</TableCell><TableCell><Stack spacing={.25} alignItems="flex-start"><Chip size="small" label={revisionStateLabel(manga)} color={status.color} /><Typography variant="caption" color="text.secondary">{mangaExplanation(manga)}</Typography></Stack></TableCell><TableCell align="right"><MangaWeights manga={manga} table /></TableCell></TableRow>; })}</Fragment>)}
                  {!groupedMangas.length && <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No hay mangas para esta sesión.</Typography></TableCell></TableRow>}
                </TableBody></Table>
              </Box>}
            </Box>
            <Divider />
            <Box>
              <Typography component="h3" variant="subtitle1" fontWeight={850}>Confirmación final</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Al aprobar se descuentan las mangas no habidas y se aplica la diferencia de cada repesaje.</Typography>
              <Stack spacing={.25} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Solicitada por: {selectedSession?.solicitante || selectedSession?.solicitante_id || 'no informado'} · {localDateTime(selectedSession?.solicitada_at)}</Typography>
                {(isApproved || selectedSession?.aprobador_id || receipt?.aprobada_at) && <Typography variant="caption" color="text.secondary">Aprobada por: {selectedSession?.aprobador || selectedSession?.aprobador_id || 'esta cuenta'} · {localDateTime(receipt?.aprobada_at || selectedSession?.aprobada_at)}</Typography>}
                {selectedSession?.motivo && <Typography variant="caption" color="text.secondary">Motivo registrado: {selectedSession.motivo}</Typography>}
              </Stack>
              {isApproved && <Alert severity="success" sx={{ mt: 1 }}>Aprobación confirmada · comprobante {receipt?.comprobante || 'no informado'} · cambio en Kardex {signedKg(adjustedKg)}.</Alert>}
              {!isApproved && <>
                {blockedMangas.length > 0 && <Alert severity="warning" sx={{ mt: 1 }}>Hay {blockedMangas.length} manga(s) bloqueada(s). La sesión queda solicitada hasta resolver el estado vigente.</Alert>}
                {detail.puede_aprobar !== true && <Alert severity="warning" sx={{ mt: 1 }}>Permiso: no puedes aprobar esta solicitud{detail.motivo_bloqueo ? ` · ${detail.motivo_bloqueo}` : ''}.</Alert>}
                {adjustmentRows.length > 0 && detail.movimientos_habilitados !== true && <Alert severity="warning" sx={{ mt: 1 }}>Los movimientos de Kardex están deshabilitados en este entorno.</Alert>}
                {detail.puede_aprobar === true && <Stack spacing={1.25} sx={{ mt: 1 }}>
                  <TextField label="Motivo de aprobación" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nota" slotProps={{ inputLabel: { shrink: true } }} multiline minRows={2} fullWidth />
                </Stack>}
              </>}
            </Box>
          </Stack>}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, py: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => selectedSession && openSession(selectedSession)} disabled={!selectedSession || detailLoading || Boolean(busy)}>Actualizar detalle</Button>
              <Button onClick={closeDetail} disabled={busy === 'approve'}>Cerrar detalle</Button>
            </Stack>
            {detail && !isApproved && <Button variant="contained" onClick={approve} disabled={!canApprove || Boolean(busy)}>{busy === 'approve' ? 'Aprobando…' : 'Aprobar sesión completa'}</Button>}
          </DialogActions>
        </Dialog>
      </Box>
    </Stack>
  );
}

export { LegacyInventoryMissingReviewScm };

function linkedSessionIds(candidate) {
  return [
    candidate?.conteo?.id,
    ...(Array.isArray(candidate?.conteos) ? candidate.conteos.map((item) => item?.id || item) : []),
  ].filter(Boolean).map(String);
}

function legacyCandidates(result) {
  const current = Array.isArray(result?.revision?.candidatas) ? result.revision.candidatas : [];
  const history = Array.isArray(result?.revision?.historial)
    ? result.revision.historial
    : (result?.revision?.historial && typeof result.revision.historial === 'object' ? Object.values(result.revision.historial) : []);
  return [...current, ...history];
}

function RevisionSessionsDeepLink({ code }) {
  const [resolution, setResolution] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([inventoryC66Api.obtenerSesionesRevision(), obtenerRevisionFaltantes()])
      .then(([sessionResult, legacyResult]) => {
        if (!active) return;
        const sessions = Array.isArray(sessionResult?.sesiones) ? sessionResult.sesiones : [];
        const candidate = legacyCandidates(legacyResult).find((item) => clean(item.codigo) === clean(code));
        const linkedIds = linkedSessionIds(candidate);
        const linkedSession = sessions.find((item) => linkedIds.includes(String(item.id)));
        const readSession = (legacyResult?.sesiones || []).find((item) => Array.isArray(item.lecturas)
          && item.lecturas.some((reading) => clean(reading.codigo) === clean(code)));
        const session = linkedSession || sessions.find((item) => readSession && String(item.id) === String(readSession.id));
        setResolution(session
          ? { sessions, sessionId: session.id }
          : { legacy: true, legacyResult });
      })
      .catch(() => {
        if (active) setResolution({ error: 'No pudimos resolver la manga vinculada. Reintenta o abre la revisión histórica explícita.' });
      });
    return () => { active = false; };
  }, [attempt, code]);

  if (!resolution) return <Stack spacing={2}><PageHeader title="Solicitudes de revisión" description="Cargando la sesión vinculada." /><Skeleton variant="rounded" height={220} /></Stack>;
  if (resolution.error) return <Stack spacing={2}><PageHeader title="Solicitudes de revisión" description="No se pudo resolver la entrada solicitada." /><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setResolution(null); setAttempt((current) => current + 1); }}>Reintentar</Button>}>{resolution.error}</Alert></Stack>;
  if (resolution.legacy) return <LegacyInventoryMissingReviewScm initialResult={resolution.legacyResult} />;
  return <RevisionSessionsInbox initialSessions={resolution.sessions} initialSessionId={resolution.sessionId} />;
}

function HistoricalRevisionDeepLink({ code }) {
  const [resolution, setResolution] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([inventoryC66Api.obtenerSesionesRevision(), obtenerRevisionFaltantes()])
      .then(([sessionResult, legacyResult]) => {
        if (!active) return;
        const sessions = Array.isArray(sessionResult?.sesiones) ? sessionResult.sesiones : [];
        setResolution({ legacyResult, requestSessionIds: sessions.map((item) => item.id).filter(Boolean) });
      })
      .catch(() => {
        if (active) setResolution({ error: 'No pudimos comprobar si la manga pertenece a una solicitud. Reintenta para mantener la consulta histórica protegida.' });
      });
    return () => { active = false; };
  }, [attempt, code]);

  if (!resolution) return <Stack spacing={2}><PageHeader title="Revisión de faltantes" description="Cargando el expediente histórico." /><Skeleton variant="rounded" height={220} /></Stack>;
  if (resolution.error) return <Stack spacing={2}><PageHeader title="Revisión de faltantes" description="No se pudo comprobar el expediente histórico." /><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setResolution(null); setAttempt((current) => current + 1); }}>Reintentar</Button>}>{resolution.error}</Alert></Stack>;
  return <LegacyInventoryMissingReviewScm initialResult={resolution.legacyResult} requestSessionIds={resolution.requestSessionIds} />;
}

export default function InventoryMissingReviewScm() {
  const params = new URLSearchParams(window.location.search);
  const historicalCode = params.get('codigo');
  if (historicalCode && params.get('historico') === '1') return <HistoricalRevisionDeepLink code={historicalCode} />;
  if (historicalCode) return <RevisionSessionsDeepLink code={historicalCode} />;
  return <RevisionSessionsInbox />;
}
