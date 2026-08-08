import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  asignarFuenteNoExactaAbastecimientoScm,
  asignarMangaAbastecimientoScm,
  despacharRetornoAbastecimientoScm,
  despacharRetornoPoolAbastecimientoScm,
  despacharSolicitudScm,
  listarSolicitudesAbastecimientoScm,
  marcarSolicitudListaScm,
  recibirRetornoAbastecimientoScm,
  recibirRetornoPoolAbastecimientoScm,
  recibirSolicitudScm,
  solicitarRetornoAbastecimientoScm,
  solicitarRetornoPoolAbastecimientoScm,
} from '../services/scmInternalSupplyApi';

const STATE_META = {
  SOLICITADA: { label: 'Pendiente de preparar', color: 'default', step: 0 },
  EN_PREPARACION: { label: 'Preparando mangas', color: 'warning', step: 1 },
  LISTA: { label: 'Lista para despacho', color: 'info', step: 2 },
  DESPACHADA: { label: 'En camino a Armado', color: 'primary', step: 3 },
  RECIBIDA: { label: 'Recibida en mesa', color: 'success', step: 4 },
  CERRADA: { label: 'Cerrada', color: 'success', step: 4 },
  INCIDENCIA: { label: 'Requiere atención', color: 'error', step: 0 },
  CANCELADA: { label: 'Cancelada', color: 'default', step: 0 },
};

const steps = ['Solicitud', 'Picking', 'Lista', 'En tránsito', 'En mesa'];
const number = (value) => Number(value || 0);
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const extractMangaIdentity = (rawValue) => {
  const value = rawValue.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    const labelId = parsed.label_id || parsed.qr?.label_id;
    const match = String(labelId || '').match(UUID_PATTERN);
    if (match) return { label_id: match[0] };
  } catch {
    // El lector también puede entregar una URL, UUID puro o código visible.
  }
  const uuidMatch = value.match(UUID_PATTERN);
  return uuidMatch
    ? { label_id: uuidMatch[0] }
    : { manga_codigo: value.toUpperCase() };
};

