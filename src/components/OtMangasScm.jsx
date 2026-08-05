import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getTrabajadores, obtenerMaquinas } from '../services/api';
import {
  agregarMangasNormalesScm, anularMangaScm, anularPesajeScm, aprobarMangaExtraScm,
  aprobarCorreccionPesajeScm, cambiarEstadoOtScm, crearOtScm,
  generarEtiquetasPrepesaje, listarOtScm, listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm, obtenerPesajeMangaScm, obtenerPlanMangas,
  recalcularPlanMangas,
  reemplazarEtiquetaScm, solicitarCorreccionPesajeScm,
  solicitarMangaExtraScm,
} from '../services/scmOtApi';
import {
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import { useScmActor } from '../context/ScmActorContext';

const today = () => new Date().toISOString().slice(0, 10);

export default function OtMangasScm() {
  const { can, canAny, experience } = useScmActor();
  const canManagePlan = can('PLAN_MANGA_ADMINISTRAR');
  const canCreateOt = can('OT_CREAR');
  const canStartOt = can('OT_INICIAR');
  const canCloseOt = can('OT_CERRAR');
  const canPlanMangas = can('MANGA_PLANIFICAR');
  const canRequestExtra = can('MANGA_EXTRA_SOLICITAR');
  const canApproveExtra = can('MANGA_EXTRA_APROBAR');
  const canPrelabel = can('MANGA_ETIQUETA_PRE_GENERAR');
  const canAnnulManga = can('MANGA_ANULAR');
  const canReplaceLabel = can('MANGA_ETIQUETA_REEMPLAZAR_APROBAR');
  const canViewWeighing = can('MANGA_PESAJE_VER');
  const canRequestCorrection = can('PESAJE_CORRECCION_SOLICITAR');
  const canApproveCorrection = can('PESAJE_CORRECCION_APROBAR');
  const canAnnulWeighing = can('ANULAR_PESAJE');
  const hasOperationalActions = canAny([
    'PLAN_MANGA_ADMINISTRAR', 'OT_CREAR', 'OT_INICIAR', 'OT_CERRAR',
    'MANGA_PLANIFICAR', 'MANGA_EXTRA_SOLICITAR', 'MANGA_EXTRA_APROBAR',
    'MANGA_ETIQUETA_PRE_GENERAR', 'MANGA_ANULAR',
    'MANGA_ETIQUETA_REEMPLAZAR_APROBAR', 'PESAJE_CORRECCION_SOLICITAR',
    'PESAJE_CORRECCION_APROBAR',
    'ANULAR_PESAJE',
  ]);
  const [catalogs, setCatalogs] = useState({ orders: [], machines: [], workers: [] });
  const [op, setOp] = useState('');
  const [runId, setRunId] = useState('');
  const [plan, setPlan] = useState(null);
  const [ots, setOts] = useState([]);
  const [extraRequests, setExtraRequests] = useState([]);
  const [otId, setOtId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({
    fecha_operativa: today(), maquina_id: '', turno: 'DIA', maquinista_id: '',
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [printJob, setPrintJob] = useState(null);
  const [allocation, setAllocation] = useState({
    plan_linea_id: '', cantidad_un: '', motivo: '',
  });
  const [actionDialog, setActionDialog] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [weighingDialog, setWeighingDialog] = useState(null);
  const [weighingBusy, setWeighingBusy] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    peso_bruto_kg: '', tara_kg: '', cantidad_confirmada: '', motivo: '',
  });
  const [annulmentForm, setAnnulmentForm] = useState({ motivo: '', evidencia: '' });

  const selectedOt = useMemo(
    () => ots.find((item) => item.public_id === otId) || ots[0] || null,
    [ots, otId],
  );
  const selectedOrder = useMemo(
    () => catalogs.orders.find((item) => item.id === op) || null,
    [catalogs.orders, op],
  );
  const selectedRun = useMemo(
    () => selectedOrder?.corridas?.find((item) => item.id === runId) || null,
    [selectedOrder, runId],
  );
  const runPlanLines = useMemo(
    () => (plan?.lineas || []).filter(
      (line) => line.corrida_fabricacion_id === runId,
    ),
    [plan, runId],
  );

  const load = useCallback(async (selectedOp) => {
    if (!selectedOp) return;
    setBusy(true);
    setError('');
    try {
      const [planPayload, otPayload, extraPayload] = await Promise.all([
        obtenerPlanMangas(selectedOp), listarOtScm(selectedOp),
        listarSolicitudesMangaExtraScm(selectedOp),
      ]);
      setPlan(planPayload.plan);
      setOts(otPayload.items || []);
      setExtraRequests(extraPayload.items || []);
      setOtId((current) => (
        otPayload.items?.some((item) => item.public_id === current)
          ? current : otPayload.items?.[0]?.public_id || ''
      ));
      setQuantities(Object.fromEntries(
        (planPayload.plan?.lineas || []).map((line) => [line.id, line.saldo_un]),
      ));
      setAllocation((current) => ({
        ...current,
        plan_linea_id: (
          planPayload.plan?.lineas?.some(
            (line) => String(line.id) === String(current.plan_linea_id),
          )
            ? current.plan_linea_id
            : String(planPayload.plan?.lineas?.[0]?.id || '')
        ),
      }));
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el flujo de OT.'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([listarOrdenesFabricacionScm(), obtenerMaquinas(), getTrabajadores()])
      .then(([orderPayload, machines, workers]) => {
        const orders = (orderPayload.items || []).filter(
          (item) => ['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION'].includes(item.estado),
        );
        const activeWorkers = (workers || []).filter(
          (item) => item.activo
            && item.roles?.some((role) => role.codigo === 'MAQUINISTA'),
        );
        setCatalogs({ orders: orders || [], machines: machines || [], workers: activeWorkers });
        const first = orders?.[0];
        setOp(first?.id || '');
        setRunId(first?.corridas?.find(
          (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
        )?.id || '');
        setForm((current) => ({
          ...current,
          maquina_id: first?.maquina_prevista_id || machines?.[0]?.id || '',
          maquinista_id: activeWorkers[0]?.id || '',
        }));
      })
      .catch((requestError) => setError(
        mensajeErrorScm(requestError, 'No se pudieron cargar los catálogos.'),
      ))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => { load(op); }, [op, load]);

  const recalculate = async () => {
    setBusy(true);
    try {
      const result = await recalcularPlanMangas(op);
      setPlan(result.plan);
      setQuantities(Object.fromEntries(
        result.plan.lineas.map((line) => [line.id, line.saldo_un]),
      ));
      setNotice(`Plan revisión ${result.plan.revision} calculado. Aún no creó mangas.`);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo calcular el plan.'));
    } finally {
      setBusy(false);
    }
  };

  const createOt = async () => {
    const asignaciones = Object.entries(quantities)
      .filter(([id, value]) => (
        Number(value) > 0
        && runPlanLines.some((line) => String(line.id) === String(id))
      ))
      .map(([id, value]) => ({ plan_linea_id: Number(id), cantidad_un: Number(value) }));
    if (!asignaciones.length) return setError('Asigna una cantidad positiva.');
    if (!runId) return setError('Selecciona una corrida de fabricación.');
    setBusy(true);
    try {
      const result = await crearOtScm(op, {
        ...form,
        corrida_fabricacion_id: runId,
        maquina_id: Number(form.maquina_id),
        maquinista_id: Number(form.maquinista_id),
        asignaciones,
      });
      setNotice(`${result.ot.codigo_ot} creada con ${result.ot.mangas.length} mangas.`);
      await load(op);
      setOtId(result.ot.public_id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo crear la OT.'));
    } finally {
      setBusy(false);
    }
  };

  const generateLabels = async () => {
    if (selected.length < 1 || selected.length > 2) {
      return setError('Selecciona una o dos mangas.');
    }
    setBusy(true);
    try {
      const result = await generarEtiquetasPrepesaje(selected);
      setPrintJob(result);
      setNotice(`Trabajo ${result.print_job_id} listo para la PC de pesaje.`);
      setSelected([]);
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se generaron las etiquetas.'));
    } finally {
      setBusy(false);
    }
  };

  const transitionOt = async (action) => {
    if (!selectedOt) return;
    setBusy(true);
    setError('');
    try {
      const result = await cambiarEstadoOtScm(
        selectedOt.public_id, action, selectedOt.version,
      );
      setNotice(`${result.ot.codigo_ot}: ${result.ot.estado.replaceAll('_', ' ')}.`);
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cambiar el estado de la OT.'));
    } finally {
      setBusy(false);
    }
  };

  const addNormalMangas = async () => {
    if (!selectedOt || !allocation.plan_linea_id || Number(allocation.cantidad_un) <= 0) {
      return setError('Selecciona una salida y una cantidad positiva.');
    }
    setBusy(true);
    setError('');
    try {
      const result = await agregarMangasNormalesScm(selectedOt.public_id, {
        plan_linea_id: Number(allocation.plan_linea_id),
        cantidad_un: Number(allocation.cantidad_un),
      });
      setNotice(`${result.mangas.length} manga(s) normal(es) agregadas.`);
      setAllocation((current) => ({ ...current, cantidad_un: '' }));
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se agregaron las mangas.'));
    } finally {
      setBusy(false);
    }
  };

  const requestExtra = async () => {
    if (
      !selectedOt || !allocation.plan_linea_id
      || Number(allocation.cantidad_un) <= 0 || !allocation.motivo.trim()
    ) {
      return setError('La manga extra requiere salida, cantidad y motivo.');
    }
    setBusy(true);
    setError('');
    try {
      const result = await solicitarMangaExtraScm(selectedOt.public_id, {
        plan_linea_id: Number(allocation.plan_linea_id),
        cantidad_un: Number(allocation.cantidad_un),
        motivo: allocation.motivo.trim(),
      });
      setNotice(`Solicitud extra ${result.solicitud.id} enviada a aprobación.`);
      setAllocation((current) => ({ ...current, cantidad_un: '', motivo: '' }));
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se solicitó la manga extra.'));
    } finally {
      setBusy(false);
    }
  };

  const approveExtra = async (requestId) => {
    setBusy(true);
    setError('');
    try {
      const result = await aprobarMangaExtraScm(requestId);
      setNotice(`Solicitud aprobada: ${result.mangas.length} manga(s) EXTRA creadas.`);
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se aprobó la solicitud. El aprobador debe ser otro actor con permiso JP.',
      ));
    } finally {
      setBusy(false);
    }
  };

  const submitMangaAction = async () => {
    if (!actionDialog || !actionReason.trim()) {
      return setError('Indica el motivo de la acción.');
    }
    setBusy(true);
    setError('');
    try {
      if (actionDialog.type === 'annul') {
        await anularMangaScm(actionDialog.manga.public_id, actionReason.trim());
        setNotice(`${actionDialog.manga.codigo} anulada.`);
      } else {
        const result = await reemplazarEtiquetaScm(
          actionDialog.manga.etiqueta_vigente.public_id,
          actionReason.trim(),
        );
        setPrintJob({ ...result, labels: [result.label] });
        setNotice(`Nueva etiqueta generada en el trabajo ${result.print_job_id}.`);
      }
      setActionDialog(null);
      setActionReason('');
      await load(op);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se completó la acción de manga.'));
    } finally {
      setBusy(false);
    }
  };

  const openWeighing = async (manga) => {
    setWeighingBusy(true);
    setError('');
    try {
      const detail = await obtenerPesajeMangaScm(manga.public_id);
      setWeighingDialog({ manga, detail });
      setCorrectionForm({
        peso_bruto_kg: detail.vigente?.peso_bruto_kg || '',
        tara_kg: detail.vigente?.tara_kg || '',
        cantidad_confirmada: detail.vigente?.cantidad_confirmada || '',
        motivo: '',
      });
      setAnnulmentForm({ motivo: '', evidencia: '' });
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo consultar el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const refreshWeighing = async () => {
    if (!weighingDialog) return;
    const detail = await obtenerPesajeMangaScm(weighingDialog.manga.public_id);
    setWeighingDialog((current) => ({ ...current, detail }));
  };

  const requestWeighingCorrection = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !correctionForm.motivo.trim()) {
      return setError('La corrección requiere un motivo.');
    }
    const proposed = {
      peso_bruto_kg: correctionForm.peso_bruto_kg,
      tara_kg: correctionForm.tara_kg,
      cantidad_confirmada: correctionForm.cantidad_confirmada,
    };
    setWeighingBusy(true);
    setError('');
    try {
      await solicitarCorreccionPesajeScm(original.public_id, {
        proposed,
        motivo: correctionForm.motivo.trim(),
      });
      await refreshWeighing();
      setCorrectionForm((current) => ({ ...current, motivo: '' }));
      setNotice('Corrección solicitada. Debe aprobarla otro actor con rol JP.');
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la corrección.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const approveWeighingCorrection = async (correctionId) => {
    setWeighingBusy(true);
    setError('');
    try {
      const result = await aprobarCorreccionPesajeScm(correctionId, {
        motivo_aprobacion: 'Validación de Jefe de Producción',
      });
      setPrintJob({
        print_job_id: result.print_job_id,
        labels: [result.post_label],
      });
      await refreshWeighing();
      await load(op);
      setNotice('Corrección aplicada; la nueva etiqueta postpesaje quedó lista para imprimir.');
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se aprobó. Use un actor JP distinto del solicitante.',
      ));
    } finally {
      setWeighingBusy(false);
    }
  };

  const annulWeighing = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !annulmentForm.motivo.trim()) {
      return setError('La anulaci??n requiere un motivo.');
    }
    setWeighingBusy(true);
    setError('');
    try {
      await anularPesajeScm(original.public_id, {
        motivo: annulmentForm.motivo.trim(),
        evidencia: annulmentForm.evidencia.trim() || null,
      });
      await refreshWeighing();
      await load(op);
      setNotice(
        'Pesaje anulado; los QR quedaron invalidados y el cupo volvi?? al plan.',
      );
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'RECEIPT_REVERSAL_REQUIRED'
        ? 'La manga ya ingres?? a Almac??n. Apruebe primero la reversa de recepci??n.'
        : mensajeErrorScm(requestError, 'No se pudo anular el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="Fabricación / Ejecución SCM"
        title="OT y mangas"
        description="Selecciona una OF y una sola corrida por OT diaria; planifica mangas y prepara la impresión 2-up."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(op)}>
              Actualizar
            </Button>
          </Stack>
        )}
      />
      <ProcessJourney current="jornada" />
      {!hasOperationalActions && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. La planificación, impresión y control
          de mangas se muestran a los responsables de la jornada.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Orden de fabricación</InputLabel>
            <Select
              label="Orden de fabricación" value={op}
              onChange={(event) => {
                setOp(event.target.value); setSelected([]); setPrintJob(null);
                const order = catalogs.orders.find((item) => item.id === event.target.value);
                const nextRun = order?.corridas?.find(
                  (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
                );
                setRunId(nextRun?.id || '');
                if (order?.maquina_prevista_id) {
                  setForm((current) => ({
                    ...current, maquina_id: order.maquina_prevista_id,
                  }));
                }
              }}
            >
              {catalogs.orders.map((order) => (
                <MenuItem key={order.id} value={order.id}>
                  {order.codigo} · {order.molde_id || 'Sin molde'}
                  {order.codigo_legacy_op ? ` · legado ${order.codigo_legacy_op}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Corrida</InputLabel>
            <Select
              label="Corrida"
              value={runId}
              onChange={(event) => {
                const nextRunId = event.target.value;
                setRunId(nextRunId);
                setSelected([]);
                const firstLine = (plan?.lineas || []).find(
                  (line) => line.corrida_fabricacion_id === nextRunId,
                );
                setAllocation((current) => ({
                  ...current,
                  plan_linea_id: String(firstLine?.id || ''),
                }));
              }}
            >
              {(selectedOrder?.corridas || [])
                .filter((item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado))
                .map((run) => (
                  <MenuItem key={run.id} value={run.id}>
                    {run.codigo} · {run.ciclos_objetivo} ciclos
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800}>Plan agregado de mangas</Typography>
            <Typography variant="body2" color="text.secondary">
              {plan
                ? `Revisión ${plan.revision} · ${runPlanLines.length} salidas de la corrida`
                : 'Sin plan activo'}
            </Typography>
          </Box>
          {canManagePlan && (
            <Button variant="contained" onClick={recalculate} disabled={!op || busy}>
              {plan ? 'Recalcular plan' : 'Calcular plan'}
            </Button>
          )}
        </Stack>
      </Paper>

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress /></Box>}

      {!busy && plan && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Salida</TableCell><TableCell>Tipo manga</TableCell>
                <TableCell align="right">Objetivo</TableCell><TableCell align="right">Capacidad</TableCell>
                <TableCell align="right">Mangas</TableCell><TableCell align="right">Saldo</TableCell>
                {canCreateOt && <TableCell>Asignar</TableCell>}
              </TableRow></TableHead>
              <TableBody>{runPlanLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={800}>{line.articulo.nombre}</Typography>
                    <Typography variant="caption">
                      {[line.pieza_color_sku, line.color].filter(Boolean).join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>{line.tipo_manga.nombre}</TableCell>
                  <TableCell align="right">{line.cantidad_objetivo_un}</TableCell>
                  <TableCell align="right">{line.capacidad_efectiva_un}</TableCell>
                  <TableCell align="right">{line.mangas_propuestas}</TableCell>
                  <TableCell align="right">{line.saldo_un}</TableCell>
                  {canCreateOt && <TableCell><TextField
                    size="small" type="number" value={quantities[line.id] ?? ''}
                    inputProps={{ min: 0, max: Number(line.saldo_un), step: 1 }}
                    onChange={(event) => setQuantities((current) => ({
                      ...current, [line.id]: event.target.value,
                    }))}
                  /></TableCell>}
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          {canCreateOt && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ p: 2 }}>
            <TextField
              label="Fecha operativa" type="date" value={form.fecha_operativa}
              InputLabelProps={{ shrink: true }}
              onChange={(event) => setForm({ ...form, fecha_operativa: event.target.value })}
            />
            <FormControl sx={{ minWidth: 190 }}><InputLabel>Máquina</InputLabel>
              <Select
                label="Máquina" value={form.maquina_id}
                onChange={(event) => setForm({ ...form, maquina_id: event.target.value })}
              >{catalogs.machines.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>
              ))}</Select>
            </FormControl>
            <FormControl sx={{ minWidth: 220 }}><InputLabel>Maquinista</InputLabel>
              <Select
                label="Maquinista" value={form.maquinista_id}
                onChange={(event) => setForm({ ...form, maquinista_id: event.target.value })}
              >{catalogs.workers.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
              ))}</Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}><InputLabel>Turno</InputLabel>
              <Select
                label="Turno" value={form.turno}
                onChange={(event) => setForm({ ...form, turno: event.target.value })}
              >
                <MenuItem value="DIA">Día</MenuItem><MenuItem value="NOCHE">Noche</MenuItem>
                <MenuItem value="EXTRA">Extra</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" onClick={createOt} disabled={!selectedRun}>
              Crear OT y mangas
            </Button>
          </Stack>
          )}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
          <FormControl sx={{ minWidth: 250 }}><InputLabel>OT central</InputLabel>
            <Select
              label="OT central" value={selectedOt?.public_id || ''}
              onChange={(event) => { setOtId(event.target.value); setSelected([]); }}
            >{ots.map((item) => (
              <MenuItem key={item.public_id} value={item.public_id}>
                {item.codigo_ot} · {item.fecha_operativa} · {item.estado}
              </MenuItem>
            ))}</Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Una o dos mangas por trabajo; cada columna conserva su propio QR.
          </Typography>
          {canPrelabel && (
            <Button
              variant="contained" startIcon={<PrintOutlinedIcon />}
              disabled={selected.length < 1 || selected.length > 2}
              onClick={generateLabels}
            >Generar preetiquetas ({selected.length}/2)</Button>
          )}
        </Stack>
        {selectedOt && (
          <>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ md: 'center' }}
              sx={{ mb: 2 }}
            >
              <Chip
                label={selectedOt.estado.replaceAll('_', ' ')}
                color={selectedOt.estado === 'EN_EJECUCION' ? 'success' : 'default'}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                Fecha productiva {selectedOt.fecha_operativa} · versión {selectedOt.version}
              </Typography>
              {canStartOt && (
                <Button
                  variant="outlined"
                  disabled={busy || selectedOt.estado !== 'PLANIFICADA'}
                  onClick={() => transitionOt('iniciar')}
                >
                  Iniciar OT
                </Button>
              )}
              {canCloseOt && (
                <Button
                  color="success"
                  variant="outlined"
                  disabled={busy || selectedOt.estado !== 'EN_EJECUCION'}
                  onClick={() => transitionOt('cerrar')}
                >
                  Cerrar OT
                </Button>
              )}
            </Stack>
            {(canPlanMangas || canRequestExtra) && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
              <Typography fontWeight={800} sx={{ mb: 1 }}>
                Agregar mangas a esta OT
              </Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel>Salida del plan</InputLabel>
                  <Select
                    label="Salida del plan"
                    value={allocation.plan_linea_id}
                    onChange={(event) => setAllocation({
                      ...allocation, plan_linea_id: event.target.value,
                    })}
                  >
                    {runPlanLines.map((line) => (
                      <MenuItem key={line.id} value={String(line.id)}>
                        {line.articulo.nombre} · saldo {line.saldo_un}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Cantidad (un)"
                  value={allocation.cantidad_un}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(event) => setAllocation({
                    ...allocation, cantidad_un: event.target.value,
                  })}
                  sx={{ width: { lg: 155 } }}
                />
                <TextField
                  size="small"
                  label="Motivo para EXTRA"
                  value={allocation.motivo}
                  onChange={(event) => setAllocation({
                    ...allocation, motivo: event.target.value,
                  })}
                  sx={{ flex: 1, minWidth: 220 }}
                />
                {canPlanMangas && (
                  <Button variant="outlined" disabled={busy} onClick={addNormalMangas}>
                    Agregar normales
                  </Button>
                )}
                {canRequestExtra && (
                  <Button
                    color="warning"
                    variant="contained"
                    disabled={busy || !allocation.motivo.trim()}
                    onClick={requestExtra}
                  >
                    Solicitar extra
                  </Button>
                )}
              </Stack>
            </Paper>
            )}
          </>
        )}
        {canApproveExtra && extraRequests.some((item) => item.estado === 'PENDIENTE') && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: 'warning.light' }}>
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              Autorizaciones pendientes de manga extra
            </Typography>
            <Stack spacing={1}>
              {extraRequests.filter((item) => item.estado === 'PENDIENTE').map((item) => (
                <Stack
                  key={item.id}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems={{ md: 'center' }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.cantidad_solicitada_un} un · {item.motivo}
                    {' '}· solicitante #{item.solicitada_por_id}
                  </Typography>
                  <Button
                    size="small"
                    color="warning"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => approveExtra(item.id)}
                  >
                    Aprobar como JP
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}
        {!selectedOt ? <Alert severity="info">No hay OT SCM para esta OF y sus corridas.</Alert> : (
          <TableContainer><Table size="small">
            <TableHead><TableRow>
              <TableCell padding="checkbox" /><TableCell>Manga</TableCell><TableCell>Salida</TableCell>
              <TableCell>Tipo</TableCell><TableCell align="right">Cantidad</TableCell>
              <TableCell>Estado</TableCell><TableCell>Etiqueta</TableCell><TableCell>Acciones</TableCell>
            </TableRow></TableHead>
            <TableBody>{selectedOt.mangas.map((manga) => {
              const checked = selected.includes(manga.public_id);
              const selectable = !manga.etiqueta_vigente && manga.estado === 'PLANIFICADA';
              return <TableRow key={manga.public_id} selected={checked}>
                <TableCell padding="checkbox"><Checkbox
                  checked={checked}
                  disabled={!canPrelabel || !selectable || (!checked && selected.length >= 2)}
                  onChange={() => setSelected((current) => (
                    checked ? current.filter((id) => id !== manga.public_id) : [...current, manga.public_id]
                  ))}
                /></TableCell>
                <TableCell><Typography fontWeight={800}>{manga.codigo}</Typography></TableCell>
                <TableCell>{manga.articulo_nombre}<br /><Typography variant="caption">{manga.color}</Typography></TableCell>
                <TableCell><Chip size="small" label={manga.tipo} color={manga.tipo === 'EXTRA' ? 'warning' : 'default'} /></TableCell>
                <TableCell align="right">{manga.cantidad_asignada_un}</TableCell>
                <TableCell>{manga.estado.replaceAll('_', ' ')}</TableCell>
                <TableCell>{manga.etiqueta_vigente?.estado || 'Sin generar'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {canAnnulManga && <Button
                      size="small"
                      color="error"
                      disabled={['PESADA', 'ETIQUETADA_FINAL', 'ANULADA'].includes(manga.estado)}
                      onClick={() => {
                        setActionReason('');
                        setActionDialog({ type: 'annul', manga });
                      }}
                    >
                      Anular
                    </Button>}
                    {canReplaceLabel && <Button
                      size="small"
                      disabled={!manga.etiqueta_vigente || manga.estado === 'ANULADA'}
                      onClick={() => {
                        setActionReason('');
                        setActionDialog({ type: 'replace', manga });
                      }}
                    >
                      Reemplazar etiqueta
                    </Button>}
                    {canViewWeighing && <Button
                      size="small"
                      disabled={weighingBusy || ![
                        'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN',
                        'ANULADA',
                      ].includes(manga.estado)}
                      onClick={() => openWeighing(manga)}
                    >
                      Ver pesaje
                    </Button>}
                  </Stack>
                </TableCell>
              </TableRow>;
            })}</TableBody>
          </Table></TableContainer>
        )}
      </Paper>
      {printJob && <Alert severity="info">
        Trabajo <strong>{printJob.print_job_id}</strong> generado con {printJob.labels.length} etiqueta(s).
        Ya puede abrirse desde la estación de pesaje.
      </Alert>}
      <Dialog
        open={Boolean(actionDialog)}
        onClose={() => setActionDialog(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {actionDialog?.type === 'annul' ? 'Anular manga' : 'Reemplazar etiqueta'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {actionDialog?.type === 'annul'
                ? 'La manga y sus etiquetas quedarán anuladas; no se elimina la evidencia.'
                : 'La etiqueta actual será invalidada y se generará otra identidad imprimible.'}
            </Alert>
            <TextField
              autoFocus
              multiline
              minRows={3}
              label="Motivo obligatorio"
              value={actionReason}
              onChange={(event) => setActionReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={actionDialog?.type === 'annul' ? 'error' : 'primary'}
            disabled={busy || !actionReason.trim()}
            onClick={submitMangaAction}
          >
            Confirmar como Jefe de Producción
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(weighingDialog)}
        onClose={() => setWeighingDialog(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Pesaje de {weighingDialog?.manga?.codigo}
        </DialogTitle>
        <DialogContent>
          {weighingBusy && <CircularProgress size={24} />}
          {weighingDialog?.detail?.original && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {weighingDialog.detail.anulacion && (
                <Alert severity="warning">
                  Pesaje anulado: {weighingDialog.detail.anulacion.motivo}. Los QR
                  anteriores ya no son v??lidos.
                </Alert>
              )}
              <Alert severity="info">
                El original es inmutable. Una corrección aprobada crea una
                proyección vigente y una nueva etiqueta postpesaje.
              </Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Versión</TableCell>
                    <TableCell align="right">Bruto kg</TableCell>
                    <TableCell align="right">Tara kg</TableCell>
                    <TableCell align="right">Neto físico kg</TableCell>
                    <TableCell align="right">Cantidad un</TableCell>
                    <TableCell align="right">Kg OT</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {[
                      ['Original', weighingDialog.detail.original],
                      ['Vigente', weighingDialog.detail.vigente],
                    ].filter(([, value]) => value).map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell align="right">{value.peso_bruto_kg}</TableCell>
                        <TableCell align="right">{value.tara_kg}</TableCell>
                        <TableCell align="right">{value.peso_fisico_neto_kg}</TableCell>
                        <TableCell align="right">{value.cantidad_confirmada}</TableCell>
                        <TableCell align="right">{value.kg_produccion_ot}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {canRequestCorrection && !weighingDialog.detail.anulacion && (
              <>
              <Typography fontWeight={800}>Solicitar corrección</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  type="number" label="Bruto kg" size="small"
                  value={correctionForm.peso_bruto_kg}
                  onChange={(event) => setCorrectionForm({
                    ...correctionForm, peso_bruto_kg: event.target.value,
                  })}
                />
                <TextField
                  type="number" label="Tara kg" size="small"
                  value={correctionForm.tara_kg}
                  onChange={(event) => setCorrectionForm({
                    ...correctionForm, tara_kg: event.target.value,
                  })}
                />
                <TextField
                  type="number" label="Cantidad un" size="small"
                  value={correctionForm.cantidad_confirmada}
                  onChange={(event) => setCorrectionForm({
                    ...correctionForm, cantidad_confirmada: event.target.value,
                  })}
                />
              </Stack>
              <TextField
                label="Motivo obligatorio" multiline minRows={2}
                value={correctionForm.motivo}
                onChange={(event) => setCorrectionForm({
                  ...correctionForm, motivo: event.target.value,
                })}
              />
              <Button
                variant="outlined"
                disabled={weighingBusy || !correctionForm.motivo.trim()}
                onClick={requestWeighingCorrection}
              >
                Solicitar corrección
              </Button>
              </>
              )}
              {canAnnulWeighing && !weighingDialog.detail.anulacion && (
                <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'error.light' }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={800} color="error">Anular pesaje</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invalida preetiqueta y postetiqueta, anula la manga y devuelve
                      su cupo al plan. Si ingres?? a Almac??n, exige primero la reversa.
                    </Typography>
                    <TextField
                      label="Motivo de anulaci??n" multiline minRows={2}
                      value={annulmentForm.motivo}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, motivo: event.target.value,
                      })}
                    />
                    <TextField
                      label="Evidencia opcional" value={annulmentForm.evidencia}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, evidencia: event.target.value,
                      })}
                    />
                    <Button color="error" variant="contained" disabled={
                      weighingBusy || !annulmentForm.motivo.trim()
                    } onClick={annulWeighing}>Anular pesaje definitivamente</Button>
                  </Stack>
                </Paper>
              )}
              {weighingDialog.detail.correcciones?.map((correction) => (
                <Paper key={correction.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ md: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={800}>
                        {correction.estado} · solicitante #{correction.requested_by_id}
                      </Typography>
                      <Typography variant="body2">{correction.reason}</Typography>
                    </Box>
                    {canApproveCorrection && correction.estado === 'PENDIENTE' && (
                      <Button
                        variant="contained"
                        color="warning"
                        disabled={weighingBusy}
                        onClick={() => approveWeighingCorrection(correction.id)}
                      >
                        Aprobar como JP
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeighingDialog(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
