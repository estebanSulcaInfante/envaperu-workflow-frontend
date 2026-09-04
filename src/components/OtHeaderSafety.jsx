import { useRef, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import { anularOtScm } from '../services/scmOtApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

export function OtCreationReview({ form, machine, worker, disabled, onConfirm, onRefresh }) {
  const [review, setReview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const sendingRef = useRef(false);
  const confirm = async () => {
    if (sendingRef.current || !review) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      await onConfirm(review.form, review.operationId);
      setReview(null);
    } catch (failure) {
      setUncertain(!failure.response || failure.response.status >= 500);
      setError(mensajeErrorScm(failure, 'No se confirmó la creación. Reintenta sin cambiar los datos; se conserva la misma operación.'));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  return <>
    <Button variant="contained" disabled={disabled} onClick={() => {
      setError('');
      setUncertain(false);
      setReview({ form: { ...form }, machine, worker, operationId: crypto.randomUUID() });
    }}>Crear OT de máquina</Button>
    <Dialog open={Boolean(review)} onClose={() => !sending && !uncertain && setReview(null)} fullWidth maxWidth="sm" aria-labelledby="ot-create-review-title">
      <DialogTitle id="ot-create-review-title">Revisar nueva OT</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity={uncertain ? 'warning' : 'info'}>{uncertain
          ? 'No conocemos el resultado del envío. Reintenta la misma operación o consulta las jornadas antes de crear otra.'
          : 'Revisa la jornada antes de confirmar. Abrir esta revisión no crea la OT.'}</Alert>
        <Typography><strong>Máquina:</strong> {review?.machine || 'Sin seleccionar'}</Typography>
        <Typography><strong>Fecha:</strong> {review?.form.fecha_operativa} · <strong>Turno:</strong> {review?.form.turno}</Typography>
        <Typography><strong>Maquinista predeterminado:</strong> {review?.worker || 'Sin asignar'}</Typography>
        <Typography variant="body2">Los trabajos de color se agregan después. Este maquinista es una propuesta, no una asignación para toda la jornada.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions>
        <Button autoFocus disabled={sending || uncertain} onClick={() => setReview(null)}>Volver</Button>
        {uncertain && onRefresh && <Button disabled={sending} onClick={async () => {
          try { await onRefresh(); setReview(null); setUncertain(false); }
          catch { setError('No se pudieron consultar las jornadas. Reintenta cuando Central esté disponible.'); }
        }}>Consultar jornadas</Button>}
        <Button variant="contained" disabled={sending || !review?.form.maquina_id || !review?.form.fecha_operativa || !review?.form.turno} onClick={confirm}>
          {sending ? 'Creando…' : 'Confirmar creación'}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}

export function OtAnnulmentAction({ ot, allowed, onSuccess, onRefresh }) {
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const sendingRef = useRef(false);
  const intentRef = useRef(null);
  const blocker = ot.bloqueo_anulacion
    || (ot.estado !== 'PLANIFICADA' ? 'La OT debe estar planificada y no iniciada.' : null)
    || (ot.trabajos_color?.length || ot.mangas?.length ? 'La OT tiene trabajos o mangas vinculados.' : null);
  const confirm = async () => {
    if (sendingRef.current || !review || !reason.trim() || conflict) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    const payload = { version: review.version, motivo: reason.trim() };
    if (!intentRef.current || JSON.stringify(intentRef.current.payload) !== JSON.stringify(payload)) {
      intentRef.current = { payload, key: crypto.randomUUID() };
    }
    try {
      const result = await anularOtScm(review.public_id, intentRef.current.payload, intentRef.current.key);
      setReview(null);
      setUncertain(false);
      intentRef.current = null;
      await onSuccess(result.ot);
    } catch (failure) {
      setConflict(failure.response?.status === 409 || failure.response?.status === 403);
      setUncertain(!failure.response || failure.response.status >= 500);
      setError(mensajeErrorScm(failure, 'No se confirmó la anulación. Reintenta la misma operación o consulta el estado antes de volver a decidir.'));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  if (ot.estado === 'ANULADA') return <Alert severity="info" sx={{ mt: 2 }}>
    <strong>{ot.codigo_ot} anulada. Su historial se conserva.</strong>
    {ot.anulacion && <Typography variant="body2">
      Motivo: {ot.anulacion.motivo} · Responsable: {ot.anulacion.actor?.nombre || ot.anulacion.actor?.codigo || ot.anulacion.actor?.id} · Fecha: {ot.anulacion.fecha}
    </Typography>}
  </Alert>;
  if (!allowed) return null;
  return <Stack spacing={1} sx={{ mt: 2, alignItems: 'flex-start' }}>
    <Button color="error" variant="outlined" disabled={Boolean(blocker)} onClick={() => {
      setReview({ ...ot }); setReason(''); setError(''); setConflict(false); setUncertain(false); intentRef.current = null;
    }}>Anular OT</Button>
    {blocker && <Typography variant="body2" color="text.secondary">No se puede anular: {blocker}</Typography>}
    <Dialog open={Boolean(review)} onClose={() => !sending && !uncertain && setReview(null)} fullWidth maxWidth="sm" aria-labelledby="ot-annul-title">
      <DialogTitle id="ot-annul-title">Anular OT vacía</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="h6">{review?.codigo_ot} · {review?.maquina_codigo || review?.maquina}</Typography>
        <Typography>{review?.fecha_operativa} · Turno {review?.turno}</Typography>
        <Alert severity="warning">Solo se anula esta OT vacía. Se conserva su código e historial; no podrá iniciarse ni recibir trabajos. No se anulan otras órdenes.</Alert>
        <TextField autoFocus required fullWidth multiline minRows={2} label="Motivo de anulación" value={reason} disabled={sending || uncertain || conflict} inputProps={{ maxLength: 250 }} onChange={(event) => setReason(event.target.value)} helperText="Obligatorio. Explica por qué se creó por error." />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions>
        <Button disabled={sending || uncertain} onClick={() => setReview(null)}>Volver</Button>
        {(conflict || uncertain) && <Button disabled={sending} onClick={async () => {
          try { await onRefresh(); setReview(null); setUncertain(false); }
          catch { setError('No se pudo consultar el estado. Reintenta cuando Central esté disponible.'); }
        }}>Consultar estado</Button>}
        <Button color="error" variant="contained" disabled={sending || conflict || !reason.trim()} onClick={confirm}>
          {sending ? 'Anulando…' : uncertain ? 'Reintentar anulación' : 'Anular OT'}
        </Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
