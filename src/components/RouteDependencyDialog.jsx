import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RouteRevisionEditor from './scmEngineering/editors/RouteRevisionEditor';
import {
  buildRoutePayload,
  emptyRouteValue,
  normalizeRouteRevision,
} from './scmEngineering/editors/engineeringEditorModel';
import {
  actualizarRutaScm,
  crearCentroTrabajoScm,
  crearRutaArticuloScm,
  listarCentrosTrabajoScm,
  listarRutasArticuloScm,
  mensajeErrorScm,
  obtenerActorScm,
  resolverArticulosScm,
} from '../services/scmEngineeringApi';

const routeIdOf = (route) => route?.operacion_ruta_revision_id ?? route?.id ?? route?.revision_id;
const routeStatus = (route) => route?.estado || route?.status || 'BORRADOR';
const routeStatusLabel = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RETIRADA: 'Retirada',
  RECHAZADA: 'Rechazada',
};
const centerExecutorForType = (type) => (
  ['INYECCION', 'SOPLADO'].includes(type) ? 'OP_OT' : 'ORDEN_OPERACION'
);

function RouteDependencyBody({
  run,
  selectedRoute,
  targetArticle,
  articleId,
  canView,
  canAdmin,
  frozen,
  frozenHash,
  onSaved,
  orderCode,
  actorId: actorIdProp,
  onClose,
  parentDialog = false,
  closeRequestRef,
}) {
  const actorId = actorIdProp || obtenerActorScm();
  const [routes, setRoutes] = useState([]);
  const [centers, setCenters] = useState([]);
  const [catalogState, setCatalogState] = useState('idle');
  const [catalogError, setCatalogError] = useState('');
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeSeverity, setNoticeSeverity] = useState('success');
  const [routeUncertain, setRouteUncertain] = useState(false);
  const [resolvedTarget, setResolvedTarget] = useState(null);
  const [identityState, setIdentityState] = useState('unknown');
  const [targetChoice, setTargetChoice] = useState(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const [closeIntent, setCloseIntent] = useState('list');
  const [centerIndex, setCenterIndex] = useState(null);
  const [centerForm, setCenterForm] = useState({ nombre: '', tipo: 'PREARMADO' });
  const [centerBusy, setCenterBusy] = useState(false);
  const [centerError, setCenterError] = useState('');
  const [centerUncertain, setCenterUncertain] = useState(false);
  const abortRef = useRef(null);
  const generationRef = useRef(0);
  const identityStateRef = useRef('unknown');
  const notify = (message, severity = 'success') => {
    setNotice(message);
    setNoticeSeverity(severity);
  };

  const baseTarget = useMemo(() => {
    if (targetArticle?.id != null) return targetArticle;
    if (selectedRoute?.articulo_salida?.id != null) return selectedRoute.articulo_salida;
    return null;
  }, [selectedRoute, targetArticle]);
  const candidateTargets = useMemo(() => (run?.salidas || [])
    .map((item) => item?.articulo)
    .filter((article) => article && !['PRODUCTO_TERMINADO', 'SUBENSAMBLE_WIP'].includes(article.clase)), [run]);
  const directTarget = targetChoice || baseTarget;
  const effectiveTarget = resolvedTarget || directTarget;
  const targetId = effectiveTarget?.id ?? articleId;
  const targetNeedsResolution = directTarget?.clase == null;
  const targetIsDirectPieceColor = effectiveTarget?.clase === 'PIEZA_COLOR';
  const effectiveCanView = Boolean(canView && targetIsDirectPieceColor && (!targetNeedsResolution || identityState === 'ready'));
  const reconciledRoute = useMemo(() => {
    if (!routeUncertain || !routeForm || !effectiveTarget?.id) return null;
    const expected = JSON.stringify(buildRoutePayload(routeForm, effectiveTarget, [effectiveTarget]));
    const matches = routes.filter((route) => {
      if (routeStatus(route) !== 'BORRADOR'
        || String(route.articulo_objetivo_id ?? route.articulo_objetivo?.id) !== String(effectiveTarget.id)) return false;
      if (editingRoute && (String(route.id) !== String(editingRoute.id)
        || Number(route.version) <= Number(editingRoute.version))) return false;
      return JSON.stringify(buildRoutePayload(normalizeRouteRevision(route, effectiveTarget, [effectiveTarget]), effectiveTarget, [effectiveTarget])) === expected;
    });
    return matches.length === 1 ? matches[0] : null;
  }, [editingRoute, effectiveTarget, routeForm, routeUncertain, routes]);
  const reconciledCenter = useMemo(() => {
    if (!centerUncertain || centerIndex == null || !centerForm.nombre.trim()) return null;
    const normalizedName = centerForm.nombre.trim().toLocaleLowerCase();
    const matches = centers.filter((center) => center.nombre?.trim().toLocaleLowerCase() === normalizedName
      && center.tipo === centerForm.tipo);
    return matches.length === 1 ? matches[0] : null;
  }, [centerForm.nombre, centerForm.tipo, centerIndex, centerUncertain, centers]);
  const runContext = [orderCode || run?.codigo || run?.id, run?.color_nombre || run?.color?.nombre || run?.color_produccion?.nombre]
    .filter(Boolean).join(' · ');
  const dirty = Boolean(routeForm && baseline && JSON.stringify(routeForm) !== JSON.stringify(baseline));
  const pendingDraft = dirty || (centerIndex != null && Boolean(centerForm.nombre.trim()));
  const readOnly = frozen || !canAdmin || !targetIsDirectPieceColor;

  const loadCatalog = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    if (!targetId || !canView || (targetNeedsResolution && identityStateRef.current === 'restricted')) {
      setCatalogState('ready');
      setRoutes([]);
      setCenters([]);
      return;
    }
    setCatalogState('loading');
    setCatalogError('');
    try {
      if (targetNeedsResolution && identityStateRef.current !== 'ready') {
        identityStateRef.current = 'loading';
        setIdentityState('loading');
        const resolvedPayload = await resolverArticulosScm(actorId, [Number(targetId)], controller.signal);
        const resolved = (resolvedPayload?.items || []).find((item) => String(item.id) === String(targetId));
        if (controller.signal.aborted || generationRef.current !== generation) return;
        if (!resolved || resolved.clase !== 'PIEZA_COLOR') {
          identityStateRef.current = 'restricted';
          setIdentityState('restricted');
          setCatalogState('ready');
          setRoutes([]);
          setCenters([]);
          return;
        }
        identityStateRef.current = 'ready';
        setResolvedTarget(resolved);
        setIdentityState('ready');
      }
      if (!targetNeedsResolution && directTarget?.clase !== 'PIEZA_COLOR') {
        setCatalogState('ready');
        setRoutes([]);
        setCenters([]);
        return;
      }
      const [routeRows, centerRows] = await Promise.all([
        listarRutasArticuloScm(Number(targetId), actorId, controller.signal),
        listarCentrosTrabajoScm(actorId, controller.signal),
      ]);
      if (controller.signal.aborted || generationRef.current !== generation) return;
      setRoutes(routeRows || []);
      setCenters(centerRows || []);
      setCatalogState('ready');
    } catch (error) {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      setCatalogState('error');
      setCatalogError(mensajeErrorScm(error, 'No se pudieron cargar las rutas y centros de trabajo.'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [actorId, canView, directTarget?.clase, targetId, targetNeedsResolution]);

  useEffect(() => {
    setEditingRoute(null);
    setRouteForm(null);
    setBaseline(null);
    notify('');
    setClosePrompt(false);
    setCenterIndex(null);
    setCenterError('');
    setCenterUncertain(false);
    setResolvedTarget(null);
    identityStateRef.current = directTarget?.clase == null ? 'unknown' : 'ready';
    setIdentityState(identityStateRef.current);
    loadCatalog();
    return () => {
      abortRef.current?.abort();
      generationRef.current += 1;
    };
  }, [directTarget?.clase, loadCatalog]);

  const openRoute = (revision = null) => {
    if (readOnly && routeStatus(revision) === 'BORRADOR') return;
    const next = revision
      ? normalizeRouteRevision(revision, effectiveTarget, effectiveTarget ? [effectiveTarget] : [])
      : emptyRouteValue(effectiveTarget);
    setEditingRoute(revision);
    setRouteForm(next);
    setBaseline(next);
    notify('');
    setClosePrompt(false);
  };

  const requestCloseEditor = useCallback(() => {
    if (saving || centerBusy) {
      notify('Espera a que termine la escritura antes de salir.', 'warning');
      return;
    }
    if (routeUncertain || centerUncertain) {
      notify('Confirma el resultado consultando el catálogo antes de salir.', 'warning');
      return;
    }
    if (pendingDraft) {
      setCloseIntent('list');
      setClosePrompt(true);
      return;
    }
    setRouteForm(null);
    setEditingRoute(null);
    setCenterIndex(null);
  }, [centerBusy, centerUncertain, pendingDraft, routeUncertain, saving]);

  const requestDialogClose = useCallback(() => {
    if (saving || centerBusy) {
      notify('Espera a que termine la escritura antes de salir.', 'warning');
      return;
    }
    if (routeUncertain || centerUncertain) {
      notify('Confirma el resultado consultando el catálogo antes de salir.', 'warning');
      return;
    }
    if (pendingDraft) {
      setCloseIntent('host');
      setClosePrompt(true);
      return;
    }
    onClose?.();
  }, [centerBusy, centerUncertain, onClose, pendingDraft, routeUncertain, saving]);

  useEffect(() => {
    if (!closeRequestRef) return undefined;
    closeRequestRef.current = requestDialogClose;
    return () => {
      if (closeRequestRef.current === requestDialogClose) closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestDialogClose]);

  const saveRoute = async (payload = buildRoutePayload(routeForm, effectiveTarget, effectiveTarget ? [effectiveTarget] : [])) => {
    if (readOnly || saving) return;
    setSaving(true);
    notify('');
    try {
      const result = editingRoute
        ? await actualizarRutaScm(editingRoute.id, { ...payload, version: editingRoute.version })
        : await crearRutaArticuloScm(Number(targetId), payload);
      const persisted = result?.revision || result?.ruta || result;
      setRouteUncertain(false);
      notify(editingRoute ? 'Borrador de ruta actualizado.' : 'Borrador de ruta creado.');
      setRouteForm(null);
      setEditingRoute(null);
      setBaseline(null);
      setCenterIndex(null);
      await loadCatalog();
      onSaved?.(persisted);
    } catch (error) {
      const status = error?.response?.status || error?.status;
      const uncertain = !(Number(status) >= 400 && Number(status) < 500);
      if (uncertain) setRouteUncertain(true);
      notify(
        mensajeErrorScm(error, 'No se pudo guardar el borrador de ruta. El formulario se conservó para reintentar.'),
        uncertain || Number(status) === 409 ? 'warning' : 'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const selectCenter = (index, center) => {
    setRouteForm((current) => {
      if (!current) return current;
      const operations = [...current.operaciones];
      const operation = operations[index];
      operations[index] = {
        ...operation,
        centro_trabajo_id: String(center.id),
        tipo: center.tipo || operation.tipo,
        executor_kind: centerExecutorForType(center.tipo || operation.tipo),
      };
      return { ...current, operaciones: operations };
    });
  };

  const createCenter = async () => {
    if (!centerForm.nombre.trim() || centerBusy || centerUncertain || centerIndex == null) return;
    const expectedType = routeForm?.operaciones?.[centerIndex]?.tipo;
    if (['INYECCION', 'SOPLADO'].includes(expectedType) && centerForm.tipo !== expectedType) {
      setCenterError(`Este paso terminal requiere un centro compatible con ${expectedType}.`);
      return;
    }
    setCenterBusy(true);
    setCenterError('');
    try {
      const created = await crearCentroTrabajoScm({ nombre: centerForm.nombre.trim(), tipo: centerForm.tipo });
      const center = created?.centro || created?.center || created;
      if (!center?.id) throw Object.assign(new Error('La respuesta no contiene el ID del centro.'), { uncertainCreation: true });
      setCenters((current) => [...current.filter((item) => String(item.id) !== String(center.id)), center]);
      selectCenter(centerIndex, center);
      setCenterIndex(null);
      setCenterForm({ nombre: '', tipo: 'PREARMADO' });
      notify('Centro confirmado y seleccionado. El centro se conserva aunque canceles la ruta.');
    } catch (error) {
      const status = error?.response?.status || error?.status;
      if (error?.uncertainCreation || !(Number(status) >= 400 && Number(status) < 500)) setCenterUncertain(true);
      setCenterError(mensajeErrorScm(error, 'No se pudo confirmar el centro. Revisa el catálogo antes de repetir el alta.'));
    } finally {
      setCenterBusy(false);
    }
  };

  const createCenterPanel = centerIndex == null ? null : {
    operationIndex: centerIndex,
    node: (
      <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'background.default' }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Crear centro de trabajo aquí</Typography>
          <Typography variant="caption" color="text.secondary">
            El centro se guarda como transacción independiente y no se revierte al cancelar la ruta.
          </Typography>
          {centerError && <Alert severity="warning">{centerError}</Alert>}
          {centerUncertain && (
            <Alert severity="warning" action={(
              <Stack direction="row" spacing={0.5}>
                <Button color="inherit" size="small" onClick={() => { loadCatalog(); notify('Catálogo consultado. No se repite el alta incierta del centro.', 'warning'); }}>Consultar catálogo</Button>
                {reconciledCenter && <Button color="inherit" size="small" onClick={() => { selectCenter(centerIndex, reconciledCenter); setCenterUncertain(false); setCenterIndex(null); notify('Centro existente adoptado tras reconciliar el catálogo.', 'success'); }}>Adoptar encontrado</Button>}
              </Stack>
            )}>
              Alta incierta: el borrador se conserva y no se repetirá el POST automáticamente.
            </Alert>
          )}
          {centerIndex != null && !['INYECCION', 'SOPLADO'].includes(routeForm?.operaciones?.[centerIndex]?.tipo) && (
            <Alert severity="info">Selecciona primero INYECCIÓN o SOPLADO para crear un centro terminal de Pieza-color.</Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Nombre del centro"
              value={centerForm.nombre}
              disabled={centerBusy || centerUncertain}
              onChange={(event) => setCenterForm((current) => ({ ...current, nombre: event.target.value }))}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="route-center-type-label">Tipo compatible</InputLabel>
              <Select
                labelId="route-center-type-label"
                label="Tipo compatible"
                value={centerForm.tipo}
                disabled={centerBusy || centerUncertain}
                onChange={(event) => setCenterForm((current) => ({ ...current, tipo: event.target.value }))}
              >
                {['INYECCION', 'SOPLADO', 'PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" onClick={() => setCenterIndex(null)} disabled={centerBusy}>Cancelar panel</Button>
            <Button size="small" variant="contained" onClick={createCenter} disabled={centerBusy || centerUncertain || !centerForm.nombre.trim() || !['INYECCION', 'SOPLADO'].includes(routeForm?.operaciones?.[centerIndex]?.tipo)}>
              {centerBusy ? 'Creando…' : 'Crear y seleccionar'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    ),
  };

  const content = (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}
        sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', py: 1 }}>
        <Box>
        <Typography variant="body2" color="text.secondary">OF {runContext || 'objetivo'} · artículo directo {directTarget?.codigo || directTarget?.nombre || targetId || 'no resuelto'}</Typography>
        {frozenHash && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Hash congelado: {frozenHash}</Typography>}
        </Box>
        {parentDialog && <Button size="small" onClick={requestDialogClose}>Volver a OF</Button>}
      </Stack>
      {!directTarget && candidateTargets.length > 0 && (
        <Alert severity="info">
          Selecciona explícitamente la salida Pieza-color que administrará esta ruta.
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            {candidateTargets.map((article) => (
              <Button key={article.id} size="small" variant="outlined" onClick={() => setTargetChoice(article)}>
                {article.codigo || article.nombre || article.id}
              </Button>
            ))}
          </Stack>
        </Alert>
      )}
      {!effectiveCanView && directTarget && <Alert severity="warning">Identidad propietaria no disponible para esta corrida. Solo se admite una Pieza-color directa; no se consulta ni administra otra salida por aproximación.</Alert>}
      {catalogState === 'loading' && <Alert severity="info" icon={<CircularProgress size={18} />}>Cargando rutas y centros…</Alert>}
      {catalogState === 'error' && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={loadCatalog}>Reintentar</Button>}>{catalogError}</Alert>}
      {notice && <Alert severity={noticeSeverity}>{notice}</Alert>}
      {routeUncertain && (
        <Alert severity="warning" action={(
          <Stack direction="row" spacing={0.5}>
            <Button color="inherit" size="small" onClick={loadCatalog}>Consultar rutas</Button>
            {reconciledRoute && <Button color="inherit" size="small" onClick={() => { const adopted = normalizeRouteRevision(reconciledRoute, effectiveTarget, effectiveTarget ? [effectiveTarget] : []); setEditingRoute(reconciledRoute); setRouteForm(adopted); setBaseline(adopted); setRouteUncertain(false); notify('Resultado de ruta adoptado tras reconciliar el catálogo.', 'success'); }}>Usar resultado</Button>}
          </Stack>
        )}>Resultado incierto: el borrador se conserva y no se repetirá el POST. Consulta el catálogo antes de cerrar.</Alert>
      )}
      {closePrompt && (
        <Alert severity="warning" action={<Stack direction="row" spacing={0.5}><Button color="inherit" size="small" onClick={() => setClosePrompt(false)}>Seguir editando</Button><Button color="inherit" size="small" onClick={() => { setClosePrompt(false); setRouteForm(null); setEditingRoute(null); setBaseline(null); setCenterIndex(null); if (closeIntent === 'host') onClose?.(); }}>Descartar cambios de ruta</Button></Stack>}>
          Hay un borrador de ruta sin guardar. Un centro ya confirmado no se revierte.
        </Alert>
      )}
      {routeForm ? (
        <>
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={requestCloseEditor} disabled={saving || centerBusy} sx={{ alignSelf: 'flex-start' }}>Volver a rutas</Button>
          <RouteRevisionEditor
            targetArticle={effectiveTarget}
            articles={effectiveTarget ? [effectiveTarget] : []}
            centers={centers}
            structures={[]}
            revision={editingRoute}
            value={routeForm}
            onChange={setRouteForm}
            onCreateCenter={(index, operation) => {
              setCenterIndex(index);
              setCenterError('');
              setCenterForm({
                nombre: '',
                tipo: ['INYECCION', 'SOPLADO'].includes(operation?.tipo) ? operation.tipo : 'PREARMADO',
              });
            }}
            createCenterPanel={createCenterPanel}
            onCancel={requestCloseEditor}
            onSubmit={saveRoute}
            busy={saving || centerBusy || routeUncertain}
            readOnly={readOnly || routeStatus(editingRoute) !== 'BORRADOR'}
            submitLabel={editingRoute ? 'Guardar borrador' : 'Crear borrador'}
            showHeading={false}
          />
        </>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box><Typography component="h3" variant="h6">Rutas del artículo</Typography><Typography variant="body2" color="text.secondary">Selecciona una revisión para consultar o editarla.</Typography></Box>
            <Button startIcon={<AddOutlinedIcon />} variant="outlined" onClick={() => openRoute()} disabled={readOnly || !directTarget?.id}>Nueva ruta</Button>
          </Stack>
          <Divider />
          {!routes.length && catalogState === 'ready' && <Alert severity="info">No hay revisiones de ruta para este artículo.</Alert>}
          <Stack spacing={1}>
            {routes.map((revision) => {
              const status = routeStatus(revision);
              const editable = !readOnly && status === 'BORRADOR';
              return (
                <Paper key={routeIdOf(revision) || `${status}-${revision.numero_revision}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                    <Box><Typography fontWeight={750}>{revision.nombre || revision.codigo || `Ruta rev. ${revision.numero_revision || '—'}`}</Typography><Typography variant="caption" color="text.secondary">{routeStatusLabel[status] || status}{revision.numero_revision ? ` · revisión ${revision.numero_revision}` : ''}</Typography></Box>
                    <Button size="small" variant={editable ? 'contained' : 'outlined'} onClick={() => openRoute(revision)}>{editable ? 'Abrir borrador' : 'Ver revisión'}</Button>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );

  return content;
}

export default function RouteDependencyDialog({
  open,
  onClose,
  parentDialog = false,
  externalCloseRequestRef,
  ...props
}) {
  const internalCloseRequestRef = useRef(null);
  const closeRequestRef = externalCloseRequestRef || internalCloseRequestRef;
  const requestClose = () => {
    if (closeRequestRef.current) {
      closeRequestRef.current();
      return;
    }
    onClose?.();
  };
  if (parentDialog) return <RouteDependencyBody {...props} parentDialog closeRequestRef={closeRequestRef} onClose={onClose} />;
  return (
    <Dialog open={open} onClose={requestClose} fullWidth maxWidth="lg" scroll="paper" aria-labelledby="route-dependency-title">
      <DialogTitle id="route-dependency-title">Administrar ruta contextual</DialogTitle>
      <DialogContent dividers><RouteDependencyBody {...props} parentDialog={false} closeRequestRef={closeRequestRef} onClose={onClose} /></DialogContent>
      <DialogActions><Button onClick={requestClose}>Volver a OF</Button></DialogActions>
    </Dialog>
  );
}
