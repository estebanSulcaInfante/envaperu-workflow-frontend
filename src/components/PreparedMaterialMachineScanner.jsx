import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, Paper,
  Stack, TextField, Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { useScmActor } from '../context/ScmActorContext';
import {
  confirmarRecepcionMaterialPreparadoQr,
  resolverRecepcionMaterialPreparadoQr,
} from '../services/opmPreparationApi';

const CONTEXT_TTL_MS = 5 * 60 * 1000;
const machinePattern = /^SCM:MAQUINA:[^:]{1,20}:V1$/;
const messageOf = (error) => error?.response?.data?.error?.message
  || error?.message || 'No se pudo completar la operación.';

export default function PreparedMaterialMachineScanner() {
  const { can } = useScmActor();
  const machineRef = useRef(null);
  const bagRef = useRef(null);
  const [machineQr, setMachineQr] = useState('');
  const [machineLocked, setMachineLocked] = useState(false);
  const [bagQr, setBagQr] = useState('');
  const [resolved, setResolved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => { machineRef.current?.focus(); }, []);
  useEffect(() => {
    if (!machineLocked) return undefined;
    const timer = globalThis.setInterval(() => {
      if (Date.now() - lastActivity >= CONTEXT_TTL_MS) {
        setMachineLocked(false);
        setMachineQr('');
        setBagQr('');
        setResolved(null);
        setSuccess('');
        setError('El contexto de máquina venció por inactividad. Escanea la placa nuevamente.');
        globalThis.setTimeout(() => machineRef.current?.focus(), 0);
      }
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [lastActivity, machineLocked]);

  const lockMachine = () => {
    const normalized = machineQr.trim();
    setError('');
    setSuccess('');
    if (!machinePattern.test(normalized)) {
      setError('El QR de máquina no tiene el formato SCM:MAQUINA:{código}:V1.');
      machineRef.current?.focus();
      return;
    }
    setMachineQr(normalized);
    setMachineLocked(true);
    setLastActivity(Date.now());
    globalThis.setTimeout(() => bagRef.current?.focus(), 0);
  };

  const resolveBag = async () => {
    const normalized = bagQr.trim();
    if (!machineLocked || !normalized) return;
    setBusy(true);
    setError('');
    setSuccess('');
    setResolved(null);
    try {
      const payload = await resolverRecepcionMaterialPreparadoQr({
        maquina_qr: machineQr,
        bolsa_qr: normalized,
      });
      setBagQr(normalized);
      setResolved(payload);
      setLastActivity(Date.now());
    } catch (requestError) {
      setError(messageOf(requestError));
      setBagQr('');
      globalThis.setTimeout(() => bagRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action) => {
    if (!resolved) return;
    setBusy(true);
    setError('');
    try {
      const payload = await confirmarRecepcionMaterialPreparadoQr({
        maquina_qr: machineQr,
        bolsa_qr: bagQr,
        entrega_id: resolved.entrega.id,
        expected_version: resolved.entrega.version,
        accion: action,
        motivo: action === 'RECIBIR'
          ? 'Recepción física confirmada con lector compartido'
          : 'Recepción y consumo inmediato confirmados con lector compartido',
      });
      setSuccess(action === 'RECIBIR'
        ? `${payload.reserva.bolsa.codigo} recibida en ${resolved.maquina.codigo}.`
        : `${payload.reserva.bolsa.codigo} recibida y consumida en ${resolved.maquina.codigo}.`);
      setBagQr('');
      setResolved(null);
      setLastActivity(Date.now());
      globalThis.setTimeout(() => bagRef.current?.focus(), 0);
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  };

  const changeMachine = () => {
    setMachineLocked(false);
    setMachineQr('');
    setBagQr('');
    setResolved(null);
    setError('');
    setSuccess('');
    globalThis.setTimeout(() => machineRef.current?.focus(), 0);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Recepción de material en máquina</Typography>
          <Typography color="text.secondary">
            Usa el lector compartido: primero la placa fija de la máquina y luego el QR de la bolsa.
          </Typography>
        </Box>
        {!can('MATERIAL_PREPARADO_RECIBIR_MAQUINA') && (
          <Alert severity="warning">Tu perfil no puede confirmar recepciones de material preparado.</Alert>
        )}
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        {success && <Alert severity="success" role="status">{success}</Alert>}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
              <TextField
                inputRef={machineRef}
                fullWidth
                label="1. QR de máquina"
                value={machineQr}
                disabled={machineLocked || busy}
                placeholder="SCM:MAQUINA:INY-01:V1"
                onChange={(event) => setMachineQr(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); lockMachine(); }
                }}
                slotProps={{ input: { startAdornment: <PrecisionManufacturingIcon sx={{ mr: 1 }} /> } }}
              />
              {machineLocked && (
                <Button variant="outlined" onClick={changeMachine}>Cambiar máquina</Button>
              )}
            </Stack>
            <TextField
              inputRef={bagRef}
              fullWidth
              label="2. QR o código de bolsa"
              value={bagQr}
              disabled={!machineLocked || busy}
              placeholder="BMP-..."
              onChange={(event) => setBagQr(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); resolveBag(); }
              }}
              slotProps={{ input: { startAdornment: <QrCodeScannerIcon sx={{ mr: 1 }} /> } }}
              helperText={machineLocked
                ? 'Escanea la bolsa y presiona Enter. La máquina se conserva para la siguiente bolsa.'
                : 'Primero escanea la placa de la máquina.'}
            />
            {busy && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><span>Validando…</span></Stack>}
          </Stack>
        </Paper>
        {resolved && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: 'success.main' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color="success" label={`${resolved.maquina.codigo} · ${resolved.maquina.nombre}`} />
                <Chip label={resolved.punto.codigo} />
                <Chip label={`${resolved.bolsa.codigo} · ${resolved.bolsa.peso_neto_kg} kg`} />
              </Stack>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Trabajo de color</Typography><Typography fontWeight={700}>{resolved.trabajo_color.codigo}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Estado</Typography><Typography fontWeight={700}>{resolved.trabajo_color.estado}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Entrega</Typography><Typography fontWeight={700}>{resolved.entrega.estado}</Typography></Box>
              </Box>
              <Alert severity="info">Confirma solo cuando la bolsa esté físicamente frente a la máquina mostrada.</Alert>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => { setResolved(null); setBagQr(''); bagRef.current?.focus(); }}>Cancelar bolsa</Button>
                <Button disabled={busy} variant="outlined" onClick={() => confirm('RECIBIR')}>Recibir sin consumir</Button>
                <Button
                  disabled={busy || !resolved.acciones_permitidas.recibir_y_consumir || !can('MATERIAL_PREPARADO_CONSUMIR')}
                  variant="contained"
                  onClick={() => confirm('RECIBIR_Y_CONSUMIR')}
                >
                  Recibir y consumir
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
