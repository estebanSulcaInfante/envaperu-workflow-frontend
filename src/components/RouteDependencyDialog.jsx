import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
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
import StructureRevisionEditor from './scmEngineering/editors/StructureRevisionEditor';
import {
  buildRoutePayload,
  emptyRouteValue,
  normalizeRouteRevision,
  buildStructurePayload,
  emptyStructureValue,
  normalizeStructureRevision,
} from './scmEngineering/editors/engineeringEditorModel';
import {
  actualizarRutaScm,
  actualizarEstructuraScm,
  crearCentroTrabajoScm,
  crearArticuloWipScm,
  crearEstructuraScm,
  hidratarEstructurasScm,
  enviarEstructuraScm,
  aprobarEstructuraScm,
  publicarEstructuraScm,
  rechazarEstructuraScm,
  descartarEstructuraScm,
  retirarEstructuraScm,
  crearRutaArticuloScm,
  listarArticulosPaginaScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarRutasArticuloScm,
  aprobarRutaScm,
  publicarRutaScm,
  retirarRutaScm,
  obtenerRutaScm,
  mensajeErrorScm,
  obtenerActorScm,
  resolverArticulosScm,
} from '../services/scmEngineeringApi';
import { useOperationMessage } from '../utils/operationFeedbackState';

const routeIdOf = (route) => route?.operacion_ruta_revision_id ?? route?.id ?? route?.revision_id;
const routeStatus = (route) => route?.estado || route?.status || 'BORRADOR';
const routeStatusLabel = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RETIRADA: 'Retirada',
  RECHAZADA: 'Rechazada',
};
const creatorIdOf = (revision) => revision?.creado_por_actor_id
  ?? revision?.creador_actor_id
  ?? revision?.created_by_actor_id
  ?? revision?.creado_por_id
  ?? revision?.creada_por_id
  ?? revision?.created_by;
const centerExecutorForType = (type) => (
  ['INYECCION', 'SOPLADO'].includes(type) ? 'OP_OT' : 'ORDEN_OPERACION'
);
const articleLabel = (article, fallback = 'no resuelto') => {
  if (!article) return fallback;
  const primary = article.nombre || article.codigo || article.id;
  return article.nombre && article.codigo
    ? `${primary} · ${article.codigo}`
    : String(primary);
};

const cloneForAttempt = (value) => {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
};

const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const contentHashOf = (revision) => revision?.content_hash ?? revision?.hash ?? revision?.contenido_hash ?? null;
const versionOf = (revision) => Number(revision?.version);
const ownerIdOf = (revision, entity) => {
  if (entity === 'route') {
    return revision?.articulo_objetivo_id
      ?? revision?.articulo_objetivo?.id
      ?? revision?.articulo_salida_id
      ?? revision?.articulo_salida?.id
      ?? null;
  }
  return revision?.articulo_resultado_id
    ?? revision?.articulo_objetivo_id
    ?? revision?.articulo_resultado?.id
    ?? revision?.articulo_objetivo?.id
    ?? revision?.article_id
    ?? null;
};
const wipDTOOf = (article) => article?.wip || article?.subtipo || article || {};
const normalizedWipPayload = (payload = {}) => ({
  nombre: String(payload.nombre ?? '').trim(),
  descripcion: payload.descripcion == null || payload.descripcion === ''
    ? null
    : String(payload.descripcion).trim(),
  requiere_calidad: Boolean(payload.requiere_calidad),
});
const wipMatchesAttempt = (article, attempt) => {
  if (!article || article.clase !== 'SUBENSAMBLE_WIP' || article.activo !== true || !attempt?.payload) return false;
  const expected = normalizedWipPayload(attempt.payload);
  const dto = wipDTOOf(article);
  const candidateDescription = dto.descripcion ?? article.descripcion;
  const candidateQuality = dto.requiere_calidad ?? article.requiere_calidad;
  return String(article.nombre ?? '').trim() === expected.nombre
    && (expected.descripcion === null
      ? candidateDescription == null || String(candidateDescription).trim() === ''
      : candidateDescription != null && String(candidateDescription).trim() === expected.descripcion)
    && (candidateQuality == null
      ? expected.requiere_calidad === false
      : Boolean(candidateQuality) === expected.requiere_calidad);
};
const routePayloadOf = (revision, targetArticle) => (
  revision?.operaciones?.length
    ? buildRoutePayload(
      normalizeRouteRevision(revision, targetArticle, targetArticle ? [targetArticle] : []),
      targetArticle,
      targetArticle ? [targetArticle] : [],
    )
    : null
);
const structurePayloadOf = (revision) => (
  revision && ('componentes' in revision || 'lineas' in revision || 'items' in revision)
    ? buildStructurePayload(normalizeStructureRevision(revision))
    : null
);
const statusTransitionFor = (attempt) => {
  if (attempt?.entity === 'route') {
    if (attempt.action === 'retirar' && attempt.fromStatus === 'APROBADA') return 'RETIRADA';
    if (['aprobar', 'publicar'].includes(attempt.action) && attempt.fromStatus === 'BORRADOR') return 'APROBADA';
    return null;
  }
  const transitions = {
    enviar: ['BORRADOR', 'PENDIENTE_APROBACION'],
    aprobar: ['PENDIENTE_APROBACION', 'APROBADA'],
    publicar: ['BORRADOR', 'APROBADA'],
    rechazar: ['PENDIENTE_APROBACION', 'RECHAZADA'],
    descartar: ['BORRADOR', 'DESCARTADA'],
    retirar: ['APROBADA', 'RETIRADA'],
  };
  const transition = transitions[attempt?.action];
  return transition?.[0] === attempt?.fromStatus ? transition[1] : null;
};
const governanceResultMatches = (revision, attempt, targetArticle) => {
  if (!revision || !attempt || String(revision.id ?? routeIdOf(revision)) !== String(attempt.id)) return false;
  const expectedStatus = statusTransitionFor(attempt);
  if (!expectedStatus || routeStatus(revision) !== expectedStatus) return false;
  if (!Number.isFinite(versionOf(revision))
    || !Number.isFinite(Number(attempt.version))
    || versionOf(revision) <= Number(attempt.version)) return false;
  const owner = ownerIdOf(revision, attempt.entity);
  if (attempt.owner != null && (owner == null || String(owner) !== String(attempt.owner))) return false;
  if (attempt.hash && contentHashOf(revision) !== attempt.hash) return false;
  if (attempt.payloadHash) {
    const payload = attempt.entity === 'route'
      ? routePayloadOf(revision, targetArticle)
      : structurePayloadOf(revision);
    if (!payload || canonicalJson(payload) !== attempt.payloadHash) return false;
  }
  return true;
};

