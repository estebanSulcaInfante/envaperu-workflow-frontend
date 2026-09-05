import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

export default function DraftOrderAnnulment({ order, allowed, disabled, onSubmit, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewedOrder, setReviewedOrder] = useState(null);
  if (!order) return null;
  if (order.estado === 'ANULADA') {
    return <Alert severity="info">
      Anulada · {order.anulacion?.motivo || 'Consultar historial de auditoría'}
      {order.anulacion?.fecha && ` · ${new Date(order.anulacion.fecha).toLocaleString('es-PE')}`}
      {order.anulacion?.actor_id && ` · ${order.anulacion.actor?.nombre || `Responsable #${order.anulacion.actor_id}`}`}
    </Alert>;
  }
  if (!allowed || order.estado !== 'BORRADOR') return null;
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit(reviewedOrder, reason.trim());
      setOpen(false);
      await onSuccess?.();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo anular. Vuelva y actualice la orden antes de reintentar.'));
    } finally {
      setBusy(false);
    }
  };
  return <>
    <Button color="error" variant="outlined" disabled={disabled} onClick={() => { setReviewedOrder(order); setReason(''); setError(''); setOpen(true); }}>
      Anular borrador
    </Button>
    <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} fullWidth maxWidth="sm" aria-labelledby="annul-draft-title">
      <DialogTitle id="annul-draft-title">Anular {reviewedOrder?.codigo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>Se conservarán el documento, su código y el historial. Esta acción no se puede deshacer desde esta vista.</Typography>
          <Typography>Se liberarán sus asignaciones de demanda. Las otras órdenes no cambian y el plan de la OP no se recalcula automáticamente.</Typography>
          <Typography variant="body2">Solo procede si sigue en borrador y no tiene actividad vinculada. Los cambios del formulario sin guardar no se aplicarán.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField autoFocus label="Motivo de anulación" value={reason} onChange={(event) => setReason(event.target.value)}
            disabled={busy} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setOpen(false)}>Volver</Button>
        <Button color="error" variant="contained" disabled={busy || !reason.trim()} onClick={submit}>
          {busy ? 'Anulando…' : 'Confirmar anulación'}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}
