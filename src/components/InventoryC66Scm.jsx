import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl,
  FormControlLabel, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, TextField,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PageHeader from './ui/PageHeader';
import C66PiecePicker from './C66PiecePicker';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { createUuid } from '../services/scmProductOnboardingApi';
import {
  abrirSesionInventarioC66,
  cerrarSesionInventarioC66,
  obtenerEstadoInventarioC66,
  registrarLecturaInventarioC66,
  retirarLecturaInventarioC66,
} from '../services/scmInventoryC66Api';

const EMPTY_STATE = { conteo_por_pieza: true, zonas: [], articulos: [], sesiones: [] };

function operationKey() {
  return createUuid();
}

function cleanCode(value) {
  return String(value || '').trim();
}

function errorMessage(error, fallback) {
  if (error?.response?.status >= 500 || !error?.response) return `${fallback} Revisa la conexión y reintenta.`;
  return mensajeErrorScm(error, fallback);
}

function sessionLabel(session, zones) {
  return session?.nombre || `${zones.find((zone) => zone.id === session?.zona)?.nombre || session?.zona || 'Sin zona'} · ${session?.id}`;
}

export default function InventoryC66Scm() {
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [zone, setZone] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [selectedPieces, setSelectedPieces] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [scanner, setScanner] = useState('');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [closeReviewOpen, setCloseReviewOpen] = useState(false);
  const [roomCovered, setRoomCovered] = useState(false);
  const [pieceCoverageReviewed, setPieceCoverageReviewed] = useState(false);
  const [discrepancy, setDiscrepancy] = useState(null);
  const [historyLimit, setHistoryLimit] = useState(50);
  const [sessionQuery, setSessionQuery] = useState('');
  const scanRef = useRef(null);
  const keys = useRef(new Map());

  const pieceCountEnabled = state.conteo_por_pieza === true;
  const activeSession = useMemo(() => state.sesiones.find((item) => String(item.id) === String(sessionId)), [sessionId, state.sesiones]);
  const sessionClosed = ['CERRADA', 'CLOSED', 'CONFIRMADA'].includes(String(activeSession?.estado || '').toUpperCase());
  const selectedScope = selectedPieces.length ? selectedPieces : (activeSession?.piezas || []);
  const pendingCodes = useMemo(() => {
    if (!activeSession) return [];
    if (Array.isArray(activeSession.pendientes_conteo)) return activeSession.pendientes_conteo;
    const expected = Array.isArray(activeSession.esperadas) ? activeSession.esperadas : [];
    const observed = new Set((activeSession.lecturas || []).map((reading) => cleanCode(reading.codigo)));
    return expected.filter((code) => !observed.has(cleanCode(code)));
  }, [activeSession]);
  const openSessions = useMemo(() => state.sesiones.filter((item) => String(item.estado || '').toUpperCase() === 'ABIERTA'), [state.sesiones]);
  const closedSessions = useMemo(() => state.sesiones.filter((item) => ['CERRADA', 'CLOSED', 'CONFIRMADA'].includes(String(item.estado || '').toUpperCase())), [state.sesiones]);
  const filteredClosedSessions = useMemo(() => {
    const query = sessionQuery.trim().toLocaleLowerCase();
    return closedSessions.filter((session) => !query || sessionLabel(session, state.zonas).toLocaleLowerCase().includes(query));
  }, [closedSessions, sessionQuery, state.zonas]);
  const pieceNames = useMemo(() => [...new Set(state.articulos.map((item) => item.nombre).filter(Boolean))], [state.articulos]);
  const selectedZoneName = state.zonas.find((item) => String(item.id) === String(zone))?.nombre || zone || 'Sin zona';
  const activeSessionZoneName = state.zonas.find((item) => String(item.id) === String(activeSession?.zona))?.nombre || activeSession?.zona || 'Sin zona';
  const articleForReading = (reading) => {
    const articleId = reading.articulo_id ?? reading.articulo ?? state.mangas?.find((item) => cleanCode(item.codigo) === cleanCode(reading.codigo))?.articulo;
    const article = state.articulos.find((item) => String(item.id) === String(articleId));
    return article ? `${article.nombre}${article.color ? ` · ${article.color}` : ''}` : (articleId || 'Artículo sin detalle');
  };
  const zoneForReading = (reading) => state.zonas.find((item) => String(item.id) === String(reading.zona))?.nombre || reading.zona || 'Zona no informada';

  const keyFor = useCallback((name) => {
    if (!keys.current.has(name)) keys.current.set(name, operationKey());
    return keys.current.get(name);
  }, []);
  const clearKey = useCallback((name) => keys.current.delete(name), []);
  const clearSelectionKeys = useCallback(() => {
    [...keys.current.keys()]
      .filter((name) => name.startsWith('open:') || name.startsWith('read:'))
      .forEach((name) => keys.current.delete(name));
  }, []);

  const focusScanner = useCallback(() => window.setTimeout(() => scanRef.current?.focus(), 0), []);

  const loadState = useCallback(async (focusedSessionId = '') => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await obtenerEstadoInventarioC66(focusedSessionId);
      if (!focusedSessionId) {
        setState({ ...EMPTY_STATE, ...result });
      } else if (Array.isArray(result?.sesiones) && result.sesiones.length) {
        const incoming = result.sesiones[0];
        setState((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'sesiones')),
          sesiones: current.sesiones.some((session) => String(session.id) === String(incoming.id))
            ? current.sesiones.map((session) => String(session.id) === String(incoming.id) ? incoming : session)
            : [...current.sesiones, incoming],
        }));
      }
      return result;
    } catch (error) {
      setLoadError(errorMessage(error, 'No pudimos cargar el estado del conteo C66.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const resetSession = () => {
    setSessionId('');
    setSessionName('');
    setSelectedPieces([]);
    setZone('');
    setScanner('');
    setCloseReviewOpen(false);
    setRoomCovered(false);
    setPieceCoverageReviewed(false);
    setDiscrepancy(null);
    setHistoryLimit(50);
    setSessionQuery('');
  };

  const createSession = async () => {
    if (!zone || busy || (pieceCountEnabled && (!sessionName.trim() || !selectedPieces.length))) return;
    const keyName = `open:${zone}:${sessionName.trim()}:${selectedPieces.join('|')}`;
    setBusy('open');
    setFeedback(null);
    try {
      const result = await abrirSesionInventarioC66({
        zona: zone,
        ...(pieceCountEnabled ? { nombre: sessionName.trim(), piezas: selectedPieces } : {}),
      }, keyFor(keyName));
      setSessionId(result.id);
      clearKey(keyName);
      setFeedback({ severity: 'success', text: `${pieceCountEnabled ? `Conteo «${sessionName.trim()}»` : 'Sesión C66'} abierto en ${selectedZoneName}.` });
      await loadState(result.id);
      focusScanner();
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo abrir la sesión C66.') });
    } finally {
      setBusy('');
    }
  };

  const resumeSession = async (session) => {
    if (busy) return;
    setBusy('session');
    setFeedback(null);
    const result = await loadState(session.id);
    const detailedSession = result?.sesiones?.find((item) => String(item.id) === String(session.id));
    if (!detailedSession || detailedSession.resumen === true) {
      setFeedback({ severity: 'error', text: 'No pudimos cargar el detalle de esta sesión. Reintenta desde su botón.' });
      setBusy('');
      return;
    }
    setSessionId(detailedSession.id);
    setSessionName(detailedSession.nombre || '');
    setSelectedPieces(Array.isArray(detailedSession.piezas) ? detailedSession.piezas : []);
    setZone(detailedSession.zona || '');
    setCloseReviewOpen(false);
    setDiscrepancy(null);
    setHistoryLimit(50);
    setBusy('');
    focusScanner();
  };

  const scanReading = async (event) => {
    event.preventDefault();
    const code = cleanCode(scanner);
    if (!sessionId || !zone || !code || busy || sessionClosed) return;
    const keyName = `read:${sessionId}:${code}`;
    setBusy('read');
    setFeedback(null);
    setDiscrepancy(null);
    try {
      const result = await registrarLecturaInventarioC66(sessionId, {
        codigo: code,
        ...(pieceCountEnabled ? { zona: zone } : {}),
      }, keyFor(keyName));
      clearKey(keyName);
      setScanner('');
      setFeedback({ severity: 'success', text: `${code} registrada en ${selectedZoneName}. ${result?.mensaje || 'Lectura confirmada.'}` });
      await loadState(sessionId);
    } catch (error) {
      const payload = error?.response?.data;
      const errorBody = payload?.error;
      const details = payload?.details || (errorBody && typeof errorBody === 'object' ? errorBody.details : {}) || {};
      const previousZone = details.zona_anterior || payload?.zona_anterior;
      if (error?.response?.status === 409 && previousZone) {
        clearKey(keyName);
        setDiscrepancy({ code, previousZone, message: mensajeErrorScm(error, 'La zona del QR no coincide.') });
        await loadState(sessionId);
      } else {
        setFeedback({ severity: 'error', text: errorMessage(error, error?.response?.status === 404 ? 'QR no reconocido.' : 'No se pudo registrar la lectura.') });
      }
    } finally {
      setBusy('');
      focusScanner();
    }
  };

  const acceptDiscrepancy = async () => {
    if (!discrepancy || busy) return;
    const keyName = `read:${sessionId}:${discrepancy.code}`;
    setBusy('read');
    try {
      await registrarLecturaInventarioC66(sessionId, {
        codigo: discrepancy.code,
        ...(pieceCountEnabled ? { zona: zone } : {}),
        confirmar_zona: true,
        zona_anterior: discrepancy.previousZone,
      }, keyFor(keyName));
      clearKey(keyName);
      setScanner('');
      setDiscrepancy(null);
      setFeedback({ severity: 'success', text: `${discrepancy.code} registrada en ${selectedZoneName}.` });
      await loadState(sessionId);
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo aceptar la discrepancia de zona.') });
    } finally {
      setBusy('');
      focusScanner();
    }
  };

  const removeReading = async (code) => {
    if (!sessionId || busy) return;
    const keyName = `remove:${sessionId}:${code}`;
    setBusy('remove');
    try {
      await retirarLecturaInventarioC66(sessionId, code, keyFor(keyName));
      clearKey(keyName);
      setFeedback({ severity: 'info', text: `Captura ${code} retirada; no se borró la manga.` });
      await loadState(sessionId);
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo retirar la captura.') });
    } finally {
      setBusy('');
      focusScanner();
    }
  };

  const closeSession = async (markMissing = false, requestReview = false) => {
    if (!sessionId || busy || sessionClosed) return;
    const keyName = `close:${sessionId}:${markMissing ? pendingCodes.join('|') : 'counted'}:${requestReview ? 'review' : 'no-review'}:${pieceCountEnabled ? (pieceCoverageReviewed ? 'complete' : 'partial') : (roomCovered ? 'complete' : 'partial')}`;
    setBusy('close');
    try {
      const result = await cerrarSesionInventarioC66(sessionId, markMissing
        ? { marcar_no_habidas: true, no_habidas: pendingCodes, ...(pieceCoverageReviewed ? { cobertura: true } : {}), ...(requestReview ? { solicitar_revision: true } : {}) }
        : (pieceCountEnabled
          ? { ...(pieceCoverageReviewed ? { cobertura: true } : {}), ...(requestReview ? { solicitar_revision: true } : {}) }
          : { ...(roomCovered ? { cobertura: true } : {}), ...(requestReview ? { solicitar_revision: true } : {}) }), keyFor(keyName));
      clearKey(keyName);
      setFeedback({ severity: 'success', text: `Recorrido cerrado · ${selectedZoneName} · ${result?.cantidad ?? activeSession?.lecturas?.length ?? 0} mangas. ${pieceCountEnabled ? 'No mueve kilos ni altera el Kardex.' : ''}` });
      resetSession();
      await loadState();
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error, 'No se pudo cerrar la sesión C66.') });
      if (error?.response?.status === 409) {
        clearKey(keyName);
        await loadState(sessionId);
      }
    } finally {
      setBusy('');
      focusScanner();
    }
  };

  if (loading && !state.zonas.length) {
    return <Stack spacing={2}><PageHeader title="Conteo C66" description="Conteo de mangas por zona, sin alterar el Kardex." /><Skeleton variant="rounded" height={260} /><Skeleton variant="rounded" height={180} /></Stack>;
  }

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ maxWidth: 1180, mx: 'auto' }}>
      <PageHeader
        title="Conteo C66"
        description="Recorre una zona, registra cada QR de manga y cierra el conteo conservando las diferencias para revisión."
        actions={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => loadState(sessionId || undefined)} disabled={loading || Boolean(busy)}>Actualizar estado</Button>}
      />
      {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => loadState(sessionId || undefined)}>Reintentar</Button>}>{loadError}</Alert>}
      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, .8fr)' }, gap: 2 }}>
        <Paper component="section" aria-labelledby="c66-task-title" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
              <Box><Typography id="c66-task-title" component="h2" variant="h6" fontWeight={850}>{sessionId ? sessionLabel(activeSession || { id: sessionId, nombre: sessionName, zona: zone }, state.zonas) : 'Nuevo conteo'}</Typography>{selectedScope.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{selectedScope.length <= 3 ? selectedScope.join(' · ') : `${selectedScope.length} piezas seleccionadas`}</Typography>}</Box>
              {sessionId && <Chip size="small" color={sessionClosed ? 'default' : 'success'} label={sessionClosed ? 'Cerrada' : 'En curso'} />}
            </Stack>
            {!sessionId && <TextField label="Nombre del conteo" value={sessionName} onChange={(event) => { clearSelectionKeys(); setSessionName(event.target.value); }} placeholder="Ej. Turno mañana" autoComplete="off" fullWidth />}
            <FormControl fullWidth disabled={sessionClosed}>
              <InputLabel id="c66-zone-label">Zona</InputLabel>
              <Select labelId="c66-zone-label" label="Zona" value={zone} disabled={sessionClosed} onChange={(event) => { clearSelectionKeys(); setZone(event.target.value); }}>
                <MenuItem value="" disabled>Selecciona la zona</MenuItem>
                {state.zonas.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
              </Select>
            </FormControl>
            {!sessionId && <C66PiecePicker options={pieceNames} value={selectedPieces} onChange={(next) => { clearSelectionKeys(); setSelectedPieces(next); }} />}
            {!sessionId && <Button variant="contained" size="large" startIcon={busy === 'open' ? <CircularProgress size={18} color="inherit" /> : <Inventory2OutlinedIcon />} onClick={createSession} disabled={!zone || (pieceCountEnabled && (!sessionName.trim() || !selectedPieces.length)) || Boolean(busy)}>{busy === 'open' ? 'Abriendo…' : pieceCountEnabled ? 'Iniciar conteo' : 'Iniciar sesión C66'}</Button>}
            {sessionId && !sessionClosed && <>
              <Divider />
              <form onSubmit={scanReading}>
                <Stack spacing={1.25}>
                  <TextField inputRef={scanRef} label="Escanear QR de manga" value={scanner} onChange={(event) => setScanner(event.target.value)} placeholder="C66-…" autoComplete="off" autoFocus fullWidth helperText="Lectura continua · Enter registra el código y devuelve el foco al lector." InputProps={{ startAdornment: <QrCodeScannerRoundedIcon color="action" sx={{ mr: 1 }} /> }} />
                  <Button type="submit" variant="contained" size="large" disabled={!scanner.trim() || Boolean(busy)}>{busy === 'read' ? 'Registrando…' : 'Registrar lectura'}</Button>
                </Stack>
              </form>
              {discrepancy && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={acceptDiscrepancy} disabled={Boolean(busy)}>Aceptar zona</Button>}>{discrepancy.message} QR {discrepancy.code} declara otra zona.</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
                {!pieceCountEnabled && <label><input type="checkbox" checked={roomCovered} onChange={(event) => setRoomCovered(event.target.checked)} /> Ya recorrí toda esta habitación</label>}
                <Button variant="outlined" color="primary" onClick={() => (pieceCountEnabled ? setCloseReviewOpen(true) : closeSession(false))} disabled={Boolean(busy)}>Cerrar sesión</Button>
              </Stack>
            </>}
            {sessionId && sessionClosed && <Button variant="outlined" onClick={resetSession}>Volver a sesiones</Button>}
            {closeReviewOpen && !sessionClosed && <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography component="h3" variant="subtitle1" fontWeight={800}>Mangas pendientes de localizar</Typography>
              {pendingCodes.length ? <Stack direction="row" flexWrap="wrap" gap={.75} sx={{ mt: 1 }}>{pendingCodes.slice(0, historyLimit).map((code) => <Chip key={code} label={code} size="small" color="warning" variant="outlined" />)}{pendingCodes.length > historyLimit && <Button size="small" onClick={() => setHistoryLimit((current) => current + 50)}>Mostrar siguientes 50 ({pendingCodes.length - historyLimit} restantes)</Button>}</Stack> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No quedan mangas pendientes; el cierre conservará solo lo contado.</Typography>}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Cerrar no mueve kilos ni altera el Kardex.</Typography>
              <FormControlLabel control={<Checkbox checked={pieceCoverageReviewed} onChange={(event) => setPieceCoverageReviewed(event.target.checked)} />} label={`Recorrí por completo ${activeSessionZoneName} para las piezas seleccionadas`} />
              <Typography variant="caption" color="text.secondary" display="block">Sin marcar la casilla, el cierre conserva las no habidas como pendientes de cobertura.</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}><Button variant="outlined" onClick={() => closeSession(false)} disabled={Boolean(busy)}>Cerrar solo lo contado</Button><Button variant="outlined" color="secondary" onClick={() => closeSession(false, true)} disabled={Boolean(busy)}>Solicitar revisión</Button><Button variant="contained" onClick={() => closeSession(true)} disabled={Boolean(busy) || !pendingCodes.length}>Cerrar y marcar {pendingCodes.length} no habida{pendingCodes.length === 1 ? '' : 's'}</Button></Stack>
            </Paper>}
          </Stack>
        </Paper>
        <Stack spacing={2}>
          {sessionId && <Paper component="section" aria-labelledby="c66-readings-title" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography id="c66-readings-title" component="h2" variant="subtitle1" fontWeight={850}>Lecturas registradas</Typography>
            {!activeSession?.lecturas?.length ? <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Aún no hay lecturas en este conteo.</Typography> : <Stack component="ul" spacing={.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>{activeSession.lecturas.slice(0, sessionClosed ? historyLimit : undefined).map((reading) => <Stack component="li" direction="row" justifyContent="space-between" alignItems="center" gap={1} key={reading.codigo}><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{reading.codigo}</Typography><Typography variant="caption" color="text.secondary" display="block">{articleForReading(reading)} · {zoneForReading(reading)}</Typography></Box>{!sessionClosed && <Button aria-label={`Retirar captura ${reading.codigo}`} size="small" color="inherit" onClick={() => removeReading(reading.codigo)} disabled={Boolean(busy)}><DeleteOutlineRoundedIcon fontSize="small" /></Button>}</Stack>)}{sessionClosed && activeSession.lecturas.length > historyLimit && <Button size="small" onClick={() => setHistoryLimit((current) => current + 50)}>Mostrar siguientes 50 ({activeSession.lecturas.length - historyLimit} restantes)</Button>}</Stack>}
            {sessionClosed && pendingCodes.length > 0 && <Box sx={{ mt: 2 }}><Typography component="h3" variant="subtitle2" fontWeight={800}>Pendientes al cerrar</Typography><Stack component="ul" spacing={.5} sx={{ listStyle: 'none', p: 0, m: 0, mt: .75 }}>{pendingCodes.slice(0, historyLimit).map((code) => <Typography component="li" variant="body2" key={code} sx={{ overflowWrap: 'anywhere' }}>{code}</Typography>)}{pendingCodes.length > historyLimit && <Button size="small" onClick={() => setHistoryLimit((current) => current + 50)}>Mostrar siguientes 50 ({pendingCodes.length - historyLimit} restantes)</Button>}</Stack></Box>}
            {sessionClosed && Array.isArray(activeSession.no_habidas) && activeSession.no_habidas.length > 0 && <Box sx={{ mt: 2 }}><Typography component="h3" variant="subtitle2" fontWeight={800}>Mangas no habidas</Typography><Stack component="ul" spacing={.5} sx={{ listStyle: 'none', p: 0, m: 0, mt: .75 }}>{activeSession.no_habidas.slice(0, historyLimit).map((code) => <Typography component="li" variant="body2" key={code} sx={{ overflowWrap: 'anywhere' }}>{code}</Typography>)}{activeSession.no_habidas.length > historyLimit && <Button size="small" onClick={() => setHistoryLimit((current) => current + 50)}>Mostrar siguientes 50 ({activeSession.no_habidas.length - historyLimit} restantes)</Button>}</Stack></Box>}
          </Paper>}
          <Paper component="section" aria-labelledby="c66-sessions-title" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography id="c66-sessions-title" component="h2" variant="subtitle1" fontWeight={850}>Sesiones C66</Typography>
            {!openSessions.length && !closedSessions.length && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No hay sesiones para retomar.</Typography>}
            {openSessions.length > 0 && <><Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 1 }}>En curso</Typography><Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>{openSessions.map((session) => <Box component="li" key={session.id}><Button fullWidth sx={{ justifyContent: 'space-between', textAlign: 'left', px: 0 }} onClick={() => resumeSession(session)} disabled={Boolean(busy)}><span>{sessionLabel(session, state.zonas)}</span><span>{busy === 'session' ? 'Cargando…' : 'Reanudar'}</span></Button></Box>)}</Stack></>}
            {closedSessions.length > 0 && <><Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 1 }}>Cerradas</Typography><TextField size="small" label="Buscar sesión cerrada" value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} placeholder="Nombre o zona" fullWidth sx={{ mt: .5, mb: .5 }} /><Box sx={{ maxHeight: 280, overflowY: 'auto' }}><Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>{filteredClosedSessions.map((session) => <Box component="li" key={session.id}><Button fullWidth sx={{ justifyContent: 'space-between', textAlign: 'left', px: 0 }} onClick={() => resumeSession(session)} disabled={Boolean(busy)}><span>{sessionLabel(session, state.zonas)}</span><span>{busy === 'session' ? 'Cargando…' : 'Consultar'}</span></Button></Box>)}</Stack>{!filteredClosedSessions.length && <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No hay sesiones con ese nombre o zona.</Typography>}</Box></>}
          </Paper>
          <Alert icon={<CheckCircleOutlineRoundedIcon />} severity="info">El conteo C66 registra presencia física por QR. No mueve kilos ni altera el Kardex.</Alert>
        </Stack>
      </Box>
    </Stack>
  );
}