export default function InternalSupplyScm() {
  const { can, experience } = useScmActor();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [requestId, setRequestId] = useState('');
  const [lineId, setLineId] = useState('');
  const [mangaCode, setMangaCode] = useState('');
  const [returnLocation, setReturnLocation] = useState('RECEPCION_PIEZAS_WIP');
  const [exceptionMode, setExceptionMode] = useState('CONJUNTO_CANDIDATOS');
  const [exceptionQuantity, setExceptionQuantity] = useState('');
  const [exceptionLocation, setExceptionLocation] = useState('RECEPCION_PIEZAS_WIP');
  const [exceptionReason, setExceptionReason] = useState('');
  const [candidateCodes, setCandidateCodes] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(
    () => requests.find((item) => item.id === requestId) || requests[0] || null,
    [requestId, requests],
  );
  const selectedLine = useMemo(
    () => selected?.lineas.find((line) => line.id === lineId) || selected?.lineas[0] || null,
    [lineId, selected],
  );

  const load = useCallback(async (preferred = '') => {
    setBusy(true);
    setError('');
    try {
      const payload = await listarSolicitudesAbastecimientoScm();
      const items = payload.items || [];
      setRequests(items);
      const next = items.some((item) => item.id === preferred) ? preferred : items[0]?.id || '';
      setRequestId(next);
      const request = items.find((item) => item.id === next) || items[0];
      setLineId(request?.lineas?.[0]?.id || '');
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el abastecimiento interno.'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(searchParams.get('solicitud') || ''); }, [load, searchParams]);

  const run = async (work, successMessage) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await work();
      setNotice(successMessage);
      setMangaCode('');
      await load(result.solicitud?.id || selected.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo completar la acción.'));
      setBusy(false);
    }
  };

  const assign = () => {
    const identity = extractMangaIdentity(mangaCode);
    if (!identity || !selectedLine) {
      setError('Escanea una etiqueta válida y selecciona el componente solicitado.');
      return;
    }
    run(
      () => asignarMangaAbastecimientoScm(selected, {
        linea_id: selectedLine.id,
        ...identity,
      }),
      'Manga reservada. El Kardex todavía no se movió.',
    );
  };

  const state = STATE_META[selected?.estado] || STATE_META.SOLICITADA;
  const canPrepare = can('PICKING_PREPARAR');
  const canDispatch = can('PICKING_DESPACHAR');
  const canReceive = can('ABASTECIMIENTO_RECIBIR');
  const canOpenCandidate = can('GENEALOGIA_CANDIDATA_CONFIRMAR');
  const canOpenLegacy = can('GENEALOGIA_LEGACY_APERTURA');

  const assignException = () => {
    if (!selectedLine || !exceptionQuantity || !exceptionReason.trim()) {
      setError('Indica componente, cantidad y motivo de la apertura excepcional.');
      return;
    }
    const codes = candidateCodes.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    if (exceptionMode === 'CONJUNTO_CANDIDATOS' && codes.length < 2) {
      setError('Escanea o escribe al menos dos códigos de manga candidatas.');
      return;
    }
    run(
      () => asignarFuenteNoExactaAbastecimientoScm(selected, {
        linea_id: selectedLine.id,
        modo: exceptionMode,
        cantidad: exceptionQuantity,
        ubicacion_codigo: exceptionLocation,
        motivo: exceptionReason,
        candidato_codigos: exceptionMode === 'CONJUNTO_CANDIDATOS' ? codes : [],
      }),
      exceptionMode === 'CONJUNTO_CANDIDATOS'
        ? 'Conjunto candidato reservado sin inventar una distribución exacta.'
        : 'Conteo legacy incorporado y reservado con trazabilidad de apertura.',
    );
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Picking de mangas para Armado"
        description="Reserva por QR, entrega con doble confirmación y retorno del remanente sin perder la identidad de la manga."
        actions={<Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(selected?.id)}>Actualizar</Button>}
      />
      <ProcessJourney current="armado" />
      <Alert severity="info">
        Perfil actual: <strong>{experience.label}</strong>. Reservar no descuenta stock;
        el Kardex cambia cuando se confirma el despacho y la recepción física.
      </Alert>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl sx={{ minWidth: { md: 480 }, flex: 1 }}>
            <InputLabel>Solicitud de abastecimiento</InputLabel>
            <Select
              label="Solicitud de abastecimiento"
              value={selected?.id || ''}
              onChange={(event) => {
                setRequestId(event.target.value);
                const request = requests.find((item) => item.id === event.target.value);
                setLineId(request?.lineas?.[0]?.id || '');
              }}
            >
              {requests.map((request) => (
                <MenuItem key={request.id} value={request.id}>
                  {request.codigo} · {request.orden_trabajo.codigo_ot} · {STATE_META[request.estado]?.label || request.estado}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selected && <Chip label={state.label} color={state.color} />}
        </Stack>
      </Paper>

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress /></Box>}
      {!busy && !selected && (
        <Alert severity="info">
          No hay solicitudes. El Responsable de Armado debe crear primero una OT diaria desde la OA y solicitar sus componentes.
        </Alert>
      )}

      {!busy && selected && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="h6">{selected.codigo} · {selected.orden_armado.codigo}</Typography>
                  <Typography color="text.secondary">
                    {selected.orden_trabajo.codigo_ot} · {selected.orden_trabajo.fecha_operativa} · {selected.orden_trabajo.turno}
                    {' · '}{selected.orden_trabajo.centro_trabajo?.nombre}
                  </Typography>
                </Box>
                <Typography fontWeight={750}>Responsable: {selected.orden_trabajo.responsable}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {steps.map((label, index) => (
                  <Chip
                    key={label}
                    size="small"
                    color={index <= state.step ? 'primary' : 'default'}
                    variant={index === state.step ? 'filled' : 'outlined'}
                    label={`${index + 1}. ${label}`}
                  />
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <Typography fontWeight={800} sx={{ px: 2, pt: 2 }}>Cobertura por componente</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Componente</TableCell>
                  <TableCell align="right">Requerido</TableCell>
                  <TableCell align="right">Reservado</TableCell>
                  <TableCell>Cobertura</TableCell>
                  <TableCell>Fuentes</TableCell>
                </TableRow></TableHead>
                <TableBody>{selected.lineas.map((line) => {
                  const coverage = Math.min(100, (number(line.cantidad_asignada) / number(line.cantidad_requerida)) * 100 || 0);
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{line.articulo.nombre}<br /><Typography variant="caption">{line.articulo.codigo}</Typography></TableCell>
                      <TableCell align="right">{line.cantidad_requerida} {line.articulo.unidad}</TableCell>
                      <TableCell align="right">{line.cantidad_asignada} {line.articulo.unidad}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}><LinearProgress variant="determinate" value={coverage} /><Typography variant="caption">{coverage.toFixed(0)}%</Typography></TableCell>
                      <TableCell>
                        {line.asignaciones.length ? `${line.asignaciones.length} exacta(s)` : ''}
                        {line.asignaciones_no_exactas?.length
                          ? `${line.asignaciones.length ? ' · ' : ''}${line.asignaciones_no_exactas.length} excepcional(es)`
                          : ''}
                        {!line.asignaciones.length && !line.asignaciones_no_exactas?.length ? '—' : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {canPrepare && ['SOLICITADA', 'EN_PREPARACION'].includes(selected.estado) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={800} gutterBottom>Escanear manga del picking</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <FormControl sx={{ minWidth: 300 }}>
                  <InputLabel>Componente solicitado</InputLabel>
                  <Select label="Componente solicitado" value={selectedLine?.id || ''} onChange={(event) => setLineId(event.target.value)}>
                    {selected.lineas.map((line) => <MenuItem key={line.id} value={line.id}>{line.articulo.codigo} · {line.articulo.nombre}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  autoFocus
                  fullWidth
                  label="Escanea QR o escribe el código de manga"
                  value={mangaCode}
                  onChange={(event) => setMangaCode(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && mangaCode.trim()) assign(); }}
                />
                <Button variant="contained" startIcon={<QrCodeScannerIcon />} disabled={!mangaCode.trim()} onClick={assign}>Reservar manga</Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                El piloto reserva la manga completa. Si el artículo o Calidad no coinciden, el sistema la rechazará sin alterar Kardex.
              </Typography>
            </Paper>
          )}

          {(canOpenCandidate || canOpenLegacy) && ['SOLICITADA', 'EN_PREPARACION'].includes(selected.estado) && (
            <Paper variant="outlined" sx={{ p: 2, borderColor: 'warning.main' }}>
              <Typography fontWeight={800}>Resolver una falta de identidad</Typography>
              <Alert severity="warning" sx={{ my: 1.5 }}>
                Úsalo solo cuando no sea posible identificar una manga exacta. La genealogía quedará
                marcada como candidata o legacy y el motivo permanecerá en auditoría.
              </Alert>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'flex-start' }}>
                <FormControl sx={{ minWidth: 250 }}>
                  <InputLabel>Nivel de origen</InputLabel>
                  <Select label="Nivel de origen" value={exceptionMode} onChange={(event) => setExceptionMode(event.target.value)}>
                    {canOpenCandidate && <MenuItem value="CONJUNTO_CANDIDATOS">Conjunto de mangas candidatas</MenuItem>}
                    {canOpenLegacy && <MenuItem value="LEGACY_SIN_ORIGEN">Conteo inicial sin origen</MenuItem>}
                  </Select>
                </FormControl>
                <TextField label="Cantidad" type="number" value={exceptionQuantity} onChange={(event) => setExceptionQuantity(event.target.value)} />
                <TextField label="Ubicación del conteo" value={exceptionLocation} onChange={(event) => setExceptionLocation(event.target.value.toUpperCase())} />
                <TextField fullWidth label="Motivo obligatorio" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} />
              </Stack>
              {exceptionMode === 'CONJUNTO_CANDIDATOS' && (
                <TextField
                  fullWidth multiline minRows={2} sx={{ mt: 1.25 }}
                  label="Códigos de mangas candidatas (uno por línea)"
                  value={candidateCodes} onChange={(event) => setCandidateCodes(event.target.value)}
                  helperText="Se conservará el conjunto completo; el sistema no inventará un reparto entre mangas."
                />
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
                <Button variant="outlined" color="warning" onClick={assignException}>Registrar fuente excepcional</Button>
              </Box>
            </Paper>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="flex-end">
            {canPrepare && selected.estado === 'EN_PREPARACION' && (
              <Button variant="contained" startIcon={<Inventory2OutlinedIcon />} onClick={() => run(() => marcarSolicitudListaScm(selected), 'Picking completo y listo para entregar.')}>Marcar picking listo</Button>
            )}
            {canDispatch && selected.estado === 'LISTA' && (
              <Button variant="contained" startIcon={<LocalShippingOutlinedIcon />} onClick={() => run(() => despacharSolicitudScm(selected), 'Despacho registrado. Las mangas están en tránsito.')}>Despachar a Armado</Button>
            )}
            {canReceive && selected.estado === 'DESPACHADA' && (
              <Button color="success" variant="contained" onClick={() => run(() => recibirSolicitudScm(selected), 'Entrega recibida en Mesa de Armado.')}>Confirmar recepción en mesa</Button>
            )}
          </Stack>

          {selected.lineas.some((line) => line.asignaciones.length) && (
            <Paper variant="outlined">
              <Typography fontWeight={800} sx={{ p: 2 }}>Custodia y retornos por manga</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow>
                  <TableCell>Manga</TableCell><TableCell>Componente</TableCell><TableCell>Ubicación</TableCell>
                  <TableCell>Estado</TableCell><TableCell align="right">Saldo</TableCell><TableCell>Acción siguiente</TableCell>
                </TableRow></TableHead>
                <TableBody>{selected.lineas.flatMap((line) => line.asignaciones.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.manga.codigo}</TableCell>
                    <TableCell>{line.articulo.nombre}</TableCell>
                    <TableCell>{assignment.manga.ubicacion.nombre}</TableCell>
                    <TableCell><Chip size="small" label={assignment.estado} /></TableCell>
                    <TableCell align="right">{assignment.saldo} {line.articulo.unidad}</TableCell>
                    <TableCell>
                      {can('ABASTECIMIENTO_DEVOLVER') && ['EN_STAGING_ARMADO', 'ABIERTA_EN_CONSUMO'].includes(assignment.estado) && (
                        <Button size="small" onClick={() => run(() => solicitarRetornoAbastecimientoScm(assignment.id), 'Retorno solicitado.')}>Solicitar retorno</Button>
                      )}
                      {can('ABASTECIMIENTO_DEVOLVER') && assignment.estado === 'PENDIENTE_RETORNO' && (
                        <Button size="small" onClick={() => run(() => despacharRetornoAbastecimientoScm(assignment.id), 'Remanente enviado a Almacén.')}>Enviar a Almacén</Button>
                      )}
                      {can('RETORNO_RECIBIR') && assignment.estado === 'EN_TRANSITO_ALMACEN' && (
                        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.75}>
                          <TextField size="small" label="Ubicación" value={returnLocation} onChange={(event) => setReturnLocation(event.target.value.toUpperCase())} />
                          <Button size="small" onClick={() => run(() => recibirRetornoAbastecimientoScm(assignment.id, returnLocation), 'Remanente recibido y liberado en Almacén.')}>Recibir</Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                )))}</TableBody>
              </Table></TableContainer>
            </Paper>
          )}
          {selected.lineas.some((line) => line.asignaciones_no_exactas?.length) && (
            <Paper variant="outlined">
              <Typography fontWeight={800} sx={{ p: 2 }}>Custodia de fuentes excepcionales</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow>
                  <TableCell>Componente</TableCell><TableCell>Nivel</TableCell><TableCell>Origen declarado</TableCell>
                  <TableCell>Estado</TableCell><TableCell align="right">Saldo</TableCell><TableCell>Acción</TableCell>
                </TableRow></TableHead>
                <TableBody>{selected.lineas.flatMap((line) => (line.asignaciones_no_exactas || []).map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{line.articulo.nombre}</TableCell>
                    <TableCell><Chip size="small" color="warning" label={assignment.modo} /></TableCell>
                    <TableCell>{assignment.candidatos?.map((value) => value.codigo).join(', ') || assignment.motivo}</TableCell>
                    <TableCell>{assignment.estado}</TableCell>
                    <TableCell align="right">{assignment.saldo} {line.articulo.unidad}</TableCell>
                    <TableCell>
                      {can('ABASTECIMIENTO_DEVOLVER') && ['EN_STAGING_ARMADO', 'ABIERTA_EN_CONSUMO'].includes(assignment.estado) && (
                        <Button size="small" onClick={() => run(() => solicitarRetornoPoolAbastecimientoScm(assignment.id), 'Retorno agrupado solicitado.')}>Solicitar retorno</Button>
                      )}
                      {can('ABASTECIMIENTO_DEVOLVER') && assignment.estado === 'PENDIENTE_RETORNO' && (
                        <Button size="small" onClick={() => run(() => despacharRetornoPoolAbastecimientoScm(assignment.id), 'Fuente agrupada enviada a Almacén.')}>Enviar a Almacén</Button>
                      )}
                      {can('RETORNO_RECIBIR') && assignment.estado === 'EN_TRANSITO_ALMACEN' && (
                        <Button size="small" onClick={() => run(() => recibirRetornoPoolAbastecimientoScm(assignment.id, returnLocation), 'Remanente agrupado recibido.')}>Confirmar recepción</Button>
                      )}
                    </TableCell>
                  </TableRow>
                )))}</TableBody>
              </Table></TableContainer>
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
