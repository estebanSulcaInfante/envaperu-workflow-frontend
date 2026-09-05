import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

const outputSummary = (order) => (order?.corridas || []).flatMap((run) => (
  (run.salidas || []).map((output) => ({
    color: run.color_nombre || run.color || `Color ${run.color_produccion_id || ''}`,
    articulo: output.articulo?.nombre || output.articulo?.codigo || 'Artículo',
    cantidad: output.cantidad_objetivo,
    kg: output.kg_estandar_objetivo,
  }))
));

export default function FabricationOrderReplacement({
  order,
  allowed,
  disabled,
  onSubmit,
  onSuccess,
  onReview,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewedOrder, setReviewedOrder] = useState(null);
  const [operationId, setOperationId] = useState(null);
  const [reviewReady, setReviewReady] = useState(false);

  if (!order || !allowed || order.estado !== 'LIBERADA' || order.reemplazo) return null;
  if (order.reemplazo_disponibilidad?.permitido === false) {
    return <Alert severity="info">No se puede reemplazar esta OF: {order.reemplazo_disponibilidad.motivo}</Alert>;
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await onSubmit(reviewedOrder, reason.trim(), operationId);
      setOpen(false);
      await onSuccess?.(result);
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se pudo preparar el reemplazo. Vuelva y actualice la orden antes de reintentar.',
      ));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Button
      color="warning"
      variant="outlined"
      disabled={disabled}
      onClick={async () => {
        setReviewedOrder(order);
        setOperationId(crypto.randomUUID());
        setError('');
        setOpen(true);
        setReviewReady(!onReview);
        if (onReview) {
          setBusy(true);
          try {
            const current = await onReview(order.id);
            setReviewedOrder(current);
            const ready = current.estado === 'LIBERADA'
              && current.reemplazo_disponibilidad?.permitido === true;
            setReviewReady(ready);
            if (!ready) setError(current.reemplazo_disponibilidad?.motivo || 'La OF ya no admite reemplazo. Actualiza la vista.');
          } catch (requestError) {
            setError(mensajeErrorScm(requestError, 'No se pudo verificar la OF. Vuelve y reintenta la revisión.'));
          } finally {
            setBusy(false);
          }
        }
      }}
    >
      Reemplazar OF
    </Button>
    <Dialog
      open={open}
      onClose={() => { if (!busy) setOpen(false); }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="replace-of-title"
    >
      <DialogTitle id="replace-of-title">
        Revisar reemplazo {reviewedOrder?.codigo}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography>
            La OF anterior quedará anulada y se preparará una nueva OF en borrador.
            El plan confirmado y las órdenes de armado no cambian.
          </Typography>
          <Typography variant="body2">
            OP de origen: {reviewedOrder?.procedencia?.op_codigo || 'No disponible'}
          </Typography>
          {outputSummary(reviewedOrder).map((item, index) => (
            <Typography variant="body2" key={`${item.articulo}-${index}`}>
              {item.color} · {item.articulo} · kg teóricos {item.kg || '—'} · unidades objetivo (referencia): {item.cantidad}
            </Typography>
          ))}
          <Alert severity="info">
            Mismo objetivo; nueva OF en borrador; no modifica OA ni órdenes en ejecución.
            La receta aprobada se selecciona explícitamente antes de liberar.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="Motivo de reemplazo"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setOperationId(crypto.randomUUID());
            }}
            disabled={busy}
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            helperText="Obligatorio para conservar la trazabilidad de la decisión."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setOpen(false)}>Volver</Button>
        <Button
          color="warning"
          variant="contained"
          disabled={busy || !reviewReady || !reason.trim()}
          onClick={submit}
        >
          {busy ? 'Preparando…' : 'Confirmar reemplazo'}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}
