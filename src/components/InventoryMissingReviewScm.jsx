import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery,
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
import * as inventoryC66Api from '../services/scmInventoryC66Api';

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

function LegacyInventoryMissingReviewScm() {
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

function localDateTime(value) {
  if (!value) return 'No informado';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function sessionSearchText(session) {
  return [session?.nombre, session?.zona, ...(Array.isArray(session?.piezas) ? session.piezas : [])]
    .filter(Boolean).join(' ').toLocaleLowerCase();
}

function revisionStateLabel(manga) {
  const state = STATUS_LABELS[String(manga?.estado || '').toUpperCase()];
  return state?.label || String(manga?.estado || 'PENDIENTE').toUpperCase();
}

function RevisionSessionsInbox() {
  const [sessions, setSessions] = useState(SESSION_EMPTY.sesiones);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState({ cobertura: false, movimientos_revisados: false, busqueda: false });
  const [busy, setBusy] = useState('');
  const operationKeys = useRef(new Map());
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

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return sessions.filter((session) => !normalized || sessionSearchText(session).includes(normalized));
  }, [query, sessions]);

  const openSession = async (session) => {
    setSelectedId(String(session.id));
    setDetail(null);
    setDetailError('');
    setReason('');
    setChecks({ cobertura: false, movimientos_revisados: false, busqueda: false });
    setFeedback(null);
    setDetailLoading(true);
    try {
      const result = await inventoryC66Api.obtenerDetalleRevisionSesion(session.id);
      setDetail(result);
    } catch (loadError) {
      setDetailError(loadError?.response?.status === 409
        ? 'La sesión cambió mientras la abrías. Vuelve a intentar para leer la versión vigente.'
        : errorMessage(loadError, 'No pudimos cargar el detalle de la sesión.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const mangas = Array.isArray(detail?.mangas) ? detail.mangas : [];
  const selectedSession = detail?.sesion || sessions.find((session) => String(session.id) === selectedId);
  const blockedMangas = mangas.filter((manga) => String(manga.estado || '').toUpperCase() === 'NO_HABIDA' && manga.aprobable === false);
  const proposedDiscount = mangas
    .filter((manga) => String(manga.estado || '').toUpperCase() === 'NO_HABIDA')
    .reduce((total, manga) => total + (Number(manga.neto_kg) || 0), 0);
  const checksComplete = Object.values(checks).every(Boolean);
  const canApprove = detail?.puede_aprobar === true && detail?.movimientos_habilitados === true && blockedMangas.length === 0 && checksComplete && reason.trim();

  const approve = async () => {
    if (!detail?.sesion?.id || !canApprove || busy) return;
    setBusy('approve');
    setFeedback(null);
    try {
      await inventoryC66Api.aprobarRevisionSesion(detail.sesion.id, {
        version_revision: detail.version_revision,
        codigos: mangas
          .filter((manga) => String(manga.estado || '').toUpperCase() === 'NO_HABIDA')
          .map((manga) => manga.codigo),
        motivo: reason.trim(),
        cobertura: true,
        movimientos_revisados: true,
        busqueda: true,
      }, keyFor(`approve:${detail.sesion.id}:${detail.version_revision}`));
      setFeedback({ severity: 'success', text: 'Aprobación registrada. La sesión conserva su comprobante y versión revisada.' });
      await loadSessions();
    } catch (approveError) {
      setFeedback({ severity: 'error', text: errorMessage(approveError, 'No se pudo aprobar la sesión. Actualiza el detalle y reintenta.') });
      if (approveError?.response?.status === 409) await openSession(selectedSession);
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
        actions={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadSessions} disabled={loading || Boolean(busy)}>Actualizar estado</Button>}
      />
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadSessions}>Reintentar</Button>}>{error}</Alert>}
      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(280px, .7fr) minmax(0, 1.5fr)' }, gap: 2, minWidth: 0, width: '100%' }}>
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
                  <Button fullWidth variant={isSelected ? 'contained' : 'outlined'} color={isSelected ? 'primary' : 'inherit'} onClick={() => openSession(session)} aria-label={`Abrir ${session.nombre || session.id}`} sx={{ justifyContent: 'space-between', textAlign: 'left', alignItems: 'flex-start', gap: 1, py: 1.25, minWidth: 0 }}>
                    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Typography component="span" variant="body2" fontWeight={800} display="block" sx={{ overflowWrap: 'anywhere' }}>{session.nombre || session.id}</Typography><Typography component="span" variant="caption" color={isSelected ? 'inherit' : 'text.secondary'} display="block" sx={{ overflowWrap: 'anywhere' }}>{session.zona || 'Zona no informada'} · {session.piezas?.join(', ') || 'Piezas no informadas'}</Typography></Box>
                    <Chip size="small" label={status.label} color={status.color} sx={{ flexShrink: 0 }} />
                  </Button>
                </Box>;
              })}
              {!filteredSessions.length && <Typography variant="body2" color="text.secondary">No hay solicitudes que coincidan.</Typography>}
            </Stack>
          </Stack>
        </Paper>

        <Paper component="section" aria-labelledby="revision-session-detail-title" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0, overflow: 'hidden' }}>
          {detailLoading && <Stack spacing={2}><Skeleton variant="rounded" height={100} /><Skeleton variant="rounded" height={240} /></Stack>}
          {!detailLoading && !detail && (detailError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => selectedSession && openSession(selectedSession)}>Reintentar detalle</Button>}>{detailError}</Alert> : <Alert severity="info">Selecciona una sesión para consultar su corte y estado vigente.</Alert>)}
          {!detailLoading && detail && <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} justifyContent="space-between" gap={1}>
              <Box><Typography id="revision-session-detail-title" component="h2" variant="h6" fontWeight={850}>Detalle de la solicitud</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{selectedSession?.nombre || selectedSession?.id} · {selectedSession?.zona || 'Zona no informada'}</Typography></Box>
              <Chip label={sessionStatus(selectedSession).label} color={sessionStatus(selectedSession).color} />
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1} aria-label="Resumen de sesión">
              <Chip variant="outlined" label={`Esperadas: ${selectedSession?.esperadas ?? 0}`} />
              <Chip variant="outlined" label={`Encontradas: ${selectedSession?.encontradas ?? 0}`} />
              <Chip variant="outlined" label={`No habidas: ${selectedSession?.no_habidas ?? 0}`} />
              <Chip variant="outlined" label={`Corte: ${localDateTime(selectedSession?.corte_at || selectedSession?.solicitada_at)}`} />
              <Chip variant="outlined" color={proposedDiscount > 0 ? 'warning' : 'default'} label={`Descuento propuesto · ${proposedDiscount.toFixed(3)} kg`} />
            </Stack>
            <Box>
              <Typography component="h3" variant="subtitle1" fontWeight={850}>Mangas por pieza y color</Typography>
              {mobile && <Stack spacing={1} sx={{ mt: 1 }}>
                {mangas.map((manga) => { const status = sessionStatus(manga); return <Paper key={manga.codigo} variant="outlined" sx={{ p: 1.25 }}><Stack spacing={.5}><Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={850} sx={{ overflowWrap: 'anywhere' }}>{manga.codigo}</Typography><Chip size="small" label={revisionStateLabel(manga)} color={status.color} /></Stack><Typography variant="body2">{manga.pieza || '—'}{manga.color ? ` · ${manga.color}` : ''}</Typography><Typography variant="caption" color="text.secondary">Neto: {kg(manga.neto_kg)}</Typography><Typography variant="caption" color="text.secondary">{manga.motivo_bloqueo || (manga.aprobable === false ? 'No aprobable con el estado vigente.' : 'Listo para revisión final.')}</Typography><Button component="a" href={`/almacen/revision-faltantes?codigo=${encodeURIComponent(manga.codigo)}`} size="small" sx={{ alignSelf: 'flex-start' }}>Abrir revisión individual</Button></Stack></Paper>; })}
                {!mangas.length && <Typography color="text.secondary">La sesión no tiene mangas devueltas por la API.</Typography>}
              </Stack>}
              {!mobile && <Box sx={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0, mt: 1 }}>
                <Table size="small" aria-label="Mangas de la sesión" sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Pieza / color</TableCell><TableCell>Estado vigente</TableCell><TableCell align="right">Neto</TableCell><TableCell>Explicación</TableCell><TableCell>Datos históricos</TableCell></TableRow></TableHead><TableBody>
                  {mangas.map((manga) => { const status = sessionStatus(manga); return <TableRow key={manga.codigo}><TableCell sx={{ fontWeight: 800 }}>{manga.codigo}</TableCell><TableCell>{manga.pieza || '—'}{manga.color ? ` · ${manga.color}` : ''}</TableCell><TableCell><Chip size="small" label={revisionStateLabel(manga)} color={status.color} /></TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{kg(manga.neto_kg)}</TableCell><TableCell sx={{ minWidth: 180 }}>{manga.motivo_bloqueo || (manga.aprobable === false ? 'No aprobable con el estado vigente.' : 'Listo para revisión final.')}</TableCell><TableCell><Button component="a" href={`/almacen/revision-faltantes?codigo=${encodeURIComponent(manga.codigo)}`} size="small">Abrir revisión individual</Button></TableCell></TableRow>; })}
                  {!mangas.length && <TableRow><TableCell colSpan={6}><Typography color="text.secondary">La sesión no tiene mangas devueltas por la API.</Typography></TableCell></TableRow>}
                </TableBody></Table>
              </Box>}
            </Box>
            <Divider />
            <Box>
              <Typography component="h3" variant="subtitle1" fontWeight={850}>Confirmación final</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>La aprobación cubre toda la sesión y usa la versión de revisión {detail.version_revision ?? '—'}.</Typography>
              {blockedMangas.length > 0 && <Alert severity="warning" sx={{ mt: 1 }}>Hay {blockedMangas.length} manga(s) bloqueada(s). La sesión queda solicitada hasta resolver el estado vigente.</Alert>}
              {detail.puede_aprobar !== true && <Alert severity="warning" sx={{ mt: 1 }}>Permiso: no puedes aprobar esta solicitud{detail.motivo_bloqueo ? ` · ${detail.motivo_bloqueo}` : ''}.</Alert>}
              {detail.movimientos_habilitados !== true && <Alert severity="warning" sx={{ mt: 1 }}>Los movimientos están deshabilitados en este entorno; la aprobación permanece bloqueada.</Alert>}
              {detail.puede_aprobar === true && <Stack spacing={1.25} sx={{ mt: 1 }}>
                <TextField label="Motivo de aprobación" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Cobertura validada y búsqueda completada" multiline minRows={2} fullWidth />
                <FormControlLabel control={<Checkbox checked={checks.cobertura} onChange={(event) => setChecks((current) => ({ ...current, cobertura: event.target.checked }))} />} label="Cobertura revisada" />
                <FormControlLabel control={<Checkbox checked={checks.movimientos_revisados} onChange={(event) => setChecks((current) => ({ ...current, movimientos_revisados: event.target.checked }))} />} label="Movimientos revisados" />
                <FormControlLabel control={<Checkbox checked={checks.busqueda} onChange={(event) => setChecks((current) => ({ ...current, busqueda: event.target.checked }))} />} label="Búsqueda y evidencias revisadas" />
              </Stack>}
              <Button variant="contained" onClick={approve} disabled={!canApprove || Boolean(busy)} sx={{ mt: 1 }}>{busy === 'approve' ? 'Aprobando…' : 'Aprobar sesión completa'}</Button>
            </Box>
            <Alert severity="info">La revisión individual conserva el detalle histórico por manga; la aprobación aquí es una confirmación de la sesión completa, no una selección parcial.</Alert>
          </Stack>}
        </Paper>
      </Box>
    </Stack>
  );
}

export { LegacyInventoryMissingReviewScm };
export default function InventoryMissingReviewScm() {
  return <RevisionSessionsInbox />;
}
