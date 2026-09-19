import { useRef, useState, useEffect } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useScmActor } from '../context/ScmActorContext';
import { cerrarMangaDesdeControlScm } from '../services/scmOtApi';

export default function CloseKgControlAction({ manga, onClosed }) {
  const { actorId } = useScmActor();
  const storageKey = `scm-kg-close:${actorId}:${manga.public_id}`;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState(null);
  const flight = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      setIntent(saved);
      if (saved) { setReason(saved.payload.motivo); setOpen(true); }
    } catch { setError('No se pudo recuperar la solicitud guardada. Revisa el historial antes de continuar.'); }
  }, [storageKey]);
  const submit = async () => {
    if (flight.current || !reason.trim()) return;
    const request = intent || { key: crypto.randomUUID(), payload: { version: manga.version, motivo: reason.trim() } };
    flight.current = true; setBusy(true); setIntent(request); setError('');
    try {
      const sentRequest = { ...request, sent: true };
      sessionStorage.setItem(storageKey, JSON.stringify(sentRequest));
      setIntent(sentRequest);
      await cerrarMangaDesdeControlScm(manga.public_id, request.payload, request.key);
      sessionStorage.removeItem(storageKey);
      setOpen(false); setIntent(null); setReason('');
      setConfirmed(true);
      try { await onClosed(); }
      catch { setError('Cierre confirmado. Actualiza la consulta para ver el estado nuevo; no repitas el cierre.'); }
    } catch (e) {
      const status = e.response?.status;
      if (!request.sent && status >= 400 && status < 500 && ![408, 429].includes(status) && e.response?.data?.error?.code !== 'IDEMPOTENCY_OPERATION_INCOMPLETE') { sessionStorage.removeItem(storageKey); setIntent(null); }
      setError(e.response?.data?.error?.message || 'No se pudo confirmar el resultado. Reintenta con la misma solicitud.');
    } finally { flight.current = false; setBusy(false); }
  };
  return <>
    {confirmed ? <Alert severity={error ? 'warning' : 'success'}>{error || 'Manga cerrada desde su último control.'}</Alert> : <Button size="small" onClick={() => setOpen(true)}>Cerrar desde último control</Button>}
    <Dialog open={open} onClose={() => { if (!busy && !intent) setOpen(false); }} fullWidth maxWidth="sm">
      <DialogTitle>Cerrar {manga.codigo} desde su último control</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography>Se termina esta manga con los kg del último control registrado. Conserva su QR y el stock ya medido. No registra otro pesaje ni pide unidades.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Motivo del cierre" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy || !!intent} required multiline />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy || !!intent} onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" disabled={busy || !reason.trim()} onClick={submit}>{intent ? 'Reintentar cierre' : 'Confirmar cierre'}</Button></DialogActions>
    </Dialog>
  </>;
}
