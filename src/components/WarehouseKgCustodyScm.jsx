import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { commandKgCustody, listKgWithdrawals, resolveKgUnit } from '../services/scmKgCustodyApi';

export default function WarehouseKgCustodyScm({ readOnly = false }) {
  const { actorId, can } = useScmActor();
  const [code, setCode] = useState('');
  const [context, setContext] = useState(null);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState('');
  const [tare, setTare] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [parts, setParts] = useState([]);
  const [pending, setPending] = useState(null);
  const inFlight = useRef(false);
  const activeActor = useRef(actorId);
  activeActor.current = actorId;
  const storageKey = `scm-kg-custody-intent:${actorId}`;

  const load = useCallback(async () => {
    const requestedActor = actorId;
    const withdrawals = await listKgWithdrawals();
    if (activeActor.current !== requestedActor) return;
    setRows(withdrawals.items || []);
  }, [actorId]);

  useEffect(() => {
    setContext(null); setParts([]); setError(''); setNotice(''); setCode('');
    try { setPending(JSON.parse(sessionStorage.getItem(storageKey) || 'null')); }
    catch { setPending(null); }
    load().catch((e) => setError(mensajeErrorScm(e, 'No se pudo consultar la custodia KG.')));
  }, [load, storageKey]);

  const resolve = async (value = code) => {
    if (inFlight.current || pending || !value.trim()) return;
    const requestedActor = actorId;
    inFlight.current = true; setBusy(true); setContext(null); setError(''); setParts([]);
    setReason(''); setDestination(''); setTare(''); setMode(''); setNotice(''); setLocations([]);
    try {
      const result = await resolveKgUnit(value.trim());
      if (activeActor.current !== requestedActor) return;
      setCode(value); setContext(result); setMode(result.measurement_context?.modo_lectura || '');
      setLocations(result.return_locations || []);
      setTare(result.measurement_context?.tara_contexto?.tara_kg ?? result.measurement_context?.tara_contexto?.tara_nominal_kg ?? '');
    } catch (e) {
      if (activeActor.current === requestedActor) {
        setError(mensajeErrorScm(e, 'No se encontró una identidad vigente.'));
        setParts((e.response?.data?.details?.hijas || []).map((unit) => ({ unidad: unit })));
      }
    } finally { inFlight.current = false; setBusy(false); }
  };

  const execute = async (path, data, success, recovery = false) => {
    if (inFlight.current || readOnly || (pending && !recovery)) return;
    const requestedActor = actorId;
    const intent = recovery ? pending : { path, data, success, key: crypto.randomUUID(), code };
    inFlight.current = true; setBusy(true); setError('');
    // Preserve exactly the same request across response loss and page reload.
    sessionStorage.setItem(storageKey, JSON.stringify(intent)); setPending(intent);
    try {
      const result = await commandKgCustody(intent);
      sessionStorage.removeItem(storageKey);
      if (activeActor.current !== requestedActor) return;
      setPending(null); setContext(null); setNotice(intent.success);
      setParts(result.division?.partes || []);
      try {
        await load();
        if (!result.division && intent.code) {
          const refreshed = await resolveKgUnit(intent.code);
          if (activeActor.current === requestedActor) {
            setContext(refreshed); setLocations(refreshed.return_locations || []);
          }
        }
      } catch {
        if (activeActor.current === requestedActor) setError('La operación quedó confirmada. No se pudo actualizar la vista; consulte de nuevo la identidad.');
      }
    } catch (e) {
      if (activeActor.current !== requestedActor) return;
      setError(mensajeErrorScm(e, 'No se confirmó la operación. Reintente la misma solicitud.'));
      const status = e.response?.status;
      if (!recovery && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        sessionStorage.removeItem(storageKey); setPending(null); setContext(null);
      }
    } finally { inFlight.current = false; setBusy(false); }
  };

  const unit = context?.unit;
  const state = unit?.estado_logistico;
  const locked = busy || !!pending;
  const allowed = (capability) => !readOnly && can(capability);
  const unitPath = `unidades-kg/${unit?.id}`;
  const reserve = () => execute(`${unitPath}/reservas`, { version: unit.version, motivo_operativo: reason.trim() }, 'Reserva registrada. El material sigue en Almacén.');
  const measurement = context?.measurement || context?.medicion;

  return <Stack spacing={2} aria-label="Custodia de piezas en kg">
    <Typography variant="h5" fontWeight={800}>Piezas y WIP · entradas y salidas en kg</Typography>
    <Alert severity="info">Almacén conserva la custodia. Retirar para Armado no confirma consumo; los remanentes vuelven con peso automático y quedan disponibles al confirmar su recepción.</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {pending && <Alert severity="warning" action={<Button disabled={busy || readOnly} onClick={() => execute(null, null, null, true)}>Recuperar operación</Button>}>
      Hay una solicitud sin resultado confirmado. Conserve esta identidad y recupere la misma operación antes de continuar.
    </Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); resolve(); }}>
        <TextField label="QR o código de pieza / parte" value={code} disabled={locked} onChange={(e) => { setCode(e.target.value); setContext(null); }} />
        <Button type="submit" variant="contained" disabled={locked || !code.trim()}>Consultar identidad KG</Button>
      </Stack>
      {unit && <Stack spacing={2} sx={{ mt: 2 }}>
        <Typography variant="h6">{unit.codigo} · {unit.articulo?.nombre || unit.articulo?.codigo}</Typography>
        <Typography>{state?.replaceAll('_', ' ')} · Calidad {unit.estado_calidad}</Typography>
        <Typography variant="h5">{unit.kg_verificados == null ? 'Peso pendiente de verificación' : `${unit.kg_verificados} kg — última verificación`}</Typography>
        {['RECIBIDA_ALMACEN', 'ALMACENADA_CONTROLADA', 'DISPONIBLE_PRODUCCION'].includes(state) && allowed('PICKING_PREPARAR') && <>
          <TextField label="Motivo y destino de uso en Armado" value={reason} disabled={locked} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={locked || !reason.trim() || !['LIBERADA', 'SIN_CONTROL'].includes(unit.estado_calidad)} onClick={reserve}>Reservar para Armado</Button>
        </>}
        {state === 'RESERVADA' && <Stack direction="row" spacing={2}>
          {allowed('PICKING_DESPACHAR') && <Button variant="contained" disabled={locked} onClick={() => execute(`${unitPath}/retiro`, { version: unit.version }, 'Retiro registrado. Material junto a Armado, pendiente de conciliación.')}>Confirmar retiro físico a Armado</Button>}
          {allowed('PICKING_PREPARAR') && <Button disabled={locked} onClick={() => execute(`${unitPath}/reservas/liberar`, { version: unit.version }, 'Reserva liberada sin mover material.')}>Liberar reserva</Button>}
        </Stack>}
        {state === 'RETIRADA_ARMADO' && context?.retiro && allowed('UNIDAD_LOGISTICA_FRACCIONAR') && <>
          <Alert severity="info">Si vuelve todo el sobrante, pese esta identidad en la estación. Si una parte queda en Armado, identifique ambas partes y pese solo la que retorna.</Alert>
          <Button disabled={locked} onClick={() => execute(`retiros-armado-kg/${context.retiro.id}/divisiones`, {
            version: unit.version, partes: [{ client_ref: 'RETORNO', intencion: 'RETORNO' }, { client_ref: 'PERMANECE', intencion: 'PERMANECE' }],
          }, 'Dos identidades creadas. Identifique físicamente cada parte; todavía no tienen kg verificados.')}>Separar retorno y parte que permanece</Button>
        </>}
        {state === 'REPESADA_PENDIENTE_RECEPCION' && measurement && allowed('RETORNO_RECIBIR') && <>
          <TextField select label="Ubicación del retorno" value={destination} disabled={locked} onChange={(e) => setDestination(e.target.value)}>
            {locations.map((location) => <MenuItem key={location.codigo} value={location.codigo}>{location.nombre} · {location.codigo}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={locked || !destination} onClick={() => execute(`${unitPath}/retorno/recibir`, {
            version: unit.version, measurement_id: measurement.id, ubicacion_codigo: destination,
          }, 'Retorno ingresado en kg y disponible, sin liberación de Calidad.')}>Recibir {measurement.neto_kg} kg medidos</Button>
        </>}
        {unit.estado === 'ACTIVA' && unit.intencion === 'PERMANECE' && allowed('RETORNO_RECIBIR') && <>
          <Alert severity="info">Esta parte permanece en custodia sin peso verificado. Prepare su retorno cuando esté físicamente disponible y pésela en la estación.</Alert>
          <TextField label="Motivo del retorno de esta parte" value={reason} disabled={locked} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={locked || !reason.trim()} onClick={() => execute(`${unitPath}/retorno/preparar`, {
            version: unit.version, motivo: reason.trim(),
          }, 'Retorno preparado con la misma identidad. Escanee y pese esta parte en Retornos KG.')}>Preparar retorno para pesaje</Button>
        </>}
        {allowed('ALMACEN_CONFIG_ADMINISTRAR') && <details>
          <summary>Configuración de lectura de esta identidad</summary>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField select label="Modo verificado de la balanza" value={mode} disabled={locked} onChange={(e) => setMode(e.target.value)}>
              <MenuItem value="NET_DIRECTO">La balanza entrega NET</MenuItem>
              <MenuItem value="BRUTO_MENOS_TARA_CONFIGURADA">La balanza entrega bruto</MenuItem>
            </TextField>
            {mode === 'BRUTO_MENOS_TARA_CONFIGURADA' && <>
              <TextField label="Tara autorizada del envase (kg)" value={tare} disabled={locked} onChange={(e) => setTare(e.target.value)} />
              <TextField label="Motivo de tara configurada" value={reason} disabled={locked} onChange={(e) => setReason(e.target.value)} />
            </>}
            <Button disabled={locked || !mode || (mode === 'BRUTO_MENOS_TARA_CONFIGURADA' && (!can('PESAJE_TARA_OVERRIDE') || !tare || !reason.trim()))} onClick={() => execute(`${unitPath}/measurement-context`, {
              version: unit.version, modo_lectura: mode,
              ...(mode === 'BRUTO_MENOS_TARA_CONFIGURADA' ? { tara_contexto: { origen: 'OVERRIDE_MANUAL', tara_kg: tare }, motivo: reason.trim() } : {}),
            }, 'Modo de lectura configurado. Vuelva a escanear en la estación antes de pesar.')}>Guardar configuración verificada</Button>
          </Stack>
        </details>}
      </Stack>}
      {parts.length > 0 && <Stack spacing={1} sx={{ mt: 2 }}>
        <Alert severity="warning">Imprima la etiqueta de cada parte en Retornos KG. Pese solo la parte RETORNO; la que PERMANECE sigue en custodia con peso sin verificar.</Alert>
        {parts.map(({ unidad: part }) => <Button key={part.id} disabled={locked} onClick={() => resolve(part.codigo)}>{part.codigo} · {part.intencion} · {part.kg_verificados ?? 'sin pesar'}</Button>)}
      </Stack>}
    </Paper>
    <Stack direction="row" justifyContent="space-between"><Typography variant="h6">Material junto a Armado</Typography><Button disabled={locked} onClick={() => load().catch((e) => setError(mensajeErrorScm(e)))}>Actualizar custodia</Button></Stack>
    <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow>
      <TableCell>Retiro / fecha</TableCell><TableCell>Entregado kg</TableCell><TableCell>Retornado kg</TableCell><TableCell>Repesado por recibir kg</TableCell><TableCell>Sin verificar / clasificar kg</TableCell>
    </TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}>
      <TableCell>{row.codigo}<Typography variant="caption" display="block">{row.created_at ? new Date(row.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : ''}</Typography><Typography variant="caption" display="block">{row.motivo_operativo}</Typography></TableCell>
      <TableCell>{row.kg_entregado}</TableCell><TableCell>{row.kg_retornado_recibido}</TableCell><TableCell>{row.kg_retorno_verificado_pendiente}</TableCell><TableCell>{row.kg_sin_verificar_clasificar}</TableCell>
    </TableRow>)}</TableBody></Table></TableContainer>
    <Typography variant="body2">La diferencia pendiente no demuestra consumo ni stock físico disponible. Consulte y repese el remanente antes de recuperarlo.</Typography>
  </Stack>;
}
