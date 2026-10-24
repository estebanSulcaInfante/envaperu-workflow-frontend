import { useMemo, useRef, useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import { ejecutarControlOfScm, obtenerImpactoEjecucionOfScm } from '../services/scmOtApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

const actionLabel = { PAUSAR: 'Pausar ejecución', REANUDAR: 'Reanudar ejecución', CANCELAR: 'Cancelar ejecución' };
const terminalStateForAction = { PAUSAR: 'PAUSADA', REANUDAR: 'EN_EJECUCION', CANCELAR: 'CANCELADA' };
const cancelableOrderStates = ['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION', 'PAUSADA'];
const executionDescription = {
  PAUSAR: 'La OF conserva producido e histórico; pausa únicamente trabajos propios ejecutables.',
  REANUDAR: 'La OF conserva producido e histórico; reanuda únicamente trabajos pausados por esta OF.',
  CANCELAR: 'La OF conserva producido e histórico, cancela pendientes propios y libera el compromiso residual de demanda cuando exista.',
};

const producedLabel = (item) => {
  if (item?.cantidad_real === null || item?.cantidad_real === undefined) return 'dato no confirmado';
  return `${item.cantidad_real}${item.unidad ? ` ${item.unidad}` : ''}`;
};

const observedState = (impact) => impact?.of?.estado || impact?.estado || '';

const confirmationMessage = (result, action) => {
  const currentState = observedState(result) || observedState(result?.impact) || terminalStateForAction[action];
  return currentState
    ? `Cambio confirmado por Central. Estado confirmado: ${currentState}.`
    : 'Cambio confirmado por Central.';
};

const emptyAttempt = () => ({
  action: '',
  reason: '',
  key: '',
  order: null,
  payload: null,
  uncertain: false,
});

const snapshotOrder = (order) => Object.freeze({ ...(order || {}) });

const snapshotAttempt = ({ order, action, reason, key, payload = null, uncertain = false }) => Object.freeze({
  order: snapshotOrder(order),
  action,
  reason,
  key,
  payload: payload ? Object.freeze({ ...payload }) : null,
  uncertain,
});

export default function ExecutionControlDialog({ open, order, canPause, canCancel, onClose, onCompleted }) {
  const [action, setAction] = useState('');
  const [impact, setImpact] = useState(null);
  const [reason, setReason] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [operationId, setOperationId] = useState('');
  const [successMessage, setSuccessMessage] = useState('Cambio confirmado por Central.');
  const [uncertainSnapshot, setUncertainSnapshot] = useState(null);
  const requestSequence = useRef(0);
  const attempt = useRef(emptyAttempt());

  const actions = useMemo(() => ([
    ...(canPause && order?.estado === 'EN_EJECUCION' ? ['PAUSAR'] : []),
    ...(canPause && order?.estado === 'PAUSADA' ? ['REANUDAR'] : []),
    ...(canCancel && cancelableOrderStates.includes(order?.estado) ? ['CANCELAR'] : []),
  ]), [canCancel, canPause, order]);

  const inspect = async (next, { authoritative = false, notice = '', preserveReason } = {}) => {
    const uncertainAttempt = attempt.current.uncertain ? attempt.current : null;
    if (uncertainAttempt && next !== uncertainAttempt.action) return;
    const sequence = ++requestSequence.current;

    if (authoritative && uncertainAttempt && next === uncertainAttempt.action) {
      setImpact(null);
      setError('');
      setState('resolving');
      try {
        const nextImpact = await obtenerImpactoEjecucionOfScm(uncertainAttempt.order.id, uncertainAttempt.action);
        if (sequence !== requestSequence.current) return;
        const currentState = observedState(nextImpact);
        if (currentState === terminalStateForAction[uncertainAttempt.action]) {
          attempt.current = snapshotAttempt({ ...uncertainAttempt, uncertain: false });
          setUncertainSnapshot(null);
          setOperationId(uncertainAttempt.key);
          setImpact(null);
          setSuccessMessage(`Estado actual confirmado por Central: ${currentState}.`);
          setState('success');
          onCompleted?.({ ...nextImpact, action: uncertainAttempt.action });
        } else {
          setImpact(nextImpact);
          setError(`Central aún muestra ${currentState || 'un estado distinto'}; no se recibió confirmación de esta intención. Reintenta la misma acción para conciliarla.`);
          setState('uncertain');
        }
      } catch (requestError) {
        if (sequence !== requestSequence.current) return;
        const detail = mensajeErrorScm(requestError, 'La consulta autoritativa falló.');
        setError(`No se pudo confirmar si se aplicó. Revisa la conexión e intenta revisar el estado otra vez; se conservará la misma intención. ${detail}`);
        setState('uncertain');
      }
      return;
    }

    const key = crypto.randomUUID();
    const retainedReason = preserveReason ?? (next === action ? reason : '');
    const nextAttempt = snapshotAttempt({ order, action: next, reason: retainedReason, key });
    setAction(next);
    setOperationId(key);
    setReason(retainedReason);
    setImpact(null);
    setError(notice);
    setSuccessMessage('Cambio confirmado por Central.');
    setUncertainSnapshot(null);
    setState('loading');
    attempt.current = nextAttempt;
    try {
      const nextImpact = await obtenerImpactoEjecucionOfScm(nextAttempt.order.id, nextAttempt.action);
      if (sequence !== requestSequence.current) return;
      setImpact(nextImpact);
      setState('ready');
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      const detail = mensajeErrorScm(requestError, 'No se pudo consultar el impacto.');
      setError(notice ? `${notice} ${detail}` : detail);
      setState('error');
    }
  };

  const submit = async () => {
    const uncertainAttempt = attempt.current.uncertain ? attempt.current : null;
    if (uncertainAttempt) {
      setState('submitting');
      setError('');
      try {
        const result = await ejecutarControlOfScm(
          uncertainAttempt.order,
          uncertainAttempt.action,
          uncertainAttempt.payload,
          uncertainAttempt.key,
        );
        attempt.current = snapshotAttempt({ ...uncertainAttempt, uncertain: false });
        setUncertainSnapshot(null);
        setOperationId(uncertainAttempt.key);
        setImpact(null);
        setSuccessMessage(confirmationMessage(result, uncertainAttempt.action));
        setState('success');
        onCompleted?.(result);
      } catch (requestError) {
        const detail = requestError?.response
          ? mensajeErrorScm(requestError, 'No se pudo completar el reintento.')
          : mensajeErrorScm(requestError, 'La red no confirmó la respuesta.');
        attempt.current = uncertainAttempt;
        setUncertainSnapshot(uncertainAttempt);
        setError(`No se pudo confirmar si se aplicó. La misma intención sigue protegida; ${detail}`);
        setState('uncertain');
      }
      return;
    }

    if (!impact?.can_execute || !reason.trim() || !action) return;
    const trimmedReason = reason.trim();
    const payload = Object.freeze({
      version: impact.version,
      impact_hash: impact.impact_hash,
      motivo: trimmedReason,
    });
    const operation = snapshotAttempt({ order, action, reason: trimmedReason, key: operationId, payload });
    attempt.current = operation;
    setState('submitting');
    setError('');
    try {
      const result = await ejecutarControlOfScm(
        operation.order,
        operation.action,
        operation.payload,
        operation.key,
      );
      attempt.current = snapshotAttempt({ ...operation, uncertain: false });
      setUncertainSnapshot(null);
      setImpact(null);
      setSuccessMessage(confirmationMessage(result, operation.action));
      setState('success');
      onCompleted?.(result);
    } catch (requestError) {
      const code = requestError?.response?.data?.error?.code
        || requestError?.response?.data?.code
        || requestError?.code;
      if (code === 'STALE_VERSION' || code === 'STALE_IMPACT') {
        await inspect(operation.action, {
          notice: 'La OF cambió mientras confirmabas. Se recargó el impacto; confirma de nuevo.',
          preserveReason: operation.reason,
        });
        return;
      }
      const uncertain = !requestError?.response;
      if (uncertain) {
        const uncertainOperation = snapshotAttempt({ ...operation, uncertain: true });
        attempt.current = uncertainOperation;
        setUncertainSnapshot(uncertainOperation);
        setError('No se pudo confirmar si se aplicó. Revisa el estado antes de reintentar; se conservará la misma intención y no debes cerrar esta pestaña.');
        setState('uncertain');
      } else {
        attempt.current = operation;
        setUncertainSnapshot(null);
        setError(mensajeErrorScm(requestError, 'No se aplicó el cambio. Revisa el impacto y reintenta con la misma intención.'));
        setState('ready');
      }
    }
  };

  const uncertain = Boolean(uncertainSnapshot);
  const uncertaintyLocked = uncertain && ['uncertain', 'resolving', 'submitting'].includes(state);
  const closeLocked = state === 'submitting' || uncertaintyLocked;
  const completed = state === 'success';
  const canSubmit = uncertaintyLocked
    ? Boolean(uncertainSnapshot.payload)
    : Boolean(impact?.can_execute && reason.trim());
  const handleClose = (event) => {
    if (closeLocked) {
      event?.preventDefault?.();
      return;
    }
    onClose?.();
  };

  return <Dialog
    open={open}
    onClose={handleClose}
    disableEscapeKeyDown={closeLocked}
    fullWidth
    maxWidth="sm"
    aria-labelledby="execution-control-title"
    aria-describedby="execution-control-description"
  >
    <DialogTitle id="execution-control-title">Gestionar ejecución · {order?.codigo}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Typography id="execution-control-description" variant="body2">{executionDescription[action] || 'La OF conserva producido e histórico; selecciona una acción para consultar su impacto.'}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{actions.map((item) => <Button
        key={item}
        variant={action === item ? 'contained' : 'outlined'}
        color={item === 'CANCELAR' ? 'error' : 'primary'}
        onClick={() => (uncertaintyLocked && item === action ? submit() : inspect(item))}
        disabled={state === 'submitting' || state === 'resolving' || completed || (uncertaintyLocked && item !== action)}
      >{actionLabel[item]}</Button>)}</Stack>
      {state === 'loading' && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /> <Typography variant="body2">Consultando impacto vigente…</Typography></Stack>}
      {state === 'resolving' && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /> <Typography variant="body2">Revisando estado autoritativo…</Typography></Stack>}
      {completed && <Alert severity="success"><Typography variant="body2">{successMessage}</Typography></Alert>}
      {!completed && impact && <Alert severity={impact.can_execute ? 'info' : 'warning'}><Typography variant="body2"><strong>{impact.trabajos?.afectados ?? 0}</strong> trabajos afectados · {impact.mangas_abiertas || 0} mangas abiertas · {impact.reservas_activas || 0} reservas activas.</Typography>{impact.producido?.length > 0 && <Typography variant="body2">Producido conservado: {impact.producido.map(producedLabel).join(' · ')}</Typography>}{impact.compromisos_residuales?.length > 0 && <Typography variant="body2">Compromiso residual: {impact.compromisos_residuales.map((item) => `${item.cantidad}${item.unidad ? ` ${item.unidad}` : ''}`).join(' · ')}</Typography>}{!impact.can_execute && <Stack component="ul" sx={{ mb: 0, pl: 2 }}>{(impact.blockers || []).map((blocker) => <li key={blocker.code}><strong>{blocker.code}</strong>: {blocker.message}{blocker.recovery ? ` ${blocker.recovery}` : ''}</li>)}</Stack>}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {uncertaintyLocked && <Button variant="outlined" onClick={() => inspect(action, { authoritative: true })} disabled={state === 'resolving' || state === 'submitting'}>Revisar estado autoritativo</Button>}
      <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} required multiline minRows={2} inputProps={{ maxLength: 500 }} helperText="Obligatorio para auditar y reintentar una respuesta incierta." disabled={!impact?.can_execute || uncertaintyLocked || state === 'submitting' || completed} />
    </Stack></DialogContent>
    <DialogActions><Button onClick={handleClose} disabled={closeLocked}>Cerrar</Button><Button variant="contained" color={action === 'CANCELAR' ? 'error' : 'primary'} onClick={submit} disabled={!canSubmit || state === 'submitting' || state === 'resolving' || completed}>{state === 'submitting' ? 'Enviando…' : completed ? 'Confirmado' : action ? actionLabel[action] : 'Confirmar'}</Button></DialogActions>
  </Dialog>;
}