function RouteDependencyBody({
  run,
  selectedRoute,
  targetArticle,
  articleId,
  canView,
  canAdmin,
  routeCanView = canView,
  routeCanAdmin = canAdmin,
  structureCanView = false,
  structureCanAdmin = false,
  articleCanAdmin = false,
  canStructureApprove = false,
  canStructurePublish = false,
  canRouteApprove = false,
  canRoutePublish = false,
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
  const [catalogError, setCatalogError, feedbackFallback_catalogError] = useOperationMessage('components/RouteDependencyDialog.jsx:catalogError', { severity: 'warning', initialValue: '' });
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeSeverity, setNoticeSeverity] = useState('success');
  const [routeUncertain, setRouteUncertain] = useState(false);
  const [resolvedTarget, setResolvedTarget] = useState(null);
  const [workspaceFrame, setWorkspaceFrame] = useState('route');
  const [ownerTargetChoice, setOwnerTargetChoice] = useState(null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerArticles, setOwnerArticles] = useState([]);
  const [ownerCatalogState, setOwnerCatalogState] = useState('idle');
  const [ownerCatalogError, setOwnerCatalogError, feedbackFallback_ownerCatalogError] = useOperationMessage('components/RouteDependencyDialog.jsx:ownerCatalogError', { severity: 'warning', initialValue: '' });
  const [ownerCatalogCursor, setOwnerCatalogCursor] = useState(null);
  const [ownerCatalogHasMore, setOwnerCatalogHasMore] = useState(false);
  const [articleSearchBusy, setArticleSearchBusy] = useState(false);
  const [wipForm, setWipForm] = useState({ nombre: '', descripcion: '', requiere_calidad: false });
  const [wipPurpose, setWipPurpose] = useState('owner');
  const [wipOperationIndex, setWipOperationIndex] = useState(null);
  const [wipBusy, setWipBusy] = useState(false);
  const [wipUncertain, setWipUncertain] = useState(false);
  const [wipReturnPending, setWipReturnPending] = useState(false);
  const [structureArticles, setStructureArticles] = useState([]);
  const [structures, setStructures] = useState([]);
  const [structureLoadedIds, setStructureLoadedIds] = useState(() => new Set());
  const [structureArticleQuery, setStructureArticleQuery] = useState('');
  const [structureArticleCursor, setStructureArticleCursor] = useState(null);
  const [structureArticleHasMore, setStructureArticleHasMore] = useState(false);
  const [structureRevision, setStructureRevision] = useState(null);
  const [structureForm, setStructureForm] = useState(null);
  const [structureBaseline, setStructureBaseline] = useState(null);
  const [structureTarget, setStructureTarget] = useState(null);
  const [structureStack, setStructureStack] = useState([]);
  const [structureBusy, setStructureBusy] = useState(false);
  const [structureUncertain, setStructureUncertain] = useState(false);
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [governanceUncertain, setGovernanceUncertain] = useState(false);
  const [governanceTarget, setGovernanceTarget] = useState(null);
  const [governanceReason, setGovernanceReason] = useState('');
  const [identityState, setIdentityState] = useState('unknown');
  const [targetChoice, setTargetChoice] = useState(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const [closeIntent, setCloseIntent] = useState('list');
  const [centerIndex, setCenterIndex] = useState(null);
  const [centerForm, setCenterForm] = useState({ nombre: '', tipo: 'PREARMADO' });
  const [centerBusy, setCenterBusy] = useState(false);
  const [centerError, setCenterError, feedbackFallback_centerError] = useOperationMessage('components/RouteDependencyDialog.jsx:centerError', { severity: 'error', initialValue: '' });
  const [centerUncertain, setCenterUncertain] = useState(false);
  const abortRef = useRef(null);
  const ownerAbortRef = useRef(null);
  const ownerGenerationRef = useRef(0);
  const structureAbortRef = useRef(null);
  const structureGenerationRef = useRef(0);
  const articleSearchAbortRef = useRef(null);
  const articleSearchGenerationRef = useRef(0);
  const routeDetailAbortRef = useRef(null);
  const routeDetailGenerationRef = useRef(0);
  const generationRef = useRef(0);
  const identityStateRef = useRef('unknown');
  const routeAttemptRef = useRef(null);
  const structureAttemptRef = useRef(null);
  const wipAttemptRef = useRef(null);
  const governanceAttemptRef = useRef(null);
  const mountedRef = useRef(true);
  const notify = (message, severity = 'success') => {
    setNotice(message);
    setNoticeSeverity(severity);
  };

  const baseTarget = useMemo(() => {
    if (targetArticle?.id != null) return targetArticle;
    if (selectedRoute?.articulo_salida?.id != null) return selectedRoute.articulo_salida;
    return null;
  }, [selectedRoute, targetArticle]);
  const selectedOwnerTarget = selectedRoute?.owner_route_target_article
    || selectedRoute?.ownerRouteTargetArticle
    || selectedRoute?.articulo_objetivo
    || run?.operacion_ruta?.owner_route_target_article
    || run?.operacion_ruta?.ownerRouteTargetArticle
    || null;
  const directOwnerUnsupported = Boolean(
    !selectedOwnerTarget
    && baseTarget?.clase
    && baseTarget.clase !== 'PIEZA_COLOR'
  );
  const candidateTargets = useMemo(() => (run?.salidas || [])
    .map((item) => item?.articulo)
    .filter((article) => article && !['PRODUCTO_TERMINADO', 'SUBENSAMBLE_WIP'].includes(article.clase)), [run]);
  const candidateOwnerTargets = useMemo(() => (run?.salidas || [])
    .map((item) => item?.articulo)
    .filter((article) => article && ['SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO'].includes(article.clase)), [run]);
  const directTarget = targetChoice || baseTarget;
  const effectiveTarget = resolvedTarget || ownerTargetChoice || selectedOwnerTarget
    || (directOwnerUnsupported ? null : directTarget);
  const targetId = effectiveTarget?.id ?? articleId;
  const contextSignature = [
    actorId,
    articleId ?? '',
    directTarget?.id ?? '',
    targetChoice?.id ?? '',
    selectedOwnerTarget?.id ?? '',
    ownerTargetChoice?.id ?? '',
  ].join(':');
  const contextSignatureRef = useRef(contextSignature);
  const contextGenerationRef = useRef(0);
  if (contextSignatureRef.current !== contextSignature) {
    contextSignatureRef.current = contextSignature;
    contextGenerationRef.current += 1;
  }
  const contextSnapshot = useCallback(() => ({
    actorId,
    generation: contextGenerationRef.current,
    signature: contextSignature,
  }), [actorId, contextSignature]);
  const isCurrentContext = useCallback((snapshot) => mountedRef.current
    && snapshot?.actorId === actorId
    && snapshot?.generation === contextGenerationRef.current
    && snapshot?.signature === contextSignatureRef.current, [actorId]);
  const targetNeedsResolution = directTarget?.clase == null;
  const targetCanRoute = ['PIEZA_COLOR', 'SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO'].includes(effectiveTarget?.clase);
  const effectiveCanView = Boolean(routeCanView && targetCanRoute && (!targetNeedsResolution || identityState === 'ready'));
  const reconciledRoute = useMemo(() => {
    if (!routeUncertain || !routeForm || !effectiveTarget?.id) return null;
    const attempt = routeAttemptRef.current;
    if (!attempt || attempt.entity !== 'route' || attempt.contextGeneration !== contextGenerationRef.current) return null;
    const expected = attempt.payloadHash || canonicalJson(buildRoutePayload(routeForm, effectiveTarget, [effectiveTarget]));
    const matches = routes.filter((route) => {
      if (routeStatus(route) !== 'BORRADOR'
        || String(route.articulo_objetivo_id ?? route.articulo_objetivo?.id) !== String(effectiveTarget.id)) return false;
      if (attempt.id != null && String(route.id) !== String(attempt.id)) return false;
      if (attempt.id != null
        && (!Number.isFinite(Number(attempt.version))
          || !Number.isFinite(versionOf(route))
          || versionOf(route) <= Number(attempt.version))) return false;
      const payload = routePayloadOf(route, effectiveTarget);
      return payload != null && canonicalJson(payload) === expected;
    });
    return matches.length === 1 ? matches[0] : null;
  }, [effectiveTarget, routeForm, routeUncertain, routes]);
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
  const structureDirty = Boolean(
    structureForm && structureBaseline
    && JSON.stringify(structureForm) !== JSON.stringify(structureBaseline),
  );
  const wipDirty = Boolean(
    wipForm.nombre.trim()
    || wipForm.descripcion.trim()
    || wipForm.requiere_calidad,
  );
  const stackDirty = structureStack.some((item) => item?.form && item?.baseline
    && JSON.stringify(item.form) !== JSON.stringify(item.baseline));
  const pendingDraft = dirty || structureDirty || stackDirty || wipDirty || (centerIndex != null && Boolean(centerForm.nombre.trim()));
  const anyBusy = saving || centerBusy || structureBusy || wipBusy || governanceBusy;
  const anyUncertain = routeUncertain || centerUncertain || structureUncertain || wipUncertain || governanceUncertain;
  const readOnly = frozen || !routeCanAdmin || !targetCanRoute;

  const loadCatalog = useCallback(async ({ apply = true } = {}) => {
    const snapshot = contextSnapshot();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    if (!targetId || !routeCanView || directOwnerUnsupported || (targetNeedsResolution && identityStateRef.current === 'restricted')) {
      if (isCurrentContext(snapshot)) {
        setCatalogState('ready');
        if (apply) {
          setRoutes([]);
          setCenters([]);
        }
      }
      return;
    }
    if (isCurrentContext(snapshot)) {
      setCatalogState('loading');
      setCatalogError('');
    }
    try {
      if (targetNeedsResolution && identityStateRef.current !== 'ready') {
        identityStateRef.current = 'loading';
        if (isCurrentContext(snapshot)) setIdentityState('loading');
        const resolvedPayload = await resolverArticulosScm(actorId, [Number(targetId)], controller.signal);
        const resolved = (resolvedPayload?.items || []).find((item) => String(item.id) === String(targetId));
        if (controller.signal.aborted || generationRef.current !== generation || !isCurrentContext(snapshot)) return;
        if (!resolved || resolved.clase !== 'PIEZA_COLOR') {
          identityStateRef.current = 'restricted';
          setIdentityState('restricted');
          setCatalogState('ready');
          if (apply) {
            setRoutes([]);
            setCenters([]);
          }
          return;
        }
        identityStateRef.current = 'ready';
        setResolvedTarget(resolved);
        setIdentityState('ready');
      }
      if (!targetNeedsResolution && !targetCanRoute) {
        if (isCurrentContext(snapshot)) {
          setCatalogState('ready');
          if (apply) {
            setRoutes([]);
            setCenters([]);
          }
        }
        return;
      }
      const [routeRows, centerRows] = await Promise.all([
        listarRutasArticuloScm(Number(targetId), actorId, controller.signal),
        listarCentrosTrabajoScm(actorId, controller.signal),
      ]);
      if (controller.signal.aborted || generationRef.current !== generation || !isCurrentContext(snapshot)) return;
      if (apply) {
        setRoutes(routeRows || []);
        setCenters(centerRows || []);
      }
      setCatalogState('ready');
      return { routes: routeRows || [], centers: centerRows || [], snapshot };
    } catch (error) {
      if (controller.signal.aborted || generationRef.current !== generation || !isCurrentContext(snapshot)) return;
      setCatalogState('error');
      setCatalogError(mensajeErrorScm(error, 'No se pudieron cargar las rutas y centros de trabajo.'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [actorId, contextSnapshot, directOwnerUnsupported, isCurrentContext, routeCanView, setCatalogError, targetCanRoute, targetId, targetNeedsResolution]);

  useEffect(() => {
    contextGenerationRef.current += 1;
    abortRef.current?.abort();
    ownerAbortRef.current?.abort();
    structureAbortRef.current?.abort();
    routeDetailAbortRef.current?.abort();
    articleSearchAbortRef.current?.abort();
    setEditingRoute(null);
    setRouteForm(null);
    setBaseline(null);
    notify('');
    setClosePrompt(false);
    setCenterIndex(null);
    setCenterError('');
    setCenterUncertain(false);
    setResolvedTarget(null);
    setWorkspaceFrame('route');
    setWipForm({ nombre: '', descripcion: '', requiere_calidad: false });
    setWipUncertain(false);
    setWipBusy(false);
    setStructureRevision(null);
    setStructureForm(null);
    setStructureUncertain(false);
    setStructureBusy(false);
    setSaving(false);
    setGovernanceBusy(false);
    setGovernanceUncertain(false);
    setGovernanceTarget(null);
    routeAttemptRef.current = null;
    structureAttemptRef.current = null;
    wipAttemptRef.current = null;
    governanceAttemptRef.current = null;
    identityStateRef.current = directTarget?.clase == null ? 'unknown' : 'ready';
    setIdentityState(identityStateRef.current);
    loadCatalog();
    return () => {
      abortRef.current?.abort();
      ownerAbortRef.current?.abort();
      structureAbortRef.current?.abort();
      routeDetailAbortRef.current?.abort();
      articleSearchAbortRef.current?.abort();
      generationRef.current += 1;
      ownerGenerationRef.current += 1;
      structureGenerationRef.current += 1;
      routeDetailGenerationRef.current += 1;
      articleSearchGenerationRef.current += 1;
    };
  }, [directTarget?.clase, loadCatalog, selectedOwnerTarget, setCenterError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      ownerAbortRef.current?.abort();
      structureAbortRef.current?.abort();
      routeDetailAbortRef.current?.abort();
      articleSearchAbortRef.current?.abort();
      generationRef.current += 1;
      ownerGenerationRef.current += 1;
      structureGenerationRef.current += 1;
      routeDetailGenerationRef.current += 1;
      articleSearchGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (selectedOwnerTarget) setOwnerTargetChoice(selectedOwnerTarget);
  }, [selectedOwnerTarget]);

  const searchOwnerArticles = useCallback(async ({ query = ownerSearch, cursor = null } = {}) => {
    const snapshot = contextSnapshot();
    if (typeof listarArticulosPaginaScm !== 'function') {
      if (!isCurrentContext(snapshot)) return undefined;
      setOwnerArticles([]);
      setOwnerCatalogState('ready');
      return { rows: [], hasMore: false, nextCursor: null, snapshot };
    }
    ownerAbortRef.current?.abort();
    const controller = new AbortController();
    ownerAbortRef.current = controller;
    const generation = ownerGenerationRef.current + 1;
    ownerGenerationRef.current = generation;
    if (!isCurrentContext(snapshot)) return undefined;
    setOwnerCatalogState('loading');
    setOwnerCatalogError('');
    try {
      const payload = await listarArticulosPaginaScm(actorId, {
        q: query.trim() || undefined,
        clases: 'SUBENSAMBLE_WIP,PRODUCTO_TERMINADO',
        activo: 'true',
        limite: 25,
        cursor: cursor || undefined,
      }, controller.signal);
      if (controller.signal.aborted || ownerGenerationRef.current !== generation || !isCurrentContext(snapshot)) return undefined;
      const rows = payload?.items || [];
      setOwnerArticles((current) => (cursor
        ? [...new Map([...current, ...rows].map((item) => [Number(item.id), item])).values()]
        : rows));
      setOwnerCatalogCursor(payload?.next_cursor || null);
      setOwnerCatalogHasMore(Boolean(payload?.has_more));
      setOwnerCatalogState('ready');
      return {
        rows,
        hasMore: Boolean(payload?.has_more),
        nextCursor: payload?.next_cursor || null,
        snapshot,
      };
    } catch (error) {
      if (controller.signal.aborted || ownerGenerationRef.current !== generation || !isCurrentContext(snapshot)) return undefined;
      setOwnerCatalogState('error');
      setOwnerCatalogError(mensajeErrorScm(error, 'No se pudo consultar artículos WIP/PT.'));
    } finally {
      if (ownerAbortRef.current === controller) ownerAbortRef.current = null;
    }
  }, [actorId, contextSnapshot, isCurrentContext, ownerSearch, setOwnerCatalogError]);

  const searchEngineeringArticles = useCallback(async (query = '') => {
    if (typeof listarArticulosPaginaScm !== 'function') return;
    const snapshot = contextSnapshot();
    articleSearchAbortRef.current?.abort();
    const controller = new AbortController();
    articleSearchAbortRef.current = controller;
    const generation = articleSearchGenerationRef.current + 1;
    articleSearchGenerationRef.current = generation;
    if (!isCurrentContext(snapshot)) return;
    setArticleSearchBusy(true);
    try {
      const payload = await listarArticulosPaginaScm(actorId, {
        q: query.trim() || undefined,
        clases: 'PIEZA_COLOR,SUBENSAMBLE_WIP,PRODUCTO_TERMINADO',
        activo: 'true',
        limite: 25,
      }, controller.signal);
      if (controller.signal.aborted || articleSearchGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      const rows = payload?.items || [];
      setStructureArticles((current) => [...new Map([
        ...current,
        ...(baseTarget ? [baseTarget] : []),
        ...(effectiveTarget ? [effectiveTarget] : []),
        ...rows,
      ].map((item) => [Number(item.id), item])).values()]);
      setStructureArticleQuery(query);
      setStructureArticleCursor(payload?.next_cursor || null);
      setStructureArticleHasMore(Boolean(payload?.has_more));
    } catch (error) {
      if (!controller.signal.aborted && articleSearchGenerationRef.current === generation && isCurrentContext(snapshot)) {
        notify(mensajeErrorScm(error, 'No se pudo consultar artículos de Ingeniería.'), 'warning');
      }
    } finally {
      if (articleSearchAbortRef.current === controller) {
        articleSearchAbortRef.current = null;
        setArticleSearchBusy(false);
      }
    }
  }, [actorId, baseTarget, contextSnapshot, effectiveTarget, isCurrentContext]);

  useEffect(() => {
    if (effectiveTarget?.clase !== 'PIEZA_COLOR' || selectedOwnerTarget || ownerTargetChoice || frozen || !routeCanView) {
      ownerAbortRef.current?.abort();
      setOwnerArticles([]);
      setOwnerCatalogCursor(null);
      setOwnerCatalogHasMore(false);
      setOwnerCatalogState('idle');
      return undefined;
    }
    const timer = setTimeout(() => {
      searchOwnerArticles({ query: ownerSearch, cursor: null });
    }, 300);
    return () => clearTimeout(timer);
  }, [effectiveTarget?.clase, frozen, ownerSearch, ownerTargetChoice, routeCanView, searchOwnerArticles, selectedOwnerTarget]);

  const openRoute = async (revision = null) => {
    if (readOnly && routeStatus(revision) === 'BORRADOR') return;
    const snapshot = contextSnapshot();
    let exactRevision = revision;
    if (revision?.id && !revision.operaciones?.length && typeof obtenerRutaScm === 'function') {
      routeDetailAbortRef.current?.abort();
      const controller = new AbortController();
      routeDetailAbortRef.current = controller;
      const generation = routeDetailGenerationRef.current + 1;
      routeDetailGenerationRef.current = generation;
      try {
        exactRevision = await obtenerRutaScm(revision.id, actorId, controller.signal);
        if (controller.signal.aborted || routeDetailGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      } catch (error) {
        if (controller.signal.aborted || routeDetailGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
        notify(mensajeErrorScm(error, 'No se pudo consultar la revisión exacta de ruta.'), 'warning');
        return;
      } finally {
        if (routeDetailAbortRef.current === controller) routeDetailAbortRef.current = null;
      }
    }
    const routeArticleIds = [...new Set((exactRevision?.operaciones || [])
      .map((operation) => operation.articulo_salida_id ?? operation.articulo_salida?.id)
      .filter(Boolean))];
    if (routeArticleIds.length && typeof resolverArticulosScm === 'function') {
      const controller = new AbortController();
      const generation = routeDetailGenerationRef.current + 1;
      routeDetailGenerationRef.current = generation;
      try {
        const payload = await resolverArticulosScm(actorId, routeArticleIds, controller.signal);
        if (controller.signal.aborted || routeDetailGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
        setStructureArticles((current) => [...new Map([
          ...current,
          ...(payload?.items || []),
        ].map((item) => [Number(item.id), item])).values()]);
      } catch (error) {
        if (controller.signal.aborted || routeDetailGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
        notify(mensajeErrorScm(error, 'No se pudieron hidratar las salidas de la revisión.'), 'warning');
      }
    }
    const next = exactRevision
      ? normalizeRouteRevision(exactRevision, effectiveTarget, effectiveTarget ? [effectiveTarget] : [])
      : emptyRouteValue(effectiveTarget);
    if (!isCurrentContext(snapshot)) return;
    setEditingRoute(exactRevision);
    setRouteForm(next);
    setBaseline(next);
    notify('');
    setClosePrompt(false);
  };

  const requestCloseEditor = useCallback(() => {
    if (saving || centerBusy || structureBusy || wipBusy || governanceBusy) {
      notify('Espera a que termine la escritura antes de salir.', 'warning');
      return;
    }
    if (routeUncertain || centerUncertain || structureUncertain || wipUncertain || governanceUncertain) {
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
  }, [centerBusy, centerUncertain, governanceBusy, governanceUncertain, pendingDraft, routeUncertain, saving, structureBusy, structureUncertain, wipBusy, wipUncertain]);

  const requestDialogClose = useCallback(() => {
    if (saving || centerBusy || structureBusy || wipBusy || governanceBusy) {
      notify('Espera a que termine la escritura antes de salir.', 'warning');
      return;
    }
    if (routeUncertain || centerUncertain || structureUncertain || wipUncertain || governanceUncertain) {
      notify('Confirma el resultado consultando el catálogo antes de salir.', 'warning');
      return;
    }
    if (pendingDraft) {
      setCloseIntent('host');
      setClosePrompt(true);
      return;
    }
    onClose?.();
  }, [centerBusy, centerUncertain, governanceBusy, governanceUncertain, onClose, pendingDraft, routeUncertain, saving, structureBusy, structureUncertain, wipBusy, wipUncertain]);

  useEffect(() => {
    if (!closeRequestRef) return undefined;
    closeRequestRef.current = requestDialogClose;
    return () => {
      if (closeRequestRef.current === requestDialogClose) closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestDialogClose]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestDialogClose();
    };
    document.addEventListener('keydown', onEscape, true);
    return () => document.removeEventListener('keydown', onEscape, true);
  }, [requestDialogClose]);

  const saveRoute = async (payload = buildRoutePayload(routeForm, effectiveTarget, effectiveTarget ? [effectiveTarget] : [])) => {
    if (readOnly || saving || routeUncertain || !isCurrentContext(contextSnapshot())) return;
    const snapshot = contextSnapshot();
    const attempt = Object.freeze({
      entity: 'route',
      id: editingRoute?.id ?? null,
      owner: effectiveTarget?.id ?? targetId ?? null,
      action: 'save',
      actor: actorId,
      version: editingRoute?.version ?? null,
      payload: cloneForAttempt(payload),
      payloadHash: canonicalJson(payload),
      hash: contentHashOf(editingRoute),
      contextGeneration: snapshot.generation,
      contextSignature: snapshot.signature,
    });
    routeAttemptRef.current = attempt;
    setSaving(true);
    notify('');
    try {
      const result = editingRoute
        ? await actualizarRutaScm(editingRoute.id, { ...payload, version: editingRoute.version })
        : await crearRutaArticuloScm(Number(targetId), payload);
      const persisted = result?.revision || result?.ruta || result;
      if (!isCurrentContext(snapshot)) return;
      if (!persisted?.id || (attempt.id != null && String(persisted.id) !== String(attempt.id))) {
        throw Object.assign(new Error('La respuesta de ruta no conserva la identidad del intento.'), { uncertainCreation: true });
      }
      const persistedOwner = ownerIdOf(persisted, 'route');
      if (persistedOwner != null && attempt.owner != null && String(persistedOwner) !== String(attempt.owner)) {
        throw Object.assign(new Error('La respuesta de ruta apunta a otro artículo.'), { uncertainCreation: true });
      }
      if (attempt.id != null && (!Number.isFinite(Number(attempt.version))
        || !Number.isFinite(versionOf(persisted))
        || versionOf(persisted) <= Number(attempt.version))) {
        throw Object.assign(new Error('La respuesta de ruta no acredita una versión posterior.'), { uncertainCreation: true });
      }
      const persistedPayload = routePayloadOf(persisted, effectiveTarget);
      if (persistedPayload && canonicalJson(persistedPayload) !== attempt.payloadHash) {
        throw Object.assign(new Error('La respuesta de ruta no coincide con el borrador enviado.'), { uncertainCreation: true });
      }
      setRouteUncertain(false);
      routeAttemptRef.current = null;
      notify(editingRoute ? 'Borrador de ruta actualizado.' : 'Borrador de ruta creado.');
      setRouteForm(null);
      setEditingRoute(null);
      setBaseline(null);
      setCenterIndex(null);
      await loadCatalog();
      if (isCurrentContext(snapshot)) onSaved?.(persisted);
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      const uncertain = !(Number(status) >= 400 && Number(status) < 500);
      if (uncertain) setRouteUncertain(true);
      notify(
        mensajeErrorScm(error, 'No se pudo guardar el borrador de ruta. El formulario se conservó para reintentar.'),
        uncertain || Number(status) === 409 ? 'warning' : 'error',
      );
    } finally {
      if (isCurrentContext(snapshot)) setSaving(false);
    }
  };

  const loadStructureFor = useCallback(async (article, { preserveCurrent = false } = {}) => {
    const snapshot = contextSnapshot();
    if (!article?.id || !isCurrentContext(snapshot)) return;
    if (!structureCanView) {
      notify('No tienes permiso independiente para consultar la BOM.', 'warning');
      return;
    }
    if (preserveCurrent && structureForm) {
      setStructureStack((current) => [...current, {
        article: structureTarget,
        revision: structureRevision,
        form: structureForm,
        baseline: structureBaseline,
        articles: structureArticles,
        structures,
        loadedIds: structureLoadedIds,
         articleQuery: structureArticleQuery,
         articleCursor: structureArticleCursor,
         articleHasMore: structureArticleHasMore,
      }]);
    }
    setWorkspaceFrame('structure');
    setStructureTarget(article);
    setStructureRevision(null);
    setStructureForm(null);
    setStructureBaseline(null);
    setStructureUncertain(false);
      setStructureArticleQuery('');
      setStructureArticleCursor(null);
      setStructureArticleHasMore(false);
    setCatalogState('loading');
    structureAbortRef.current?.abort();
    const controller = new AbortController();
    structureAbortRef.current = controller;
    const generation = structureGenerationRef.current + 1;
    structureGenerationRef.current = generation;
    try {
      const [structureRows, articlePage] = await Promise.all([
        listarEstructurasScm(article.id, actorId, controller.signal),
        listarArticulosPaginaScm(actorId, {
          clases: 'PIEZA_COLOR,SUBENSAMBLE_WIP,PRODUCTO_TERMINADO',
          activo: 'true',
          limite: 25,
        }, controller.signal),
      ]);
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      const rows = structureRows || [];
      const referencedIds = [...new Set(rows.flatMap((row) => (
        row.componentes || row.lineas || row.items || []
      ).map((line) => line.articulo_id ?? line.article_id).filter(Boolean)))];
      const resolvedPayload = referencedIds.length && typeof resolverArticulosScm === 'function'
        ? await resolverArticulosScm(actorId, referencedIds, controller.signal)
        : null;
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      const hydratedStructurePayload = referencedIds.length && typeof hidratarEstructurasScm === 'function'
        ? await hidratarEstructurasScm(actorId, { articuloIds: referencedIds }, controller.signal)
        : null;
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      const hydratedStructures = [
        ...(hydratedStructurePayload?.approved || []),
        ...(hydratedStructurePayload?.referenced || []),
      ].filter((item, index, rows) => rows.findIndex((candidate) => String(candidate.id) === String(item.id)) === index);
      setStructureLoadedIds((current) => new Set([
        ...current,
        Number(article.id),
        ...referencedIds.map(Number),
      ]));
      setStructures([...rows, ...hydratedStructures.filter((item) => (
        !rows.some((row) => String(row.id) === String(item.id))
      ))]);
      setStructureArticles([
        article,
        ...(articlePage?.items || []).filter((item) => String(item.id) !== String(article.id)),
        ...(resolvedPayload?.items || []).filter((item) => (
          String(item.id) !== String(article.id)
          && !(articlePage?.items || []).some((candidate) => String(candidate.id) === String(item.id))
        )),
      ]);
      setStructureArticleQuery('');
      setStructureArticleCursor(articlePage?.next_cursor || null);
      setStructureArticleHasMore(Boolean(articlePage?.has_more));
      setCatalogState('ready');
    } catch (error) {
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return;
      setCatalogState('error');
      setCatalogError(mensajeErrorScm(error, 'No se pudieron cargar las estructuras y artículos.'));
    } finally {
      if (structureAbortRef.current === controller) structureAbortRef.current = null;
    }
  }, [actorId, contextSnapshot, isCurrentContext, setCatalogError, structureArticleCursor, structureArticleHasMore, structureArticleQuery, structureArticles, structureBaseline, structureCanView, structureForm, structureLoadedIds, structureRevision, structureTarget, structures]);

  const openStructureEditor = (revision = null) => {
    if (revision && structureTarget?.id != null) {
      const resultArticleId = revision.articulo_resultado_id ?? revision.articulo_resultado?.id;
      if (resultArticleId == null || String(resultArticleId) !== String(structureTarget.id)) return;
    }
    const next = revision ? normalizeStructureRevision(revision) : emptyStructureValue();
    setStructureRevision(revision);
    setStructureForm(next);
    setStructureBaseline(next);
    setStructureUncertain(false);
  };

  const refreshStructuresFor = useCallback(async (articleId, { apply = true } = {}) => {
    const snapshot = contextSnapshot();
    if (!articleId || !isCurrentContext(snapshot)) return undefined;
    structureAbortRef.current?.abort();
    const controller = new AbortController();
    structureAbortRef.current = controller;
    const generation = structureGenerationRef.current + 1;
    structureGenerationRef.current = generation;
    try {
      const rows = await listarEstructurasScm(articleId, actorId, controller.signal);
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return undefined;
      if (apply) {
        setStructureLoadedIds((current) => new Set([...current, Number(articleId)]));
        setStructures((current) => {
          const next = [...current];
          (rows || []).forEach((row) => {
            const index = next.findIndex((item) => String(item.id) === String(row.id));
            if (index >= 0) next[index] = row;
            else next.push(row);
          });
          return next;
        });
      }
      return rows || [];
    } catch (error) {
      if (controller.signal.aborted || structureGenerationRef.current !== generation || !isCurrentContext(snapshot)) return undefined;
      notify(mensajeErrorScm(error, 'No se pudo actualizar la lista de BOM.'), 'warning');
    } finally {
      if (structureAbortRef.current === controller) structureAbortRef.current = null;
    }
  }, [actorId, contextSnapshot, isCurrentContext]);

  const saveStructure = async (payload = buildStructurePayload(structureForm)) => {
    if (!structureTarget?.id || structureBusy || structureUncertain || frozen || !structureCanAdmin || !structureCanView || !structureForm) return;
    const snapshot = contextSnapshot();
    if (!isCurrentContext(snapshot)) return;
    const attempt = Object.freeze({
      entity: 'structure',
      id: structureRevision?.id ?? null,
      owner: structureTarget.id,
      action: 'save',
      actor: actorId,
      version: structureRevision?.version ?? null,
      payload: cloneForAttempt(payload),
      payloadHash: canonicalJson(payload),
      hash: contentHashOf(structureRevision),
      contextGeneration: snapshot.generation,
      contextSignature: snapshot.signature,
    });
    structureAttemptRef.current = attempt;
    setStructureBusy(true);
    try {
      const result = structureRevision
        ? await actualizarEstructuraScm(structureRevision.id, {
          ...payload,
          version: structureRevision.version,
        })
        : await crearEstructuraScm(Number(structureTarget.id), payload);
      const persisted = result?.revision || result?.estructura || result;
      if (!isCurrentContext(snapshot)) return;
      if (!persisted?.id || (attempt.id != null && String(persisted.id) !== String(attempt.id))) {
        throw Object.assign(new Error('La respuesta de BOM no conserva la identidad del intento.'), { uncertainCreation: true });
      }
      const persistedOwner = ownerIdOf(persisted, 'structure');
      if (attempt.id != null && (persistedOwner == null || String(persistedOwner) !== String(attempt.owner))) {
        throw Object.assign(new Error('La respuesta de BOM apunta a otro artículo.'), { uncertainCreation: true });
      }
      if (attempt.id != null && (!Number.isFinite(Number(attempt.version))
        || !Number.isFinite(versionOf(persisted))
        || versionOf(persisted) <= Number(attempt.version))) {
        throw Object.assign(new Error('La respuesta de BOM no acredita una versión posterior.'), { uncertainCreation: true });
      }
      const persistedPayload = structurePayloadOf(persisted);
      if (persistedPayload && canonicalJson(persistedPayload) !== attempt.payloadHash) {
        throw Object.assign(new Error('La respuesta de BOM no coincide con el borrador enviado.'), { uncertainCreation: true });
      }
      setStructureUncertain(false);
      structureAttemptRef.current = null;
      setStructureRevision(persisted);
      setStructureForm(normalizeStructureRevision(persisted));
      setStructureBaseline(normalizeStructureRevision(persisted));
      setStructures((current) => [
        persisted,
        ...current.filter((item) => String(item.id) !== String(persisted.id)),
      ]);
      notify('BOM guardada como borrador. La ruta y la OF siguen sin aprobarse ni guardarse.');
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      if (!(Number(status) >= 400 && Number(status) < 500)) setStructureUncertain(true);
      notify(mensajeErrorScm(error, 'No se pudo guardar la BOM; el borrador se conserva.'), Number(status) === 409 ? 'warning' : 'error');
    } finally {
      if (isCurrentContext(snapshot)) setStructureBusy(false);
    }
  };

  const governStructure = async (revision, action) => {
    if (!revision?.id || governanceBusy || governanceUncertain || frozen || !structureCanView) return;
    const status = routeStatus(revision);
    const creatorIsCurrentActor = creatorIdOf(revision) != null
      && String(creatorIdOf(revision)) === String(actorId);
    const allowed = {
      enviar: status === 'BORRADOR' && structureCanAdmin,
      aprobar: status === 'PENDIENTE_APROBACION' && canStructureApprove && !creatorIsCurrentActor,
      publicar: status === 'BORRADOR' && canStructurePublish,
      rechazar: status === 'PENDIENTE_APROBACION' && canStructureApprove && !creatorIsCurrentActor,
      descartar: status === 'BORRADOR' && structureCanAdmin,
      retirar: status === 'APROBADA' && canStructureApprove,
    };
    if (!allowed[action]) {
      notify('La acción de BOM no está permitida para este estado o capacidad.', 'warning');
      return;
    }
    const needsReason = ['rechazar', 'descartar'].includes(action);
    if (needsReason && !governanceReason.trim()) {
      notify('Escribe un motivo antes de gobernar esta BOM.', 'warning');
      return;
    }
    const reason = governanceReason.trim();
    const actions = {
      enviar: () => enviarEstructuraScm(revision),
      aprobar: () => aprobarEstructuraScm(revision),
      publicar: () => publicarEstructuraScm(revision),
      rechazar: () => rechazarEstructuraScm(revision, reason),
      descartar: () => descartarEstructuraScm(revision, reason),
      retirar: () => retirarEstructuraScm(revision, reason),
    };
    const snapshot = contextSnapshot();
    const attempt = Object.freeze({
      entity: 'structure',
      id: revision.id,
      owner: ownerIdOf(revision, 'structure') ?? structureTarget?.id ?? null,
      action,
      actor: actorId,
      version: revision.version,
      fromStatus: status,
      payload: cloneForAttempt(structurePayloadOf(revision)),
      payloadHash: structurePayloadOf(revision) ? canonicalJson(structurePayloadOf(revision)) : null,
      hash: contentHashOf(revision),
      contextGeneration: snapshot.generation,
      contextSignature: snapshot.signature,
    });
    governanceAttemptRef.current = attempt;
    setGovernanceBusy(true);
    setGovernanceTarget({ kind: 'structure', revision: cloneForAttempt(revision), attempt });
    try {
      const result = await actions[action]();
      const persisted = result?.revision || result?.estructura || result;
      if (!isCurrentContext(snapshot)) return;
      if (!governanceResultMatches(persisted, attempt, structureTarget)) {
        throw Object.assign(new Error('La respuesta de gobierno BOM no acredita la transición del intento.'), { uncertainCreation: true });
      }
      setStructures((current) => current.map((item) => (
        String(item.id) === String(revision.id) ? persisted : item
      )));
      setGovernanceReason('');
      setGovernanceUncertain(false);
      governanceAttemptRef.current = null;
      notify(`BOM ${action} ejecutada. La ruta y la OF no se guardaron automáticamente.`);
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      if (!(Number(status) >= 400 && Number(status) < 500)) setGovernanceUncertain(true);
      notify(mensajeErrorScm(error, 'No se pudo gobernar la BOM; consulta su estado antes de repetir.'), 'warning');
    } finally {
      if (isCurrentContext(snapshot)) setGovernanceBusy(false);
    }
  };

  const governRoute = async (revision, action) => {
    if (!revision?.id || governanceBusy || governanceUncertain || frozen || !routeCanView) return;
    const status = routeStatus(revision);
    const creatorIsCurrentActor = creatorIdOf(revision) != null
      && String(creatorIdOf(revision)) === String(actorId);
    const allowed = {
      aprobar: status === 'BORRADOR' && canRouteApprove && !creatorIsCurrentActor,
      publicar: status === 'BORRADOR' && canRoutePublish,
      retirar: status === 'APROBADA' && canRouteApprove,
    };
    if (!allowed[action]) {
      notify('La acción de ruta no está permitida para este estado o capacidad.', 'warning');
      return;
    }
    const actions = {
      aprobar: () => aprobarRutaScm(revision),
      publicar: () => publicarRutaScm(revision),
      retirar: () => retirarRutaScm(revision),
    };
    const snapshot = contextSnapshot();
    const payload = routePayloadOf(revision, effectiveTarget);
    const attempt = Object.freeze({
      entity: 'route',
      id: routeIdOf(revision),
      owner: ownerIdOf(revision, 'route') ?? effectiveTarget?.id ?? null,
      action,
      actor: actorId,
      version: revision.version,
      fromStatus: status,
      payload: cloneForAttempt(payload),
      payloadHash: payload ? canonicalJson(payload) : null,
      hash: frozenHash || contentHashOf(revision),
      contextGeneration: snapshot.generation,
      contextSignature: snapshot.signature,
    });
    governanceAttemptRef.current = attempt;
    setGovernanceBusy(true);
    setGovernanceTarget({ kind: 'route', revision: cloneForAttempt(revision), attempt });
    try {
      const result = await actions[action]();
      const persisted = result?.revision || result?.ruta || result;
      if (!isCurrentContext(snapshot)) return;
      if (!governanceResultMatches(persisted, attempt, effectiveTarget)) {
        throw Object.assign(new Error('La respuesta de gobierno de ruta no acredita la transición del intento.'), { uncertainCreation: true });
      }
      setRoutes((current) => current.map((item) => (
        String(routeIdOf(item)) === String(routeIdOf(revision)) ? persisted : item
      )));
      setGovernanceUncertain(false);
      governanceAttemptRef.current = null;
      notify(`Ruta ${action} ejecutada. La OF no se guardó ni liberó automáticamente.`);
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      if (!(Number(status) >= 400 && Number(status) < 500)) setGovernanceUncertain(true);
      notify(mensajeErrorScm(error, 'No se pudo gobernar la ruta; consulta su estado antes de repetir.'), 'warning');
    } finally {
      if (isCurrentContext(snapshot)) setGovernanceBusy(false);
    }
  };

  const reconcileRouteGovernance = async () => {
    const snapshot = contextSnapshot();
    const attempt = governanceAttemptRef.current || governanceTarget?.attempt;
    if (!attempt || attempt.entity !== 'route' || !isCurrentContext(snapshot)) {
      if (isCurrentContext(snapshot)) notify('No hay un intento de ruta vigente para reconciliar.', 'warning');
      return;
    }
    const refreshed = await loadCatalog({ apply: false });
    if (!refreshed || !isCurrentContext(snapshot)) return;
    const refreshedRoutes = refreshed.routes;
    const matches = (refreshedRoutes || []).filter((item) => String(routeIdOf(item)) === String(attempt.id));
    if (matches.length === 1 && governanceResultMatches(matches[0], attempt, effectiveTarget)) {
      setRoutes(refreshedRoutes);
      setGovernanceUncertain(false);
      governanceAttemptRef.current = null;
      notify('Revisión de ruta consultada; conserva el formulario y el foco actual.', 'success');
    } else {
      notify('La lectura de ruta no acredita la transición, versión o hash del intento; se mantiene la cuarentena.', 'warning');
    }
  };

  const reconcileStructureSave = async () => {
    const snapshot = contextSnapshot();
    const attempt = structureAttemptRef.current;
    if (!attempt || attempt.action !== 'save' || !structureTarget?.id || !isCurrentContext(snapshot)) {
      if (isCurrentContext(snapshot)) notify('No hay un guardado de BOM vigente para reconciliar.', 'warning');
      return;
    }
    const refreshedRows = await refreshStructuresFor(structureTarget.id, { apply: false });
    if (!Array.isArray(refreshedRows) || !isCurrentContext(snapshot)) return;
    const matches = refreshedRows.filter((item) => {
      if (routeStatus(item) !== 'BORRADOR') return false;
      if (attempt.id != null && String(item.id) !== String(attempt.id)) return false;
      const owner = ownerIdOf(item, 'structure');
      if (attempt.id != null && (owner == null || String(owner) !== String(attempt.owner))) return false;
      if (attempt.id != null && (!Number.isFinite(Number(attempt.version))
        || !Number.isFinite(versionOf(item))
        || versionOf(item) <= Number(attempt.version))) return false;
      const payload = structurePayloadOf(item);
      return payload != null && canonicalJson(payload) === attempt.payloadHash;
    });
    if (matches.length !== 1) {
      notify('La lectura de BOM no coincide de forma inequívoca con el borrador; se mantiene la cuarentena.', 'warning');
      return;
    }
    const persisted = matches[0];
    setStructures((current) => [persisted, ...current.filter((item) => String(item.id) !== String(persisted.id))]);
    setStructureRevision(persisted);
    setStructureForm(normalizeStructureRevision(persisted));
    setStructureBaseline(normalizeStructureRevision(persisted));
    setStructureUncertain(false);
    structureAttemptRef.current = null;
    notify('BOM existente adoptada tras reconciliar el catálogo.', 'success');
  };

  const reconcileStructureGovernance = async () => {
    const snapshot = contextSnapshot();
    const attempt = governanceAttemptRef.current || governanceTarget?.attempt;
    if (!structureTarget?.id || !attempt || attempt.entity !== 'structure' || !isCurrentContext(snapshot)) return;
    const refreshedRows = await refreshStructuresFor(structureTarget.id, { apply: false });
    if (!Array.isArray(refreshedRows) || !isCurrentContext(snapshot)) return;
    const matches = refreshedRows.filter((item) => String(item.id) === String(attempt.id));
    if (matches.length === 1 && governanceResultMatches(matches[0], attempt, structureTarget)) {
      const persisted = matches[0];
      setStructures((current) => [persisted, ...current.filter((item) => String(item.id) !== String(persisted.id))]);
      setStructureRevision(persisted);
      setGovernanceUncertain(false);
      governanceAttemptRef.current = null;
      notify('BOM consultada; conserva el borrador y el foco actual.', 'success');
    } else {
      notify('La lectura de BOM no acredita la transición, versión o contenido del intento; se mantiene la cuarentena.', 'warning');
    }
  };

  const createWip = async () => {
    if (!wipForm.nombre.trim() || wipBusy || wipUncertain || frozen || !articleCanAdmin) return;
    const snapshot = contextSnapshot();
    if (!isCurrentContext(snapshot)) return;
    const purpose = wipPurpose;
    const operationIndex = wipOperationIndex;
    const payload = normalizedWipPayload(wipForm);
    const attempt = Object.freeze({
      entity: 'wip',
      id: null,
      owner: purpose === 'component' ? structureTarget?.id ?? null : effectiveTarget?.id ?? null,
      action: 'create',
      actor: actorId,
      version: null,
      payload: cloneForAttempt(payload),
      payloadHash: canonicalJson(payload),
      class: 'SUBENSAMBLE_WIP',
      purpose,
      operationIndex,
      contextGeneration: snapshot.generation,
      contextSignature: snapshot.signature,
    });
    wipAttemptRef.current = attempt;
    setWipBusy(true);
    try {
      const result = await crearArticuloWipScm(payload);
      const article = result?.articulo || result?.article || result;
      if (!article?.id) throw Object.assign(new Error('La respuesta no contiene el ID del WIP.'), { uncertainCreation: true });
      if (!isCurrentContext(snapshot)) return;
      if (article.clase !== 'SUBENSAMBLE_WIP' || article.activo === false || !wipMatchesAttempt(article, attempt)) {
        throw Object.assign(new Error('La respuesta no coincide con el WIP solicitado.'), { uncertainCreation: true });
      }
      if (purpose === 'component' || purpose === 'operation') {
        setStructureArticles((current) => [
          article,
          ...current.filter((item) => String(item.id) !== String(article.id)),
        ]);
        if (purpose === 'operation' && operationIndex != null) {
          setRouteForm((current) => {
            if (!current) return current;
            const operaciones = [...(current.operaciones || [])];
            operaciones[operationIndex] = {
              ...operaciones[operationIndex],
              articulo_salida_id: String(article.id),
            };
            return { ...current, operaciones };
          });
        }
      } else {
        setOwnerTargetChoice(article);
        setResolvedTarget(article);
      }
      setWipForm({ nombre: '', descripcion: '', requiere_calidad: false });
      setWipPurpose('owner');
      setWipOperationIndex(null);
      setWorkspaceFrame(purpose === 'component' ? 'structure' : 'route');
      setWipUncertain(false);
      wipAttemptRef.current = null;
      await loadCatalog();
      if (!isCurrentContext(snapshot)) return;
      notify(`WIP ${article.codigo || article.id} confirmado. Su alta persiste aunque canceles la ruta.`);
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      if (error?.uncertainCreation || !(Number(status) >= 400 && Number(status) < 500)) setWipUncertain(true);
      notify(mensajeErrorScm(error, 'No se pudo confirmar el WIP; no se repetirá el alta incierta.'), 'warning');
    } finally {
      if (isCurrentContext(snapshot)) setWipBusy(false);
    }
  };

  const reconcileWip = async () => {
    const snapshot = contextSnapshot();
    const attempt = wipAttemptRef.current;
    if (!attempt || attempt.entity !== 'wip' || !isCurrentContext(snapshot)) return;
    let page = await searchOwnerArticles({ query: attempt.payload.nombre, cursor: null });
    if (!page || !isCurrentContext(snapshot)) return;
    const allRows = [...(page.rows || [])];
    const seenCursors = new Set();
    while (page.hasMore && page.nextCursor && !seenCursors.has(page.nextCursor)) {
      seenCursors.add(page.nextCursor);
      page = await searchOwnerArticles({ query: attempt.payload.nombre, cursor: page.nextCursor });
      if (!page || !isCurrentContext(snapshot)) return;
      allRows.push(...(page.rows || []));
    }
    if (page.hasMore) {
      notify('La consulta de artículos sigue incompleta; carga la siguiente página antes de adoptar.', 'warning');
      return;
    }
    const matches = [...new Map(allRows.map((item) => [Number(item.id), item])).values()]
      .filter((item) => wipMatchesAttempt(item, attempt));
    if (matches.length !== 1) {
      notify('La lectura de artículos WIP no coincide de forma inequívoca; no se adopta ni se repite el POST.', 'warning');
      return;
    }
    const article = matches[0];
    if (attempt.purpose === 'owner') {
      setOwnerTargetChoice(article);
      setResolvedTarget(article);
    } else if (attempt.purpose === 'component') {
      setStructureArticles((current) => [article, ...current.filter((item) => String(item.id) !== String(article.id))]);
    } else if (attempt.purpose === 'operation' && attempt.operationIndex != null) {
      setRouteForm((current) => {
        if (!current) return current;
        const operaciones = [...(current.operaciones || [])];
        operaciones[attempt.operationIndex] = { ...operaciones[attempt.operationIndex], articulo_salida_id: String(article.id), articulo_salida: article };
        return { ...current, operaciones };
      });
    }
    setWipUncertain(false);
    wipAttemptRef.current = null;
    setWipReturnPending(true);
    notify('Artículo WIP existente adoptado tras reconciliar el catálogo.', 'success');
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
    const snapshot = contextSnapshot();
    if (!isCurrentContext(snapshot)) return;
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
      if (!isCurrentContext(snapshot)) return;
      setCenters((current) => [...current.filter((item) => String(item.id) !== String(center.id)), center]);
      selectCenter(centerIndex, center);
      setCenterIndex(null);
      setCenterForm({ nombre: '', tipo: 'PREARMADO' });
      notify('Centro confirmado y seleccionado. El centro se conserva aunque canceles la ruta.');
    } catch (error) {
      if (!isCurrentContext(snapshot)) return;
      const status = error?.response?.status || error?.status;
      if (error?.uncertainCreation || !(Number(status) >= 400 && Number(status) < 500)) setCenterUncertain(true);
      setCenterError(mensajeErrorScm(error, 'No se pudo confirmar el centro. Revisa el catálogo antes de repetir el alta.'));
    } finally {
      if (isCurrentContext(snapshot)) setCenterBusy(false);
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
          {centerError && feedbackFallback_centerError && <Alert severity="warning">{centerError}</Alert>}
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
          {centerIndex != null && !routeForm?.operaciones?.[centerIndex]?.tipo && (
            <Alert severity="info">Selecciona primero el tipo de operación para crear un centro compatible.</Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Nombre del centro"
              value={centerForm.nombre}
              disabled={anyBusy || anyUncertain}
              onChange={(event) => setCenterForm((current) => ({ ...current, nombre: event.target.value }))}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="route-center-type-label">Tipo compatible</InputLabel>
              <Select
                labelId="route-center-type-label"
                label="Tipo compatible"
                value={centerForm.tipo}
                disabled={anyBusy || anyUncertain}
                onChange={(event) => setCenterForm((current) => ({ ...current, tipo: event.target.value }))}
              >
                {['INYECCION', 'SOPLADO', 'PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" onClick={() => setCenterIndex(null)} disabled={anyBusy || anyUncertain}>Cancelar panel</Button>
            <Button size="small" variant="contained" onClick={createCenter} disabled={anyBusy || anyUncertain || !centerForm.nombre.trim() || !routeForm?.operaciones?.[centerIndex]?.tipo}>
              {centerBusy ? 'Creando…' : 'Crear y seleccionar'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    ),
  };

  const routeContent = (
    <Stack spacing={2}>
      {wipReturnPending && <Button size="small" onClick={() => setWipReturnPending(false)} disabled={anyBusy || anyUncertain} sx={{ alignSelf: 'flex-start' }}>Volver a ruta</Button>}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}
        sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', py: 1 }}>
        <Box>
        <Typography variant="body2" color="text.secondary">
           OF {runContext || 'objetivo'} · salida OF {articleLabel(baseTarget, targetId || 'no resuelta')}
           {' · dueño de ruta '}{articleLabel(effectiveTarget, 'no seleccionado')}
          {!selectedOwnerTarget && !ownerTargetChoice && baseTarget?.clase === 'PIEZA_COLOR'
             ? ` · artículo directo ${articleLabel(baseTarget)}`
            : ''}
        </Typography>
        {frozenHash && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Hash congelado: {frozenHash}</Typography>}
        </Box>
        {parentDialog && <Button size="small" onClick={requestDialogClose}>Volver a OF</Button>}
      </Stack>
      {!directTarget && candidateTargets.length > 0 && (
        <Alert severity="info">
          Selecciona explícitamente la salida Pieza-color que administrará esta ruta.
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            {candidateTargets.map((article) => (
              <Button key={article.id} size="small" variant="outlined" onClick={() => setTargetChoice(article)} disabled={anyBusy || anyUncertain}>
                 {articleLabel(article)}
              </Button>
            ))}
          </Stack>
        </Alert>
      )}
      {effectiveTarget?.clase === 'PIEZA_COLOR' && !selectedOwnerTarget && !ownerTargetChoice && (
        <Alert severity="info">
          La salida OF puede mantenerse como Pieza-color directa o puedes preparar un dueño WIP explícito.
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => { setWipPurpose('owner'); setWorkspaceFrame('wip'); }} disabled={frozen || !articleCanAdmin || anyBusy || anyUncertain}>
              Preparar ruta para otro artículo
            </Button>
            {candidateOwnerTargets.map((article) => (
              <Button key={article.id} size="small" variant="outlined" onClick={() => setOwnerTargetChoice(article)} disabled={anyBusy || anyUncertain}>
                 Usar {articleLabel(article)} como dueño
              </Button>
            ))}
          </Stack>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              label="Buscar dueño WIP o PT"
              value={ownerSearch}
               disabled={frozen || !routeCanView || anyBusy || anyUncertain}
              onChange={(event) => setOwnerSearch(event.target.value)}
              helperText="Busca por código o nombre; se consulta por páginas."
            />
            {ownerCatalogState === 'loading' && <Typography variant="caption" color="text.secondary">Consultando catálogo…</Typography>}
            {ownerCatalogState === 'error' && feedbackFallback_ownerCatalogError && <Alert severity="warning">{ownerCatalogError}</Alert>}
            {ownerArticles.map((article) => (
              <Button key={`remote-owner-${article.id}`} size="small" variant="outlined" sx={{ justifyContent: 'flex-start' }} onClick={() => setOwnerTargetChoice(article)} disabled={anyBusy || anyUncertain}>
                 Usar {articleLabel(article)} como dueño · {article.clase}
              </Button>
            ))}
            {ownerCatalogHasMore && (
              <Button size="small" onClick={() => searchOwnerArticles({ query: ownerSearch, cursor: ownerCatalogCursor })} disabled={ownerCatalogState === 'loading' || anyBusy || anyUncertain}>
                Cargar más dueños
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {effectiveTarget && effectiveTarget.id !== baseTarget?.id && (
        <Alert severity="info">
           Propietario explícito: {articleLabel(effectiveTarget)}. La salida física de la OF sigue siendo {articleLabel(baseTarget, baseTarget?.id)}; no se selecciona automáticamente.
        </Alert>
      )}
      {!effectiveCanView && directTarget && <Alert severity="warning">Identidad propietaria no disponible para esta corrida. Solo se admite una Pieza-color directa; no se consulta ni administra otra salida por aproximación.</Alert>}
      {catalogState === 'loading' && <Alert severity="info" icon={<CircularProgress size={18} />}>Cargando rutas y centros…</Alert>}
      {catalogState === 'error' && feedbackFallback_catalogError && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={loadCatalog}>Reintentar</Button>}>{catalogError}</Alert>}
      {notice && <Alert severity={noticeSeverity}>{notice}</Alert>}
      {routeUncertain && (
        <Alert severity="warning" action={(
          <Stack direction="row" spacing={0.5}>
            <Button color="inherit" size="small" onClick={loadCatalog}>Consultar rutas</Button>
            {reconciledRoute && <Button color="inherit" size="small" onClick={() => { const adopted = normalizeRouteRevision(reconciledRoute, effectiveTarget, effectiveTarget ? [effectiveTarget] : []); setEditingRoute(reconciledRoute); setRouteForm(adopted); setBaseline(adopted); setRouteUncertain(false); routeAttemptRef.current = null; notify('Resultado de ruta adoptado tras reconciliar el catálogo.', 'success'); }}>Usar resultado</Button>}
          </Stack>
        )}>Resultado incierto: el borrador se conserva y no se repetirá el POST. Consulta el catálogo antes de cerrar.</Alert>
      )}
      {governanceUncertain && (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={reconcileRouteGovernance}>Consultar rutas</Button>}>
          Gobierno incierto: consulta la revisión exacta antes de repetir; no se reenvía automáticamente.
        </Alert>
      )}
      {closePrompt && (
          <Alert severity="warning" action={<Stack direction="row" spacing={0.5}><Button color="inherit" size="small" onClick={() => setClosePrompt(false)}>Seguir editando</Button><Button color="inherit" size="small" onClick={() => { setClosePrompt(false); setRouteForm(null); setEditingRoute(null); setBaseline(null); setStructureForm(null); setStructureRevision(null); setStructureBaseline(null); setStructureStack([]); setWorkspaceFrame('route'); setCenterIndex(null); if (closeIntent === 'host') onClose?.(); }}>Descartar niveles no guardados</Button></Stack>}>
          Hay un borrador de ruta sin guardar. También hay cambios pendientes en sus dependencias; los maestros ya confirmados no se revierten.
        </Alert>
      )}
      {routeForm ? (
        <>
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={requestCloseEditor} disabled={anyBusy || anyUncertain} sx={{ alignSelf: 'flex-start' }}>Volver a rutas</Button>
          <RouteRevisionEditor
            targetArticle={effectiveTarget}
            articles={[
              ...(effectiveTarget ? [effectiveTarget] : []),
              ...structureArticles.filter((item) => String(item.id) !== String(effectiveTarget?.id)),
            ]}
            centers={centers}
            structures={structures}
            revision={editingRoute}
            value={routeForm}
            onChange={setRouteForm}
            onSearchArticles={searchEngineeringArticles}
            searchArticlesLoading={articleSearchBusy}
            onPrepareWip={(index) => {
              if (!articleCanAdmin) return;
              setWipOperationIndex(index);
              setWipPurpose('operation');
              setWorkspaceFrame('wip');
            }}
            onCreateCenter={(index, operation) => {
              setCenterIndex(index);
              setCenterError('');
              setCenterForm({
                nombre: '',
                tipo: ['INYECCION', 'SOPLADO', 'PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].includes(operation?.tipo)
                  ? operation.tipo
                  : 'PREARMADO',
              });
            }}
            onNavigateStructure={(structureArticleId) => {
              const article = structureArticles.find((item) => String(item.id) === String(structureArticleId))
                || (String(structureArticleId) === String(effectiveTarget?.id) ? effectiveTarget : null)
                || (String(structureArticleId) === String(baseTarget?.id) ? baseTarget : null);
              if (article) loadStructureFor(article);
            }}
            onRefreshStructures={refreshStructuresFor}
            isStructureLoaded={(articleId) => structureLoadedIds.has(Number(articleId))}
            createCenterPanel={createCenterPanel}
            onCancel={requestCloseEditor}
            onSubmit={saveRoute}
             busy={anyBusy || anyUncertain}
            readOnly={readOnly || routeStatus(editingRoute) !== 'BORRADOR'}
            submitLabel={editingRoute ? 'Guardar borrador' : 'Crear borrador'}
            showHeading={false}
          />
        </>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box><Typography component="h3" variant="h6">Rutas del artículo</Typography><Typography variant="body2" color="text.secondary">Selecciona una revisión para consultar o editarla.</Typography></Box>
             <Button startIcon={<AddOutlinedIcon />} variant="outlined" onClick={() => openRoute()} disabled={readOnly || !directTarget?.id || anyBusy || anyUncertain}>Nueva ruta</Button>
          </Stack>
          <Divider />
          {!routes.length && catalogState === 'ready' && <Alert severity="info">No hay revisiones de ruta para este artículo.</Alert>}
          <Stack spacing={1}>
            {routes.map((revision) => {
              const status = routeStatus(revision);
              const editable = !readOnly && status === 'BORRADOR';
              const creatorIsCurrentActor = creatorIdOf(revision) != null
                && String(creatorIdOf(revision)) === String(actorId);
              return (
                <Paper key={routeIdOf(revision) || `${status}-${revision.numero_revision}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                    <Box><Typography fontWeight={750}>{revision.nombre || revision.codigo || `Ruta rev. ${revision.numero_revision || '—'}`}</Typography><Typography variant="caption" color="text.secondary"><span>{routeStatusLabel[status] || status}</span>{revision.numero_revision ? <span>{` · revisión ${revision.numero_revision}`}</span> : null}</Typography></Box>
                    <Button size="small" variant={editable ? 'contained' : 'outlined'} onClick={() => openRoute(revision)} disabled={anyBusy || anyUncertain}>{editable ? 'Abrir borrador' : 'Ver revisión'}</Button>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                    {status === 'BORRADOR' && canRouteApprove && !creatorIsCurrentActor && <Button size="small" onClick={() => governRoute(revision, 'aprobar')} disabled={anyBusy || anyUncertain}>Aprobar ruta</Button>}
                    {status === 'BORRADOR' && canRoutePublish && <Button size="small" onClick={() => governRoute(revision, 'publicar')} disabled={anyBusy || anyUncertain}>Publicar ruta</Button>}
                    {status === 'APROBADA' && canRouteApprove && <Button size="small" onClick={() => governRoute(revision, 'retirar')} disabled={anyBusy || anyUncertain}>Retirar ruta</Button>}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );

  const wipContent = (
    <Stack spacing={2}>
      {closePrompt && (
        <Alert severity="warning" action={<Stack direction="row" spacing={0.5}><Button color="inherit" size="small" onClick={() => setClosePrompt(false)}>Seguir editando</Button><Button color="inherit" size="small" onClick={() => { setClosePrompt(false); setRouteForm(null); setEditingRoute(null); setBaseline(null); setStructureForm(null); setStructureRevision(null); setStructureBaseline(null); setStructureStack([]); setWorkspaceFrame('route'); setCenterIndex(null); if (closeIntent === 'host') onClose?.(); }}>Descartar niveles no guardados</Button></Stack>}>
          Hay un borrador de ruta sin guardar. También hay cambios pendientes en sus dependencias; los maestros ya confirmados no se revierten.
        </Alert>
      )}
       <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => setWorkspaceFrame('route')} disabled={anyBusy || anyUncertain} sx={{ alignSelf: 'flex-start' }}>
        Volver a ruta
      </Button>
      <Box>
        <Typography component="h3" variant="h6">Alta de artículo WIP {wipPurpose === 'component' ? 'para BOM' : wipPurpose === 'operation' ? 'para salida de operación' : 'para dueño de ruta'}</Typography>
        <Typography variant="body2" color="text.secondary">
          El WIP es un maestro independiente; confirmar aquí no guarda ni libera la OF ni la BOM.
        </Typography>
      </Box>
      {wipUncertain && (
        <Alert severity="warning" action={<Stack direction="row" spacing={0.5}>
          <Button color="inherit" size="small" onClick={reconcileWip}>Consultar artículos</Button>
        </Stack>}>
          Alta incierta: consulta el catálogo antes de repetir. El formulario se conserva y no se repite el POST.
        </Alert>
      )}
      <TextField
        label="Nombre del WIP"
        value={wipForm.nombre}
        disabled={anyBusy || anyUncertain}
        onChange={(event) => setWipForm((current) => ({ ...current, nombre: event.target.value }))}
      />
      <TextField
        label="Descripción"
        value={wipForm.descripcion}
        disabled={anyBusy || anyUncertain}
        onChange={(event) => setWipForm((current) => ({ ...current, descripcion: event.target.value }))}
      />
      <FormControlLabel
        control={(
          <Checkbox
            checked={Boolean(wipForm.requiere_calidad)}
            disabled={anyBusy || anyUncertain}
            onChange={(event) => setWipForm((current) => ({
              ...current,
              requiere_calidad: event.target.checked,
            }))}
          />
        )}
        label="Requiere control de calidad"
      />
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
         <Button onClick={() => setWorkspaceFrame('route')} disabled={anyBusy || anyUncertain}>Cancelar panel</Button>
        <Button variant="contained" onClick={createWip} disabled={anyBusy || anyUncertain || !wipForm.nombre.trim()}>
          {wipBusy ? 'Confirmando…' : 'Confirmar WIP'}
        </Button>
      </Stack>
    </Stack>
  );

  const structureContent = (
    <Stack spacing={2}>
      {closePrompt && (
        <Alert severity="warning" action={<Stack direction="row" spacing={0.5}><Button color="inherit" size="small" onClick={() => setClosePrompt(false)}>Seguir editando</Button><Button color="inherit" size="small" onClick={() => { setClosePrompt(false); setRouteForm(null); setEditingRoute(null); setBaseline(null); setStructureForm(null); setStructureRevision(null); setStructureBaseline(null); setStructureStack([]); setWorkspaceFrame('route'); setCenterIndex(null); if (closeIntent === 'host') onClose?.(); }}>Descartar niveles no guardados</Button></Stack>}>
          Hay un borrador de ruta sin guardar. También hay cambios pendientes en sus dependencias; los maestros ya confirmados no se revierten.
        </Alert>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
         <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => {
          if (structureStack.length) {
            const previous = structureStack.at(-1);
            setStructureStack((current) => current.slice(0, -1));
            setStructureTarget(previous.article);
            setStructureRevision(previous.revision);
            setStructureForm(previous.form);
            setStructureBaseline(previous.baseline);
            setStructureArticles(previous.articles || []);
            setStructures(previous.structures || []);
            setStructureLoadedIds(previous.loadedIds || new Set());
             setStructureArticleQuery(previous.articleQuery || '');
             setStructureArticleCursor(previous.articleCursor || null);
             setStructureArticleHasMore(Boolean(previous.articleHasMore));
          } else {
            setWorkspaceFrame('route');
          }
         }} disabled={anyBusy || anyUncertain}>
          {structureStack.length ? 'Volver a BOM padre' : 'Volver a ruta'}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {structureStack.length ? 'BOM padre conservada' : 'Composición del WIP'}
        </Typography>
      </Stack>
      <Box>
          <Typography component="h3" variant="h6">BOM de {articleLabel(structureTarget, 'artículo')}</Typography>
        <Typography variant="body2" color="text.secondary">
          BORRADOR/PENDIENTE puede vincularse a una ruta BORRADOR; sólo APROBADA habilita gobierno final.
        </Typography>
      </Box>
      <Button
        size="small"
        variant="outlined"
        onClick={() => { setWipPurpose('component'); setWorkspaceFrame('wip'); }}
         disabled={frozen || !articleCanAdmin || !structureCanAdmin || anyBusy || anyUncertain}
        sx={{ alignSelf: 'flex-start' }}
      >
        Preparar WIP para componente BOM
      </Button>
      {catalogState === 'loading' && <Alert severity="info" icon={<CircularProgress size={18} />}>Cargando BOM y artículos…</Alert>}
      {catalogState === 'error' && feedbackFallback_catalogError && <Alert severity="warning">{catalogError}</Alert>}
      {structureUncertain && (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={reconcileStructureSave}>Consultar BOM</Button>}>
          Guardado incierto: reconcilia la lectura antes de repetir el POST.
        </Alert>
      )}
      {governanceUncertain && (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={reconcileStructureGovernance}>Consultar BOM</Button>}>
          Gobierno incierto: consulta la revisión exacta antes de repetir; no se reenvía automáticamente.
        </Alert>
      )}
      {(canStructureApprove || canStructurePublish) && (
        <TextField
          size="small"
          label="Motivo de rechazo, descarte o retiro"
          value={governanceReason}
          disabled={anyBusy || anyUncertain}
          onChange={(event) => setGovernanceReason(event.target.value)}
          helperText="Gobernar la BOM no guarda la ruta ni la OF."
        />
      )}
      {!structureForm && (
        <Stack spacing={1}>
           <Button variant="outlined" onClick={() => openStructureEditor()} disabled={frozen || !structureCanAdmin || !structureCanView || anyBusy || anyUncertain}>Nueva BOM borrador</Button>
          {structures.filter((revision) => {
            const resultArticleId = revision.articulo_resultado_id ?? revision.articulo_resultado?.id;
            return structureTarget?.id != null && resultArticleId != null
              && String(resultArticleId) === String(structureTarget.id);
          }).map((revision) => (
            <Paper key={revision.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography fontWeight={750}>Revisión {revision.numero_revision || '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{revision.estado || 'BORRADOR'}</Typography>
                </Box>
                <Button size="small" onClick={() => openStructureEditor(revision)} disabled={anyBusy || anyUncertain}>
                  {revision.estado === 'BORRADOR' ? 'Abrir borrador' : 'Ver revisión'}
                </Button>
              </Stack>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                {revision.estado === 'BORRADOR' && structureCanAdmin && <Button size="small" onClick={() => governStructure(revision, 'enviar')} disabled={anyBusy || anyUncertain}>Enviar BOM</Button>}
                {revision.estado === 'PENDIENTE_APROBACION' && canStructureApprove && !(creatorIdOf(revision) != null && String(creatorIdOf(revision)) === String(actorId)) && <Button size="small" onClick={() => governStructure(revision, 'aprobar')} disabled={anyBusy || anyUncertain}>Aprobar BOM</Button>}
                {revision.estado === 'BORRADOR' && canStructurePublish && <Button size="small" onClick={() => governStructure(revision, 'publicar')} disabled={anyBusy || anyUncertain}>Publicar BOM</Button>}
                {revision.estado === 'PENDIENTE_APROBACION' && canStructureApprove && !(creatorIdOf(revision) != null && String(creatorIdOf(revision)) === String(actorId)) && <Button size="small" onClick={() => governStructure(revision, 'rechazar')} disabled={anyBusy || anyUncertain}>Rechazar BOM</Button>}
                {revision.estado === 'BORRADOR' && structureCanAdmin && <Button size="small" onClick={() => governStructure(revision, 'descartar')} disabled={anyBusy || anyUncertain}>Descartar BOM</Button>}
                {revision.estado === 'APROBADA' && canStructureApprove && <Button size="small" onClick={() => governStructure(revision, 'retirar')} disabled={anyBusy || anyUncertain}>Retirar BOM</Button>}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      {structureForm && (
        <StructureRevisionEditor
          targetArticle={structureTarget}
          componentArticles={structureArticles}
          onSearchArticles={searchEngineeringArticles}
          searchArticlesLoading={articleSearchBusy}
          isStructureLoaded={(articleId) => structureLoadedIds.has(Number(articleId))}
          structures={structures}
          revision={structureRevision}
          value={structureForm}
          onChange={setStructureForm}
          onSubmit={saveStructure}
          onCancel={() => {
            if (structureDirty) {
              notify('La BOM tiene cambios sin guardar. Vuelve explícitamente o descarta el nivel.', 'warning');
              return;
            }
            setStructureForm(null);
            setStructureRevision(null);
          }}
          onNavigateStructure={(articleId) => {
            const article = structureArticles.find((item) => String(item.id) === String(articleId));
            if (article) loadStructureFor(article, { preserveCurrent: true });
          }}
          busy={anyBusy || anyUncertain}
          readOnly={frozen || !structureCanAdmin || !structureCanView || (structureRevision?.estado !== undefined && structureRevision.estado !== 'BORRADOR')}
          submitLabel={structureRevision ? 'Guardar BOM borrador' : 'Crear BOM borrador'}
        />
      )}
    </Stack>
  );

  const content = workspaceFrame === 'wip'
    ? wipContent
    : workspaceFrame === 'structure'
      ? structureContent
      : routeContent;

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
