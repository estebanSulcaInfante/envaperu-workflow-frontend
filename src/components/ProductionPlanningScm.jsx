import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import {
  ajustarMetasPlanOpScm, aprobarOpDemandaScm, actualizarRutasOpScm,
  calcularPlanOpScm, cancelarOpDemandaScm, confirmarPlanOpScm, crearOpDemandaScm,
  listarOpDemandaScm, obtenerPlanOpScm,
} from '../services/scmPlanningApi';
import {
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import { buscarProductos } from '../services/api';
import { listarPresentacionesComercialesScm } from '../services/scmCatalogApi';
import { useScmActor } from '../context/ScmActorContext';

const stateColor = {
  BORRADOR: 'default',
  APROBADA: 'info',
  PLANIFICADA: 'primary',
  EN_COBERTURA: 'warning',
  COMPLETADA: 'success',
  CANCELADA: 'error',
};

const emptyCreateForm = () => ({
  referencia_origen: '',
  fecha_necesidad: '',
  prioridad: 'NORMAL',
  producto_terminado_id: '',
  presentacion_comercial_id: '',
  cantidad_presentaciones: '',
});

const EMPTY_DOCUMENTS = [];

const documentTypeLabel = {
  FABRICACION: 'OF',
  ENSAMBLE: 'OA',
};

const articleClassLabel = {
  PIEZA_COLOR: 'Pieza-color',
  SUBENSAMBLE_WIP: 'WIP',
  PRODUCTO_TERMINADO: 'Producto terminado',
};

const routeBlockerView = (value, index, lines, order) => {
  const item = value && typeof value === 'object' ? value : {};
  const article = item.articulo && typeof item.articulo === 'object'
    ? item.articulo
    : {};
  const line = lines.find((candidate) => String(candidate.id) === String(item.linea_id));
  const productId = item.producto_terminado_id || line?.producto_terminado_id || '';
  const articleCode = article.codigo
    || item.articulo_codigo
    || (item.articulo_id != null ? `Artículo #${item.articulo_id}` : 'Artículo sin identificar');
  const articleName = article.nombre
    || item.articulo_nombre
    || 'Nombre no disponible en esta revisión; recalcula para actualizar el detalle.';
  const articleClass = article.clase || item.articulo_clase || '';
  const reason = item.motivo || (
    item.codigo === 'ROUTE_OUTPUT_MISSING'
      ? 'La BOM requiere este artículo, pero la ruta aprobada no incluye una operación cuya salida sea este artículo.'
      : 'La configuración técnica no permite cubrir este artículo.'
  );
  const query = new URLSearchParams({ tab: 'rutas' });
  if (productId) query.set('producto', productId);
  query.set('faltante', articleCode);
  if (order?.codigo) query.set('op', order.codigo);
  if (order?.id) query.set('volver', `/planificacion?op=${order.id}`);

  return {
    item,
    key: `${item.codigo || 'bloqueo'}-${item.linea_id || index}-${item.articulo_id || index}`,
    articleCode,
    articleName,
    articleClass: articleClassLabel[articleClass] || articleClass || 'Clase no disponible',
    productId,
    quantity: item.cantidad,
    reason,
    route: `/datos-maestros/ingenieria-scm?${query.toString()}`,
  };
};

const documentView = (value, index) => {
  const item = value && typeof value === 'object' ? value : {};
  const article = item.articulo && typeof item.articulo === 'object'
    ? item.articulo
    : {};
  const articleId = item.articulo_scm_id;
  const articleCode = article.codigo
    || item.articulo_codigo
    || item.articulo_codigo_snapshot
    || (articleId != null ? `ID ${articleId}` : 'Sin código de artículo');
  const articleName = article.nombre
    || item.articulo_nombre
    || item.articulo_nombre_snapshot
    || (articleId != null ? `Artículo #${articleId}` : 'Artículo no disponible');
  const quantity = item.cantidad_calculada
    ?? item.cantidad_objetivo
    ?? item.cantidad
    ?? null;
  const issues = [
    !item.clave && 'identificador',
    !documentTypeLabel[item.tipo] && 'tipo de orden',
    item.operacion_ruta_id == null && 'operación de ruta',
    !item.ruta_hash && 'versión de ruta',
    articleId == null && 'artículo',
    item.cantidad_objetivo == null && 'meta confirmable',
  ].filter(Boolean);

  return {
    item,
    key: item.clave || `documento-${index + 1}`,
    typeLabel: documentTypeLabel[item.tipo] || 'Documento',
    operationLabel: item.operacion
      || (item.operacion_ruta_id != null
        ? `Operación de ruta #${item.operacion_ruta_id}`
        : 'Operación no registrada'),
    articleCode,
    articleName,
    quantity,
    issues,
    operable: issues.length === 0,
  };
};

const routeSnapshotLabel = (snapshot, fallbackId) => {
  const value = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const id = value.id ?? fallbackId;
  const revision = value.revision ?? value.numero_revision;
  const identity = value.codigo || (id != null ? `ID ${id}` : 'sin identificador');
  return `Ruta ${identity}${revision != null ? ` · revisión ${revision}` : ''}`;
};

export default function ProductionPlanningScm() {
  const { can, experience } = useScmActor();
  const canCreate = can('OP_CREAR');
  const canApprove = can('OP_APROBAR');
  const canCancel = can('OP_CANCELAR');
  const canCalculate = can('PLANIFICACION_CALCULAR');
  const canConfirm = can('PLANIFICACION_CONFIRMAR');
  const isReadOnly = !canCreate && !canApprove && !canCancel && !canCalculate && !canConfirm;
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [products, setProducts] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [routeRefreshOpen, setRouteRefreshOpen] = useState(false);
  const [routeRefreshResult, setRouteRefreshResult] = useState(null);
  const [targetDraft, setTargetDraft] = useState({});
  const [targetReason, setTargetReason] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  const selected = useMemo(
    () => orders.find((item) => item.id === orderId) || orders[0] || null,
    [orderId, orders],
  );

  const loadPlan = useCallback(async (id) => {
    if (!id) {
      setPlan(null);
      return;
    }
    const payload = await obtenerPlanOpScm(id);
    setPlan(payload.plan);
  }, []);

  const load = useCallback(async (preferredId) => {
    setBusy(true);
    setError('');
    try {
      const [payload, productItems, presentationItems] = await Promise.all([
        listarOpDemandaScm(),
        buscarProductos(),
        listarPresentacionesComercialesScm({ activo: true }),
      ]);
      setProducts(productItems || []);
      setPresentations(presentationItems || []);
      const items = payload.items || [];
      const nextId = items.some((item) => item.id === preferredId)
        ? preferredId : items[0]?.id || '';
      setOrders(items);
      setOrderId(nextId);
      await loadPlan(nextId);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se cargaron las OP de demanda.'));
    } finally {
      setBusy(false);
    }
  }, [loadPlan]);

  useEffect(() => { load(''); }, [load]);

  const run = async (action, orderOverride = null) => {
    const targetOrder = orderOverride || selected;
    if (!targetOrder) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let result;
      if (action === 'approve') result = await aprobarOpDemandaScm(targetOrder);
      if (action === 'calculate') result = await calcularPlanOpScm(targetOrder);
      if (action === 'confirm') result = await confirmarPlanOpScm(targetOrder, plan);
      const nextOrder = result.orden || result;
      setNotice(
        action === 'approve'
          ? `${nextOrder.codigo} aprobada.`
          : action === 'calculate'
            ? `Plan revisión ${result.plan.revision} calculado sin crear documentos.`
            : `${result.documentos.length} OF/OA creadas en borrador.`,
      );
      await load(targetOrder.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se completó la planificación.'));
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async () => {
    if (
      !createForm.producto_terminado_id
      || !createForm.presentacion_comercial_id
      || Number(createForm.cantidad_presentaciones) <= 0
      || !createForm.fecha_necesidad
    ) {
      setError(
        'Completa producto, presentación, cantidad autorizada y fecha de necesidad según la solicitud.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await crearOpDemandaScm({
        origen: 'PLANIFICACION',
        referencia_origen: createForm.referencia_origen.trim() || undefined,
        fecha_necesidad: createForm.fecha_necesidad,
        prioridad: createForm.prioridad,
        lineas: [{
          producto_terminado_id: createForm.producto_terminado_id,
          presentacion_comercial_id: Number(createForm.presentacion_comercial_id),
          cantidad_presentaciones: Number(createForm.cantidad_presentaciones),
        }],
      });
      setCreateOpen(false);
      setNotice(`${created.codigo} creada en borrador.`);
      await load(created.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se creó la OP de demanda.'));
    } finally {
      setBusy(false);
    }
  };

  const proposal = plan?.propuesta && typeof plan.propuesta === 'object'
    ? plan.propuesta
    : {};
  const documents = Array.isArray(proposal.documentos)
    ? proposal.documentos
    : EMPTY_DOCUMENTS;
  const documentViews = documents.map(documentView);
  const incompleteDocuments = documentViews.filter((item) => !item.operable);
  const proposalIssues = plan?.estado === 'CALCULADO' && !Array.isArray(proposal.asignaciones_demanda)
    ? ['asignaciones de demanda']
    : [];
  const planIntegrityBlocked = incompleteDocuments.length > 0 || proposalIssues.length > 0;
  const selectedLines = Array.isArray(selected?.lineas) ? selected.lineas : [];
  const selectedPresentations = presentations.filter(
    (item) => item.producto_terminado_id === createForm.producto_terminado_id,
  );
  const selectedPresentation = selectedPresentations.find(
    (item) => item.id === Number(createForm.presentacion_comercial_id),
  );
  const createReady = Boolean(
    createForm.producto_terminado_id
    && createForm.presentacion_comercial_id
    && Number(createForm.cantidad_presentaciones) > 0
    && createForm.fecha_necesidad,
  );
  const blockers = Array.isArray(proposal.bloqueos) ? proposal.bloqueos : [];
  const blockerViews = blockers.map(
    (item, index) => routeBlockerView(item, index, selectedLines, selected),
  );
  const hasRouteBlocker = blockerViews.some((view) => (
    String(view.item.codigo || '').includes('ROUTE')
    || String(view.item.motivo_codigo || '').includes('RUTA')
    || /ruta/i.test(view.reason)
  ));
  const stockReservations = Array.isArray(proposal.reservas_stock)
    ? proposal.reservas_stock
    : [];
  const targetDirty = documents.some(
    (item) => String(targetDraft[item.clave] ?? item.cantidad_objetivo)
      !== String(item.cantidad_objetivo),
  );

  useEffect(() => {
    setTargetDraft(Object.fromEntries(
      documents.map((item) => [item.clave, item.cantidad_objetivo]),
    ));
    setTargetReason('');
  }, [documents, plan?.id]);

  useEffect(() => {
    setRouteRefreshOpen(false);
    setRouteRefreshResult(null);
    setCancelOpen(false);
    setCancelReason('');
  }, [selected?.id]);

  const cancelSelectedOrder = async () => {
    if (!selected || !cancelReason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const cancelled = await cancelarOpDemandaScm(selected, cancelReason.trim());
      setOrders((current) => current.map((item) => (
        item.id === cancelled.id ? cancelled : item
      )));
      setCancelOpen(false);
      setCancelReason('');
      setNotice(`${cancelled.codigo} cancelada; el historial fue conservado.`);
      await load(cancelled.id);
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se canceló la OP. Actualiza la pantalla y revisa su estado antes de reintentar.',
      ));
    } finally {
      setBusy(false);
    }
  };

  const refreshOrderRoutes = async () => {
    if (!selected || selected.estado !== 'APROBADA' || !canCalculate) return;
    setBusy(true);
    setError('');
    setNotice('');
    let result;
    try {
      result = await actualizarRutasOpScm(selected);
    } catch (requestError) {
      const reason = mensajeErrorScm(
        requestError,
        'No se actualizó la ingeniería de la OP.',
      );
      setError(
        `${reason} No se modificó la OP. Actualiza la pantalla y revisa la ruta en Ingeniería SCM.`,
      );
      setBusy(false);
      return;
    }

    const changes = Array.isArray(result.cambios) ? result.cambios : [];
    const supersededPlans = Array.isArray(result.planes_superados)
      ? result.planes_superados
      : [];
    setRouteRefreshResult({
      ...result,
      cambios: changes,
      planes_superados: supersededPlans,
    });
    setRouteRefreshOpen(false);
    if (result.orden) {
      setOrders((current) => current.map((item) => (
        item.id === result.orden.id ? result.orden : item
      )));
    }
    if (changes.length === 0) {
      setNotice(
        'La OP no cambió: sus rutas congeladas ya coinciden con la ingeniería aprobada vigente.',
      );
    }
    try {
      await loadPlan(result.orden?.id || selected.id);
    } catch {
      setPlan(null);
      setError(
        'La ingeniería de la OP sí se actualizó, pero no se pudo recargar el plan. Usa Actualizar antes de recalcular.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveTargets = async () => {
    if (!selected || !plan || !targetDirty || planIntegrityBlocked) return;
    if (!targetReason.trim()) {
      setError('Indica el motivo del ajuste para conservar la trazabilidad.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const ajustes = documents
        .filter(
          (item) => String(targetDraft[item.clave]) !== String(item.cantidad_objetivo),
        )
        .map((item) => ({
          clave: item.clave,
          cantidad_objetivo: Number(targetDraft[item.clave]),
        }));
      const result = await ajustarMetasPlanOpScm(
        selected,
        plan,
        ajustes,
        targetReason.trim(),
      );
      setPlan(result.plan);
      setNotice(`Metas guardadas en la revisión ${result.plan.revision}.`);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se guardaron las metas del plan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Planificación de OP"
        description="Calcula cobertura documental y confirma propuestas OF/OA sin consumir inventario ni liberar producción."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(selected?.id)}>
              Actualizar
            </Button>
            {canCreate && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={() => {
                  setCreateForm(emptyCreateForm());
                  setError('');
                  setCreateOpen(true);
                }}
              >
                Nueva OP
              </Button>
            )}
          </Stack>
        )}
      />
      <ProcessJourney current="demanda" />
      {isReadOnly && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. Las acciones de creación, cálculo y
          confirmación se muestran únicamente a los responsables de planificación.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {routeRefreshResult?.cambios?.length > 0 && (
        <Alert severity="success" onClose={() => setRouteRefreshResult(null)}>
          <Stack spacing={1.25}>
            <Box>
              <Typography fontWeight={800}>
                Ingeniería congelada de {routeRefreshResult.orden?.codigo || 'la OP'} actualizada
              </Typography>
              <Typography variant="body2">
                El sistema registró el cambio de cada snapshot. La OP quedó en versión
                {' '}{routeRefreshResult.orden?.version ?? '—'}.
              </Typography>
            </Box>
            {routeRefreshResult.cambios.map((change) => (
              <Paper key={change.linea_id} variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="body2" fontWeight={750}>
                  {change.producto_terminado_id || 'Producto sin código'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {routeSnapshotLabel(change.ruta_anterior)} ({change.ruta_anterior?.estado || 'estado anterior no informado'})
                  {' → '}
                  {routeSnapshotLabel(change.ruta_nueva)} ({change.ruta_nueva?.estado || 'estado nuevo no informado'})
                </Typography>
              </Paper>
            ))}
            <Typography variant="body2">
              {routeRefreshResult.planes_superados.length === 1
                ? '1 plan calculado quedó superado y se conserva para auditoría.'
                : `${routeRefreshResult.planes_superados.length} planes calculados quedaron superados y se conservan para auditoría.`}
            </Typography>
            <Box>
              <Button
                variant="contained"
                disabled={busy || routeRefreshResult.orden?.estado !== 'APROBADA'}
                onClick={() => run('calculate', routeRefreshResult.orden)}
              >
                Recalcular con ingeniería actualizada
              </Button>
            </Box>
          </Stack>
        </Alert>
      )}
      <Alert severity="info">
        El cálculo propone metas según la demanda y el Kardex. Antes de confirmar puedes
        ajustar fabricación o armado; el sistema conservará el valor sugerido, el motivo
        y una nueva revisión auditable.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>OP de demanda</InputLabel>
            <Select
              label="OP de demanda"
              value={selected?.id || ''}
              onChange={async (event) => {
                setOrderId(event.target.value);
                setBusy(true);
                try { await loadPlan(event.target.value); } finally { setBusy(false); }
              }}
            >
              {orders.map((order) => (
                <MenuItem key={order.id} value={order.id}>
                  {order.codigo} · {order.estado} · {order.referencia_origen || 'Sin referencia'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selected && (
            <>
              <Chip label={selected.estado} color={stateColor[selected.estado] || 'default'} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                Necesidad {selected.fecha_necesidad} · versión {selected.version}
              </Typography>
              {canCancel && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<CancelOutlinedIcon />}
                  disabled={busy || !['BORRADOR', 'APROBADA'].includes(selected.estado)}
                  onClick={() => {
                    setError('');
                    setCancelReason('');
                    setCancelOpen(true);
                  }}
                >
                  Cancelar OP
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="outlined"
                  disabled={busy || selected.estado !== 'BORRADOR'}
                  onClick={() => run('approve')}
                >
                  Aprobar OP
                </Button>
              )}
              {canCalculate && (
                <Button
                  variant="contained"
                  disabled={busy || selected.estado !== 'APROBADA'}
                  onClick={() => run('calculate')}
                >
                  {plan?.estado === 'CALCULADO' ? 'Recalcular' : 'Calcular plan'}
                </Button>
              )}
              {canConfirm && (
                <Button
                  color="success"
                  variant="contained"
                  disabled={
                    busy
                    || selected.estado !== 'APROBADA'
                    || plan?.estado !== 'CALCULADO'
                    || blockers.length > 0
                    || planIntegrityBlocked
                  }
                  onClick={() => run('confirm')}
                >
                  Confirmar plan
                </Button>
              )}
            </>
          )}
        </Stack>
      </Paper>

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
      {!busy && !selected && <Alert severity="info">Todavía no existen OP de demanda.</Alert>}

      {!busy && selected && (
        <Paper variant="outlined">
          <Typography fontWeight={800} sx={{ p: 2 }}>Demanda y cobertura</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Producto terminado</TableCell>
                <TableCell align="right">Solicitado</TableCell>
                <TableCell align="right">Planificado</TableCell>
                <TableCell align="right">Comprometido</TableCell>
                <TableCell align="right">Satisfecho</TableCell>
              </TableRow></TableHead>
              <TableBody>{selectedLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.producto || line.producto_terminado_id || 'Producto no disponible'}
                    <br />
                    <Typography variant="caption">
                      {line.producto_terminado_id || 'Sin código de producto'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {line.presentacion_comercial
                      ? `${line.presentacion_comercial.cantidad ?? '—'} ${line.presentacion_comercial.nombre || 'presentación no disponible'} = ${line.cantidad_solicitada ?? '—'} UN`
                      : `${line.cantidad_solicitada ?? '—'} UN`}
                  </TableCell>
                  <TableCell align="right">{line.cobertura?.planificada ?? '—'}</TableCell>
                  <TableCell align="right">{line.cobertura?.comprometida ?? '—'}</TableCell>
                  <TableCell align="right">{line.cobertura?.satisfecha ?? '—'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          {selectedLines.length === 0 && (
            <Alert severity="warning" sx={{ m: 2, mt: 0 }}>
              Esta OP no tiene líneas de demanda consultables. Revisa el origen de la OP
              antes de aprobarla o recalcularla.
            </Alert>
          )}
        </Paper>
      )}

      {plan && (
        <Paper variant="outlined">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
            <Typography fontWeight={800} sx={{ flex: 1 }}>
              Propuesta revisión {plan.revision}
            </Typography>
            <Chip label={plan.estado} color={plan.estado === 'CONFIRMADO' ? 'success' : 'info'} />
            <Chip
              label={proposal.politica_stock || 'Política de stock no registrada'}
              variant="outlined"
            />
          </Stack>
          {blockerViews.length > 0 && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography fontWeight={800}>
                    {blockerViews.length === 1
                      ? 'Hay 1 artículo requerido sin una operación de ruta.'
                      : `Hay ${blockerViews.length} artículos requeridos sin una operación de ruta.`}
                  </Typography>
                  <Typography variant="body2">
                    El plan no puede confirmarse hasta que cada salida requerida exista en la
                    ruta aprobada o quede cubierta por inventario elegible.
                  </Typography>
                </Box>
                {blockerViews.map((view) => (
                  <Paper
                    key={view.key}
                    variant="outlined"
                    sx={{ p: 1.5, bgcolor: 'background.paper' }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      alignItems={{ md: 'center' }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip size="small" label={view.articleCode} />
                          <Chip size="small" variant="outlined" label={view.articleClass} />
                          {view.quantity != null && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${view.quantity} UN requeridas`}
                            />
                          )}
                        </Stack>
                        <Typography fontWeight={750} sx={{ mt: 0.75 }}>
                          {view.articleName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Motivo:</strong> {view.reason}
                        </Typography>
                      </Box>
                      {view.productId ? (
                        <Button
                          component={RouterLink}
                          to={view.route}
                          variant="outlined"
                          sx={{ flexShrink: 0 }}
                        >
                          Revisar ruta del {view.productId}
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Recalcula para recuperar el producto de la línea.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                ))}
                <Typography variant="body2">
                  Publicar la corrección técnica no cambia esta OP aprobada. Si su ruta
                  congelada fue retirada y existe una sucesora aprobada, sigue la secuencia
                  {' '}<strong>corregir maestro → actualizar ingeniería de la OP → recalcular</strong>.
                  {' '}Recalcular por sí solo nunca adopta revisiones nuevas.
                </Typography>
                {canCalculate && selected?.estado === 'APROBADA' && hasRouteBlocker && (
                  <Box>
                    <Button
                      variant="contained"
                      color="warning"
                      disabled={busy}
                      onClick={() => setRouteRefreshOpen(true)}
                    >
                      Actualizar ingeniería de la OP
                    </Button>
                  </Box>
                )}
              </Stack>
            </Alert>
          )}
          {stockReservations.length > 0 && (
            <Alert severity="success" sx={{ mx: 2, mb: 2 }}>
              Kardex cubre {stockReservations.reduce(
                (total, item) => total + Number(item.cantidad || 0),
                0,
              ).toLocaleString('es-PE')} unidades en esta propuesta. Al confirmar
              quedarán reservadas; la existencia física no se consumirá todavía.
            </Alert>
          )}
          {incompleteDocuments.length > 0 && (
            <Alert
              severity={plan.estado === 'CALCULADO' ? 'error' : 'warning'}
              sx={{ mx: 2, mb: 2 }}
            >
              {incompleteDocuments.length === 1
                ? `1 documento ${plan.estado === 'CONFIRMADO' ? 'histórico' : 'propuesto'} tiene`
                : `${incompleteDocuments.length} documentos ${plan.estado === 'CONFIRMADO' ? 'históricos' : 'propuestos'} tienen`}{' '}
              datos incompletos de artículo, operación, versión de ruta, tipo de orden o meta.{' '}
              {plan.estado === 'CALCULADO'
                ? 'No puedes confirmar esta revisión: recalcula el plan y, si el aviso continúa, regulariza la ruta o el maestro indicado.'
                : 'La revisión se conserva para consulta; consulta las OF/OA ya creadas y solicita regularizar el dato si necesitas reconstruir su trazabilidad.'}
            </Alert>
          )}
          {proposalIssues.length > 0 && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              Esta revisión calculada no conserva {proposalIssues.join(', ')}. No puedes
              confirmarla: recalcula el plan y, si el aviso continúa, revisa la OP y su
              ruta aprobada.
            </Alert>
          )}
          {plan.estado === 'CALCULADO' && canCalculate && (
            <Alert severity="info" sx={{ mx: 2, mb: 2 }}>
              Puedes reducir las metas hasta 0 cuando exista cobertura externa al plan.
              Para producir más, aumenta la demanda o recalcula. Explica el motivo antes
              de guardar.
            </Alert>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Documento propuesto</TableCell>
                <TableCell>Operación</TableCell>
                <TableCell>Salida</TableCell>
                <TableCell align="right">Sugerido</TableCell>
                <TableCell align="right">Meta confirmable</TableCell>
                <TableCell>Configuración</TableCell>
                <TableCell>Continuar en</TableCell>
              </TableRow></TableHead>
              <TableBody>{documentViews.map((view) => {
                const { item } = view;
                return (
                <TableRow key={view.key}>
                  <TableCell>
                    <Chip size="small" label={view.typeLabel} />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {view.key}
                    </Typography>
                  </TableCell>
                  <TableCell>{view.operationLabel}</TableCell>
                  <TableCell>
                    {view.articleName}
                    <br />
                    <Typography variant="caption">{view.articleCode}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {view.quantity ?? '—'} un
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 170 }}>
                    {plan.estado === 'CALCULADO' && canCalculate && view.operable ? (
                      <TextField
                        size="small"
                        type="number"
                        value={targetDraft[item.clave] ?? item.cantidad_objetivo}
                        inputProps={{
                          min: 0,
                          max: Number(item.cantidad_calculada ?? item.cantidad_objetivo),
                          step: 1,
                        }}
                        onChange={(event) => setTargetDraft((current) => ({
                          ...current,
                          [item.clave]: event.target.value,
                        }))}
                        error={
                          Number(targetDraft[item.clave]) < 0
                          || Number(targetDraft[item.clave])
                            > Number(item.cantidad_calculada ?? item.cantidad_objetivo)
                        }
                        sx={{ width: 130 }}
                      />
                    ) : `${item.cantidad_objetivo ?? '—'} un`}
                  </TableCell>
                  <TableCell>
                    {!view.operable
                      ? `Datos incompletos: ${view.issues.join(', ')}`
                      : item.requiere_configuracion_tecnica
                        ? 'Pendiente técnica'
                        : 'Lista para revisión'}
                  </TableCell>
                  <TableCell>
                    {plan.estado === 'CONFIRMADO' && documentTypeLabel[item.tipo] ? (
                      <Button
                        component={RouterLink}
                        size="small"
                        to={item.tipo === 'FABRICACION'
                          ? '/produccion/ordenes-fabricacion'
                          : '/produccion/ordenes-armado'}
                      >
                        Abrir {item.tipo === 'FABRICACION' ? 'OF' : 'OA'}
                      </Button>
                    ) : plan.estado === 'CONFIRMADO'
                      ? 'Destino no disponible'
                      : 'Al confirmar'}
                  </TableCell>
                </TableRow>
                );
              })}</TableBody>
            </Table>
          </TableContainer>
          {plan.estado === 'CALCULADO' && canCalculate && (
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ md: 'center' }}
              sx={{ p: 2 }}
            >
              <TextField
                fullWidth
                label="Motivo del ajuste"
                placeholder="Ej.: cubrir parte con inventario inicial pendiente de cargar"
                value={targetReason}
                onChange={(event) => setTargetReason(event.target.value)}
                disabled={!targetDirty}
              />
              <Button
                variant="contained"
                onClick={saveTargets}
                disabled={busy || !targetDirty || !targetReason.trim() || planIntegrityBlocked}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Guardar metas
              </Button>
            </Stack>
          )}
        </Paper>
      )}
      <Dialog
        open={cancelOpen}
        onClose={() => !busy && setCancelOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="cancel-op-title"
      >
        <DialogTitle id="cancel-op-title">
          Cancelar {selected?.codigo || 'OP'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="warning">
              Esta acción conserva la OP y su historial, pero impide continuar su
              planificación. No equivale a eliminar el registro.
            </Alert>
            <Typography variant="body2">
              Solo se cancelará <strong>{selected?.codigo || 'la OP seleccionada'}</strong>;
              {' '}las demás OP no serán modificadas.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Referencia: {selected?.referencia_origen || 'sin referencia'} · estado actual:{' '}
              {selected?.estado || 'no disponible'}.
            </Typography>
            <TextField
              autoFocus
              required
              fullWidth
              multiline
              minRows={3}
              label="Motivo de cancelación"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              helperText="El motivo quedará registrado con tu identidad y la versión de la OP."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setCancelOpen(false)}>
            Volver
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy || !cancelReason.trim()}
            onClick={cancelSelectedOrder}
          >
            Confirmar cancelación
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={routeRefreshOpen}
        onClose={() => !busy && setRouteRefreshOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="route-refresh-title"
      >
        <DialogTitle id="route-refresh-title">
          Actualizar ingeniería congelada de la OP
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="warning">
              Esta acción reemplaza los snapshots técnicos de ruta congelados en la OP
              por sus sucesoras aprobadas. Puede dejar planes calculados como superados,
              pero no crea OF/OA ni recalcula el plan.
            </Alert>
            <Typography variant="body2">
              Recalcular por sí solo nunca adopta revisiones nuevas. Confirma esta acción
              supervisada sólo después de verificar la corrección publicada en Ingeniería SCM.
            </Typography>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Snapshots congelados que se validarán
              </Typography>
              <Stack spacing={1}>
                {selectedLines.map((line) => {
                  const frozen = line.ruta_congelada || line.ruta_revision;
                  const approved = line.ruta_aprobada || line.ruta_nueva;
                  return (
                    <Paper key={line.id} variant="outlined" sx={{ p: 1.25 }}>
                      <Typography variant="body2" fontWeight={750}>
                        {line.producto_terminado_id || line.producto || 'Producto sin código'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Actual: {routeSnapshotLabel(frozen, line.ruta_revision_id)}
                        {approved ? ` → Aprobada: ${routeSnapshotLabel(approved)}` : ''}
                      </Typography>
                    </Paper>
                  );
                })}
                {selectedLines.length === 0 && (
                  <Alert severity="error">
                    La OP no expone líneas verificables. Cierra este cuadro y actualiza la pantalla.
                  </Alert>
                )}
              </Stack>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Si la versión de la OP cambió, falta una ruta aprobada o la ruta no es una
              sucesora válida, el sistema rechazará la operación sin modificar la OP.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setRouteRefreshOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy || selectedLines.length === 0}
            onClick={refreshOrderRoutes}
          >
            Confirmar actualización
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva OP de demanda</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 800 }}>
                Datos que debe proporcionar la solicitud
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Planificación confirma el producto terminado, la presentación, la cantidad
                autorizada y la fecha de necesidad. La referencia y la prioridad se registran
                cuando la solicitud las incluye. No crees la OP sin una cantidad autorizada.
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                <strong>Responsable cuando falta un dato:</strong> quien solicita la demanda debe
                completarlo o autorizarlo; Planificación no lo supone.
              </Typography>
            </Alert>
            <Alert severity="info">
              <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 800 }}>
                Lo que deriva el sistema
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Convierte las presentaciones confirmadas a unidades equivalentes del PT. La
                cobertura y la propuesta OF/OA se calculan después; no determinan la cantidad
                solicitada ni la fecha.
              </Typography>
            </Alert>
            <FormControl fullWidth>
              <InputLabel id="op-product-label">Producto terminado</InputLabel>
              <Select
                labelId="op-product-label"
                id="op-product"
                label="Producto terminado"
                value={createForm.producto_terminado_id}
                onChange={(event) => {
                  const productId = event.target.value;
                  const options = presentations.filter(
                    (item) => item.producto_terminado_id === productId,
                  );
                  const defaultPresentation = options.find((item) => item.predeterminada)
                    || options[0];
                  setCreateForm({
                    ...createForm,
                    producto_terminado_id: productId,
                    presentacion_comercial_id: defaultPresentation?.id || '',
                    cantidad_presentaciones: '',
                  });
                }}
              >
                {products.map((product) => (
                  <MenuItem key={product.cod_sku_pt} value={product.cod_sku_pt}>
                    {product.cod_sku_pt} · {product.producto}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!createForm.producto_terminado_id}>
              <InputLabel id="op-presentation-label">Presentación comercial</InputLabel>
              <Select
                labelId="op-presentation-label"
                id="op-presentation"
                label="Presentación comercial"
                value={createForm.presentacion_comercial_id}
                onChange={(event) => setCreateForm({
                  ...createForm,
                  presentacion_comercial_id: event.target.value,
                })}
              >
                {selectedPresentations.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.nombre} · {item.unidades_base} UN
                    {item.predeterminada ? ' · Predeterminada' : ''}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {selectedPresentation?.predeterminada
                  ? 'Se propone la presentación predeterminada del maestro. Confírmala o cámbiala según la solicitud.'
                  : selectedPresentation
                    ? 'Confirma que esta presentación coincide con la solicitud.'
                    : 'Selecciona el producto y luego confirma la presentación indicada en la solicitud.'}
              </FormHelperText>
            </FormControl>
            <TextField
              label="Cantidad de presentaciones"
              type="number"
              required
              value={createForm.cantidad_presentaciones}
              inputProps={{ min: 1, step: 1 }}
              onChange={(event) => setCreateForm({
                ...createForm,
                cantidad_presentaciones: event.target.value,
              })}
              helperText={selectedPresentation && Number(createForm.cantidad_presentaciones) > 0
                ? `${createForm.cantidad_presentaciones} ${selectedPresentation.nombre} = ${Number(createForm.cantidad_presentaciones) * selectedPresentation.unidades_base} UN`
                : 'Ingresa la cantidad autorizada en la solicitud; el sistema no la estima.'}
            />
            <TextField
              label="Fecha de necesidad"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
              value={createForm.fecha_necesidad}
              onChange={(event) => setCreateForm({
                ...createForm,
                fecha_necesidad: event.target.value,
              })}
              helperText="Fecha requerida por la demanda; no es la fecha de inicio de producción ni una promesa de entrega."
            />
            <FormControl fullWidth>
              <InputLabel id="op-priority-label">Prioridad (si aplica)</InputLabel>
              <Select
                labelId="op-priority-label"
                id="op-priority"
                label="Prioridad (si aplica)"
                value={createForm.prioridad}
                onChange={(event) => setCreateForm({
                  ...createForm,
                  prioridad: event.target.value,
                })}
              >
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="ALTA">Alta</MenuItem>
                <MenuItem value="URGENTE">Urgente</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Referencia de la solicitud (si existe)"
              value={createForm.referencia_origen}
              onChange={(event) => setCreateForm({
                ...createForm,
                referencia_origen: event.target.value,
              })}
              helperText="Ej.: pedido, reposición autorizada o solicitud interna. El origen de esta OP se registra como Planificación."
            />
            <Alert severity="info">
              Al guardar se congelan las revisiones BOM y ruta aprobadas disponibles.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={createOrder} disabled={busy || !createReady}>
            Crear OP en borrador
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
