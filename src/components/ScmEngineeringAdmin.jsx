import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ApprovalOutlinedIcon from '@mui/icons-material/ApprovalOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  actualizarArticuloWipScm,
  actualizarCentroTrabajoScm,
  actualizarEstructuraScm,
  actualizarPerfilEmpacableScm,
  actualizarReglaEmpaqueScm,
  actualizarRutaScm,
  actualizarTipoContenedorScm,
  aprobarEstructuraScm,
  aprobarReglaEmpaqueScm,
  aprobarRutaScm,
  asignarPerfilesArticuloScm,
  crearArticuloWipScm,
  crearCentroTrabajoScm,
  crearEstructuraScm,
  crearPerfilEmpacableScm,
  crearReglaEmpaqueScm,
  crearRutaArticuloScm,
  crearTipoContenedorScm,
  descartarEstructuraScm,
  enviarEstructuraScm,
  listarArticulosPaginaScm,
  listarAsignacionesEmpaqueScm,
  listarAprobacionesIngenieriaScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaquePaginaScm,
  listarRutasArticuloScm,
  listarTiposContenedorScm,
  mensajeErrorScm,
  hidratarEstructurasScm,
  obtenerReglaEmpaqueScm,
  obtenerPerfilesArticuloScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
  publicarRutaScm,
  rechazarEstructuraScm,
  retirarEstructuraScm,
  retirarRutaScm,
  resolverArticulosScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ScmArticleAutocomplete from './ui/ScmArticleAutocomplete';
import { useScmActor } from '../context/ScmActorContext';
import { matchesOmniSearch } from '../utils/tableSearch';
import {
  ApprovalActionPanel,
  PackagingProfileEditor,
  PackagingRuleEditor,
  RouteRevisionEditor,
  StructureRevisionEditor,
  buildRoutePayload,
  buildStructurePayload,
  compactDecimal,
  emptyPackagingProfileValue,
  emptyPackagingRuleValue,
  emptyRouteValue,
  emptyStructureValue,
  EXECUTOR_LABEL,
  normalizeRouteRevision,
  normalizeStructureRevision,
  OPERATION_TYPES,
  OPERATION_TYPE_LABEL,
} from './scmEngineering/editors';

const ARTICLE_CLASS = {
  PIEZA_COLOR: 'Pieza-color',
  SUBENSAMBLE_WIP: 'WIP',
  PRODUCTO_TERMINADO: 'Producto terminado',
};
const STATUS_COLOR = {
  BORRADOR: 'warning',
  PENDIENTE_APROBACION: 'info',
  APROBADA: 'success',
  RETIRADA: 'default',
  RECHAZADA: 'error',
  DESCARTADA: 'default',
};
const CONTAINER_CLASSES = ['MANGA', 'BOLSA', 'JABA', 'CAJA', 'OTRO'];
const emptyWip = { nombre: '', descripcion: '', requiere_calidad: false };
const emptyCenter = { nombre: '', tipo: 'PREARMADO' };
const emptyContainer = {
  clase: 'MANGA',
  nombre: '',
  material: '',
  tara_nominal_g: '0',
  tolerancia_tara_g: '0',
  peso_bruto_max_kg: '',
};
const initialApprovalCursors = () => ({
  ESTRUCTURA: { 0: null },
  RUTA: { 0: null },
  EMPAQUE: { 0: null },
});

const initialPlanningContext = () => {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const requestedReturn = params.get('volver') || '';
  return {
    orderCode: params.get('op') || '',
    missingArticleCode: params.get('faltante') || '',
    returnTo: requestedReturn.startsWith('/planificacion') ? requestedReturn : '',
  };
};

const requestedPackagingArticleId = () => (
  new URLSearchParams(globalThis.location?.search || '').get('articulo') || ''
);

const isRoutableArticle = (item) => (
  item.activo !== false
  && ['PIEZA_COLOR', 'SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO'].includes(item.clase)
);

const statusChip = (state) => (
  <Chip
    size="small"
    label={String(state || 'SIN DEFINIR').replaceAll('_', ' ')}
    color={STATUS_COLOR[state] || 'default'}
    variant="outlined"
  />
);

const normalizeApprovalItem = (item = {}, domain) => ({
  ...item,
  id: item.id ?? item.revision_id,
  revision_id: item.revision_id ?? item.id,
  ...(domain === 'ESTRUCTURA'
    ? { articulo_resultado: item.articulo_resultado || item.objetivo || item.articulo }
    : {}),
  ...(domain === 'RUTA'
    ? { articulo_objetivo: item.articulo_objetivo || item.objetivo || item.articulo }
    : {}),
  ...(domain === 'EMPAQUE'
    ? {
      perfil_empacable: item.perfil_empacable || item.perfil || null,
      tipo_contenedor: item.tipo_contenedor || item.contenedor || null,
    }
    : {}),
});

function EmptyRow({ columns, children = 'Todavía no hay registros.' }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} align="center" sx={{ py: 5, color: 'text.secondary' }}>
        {children}
      </TableCell>
    </TableRow>
  );
}

function ScmEngineeringAdmin() {
  const { actor, actorId, can, experience } = useScmActor();
  const canAdminArticles = can('ARTICULO_ADMINISTRAR');
  const canAdminStructures = can('ESTRUCTURA_ADMINISTRAR');
  const canApproveStructures = can('ESTRUCTURA_APROBAR');
  const canPublishStructuresDirectly = can('ESTRUCTURA_PUBLICAR_DIRECTO');
  const canAdminRoutes = can('RUTA_ADMINISTRAR');
  const canApproveRoutes = can('RUTA_APROBAR');
  const canPublishRoutesDirectly = can('RUTA_PUBLICAR_DIRECTO');
  const canAdminPackaging = can('EMPAQUE_ADMINISTRAR');
  const canApprovePackaging = can('EMPAQUE_APROBAR');
  const canPublishPackagingDirectly = can('EMPAQUE_PUBLICAR_DIRECTO');
  const isReadOnly = !canAdminArticles && !canAdminStructures && !canApproveStructures
    && !canAdminRoutes && !canApproveRoutes && !canAdminPackaging && !canApprovePackaging;
  const canonicalCapabilities = [
    canAdminStructures && 'ESTRUCTURA_ADMINISTRAR',
    canApproveStructures && 'ESTRUCTURA_APROBAR',
    canPublishStructuresDirectly && 'ESTRUCTURA_PUBLICAR_DIRECTO',
    canAdminRoutes && 'RUTA_ADMINISTRAR',
    canApproveRoutes && 'RUTA_APROBAR',
    canPublishRoutesDirectly && 'RUTA_PUBLICAR_DIRECTO',
    canAdminPackaging && 'EMPAQUE_ADMINISTRAR',
    canApprovePackaging && 'EMPAQUE_APROBAR',
    canPublishPackagingDirectly && 'EMPAQUE_PUBLICAR_DIRECTO',
  ].filter(Boolean);
  const capabilityFingerprint = canonicalCapabilities.join('|');
  const canReadStructures = can('ESTRUCTURA_VER');
  const canReadRoutes = can('RUTA_VER');
  const canReadPackaging = can('EMPAQUE_VER');
  const canReadArticles = can('ARTICULO_VER');
  const readCapabilityFingerprint = [
    canReadArticles && 'ARTICULO_VER',
    canReadStructures && 'ESTRUCTURA_VER',
    canReadRoutes && 'RUTA_VER',
    canReadPackaging && 'EMPAQUE_VER',
  ].filter(Boolean).join('|');
  const [tab, setTab] = useState(() => ({
    articulos: 0,
    estructuras: 1,
    rutas: 2,
    empaque: 3,
    aprobaciones: 4,
  }[new URLSearchParams(globalThis.location?.search || '').get('tab')] || 0));
  const articleSearchScope = [
    actorId,
    tab,
    capabilityFingerprint,
    readCapabilityFingerprint,
  ].join(':');
  const [loading, setLoading] = useState(true);
  const [loadedActorId, setLoadedActorId] = useState(null);
  const initializedActor = useRef(false);
  const activeActor = useRef(actorId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshFailure, setRefreshFailure] = useState(null);
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState([]);
  const [articleCache, setArticleCache] = useState([]);
  const [articlePage, setArticlePage] = useState({ items: [], total: 0, has_more: false, next_cursor: null });
  const [articlePageIndex, setArticlePageIndex] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [articleCursors, setArticleCursors] = useState({ 0: null });
  const [articleQuery, setArticleQuery] = useState('');
  const [articlePageError, setArticlePageError] = useState('');
  const [structurePageError, setStructurePageError] = useState('');
  const [articlePageLoading, setArticlePageLoading] = useState(false);
  const [structures, setStructures] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState('');
  const [centers, setCenters] = useState([]);
  const [containers, setContainers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [dataRevision, setDataRevision] = useState(0);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [assignmentCursors, setAssignmentCursors] = useState({ 0: null });
  const [assignmentState, setAssignmentState] = useState(null);
  const [selectedProfileState, setSelectedProfileState] = useState(null);
  const assignmentCursor = assignmentCursors[assignmentPage] || null;
  const assignmentKey = JSON.stringify([actorId, dataRevision, assignmentQuery, assignmentCursor]);
  const assignmentCurrent = assignmentState?.key === assignmentKey;
  const assignmentLoading = tab === 3 && !assignmentCurrent;
  const assignmentPayload = assignmentCurrent
    ? assignmentState.payload : { items: [], total: 0, has_more: false, next_cursor: null };
  const [rules, setRules] = useState([]);
  const [rulePage, setRulePage] = useState({ items: [], total: 0, has_more: false, next_cursor: null });
  const [rulePageIndex, setRulePageIndex] = useState(0);
  const [ruleCursors, setRuleCursors] = useState({ 0: null });
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleHistory, setRuleHistory] = useState(false);
  const [rulePageError, setRulePageError] = useState('');
  const [rulePageLoading, setRulePageLoading] = useState(false);
  const [approvalPages, setApprovalPages] = useState({});
  const [approvalLoadedDomains, setApprovalLoadedDomains] = useState({});
  const [approvalDenied, setApprovalDenied] = useState({});
  const [approvalErrors, setApprovalErrors] = useState({});
  const [approvalPage, setApprovalPage] = useState({});
  const [approvalCursors, setApprovalCursors] = useState({});
  const [approvalQuery, setApprovalQuery] = useState('');
  const pagedAbort = useRef(null);
  const pendingRefreshRef = useRef(null);
  const refreshInFlightRef = useRef(null);
  const refreshNonceRef = useRef(0);
  const hydrationAbort = useRef(null);
  const ruleReadAbort = useRef(null);
  const ruleReadGeneration = useRef(0);
  const [hydratingEditor, setHydratingEditor] = useState(false);
  const [hydrationError, setHydrationError] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedRouteArticleId, setSelectedRouteArticleId] = useState('');
  const [dialog, setDialog] = useState(null);
  const [wipForm, setWipForm] = useState(emptyWip);
  const [bomForm, setBomForm] = useState(emptyStructureValue);
  const [centerForm, setCenterForm] = useState(emptyCenter);
  const [routeForm, setRouteForm] = useState(emptyRouteValue);
  const [containerForm, setContainerForm] = useState(emptyContainer);
  const [profileForm, setProfileForm] = useState(emptyPackagingProfileValue);
  const [ruleForm, setRuleForm] = useState(emptyPackagingRuleValue);
  const [editingWip, setEditingWip] = useState(null);
  const [editingBom, setEditingBom] = useState(null);
  const [editingCenter, setEditingCenter] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingContainer, setEditingContainer] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [structureResolution, setStructureResolution] = useState({
    action: '',
    revision: null,
    motivo: '',
  });
  const [showStructureHistory, setShowStructureHistory] = useState(false);
  const [packagingArticleId, setPackagingArticleId] = useState(
    requestedPackagingArticleId,
  );
  const [packagingProfileId, setPackagingProfileId] = useState('');
  const selectedProfileKey = JSON.stringify([actorId, dataRevision, packagingArticleId]);
  const selectedProfileCurrent = selectedProfileState?.key === selectedProfileKey;
  const selectedProfileLoading = Boolean(packagingArticleId) && !selectedProfileCurrent;
  const articleProfilesError = [
    assignmentCurrent && assignmentState.error,
    selectedProfileCurrent && selectedProfileState.error,
  ].filter(Boolean).join(' · ');

  const [planningContext] = useState(initialPlanningContext);

  const routeTargetArticles = useMemo(
    () => [...new Map([...articles, ...articleCache]
      .filter(isRoutableArticle)
      .map((item) => [Number(item.id), item])).values()],
    [articleCache, articles],
  );
  const activeCenters = useMemo(
    () => centers.filter((item) => item.activo !== false),
    [centers],
  );
  const routeTargetArticle = useMemo(
    () => routeTargetArticles.find(
      (item) => String(item.id) === String(selectedRouteArticleId),
    ),
    [routeTargetArticles, selectedRouteArticleId],
  );
  const structureResultArticles = useMemo(
    () => [...new Map([...articles, ...articleCache].filter((item) => (
      item.clase === 'SUBENSAMBLE_WIP'
      || item.clase === 'PRODUCTO_TERMINADO'
    )).map((item) => [Number(item.id), item])).values()],
    [articleCache, articles],
  );
  const selectedArticle = articleCache.find((item) => item.id === Number(selectedArticleId));
  const packagingArticle = articleCache.find(
    (item) => item.id === Number(packagingArticleId),
  );
  const packagingArticles = useMemo(
    () => [...new Map([...articles, ...articleCache].map((item) => [Number(item.id), item])).values()],
    [articleCache, articles],
  );
  const structureComponentArticles = useMemo(
    () => [...new Map([...articles, ...articleCache].filter((item) => (
      (item.clase === 'PIEZA_COLOR' || item.clase === 'SUBENSAMBLE_WIP')
      && item.id !== Number(selectedArticleId)
    )).map((item) => [Number(item.id), item])).values()],
    [articles, articleCache, selectedArticleId],
  );
  const filteredArticles = useMemo(
    () => articles.filter((item) => matchesOmniSearch(item, search)),
    [articles, search],
  );
  const pendingStructures = structures.filter(
    (item) => item.estado === 'PENDIENTE_APROBACION',
  );
  const pendingRoutes = routes.filter((item) => item.estado === 'BORRADOR');
  const pendingRules = rules.filter((item) => item.estado === 'BORRADOR');
  const approvalStructureItems = approvalPages.ESTRUCTURA?.items || pendingStructures;
  const approvalRouteItems = approvalPages.RUTA?.items || pendingRoutes;
  const approvalRuleItems = approvalPages.EMPAQUE?.items || pendingRules;
  const approvalCountKnown = Object.keys(approvalLoadedDomains).length > 0;

  const loadPagedTab = useCallback(async (targetTab = tab, options = {}) => {
    if (activeActor.current !== actorId) return null;
    pagedAbort.current?.abort();
    const controller = new AbortController();
    pagedAbort.current = controller;
    const signal = controller.signal;
    const effectiveArticlePageIndex = options.resetPagination ? 0 : articlePageIndex;
    const effectiveRulePageIndex = options.resetPagination ? 0 : rulePageIndex;
    const effectiveApprovalPage = options.resetPagination ? {} : approvalPage;
    let refreshFailed = false;
    const refreshRetryPlan = { ...options };
    const syncRefreshFailure = () => {
      if (!options.refreshAfterMutation || !refreshFailed) return;
      setRefreshFailure({
        actorId,
        tab: targetTab,
        message: 'Cambio guardado; no se pudo actualizar esta sección.',
        plan: { ...refreshRetryPlan },
      });
    };
    const markRefreshFailure = (retryOptions = {}) => {
      if (!options.refreshAfterMutation) return;
      refreshFailed = true;
      Object.assign(refreshRetryPlan, retryOptions);
      syncRefreshFailure();
    };
    const markRefreshSuccess = (successOptions = {}, deletedKeys = []) => {
      if (!options.refreshAfterMutation) return;
      Object.assign(refreshRetryPlan, successOptions);
      deletedKeys.forEach((key) => delete refreshRetryPlan[key]);
      syncRefreshFailure();
    };
    setLoadedActorId(actorId);
    setError('');
    const articleMode = !options.skipArticles && canReadArticles && (
      targetTab === 0
      || (targetTab === 1 && canReadStructures)
      || (targetTab === 2 && canReadRoutes)
      || (targetTab === 3 && canReadPackaging)
    );
    const articleClasses = targetTab === 1
      ? 'SUBENSAMBLE_WIP,PRODUCTO_TERMINADO'
      : 'PIEZA_COLOR,SUBENSAMBLE_WIP,PRODUCTO_TERMINADO';
    try {
      if (articleMode) {
        setArticlePageLoading(true);
        const payload = await listarArticulosPaginaScm(actorId, {
          q: articleQuery || undefined,
          clases: articleClasses,
          activo: targetTab === 2 ? 'true' : 'all',
          limite: 25,
          cursor: options.resetPagination ? undefined : articleCursors[effectiveArticlePageIndex] || undefined,
        }, signal);
        if (signal.aborted || activeActor.current !== actorId) return null;
        const next = { items: payload?.items || [], total: payload?.total || 0, has_more: Boolean(payload?.has_more), next_cursor: payload?.next_cursor || null };
        setArticlePage(next);
        setArticles(next.items);
        setArticleCache((current) => [...new Map([...current, ...next.items].map((item) => [Number(item.id), item])).values()]);
        if (effectiveArticlePageIndex === 0) {
          const params = new URLSearchParams(globalThis.location?.search || '');
          const requestedArticle = params.get('articulo');
          const requestedProduct = params.get('producto');
          let requested = next.items.find((item) => (
            String(item.id) === String(requestedArticle)
            || String(item.codigo) === String(requestedProduct)
            || String(item.subtipo?.producto_terminado_id) === String(requestedProduct)
          ));
          if (!requested && requestedArticle && /^\d+$/.test(requestedArticle)) {
            const resolvedPayload = await resolverArticulosScm(actorId, [Number(requestedArticle)], signal);
            if (signal.aborted || activeActor.current !== actorId) return null;
            const resolvedItems = resolvedPayload?.items || [];
            if (resolvedItems.length) {
              setArticleCache((current) => [...new Map(
                [...current, ...resolvedItems].map((item) => [Number(item.id), item]),
              ).values()]);
              requested = resolvedItems.find((item) => String(item.id) === String(requestedArticle));
            }
          }
          if (requested) {
            if (isRoutableArticle(requested)) setSelectedRouteArticleId((current) => current || String(requested.id));
            if (requested.clase === 'SUBENSAMBLE_WIP' || requested.clase === 'PRODUCTO_TERMINADO') {
              setSelectedArticleId((current) => current || String(requested.id));
            }
          }
        }
        setArticlePageError('');
        if (targetTab === 1) setStructurePageError('');
        setArticleCursors((current) => ({ ...current, [effectiveArticlePageIndex + 1]: next.next_cursor }));
        if (targetTab === 1 && canReadStructures && selectedArticleId) {
          const hydrated = await hidratarEstructurasScm(actorId, { articuloIds: [selectedArticleId] }, signal);
          if (signal.aborted || activeActor.current !== actorId) return null;
          const structureRows = await listarEstructurasScm(Number(selectedArticleId), actorId, signal);
          if (signal.aborted || activeActor.current !== actorId) return null;
          setStructures([...structureRows, ...(hydrated?.approved || []), ...(hydrated?.referenced || [])]
            .filter((item, index, rows) => rows.findIndex((candidate) => Number(candidate.id) === Number(item.id)) === index));
        }
      }
      if (targetTab === 2 && canReadArticles && canReadRoutes) {
        const routeCenters = await listarCentrosTrabajoScm(actorId, signal);
        if (signal.aborted || activeActor.current !== actorId) return null;
        setCenters(routeCenters);
      }
      const routeTargetId = selectedRouteArticleId || (() => {
        const params = new URLSearchParams(globalThis.location?.search || '');
        const requested = params.get('articulo') || params.get('producto');
        const article = [...articles, ...articleCache].find((item) => (
          String(item.id) === String(requested)
          || String(item.codigo) === String(requested)
          || String(item.subtipo?.producto_terminado_id) === String(requested)
        ));
        return article?.id ? String(article.id) : '';
      })();
      if (targetTab === 2 && canReadArticles && canReadRoutes && routeTargetId && !options.skipRoutes) {
        setRoutesLoading(true);
        setRoutesError('');
        try {
          const routeRows = await listarRutasArticuloScm(Number(routeTargetId), actorId, signal);
          if (!signal.aborted && activeActor.current === actorId) setRoutes(routeRows);
          const routeHydration = await hidratarEstructurasScm(actorId, {
            articuloIds: [routeTargetId],
          }, signal);
          if (!signal.aborted && activeActor.current === actorId) {
            setStructures((current) => [...new Map([
              ...current,
              ...(routeHydration?.approved || []),
              ...(routeHydration?.referenced || []),
            ].map((item) => [Number(item.id), item])).values()]);
          }
        } catch (routeError) {
          if (!signal.aborted && activeActor.current === actorId) {
            setRoutesError(mensajeErrorScm(routeError, 'No se pudieron cargar las rutas del artículo seleccionado.'));
          }
          return signal.aborted ? null : false;
        } finally {
          if (!signal.aborted && activeActor.current === actorId) setRoutesLoading(false);
        }
      }
      if (targetTab === 3 && canReadPackaging) {
        if (!options.skipCatalogs) {
        const catalogReaders = {
          centers: () => listarCentrosTrabajoScm(actorId, signal),
          containers: () => listarTiposContenedorScm(actorId, signal),
          profiles: () => listarPerfilesEmpacablesScm(actorId, signal),
        };
        const catalogTargets = options.catalogs || ['containers', 'profiles'];
        const catalogs = await Promise.allSettled(catalogTargets.map((name) => (
          catalogReaders[name] ? catalogReaders[name]() : Promise.resolve([])
        )));
        if (signal.aborted || activeActor.current !== actorId) return null;
        const catalogError = catalogs.find((result) => result.status === 'rejected');
        if (catalogError) {
          markRefreshFailure({
            catalogs: catalogTargets.filter((_, index) => catalogs[index].status === 'rejected'),
            skipCatalogs: false,
          });
          if (!options.refreshAfterMutation) {
            setError(mensajeErrorScm(catalogError.reason, 'No se pudo actualizar el catálogo de empaque.'));
          }
        } else {
          markRefreshSuccess({ skipCatalogs: true }, ['catalogs']);
        }
        catalogs.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          if (catalogTargets[index] === 'centers') setCenters(result.value);
          if (catalogTargets[index] === 'containers') setContainers(result.value);
          if (catalogTargets[index] === 'profiles') setProfiles(result.value);
        });
        }
        if (options.refreshAssignments && canReadArticles) {
          try {
            const assignmentPayload = await listarAsignacionesEmpaqueScm({
              q: assignmentQuery || undefined,
              limite: 25,
              cursor: assignmentCursor || undefined,
            });
            if (!signal.aborted && activeActor.current === actorId) {
              setAssignmentState({ key: assignmentKey, payload: assignmentPayload, error: '' });
            }
            markRefreshSuccess({ refreshAssignments: false });
          } catch (assignmentError) {
            if (!signal.aborted && activeActor.current === actorId) {
              setAssignmentState({
                key: assignmentKey,
                payload: assignmentState?.payload || { items: [], total: 0, has_more: false, next_cursor: null },
                error: mensajeErrorScm(assignmentError),
              });
            }
            markRefreshFailure({
              refreshAssignments: true,
            });
            if (signal.aborted || activeActor.current !== actorId) return null;
          }
        }
        if (!options.skipRules) {
          setRulePageLoading(true);
          const ruleViews = options.ruleViews || [ruleHistory ? 'historial' : 'actual'];
          try {
            for (const vista of ruleViews) {
              const rulePayload = await listarReglasEmpaquePaginaScm(actorId, {
                vista, q: ruleQuery || undefined,
                limite: 25,
                cursor: options.resetPagination ? undefined : ruleCursors[effectiveRulePageIndex] || undefined,
              }, signal);
              if (signal.aborted || activeActor.current !== actorId) return null;
              if (vista === (ruleHistory ? 'historial' : 'actual')) {
                const nextRules = { items: rulePayload?.items || [], total: rulePayload?.total || 0, has_more: Boolean(rulePayload?.has_more), next_cursor: rulePayload?.next_cursor || null };
                setRulePage(nextRules);
                setRules(nextRules.items.map((item) => ({
                  ...item,
                  perfil_empacable: item.perfil_empacable || item.perfil || null,
                  tipo_contenedor: item.tipo_contenedor || item.contenedor || null,
                })));
                setRulePageError('');
              }
            }
            markRefreshSuccess({ skipRules: true }, ['ruleViews']);
          } catch (ruleError) {
            if (signal.aborted || activeActor.current !== actorId) return null;
            setRulePageError(mensajeErrorScm(ruleError, 'No se pudieron actualizar las reglas de empaque.'));
            markRefreshFailure({
              skipRules: false,
              ruleViews: [ruleHistory ? 'historial' : 'actual'],
            });
            if (signal.aborted || activeActor.current !== actorId) return null;
          }
        }
      }
      if (!options.skipApprovals && (targetTab === 4 || (targetTab === 3 && options.approvalDomains))) {
        const domains = (options.approvalDomains || [
          canReadStructures && 'ESTRUCTURA',
          canReadRoutes && 'RUTA',
          canReadPackaging && 'EMPAQUE',
        ]).filter(Boolean);
        const denied = {
          ...(canReadStructures ? {} : { ESTRUCTURA: true }),
          ...(canReadRoutes ? {} : { RUTA: true }),
          ...(canReadPackaging ? {} : { EMPAQUE: true }),
        };
        setApprovalDenied(denied);
        if (!options.approvalDomains) setApprovalErrors({});
        if (!domains.length) {
          setApprovalPages({});
          markRefreshSuccess({ skipApprovals: true }, ['approvalDomains']);
        } else {
          const results = await Promise.allSettled(domains.map((dominio) => (
            listarAprobacionesIngenieriaScm(actorId, {
              dominio,
              q: approvalQuery || undefined,
              limite: 25,
              cursor: options.resetPagination
                ? undefined
                : approvalCursors[dominio]?.[effectiveApprovalPage[dominio] || 0] || undefined,
            }, signal)
          )));
          if (signal.aborted || activeActor.current !== actorId) return null;
          const nextPages = { ...approvalPages };
          const nextErrors = {};
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const domain = domains[index];
              nextPages[domain] = {
                ...result.value,
                items: (result.value?.items || []).map((item) => normalizeApprovalItem(item, domain)),
              };
              setApprovalLoadedDomains((current) => ({ ...current, [domain]: true }));
            } else {
              nextErrors[domains[index]] = mensajeErrorScm(result.reason);
            }
          });
          setApprovalPages(nextPages);
          setApprovalErrors(nextErrors);
          if (Object.keys(nextErrors).length) {
            markRefreshFailure({
              skipApprovals: false,
              approvalDomains: Object.keys(nextErrors),
            });
          } else {
            markRefreshSuccess({ skipApprovals: true }, ['approvalDomains']);
          }
        }
      }
      syncRefreshFailure();
      return refreshFailed ? false : true;
    } catch (requestError) {
      if (signal.aborted || activeActor.current !== actorId) return null;
      const message = mensajeErrorScm(requestError);
      if (!options.refreshAfterMutation) {
        if (targetTab === 0 || targetTab === 1 || targetTab === 2 || targetTab === 3) setArticlePageError(message);
        if (targetTab === 1) setStructurePageError(message);
        if (targetTab === 3) setRulePageError(message);
        if (targetTab === 2) setRoutesError(message);
        if (targetTab === 4) setError(message);
      }
      markRefreshFailure({
        skipCatalogs: true,
        skipApprovals: true,
        ruleViews: [ruleHistory ? 'historial' : 'actual'],
      });
      return false;
    } finally {
      if (pagedAbort.current === controller) {
        pagedAbort.current = null;
        setArticlePageLoading(false);
        setRulePageLoading(false);
      }
    }
  }, [actorId, articleCursors, articlePageIndex, articleQuery, approvalCursors, approvalPage,
    approvalQuery, assignmentCursor, assignmentKey, assignmentQuery, assignmentState,
    approvalPages, canReadArticles,
    canReadPackaging, canReadRoutes, canReadStructures, ruleCursors, ruleHistory, rulePageIndex, ruleQuery,
    selectedArticleId, selectedRouteArticleId, articles, articleCache, tab]);
  const loadPagedTabRef = useRef(loadPagedTab);
  useEffect(() => {
    loadPagedTabRef.current = loadPagedTab;
  }, [loadPagedTab]);

  useEffect(() => {
    activeActor.current = actorId;
    if (!initializedActor.current) {
      setPackagingArticleId(requestedPackagingArticleId());
    } else {
      setPackagingArticleId('');
    }
    setPackagingProfileId('');
    setAssignmentSearch('');
    setAssignmentQuery('');
    setAssignmentPage(0);
    setAssignmentCursors({ 0: null });
    setDialog(null);
    setNotice('');
    setRefreshFailure(null);
    setArticles([]);
    setArticleCache([]);
    setStructures([]);
    setRoutes([]);
    setCenters([]);
    setContainers([]);
    setProfiles([]);
    setRules([]);
    setArticlePage({ items: [], total: 0, has_more: false, next_cursor: null });
    setStructurePageError('');
    setRulePage({ items: [], total: 0, has_more: false, next_cursor: null });
    setApprovalPages({});
    setApprovalLoadedDomains({});
    setApprovalDenied({});
    setApprovalErrors({});
    setApprovalPage({});
    setApprovalCursors(initialApprovalCursors());
    setApprovalQuery('');
    setDataRevision((current) => current + 1);
    setArticleQuery('');
    setRuleQuery('');
    setSearch('');
    setSelectedArticleId('');
    setSelectedRouteArticleId('');
    if (initializedActor.current) setPackagingArticleId('');
    setPackagingProfileId('');
    setArticlePage({ items: [], total: 0, has_more: false, next_cursor: null });
    setRulePage({ items: [], total: 0, has_more: false, next_cursor: null });
    setApprovalPages({});
    setLoadedActorId(actorId);
    setLoading(false);
    initializedActor.current = true;
    return () => {
      activeActor.current = null;
      pagedAbort.current?.abort();
      hydrationAbort.current?.abort();
      ruleReadGeneration.current += 1;
      ruleReadAbort.current?.abort();
    };
  }, [actorId, capabilityFingerprint, readCapabilityFingerprint]);

  useEffect(() => {
    if (loadedActorId !== actorId) return undefined;
    if (refreshInFlightRef.current
      && (refreshInFlightRef.current.actorId !== actorId
        || refreshInFlightRef.current.tab !== tab)) {
      pagedAbort.current?.abort();
      refreshInFlightRef.current = null;
    }
    const pending = pendingRefreshRef.current;
    if (pending && pending.actorId !== actorId) {
      pendingRefreshRef.current = null;
    }
    if (pending && pending.actorId === actorId && pending.tab === tab) {
      pendingRefreshRef.current = null;
      refreshInFlightRef.current = pending;
      loadPagedTabRef.current(tab, pending.plan).then((result) => {
        if (refreshInFlightRef.current?.nonce !== pending.nonce) return;
        refreshInFlightRef.current = null;
        if (result === true && pending.plan.refreshAfterMutation) {
          setRefreshFailure(null);
        }
        if (result === false && activeActor.current === actorId) {
          if (!pending.plan.refreshAfterMutation) {
            setError('Cambio guardado; no se pudo actualizar esta sección.');
          }
        }
      });
      return () => {};
    }
    if (refreshInFlightRef.current?.actorId === actorId
      && refreshInFlightRef.current?.tab === tab) return undefined;
    loadPagedTabRef.current(tab);
    return () => pagedAbort.current?.abort();
  }, [actorId, articlePageIndex, articleQuery, approvalCursors, approvalPage,
    loadedActorId, ruleHistory, rulePageIndex, ruleQuery, selectedArticleId,
    selectedRouteArticleId, tab, refreshTick]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setAssignmentQuery(assignmentSearch.trim());
      setAssignmentPage(0);
      setAssignmentCursors({ 0: null });
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [assignmentSearch]);

  useEffect(() => {
    if (tab !== 0) return undefined;
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      setArticleQuery((current) => (current === '' ? current : ''));
      setArticlePageIndex(0);
      setArticleCursors({ 0: null });
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      setArticleQuery(normalizedSearch);
      setArticlePageIndex(0);
      setArticleCursors({ 0: null });
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [actorId, capabilityFingerprint, search, tab]);

  useEffect(() => {
    if (tab !== 3 || !canReadPackaging || !canReadArticles || loading || loadedActorId !== actorId) {
      setAssignmentState(null);
      return undefined;
    }
    let active = true;
    listarAsignacionesEmpaqueScm({
      q: assignmentQuery || undefined, limite: 25, cursor: assignmentCursor || undefined,
    }).then((payload) => {
      if (active) setAssignmentState({ key: assignmentKey, payload, error: '' });
    }).catch((requestError) => {
      if (active) setAssignmentState({
        key: assignmentKey,
        payload: { items: [], total: 0, has_more: false, next_cursor: null },
        error: mensajeErrorScm(requestError),
      });
    });
    return () => { active = false; };
  }, [actorId, assignmentCursor, assignmentKey, assignmentQuery, canReadArticles,
    canReadPackaging, loadedActorId, loading, tab]);

  useEffect(() => {
    if (tab !== 3 || !canReadPackaging || !canReadArticles || loading
      || loadedActorId !== actorId || !packagingArticleId) {
      setSelectedProfileState(null);
      return undefined;
    }
    let active = true;
    setPackagingProfileId('');
    obtenerPerfilesArticuloScm(Number(packagingArticleId)).then((payload) => {
      if (!active) return;
      const currentDefault = (payload.perfiles || []).find((item) => item.activo && item.es_predeterminado);
      setPackagingProfileId(currentDefault ? String(currentDefault.perfil_empacable_id) : '');
      setSelectedProfileState({ key: selectedProfileKey, error: '' });
    }).catch((requestError) => {
      if (active) setSelectedProfileState({ key: selectedProfileKey, error: mensajeErrorScm(requestError) });
    });
    return () => { active = false; };
  }, [actorId, canReadArticles, canReadPackaging, loadedActorId, loading,
    packagingArticleId, selectedProfileKey, tab]);

  const runMutation = async (operation, successMessage, mutationOptions = {}) => {
    const mutationDialog = dialog;
    setSaving(true);
    setError('');
    setNotice('');
    setRefreshFailure(null);
    try {
      await operation();
      setDialog(null);
      setNotice(successMessage);
      const pagedOptions = mutationOptions.approvalDomain
        ? { approvalDomains: [mutationOptions.approvalDomain] }
          : mutationOptions.refreshScope
            ? { skipArticles: true, ...mutationOptions.refreshScope }
            : mutationOptions.profileAssignment
            ? { skipArticles: true, skipRules: true, refreshAssignments: true, catalogs: ['profiles'] }
            : mutationDialog === 'profile'
          ? {
            skipArticles: true, refreshAssignments: true, catalogs: ['profiles'],
            ruleViews: [ruleHistory ? 'historial' : 'actual'], approvalDomains: ['EMPAQUE'],
          }
          : mutationDialog === 'container'
            ? {
              skipArticles: true, catalogs: ['containers'],
              ruleViews: [ruleHistory ? 'historial' : 'actual'], approvalDomains: ['EMPAQUE'],
            }
            : mutationDialog === 'rule'
              ? { skipArticles: true, skipCatalogs: true }
              : mutationDialog === 'assignment'
                ? { skipArticles: true, skipCatalogs: true, skipRules: true, refreshAssignments: true }
                : mutationDialog === 'center'
                  ? { skipArticles: true, skipRules: true, skipRoutes: true, catalogs: ['centers'] }
                  : {};
      pendingRefreshRef.current = {
        actorId,
        tab,
        plan: { ...pagedOptions, resetPagination: true, refreshAfterMutation: true },
        nonce: refreshNonceRef.current + 1,
      };
      refreshNonceRef.current += 1;
      setRefreshTick((current) => current + 1);
      if (tab === 0 || tab === 1 || tab === 2) {
        setArticlePageIndex(0);
        setArticleCursors({ 0: null });
      }
      if (tab === 3) {
        setRulePageIndex(0);
        setRuleCursors({ 0: null });
      }
      if (tab === 4) {
        setApprovalPage({});
        setApprovalCursors(initialApprovalCursors());
      }
      if (pagedOptions.approvalDomains) {
        setApprovalPage({});
        setApprovalCursors(initialApprovalCursors());
      }
      if (mutationOptions.profileAssignment && packagingArticleId) {
        try {
          const payload = await obtenerPerfilesArticuloScm(Number(packagingArticleId));
          const currentDefault = (payload.perfiles || []).find((item) => item.activo && item.es_predeterminado);
          setPackagingProfileId(currentDefault ? String(currentDefault.perfil_empacable_id) : '');
          setSelectedProfileState({ key: selectedProfileKey, error: '' });
        } catch (refreshError) {
          setSelectedProfileState({ key: selectedProfileKey, error: mensajeErrorScm(refreshError) });
          setError('Cambio guardado; no se pudo actualizar esta sección.');
        }
      }
    } catch (requestError) {
      setError(mensajeErrorScm(requestError));
    } finally {
      setSaving(false);
    }
  };

  const retryRefreshFailure = async () => {
    if (!refreshFailure || refreshFailure.actorId !== actorId) return;
    const result = await loadPagedTab(refreshFailure.tab, refreshFailure.plan);
    if (result === true) setRefreshFailure(null);
  };

  const runRouteMutation = (operation, successMessage, options) => runMutation(operation, successMessage, options);

  const structuresForSelection = structures.filter(
    (item) => item.articulo_resultado_id === Number(selectedArticleId),
  );
  const currentStructuresForSelection = structuresForSelection.filter(
    (item) => ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA'].includes(item.estado),
  );
  const historicalStructuresForSelection = structuresForSelection.filter(
    (item) => ['RECHAZADA', 'RETIRADA', 'DESCARTADA'].includes(item.estado),
  );
  const visibleStructuresForSelection = showStructureHistory
    ? [...currentStructuresForSelection, ...historicalStructuresForSelection]
    : currentStructuresForSelection;
  const hasOpenStructure = structuresForSelection.some(
    (item) => ['BORRADOR', 'PENDIENTE_APROBACION'].includes(item.estado),
  );
  const routesForSelection = routes;
  const newRouteDisabledReason = !selectedRouteArticleId
    ? 'Selecciona un artículo objetivo PiezaColor, WIP o producto terminado antes de crear una ruta.'
    : routesLoading
      ? 'Espera mientras se cargan las rutas del artículo seleccionado.'
    : activeCenters.length === 0
      ? 'Crea al menos un centro de trabajo activo antes de crear una ruta.'
      : '';

  const goToStructuresForArticle = (articleId) => {
    setSelectedArticleId(String(articleId || ''));
    setShowStructureHistory(false);
    setDialog(null);
    setTab(1);
  };

  const openBom = () => {
    setHydrationError('');
    setEditingBom(null);
    setBomForm(emptyStructureValue());
    setDialog('bom');
  };
  const hydrateEditorReferences = async ({ articleIds = [], revisionIds = [] } = {}) => {
    const resolve = resolverArticulosScm;
    const hydrate = hidratarEstructurasScm;
    const uniqueArticles = [...new Set(articleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const uniqueRevisions = [...new Set(revisionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    hydrationAbort.current?.abort();
    const controller = new AbortController();
    hydrationAbort.current = controller;
    setHydratingEditor(true);
    setHydrationError('');
    try {
      const chunk = (values, size = 100) => Array.from(
        { length: Math.ceil(values.length / size) },
        (_, index) => values.slice(index * size, index * size + size),
      ).filter((values) => values.length);
      let resolvedArticles = [];
      const missing = [];
      {
        const responses = [];
        for (const ids of chunk(uniqueArticles)) {
          // Sequential chunks keep concurrency bounded while preserving every
          // referenced identity when a draft has more than 100 IDs.
          responses.push(await resolve(actorId, ids, controller.signal));
        }
        const resolved = responses.flatMap((payload) => payload?.items || []);
        missing.push(...responses.flatMap((payload) => payload?.missing_ids || []));
        resolvedArticles = resolved;
        if (!controller.signal.aborted) {
          setArticleCache((current) => [...new Map([...current, ...resolved].map((item) => [Number(item.id), item])).values()]);
        }
      }
      if (uniqueArticles.length || uniqueRevisions.length) {
        const combined = [...uniqueArticles.map((id) => ({ kind: 'article', id })), ...uniqueRevisions.map((id) => ({ kind: 'revision', id }))];
        const responses = [];
        for (const entries of chunk(combined)) {
          responses.push(await hydrate(actorId, {
            articuloIds: entries.filter((entry) => entry.kind === 'article').map((entry) => entry.id),
            revisionIds: entries.filter((entry) => entry.kind === 'revision').map((entry) => entry.id),
          }, controller.signal));
        }
        missing.push(...responses.flatMap((payload) => [
          ...(payload?.missing_article_ids || []), ...(payload?.missing_revision_ids || []),
        ]));
        if (missing.length) {
          setHydrationError(`Dependencia sin resolver: ${[...new Set(missing)].join(', ')}.`);
          return false;
        }
        const structuresFromHydration = responses.flatMap((payload) => [
          ...(payload?.approved || []), ...(payload?.referenced || []),
        ]);
        if (!controller.signal.aborted && structuresFromHydration.length) {
          setStructures((current) => [...new Map([...current, ...structuresFromHydration].map((item) => [Number(item.id), item])).values()]);
        }
      }
      if (missing.length) {
        setHydrationError(`Dependencia sin resolver: ${[...new Set(missing)].join(', ')}.`);
        return false;
      }
      return controller.signal.aborted ? false : { articles: resolvedArticles };
    } catch (requestError) {
      if (controller.signal.aborted) return false;
      setHydrationError(mensajeErrorScm(requestError, 'No se pudieron resolver las referencias del borrador.'));
      return false;
    } finally {
      if (hydrationAbort.current === controller) {
        hydrationAbort.current = null;
        setHydratingEditor(false);
      }
    }
  };
  const editBom = async (revision) => {
    setHydrationError('');
    setEditingBom(revision);
    setDialog('bom');
    const componentIds = (revision.componentes || []).map((line) => line.articulo_id);
    const ready = await hydrateEditorReferences({
      articleIds: [revision.articulo_resultado_id, ...componentIds],
      revisionIds: revision.estructura_revision_id ? [revision.estructura_revision_id] : [],
    });
    if (ready !== false) setBomForm(normalizeStructureRevision(revision));
  };
  const changeBom = (nextValue) => {
    setBomForm(nextValue);
    const referencedWips = (nextValue.componentes || [])
      .map((line) => structureComponentArticles.find((article) => Number(article.id) === Number(line.articulo_id)))
      .filter((article) => article?.clase === 'SUBENSAMBLE_WIP')
      .map((article) => Number(article.id))
      .filter((id) => !structures.some((item) => Number(item.articulo_resultado_id) === id && item.estado === 'APROBADA'));
    if (referencedWips.length) hydrateEditorReferences({ articleIds: referencedWips });
  };
  const openRoute = () => {
    setHydrationError('');
    setEditingRoute(null);
    setRouteForm(emptyRouteValue(routeTargetArticle));
    setDialog('route');
  };
  const editRoute = async (revision) => {
    setHydrationError('');
    setEditingRoute(revision);
    setDialog('route');
    const routeArticleIds = (revision.operaciones || []).map((operation) => operation.articulo_salida_id);
    const structureRevisionIds = (revision.operaciones || [])
      .map((operation) => operation.estructura_revision_id)
      .filter(Boolean);
    const ready = await hydrateEditorReferences({
      articleIds: [routeTargetArticle?.id, ...routeArticleIds],
      revisionIds: structureRevisionIds,
    });
    if (ready !== false) {
      const hydratedArticles = [...new Map([...articles, ...(ready.articles || [])].map((item) => [Number(item.id), item])).values()];
      setRouteForm(normalizeRouteRevision(revision, routeTargetArticle, hydratedArticles));
    }
  };
  const editRule = async (rule) => {
    setHydrationError('');
    setEditingRule(rule);
    setDialog('rule');
    ruleReadAbort.current?.abort();
    const generation = ruleReadGeneration.current + 1;
    ruleReadGeneration.current = generation;
    let detail = rule;
    const readDetail = obtenerReglaEmpaqueScm;
    if (rule.revision_id) {
      const controller = new AbortController();
      ruleReadAbort.current = controller;
      setRuleForm(emptyPackagingRuleValue());
      setHydratingEditor(true);
      try {
        detail = await readDetail(rule.revision_id, actorId, controller.signal);
        if (controller.signal.aborted || activeActor.current !== actorId
          || ruleReadGeneration.current !== generation) return;
      } catch (requestError) {
        if (controller.signal.aborted || activeActor.current !== actorId
          || ruleReadGeneration.current !== generation) return;
        setHydrationError(mensajeErrorScm(requestError, 'No se pudo cargar el detalle de la regla.'));
        return;
      } finally {
        if (ruleReadGeneration.current === generation) setHydratingEditor(false);
        if (ruleReadAbort.current === controller) ruleReadAbort.current = null;
      }
    }
    setEditingRule(detail);
    setRuleForm({
      perfil_empacable_id: String(detail.perfil_empacable_id ?? detail.perfil?.id ?? ''),
      tipo_contenedor_id: String(detail.tipo_contenedor_id ?? detail.contenedor?.id ?? ''),
      medicion_fisica_probada: detail.medicion_fisica_probada,
      cantidad_objetivo_un: String(detail.cantidad_objetivo_un ?? ''),
      cantidad_maxima_probada_un: String(detail.cantidad_maxima_probada_un ?? ''),
      peso_neto_operativo_max_kg: String(detail.peso_neto_operativo_max_kg ?? ''),
      margen_seguridad_kg: String(detail.margen_seguridad_kg ?? 0),
      tolerancia_peso_abs_g: String(detail.tolerancia_peso_abs_g ?? 0),
      tolerancia_peso_pct: String(detail.tolerancia_peso_pct ?? 0),
      notas: detail.notas || '',
    });
  };

  const saveBom = (payload = buildStructurePayload(bomForm)) => {
    return runMutation(
      () => editingBom
        ? actualizarEstructuraScm(
          editingBom.id,
          { ...payload, version: editingBom.version },
        )
        : crearEstructuraScm(Number(selectedArticleId), payload),
      editingBom
        ? 'Borrador de estructura actualizado.'
        : 'Borrador de estructura creado.',
    );
  };

  const confirmStructureResolution = () => {
    const { action, revision, motivo } = structureResolution;
    if (action === 'reject') {
      return runMutation(
        () => rechazarEstructuraScm(revision, motivo.trim()),
        'Estructura rechazada.',
      );
    }
    if (action === 'discard') {
      return runMutation(
        () => descartarEstructuraScm(revision, motivo.trim()),
        'Borrador de estructura descartado.',
      );
    }
    if (action === 'retire') {
      return runMutation(
        () => retirarEstructuraScm(revision),
        'Estructura retirada. Para reutilizarla, crea una nueva revisión basada en ella.',
      );
    }
    if (action === 'publish') {
      return runMutation(
        () => publicarEstructuraScm(revision),
        'Estructura publicada directamente por jefatura.',
      );
    }
    if (action === 'clone') {
      return runMutation(
        () => crearEstructuraScm(revision.articulo_resultado_id, {
          notas: `Basada en revisión ${revision.numero_revision}${revision.notas ? ` · ${revision.notas}` : ''}`,
          componentes: revision.componentes.map((line, index) => ({
            secuencia: index + 1,
            articulo_id: Number(line.articulo_id),
            cantidad: Number(line.cantidad),
            unidad: 'UN',
            merma_tecnica_pct: Number(line.merma_tecnica_pct || 0),
          })),
        }),
        'Nueva revisión creada como borrador a partir del historial.',
      );
    }
    return undefined;
  };

  const saveRoute = (payload = buildRoutePayload(routeForm, routeTargetArticle, articles)) => {
    return runRouteMutation(
      () => editingRoute
        ? actualizarRutaScm(
          editingRoute.id,
          { ...payload, version: editingRoute.version },
        )
        : crearRutaArticuloScm(Number(selectedRouteArticleId), payload),
      editingRoute ? 'Borrador de ruta actualizado.' : 'Borrador de ruta creado.',
    );
  };


  const approvalButton = (
    revision,
    approve,
    successMessage,
    allowed,
    mutationRunner = runMutation,
  ) => {
    if (!allowed) return null;
    const isCreator = Number(actorId) === Number(revision.creada_por_id);
    const actorLabel = actor?.nombre_completo || `actor #${actorId}`;
    const explanation = isCreator
      ? `${actorLabel} creó esta revisión y no puede aprobarla. Cambia al perfil aprobador.`
      : `Aprobar como ${actorLabel}.`;

    return (
      <Tooltip title={explanation}>
        <span>
          <Button
            size="small"
            variant="contained"
            disabled={isCreator || saving}
            onClick={() => mutationRunner(approve, successMessage)}
          >
            {isCreator ? 'Requiere otro actor' : 'Aprobar'}
          </Button>
        </span>
      </Tooltip>
    );
  };

  const routeApprovalAction = (revision) => {
    if (canPublishRoutesDirectly) {
      return (
        <Button
          size="small"
          variant="contained"
          disabled={saving}
          onClick={() => runRouteMutation(
            () => publicarRutaScm(revision),
            'Ruta publicada directamente por jefatura.',
            { approvalDomain: 'RUTA' },
          )}
        >
          Publicar (queda aprobada)
        </Button>
      );
    }
    return approvalButton(
      revision,
      () => aprobarRutaScm(revision),
      'Ruta aprobada.',
      canApproveRoutes,
      runRouteMutation,
    );
  };

  const structureApprovalActions = (revision) => {
    if (!canApproveStructures) return null;
    const isCreator = Number(actorId) === Number(revision.creada_por_id);
    const actorLabel = actor?.nombre_completo || `actor #${actorId}`;
    if (isCreator) {
      return (
        <Tooltip title={`${actorLabel} creó esta revisión y no puede revisarla. Cambia al perfil aprobador.`}>
          <span>
            <Button size="small" variant="contained" disabled>
              Requiere otro actor
            </Button>
          </span>
        </Tooltip>
      );
    }
    return (
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="contained"
          disabled={saving}
          onClick={() => runMutation(
            () => aprobarEstructuraScm(revision),
            'Estructura aprobada.',
            { approvalDomain: 'ESTRUCTURA' },
          )}
        >
          Aprobar
        </Button>
        <Button
          size="small"
          color="error"
          variant="outlined"
          disabled={saving}
          onClick={() => {
            setStructureResolution({ action: 'reject', revision, motivo: '' });
            setDialog('structureResolution');
          }}
        >
          Rechazar
        </Button>
      </Stack>
    );
  };

  const runApprovalPanelAction = (domain, action, revision) => {
    if (domain === 'ESTRUCTURA') {
      if (action === 'submit') {
        return runMutation(
          () => enviarEstructuraScm(revision),
          'Estructura enviada a aprobación.',
          { approvalDomain: 'ESTRUCTURA' },
        );
      }
      if (action === 'approve') {
        return runMutation(
          () => aprobarEstructuraScm(revision),
          'Estructura aprobada.',
          { approvalDomain: 'ESTRUCTURA' },
        );
      }
      if (action === 'reject') {
        setStructureResolution({ action: 'reject', revision, motivo: '' });
        setDialog('structureResolution');
        return undefined;
      }
      if (action === 'publish') {
        setStructureResolution({ action: 'publish', revision, motivo: '' });
        setDialog('structureResolution');
        return undefined;
      }
    }
    if (domain === 'RUTA') {
      if (action === 'approve') {
        return runMutation(() => aprobarRutaScm(revision), 'Ruta aprobada.', { approvalDomain: 'RUTA' });
      }
      if (action === 'publish') {
        return runRouteMutation(
          () => publicarRutaScm(revision),
          'Ruta publicada directamente por jefatura.',
          { approvalDomain: 'RUTA' },
        );
      }
    }
    if (domain === 'EMPAQUE') {
      if (action === 'approve') {
        return runMutation(
          () => aprobarReglaEmpaqueScm(revision),
          'Regla de empaque aprobada.',
          { approvalDomain: 'EMPAQUE' },
        );
      }
      if (action === 'publish') {
        return runMutation(
          () => publicarReglaEmpaqueScm(revision),
          'Regla de empaque publicada directamente por jefatura.',
          { approvalDomain: 'EMPAQUE' },
        );
      }
    }
    return undefined;
  };

  const tabs = ['Artículos', 'Estructuras BOM', 'Rutas', 'Empaque', 'Aprobaciones'];
  const refreshEngineering = () => {
    return loadPagedTab(tab, tab === 3 ? { refreshAssignments: true } : {});
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Ingeniería SCM"
        description="Artículos, estructuras multinivel, rutas y reglas físicas de empaque conectadas a la API R-core."
        actions={(
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton aria-label="Recargar ingeniería SCM" onClick={refreshEngineering}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        )}
      />

      <Alert severity="info">
        Estás trabajando como {actor?.nombre_completo || `actor #${actorId}`}.{' '}
        {canPublishStructuresDirectly || canPublishRoutesDirectly
          || canPublishPackagingDirectly
          ? 'Tu perfil puede publicar directamente sus borradores de estructuras, rutas y reglas de empaque.'
          : 'Las aprobaciones exigen segregación entre quien crea la revisión y quien la aprueba.'}
      </Alert>
      {isReadOnly && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. Puedes revisar artículos, estructuras,
          rutas y empaque sin modificar sus revisiones.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {refreshFailure && refreshFailure.actorId === actorId && (tab === 0 || tab === 1 || tab === 2) && (
        <Alert
          severity="warning"
          action={<Button onClick={retryRefreshFailure}>Reintentar sección</Button>}
        >
          {refreshFailure.message}
        </Alert>
      )}

      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setSearch('');
            setArticleQuery('');
            setArticlePageIndex(0);
            setArticleCursors({ 0: null });
            setTab(value);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Maestros de ingeniería SCM"
        >
          {tabs.map((label, index) => (
            <Tab
              key={label}
              label={index === 4 && approvalCountKnown
                ? `${label} (${(approvalPages.ESTRUCTURA?.total ?? 0)
                  + (approvalPages.RUTA?.total ?? 0)
                  + (approvalPages.EMPAQUE?.total ?? 0)})`
                : label}
            />
          ))}
        </Tabs>
      </Paper>

      {loading || loadedActorId !== actorId ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : (
        <>
          {tab === 0 && !canReadArticles && (
            <Alert severity="info">Sin permiso para consultar artículos.</Alert>
          )}
          {tab === 0 && canReadArticles && (
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                sx={{ p: 2 }}
              >
                <TextField
                  label="Buscar por código, nombre o clase"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 420 } }}
                />
                {canAdminArticles && <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingWip(null);
                    setWipForm(emptyWip);
                    setDialog('wip');
                  }}
                >
                  Nuevo WIP
                </Button>}
              </Stack>
              <Divider />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Clase</TableCell>
                      <TableCell>Unidad</TableCell>
                      <TableCell>Definición</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredArticles.map((article) => (
                      <TableRow key={article.id} hover>
                        <TableCell sx={{ fontWeight: 750 }}>{article.codigo}</TableCell>
                        <TableCell>{article.nombre}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ARTICLE_CLASS[article.clase]} variant="outlined" />
                        </TableCell>
                        <TableCell>{article.unidad_base}</TableCell>
                        <TableCell>
                          {article.clase === 'SUBENSAMBLE_WIP'
                            ? article.wip?.descripcion || 'Sin descripción'
                            : article.subtipo?.pieza_color_sku
                              || article.subtipo?.producto_terminado_id}
                        </TableCell>
                        <TableCell align="right">
                          {canAdminArticles && article.clase === 'SUBENSAMBLE_WIP' && (
                            <>
                              <IconButton
                                size="small"
                                aria-label={`Editar WIP ${article.nombre}`}
                                onClick={() => {
                                  setEditingWip(article);
                                  setWipForm({
                                    nombre: article.nombre,
                                    descripcion: article.wip?.descripcion || '',
                                    requiere_calidad: Boolean(
                                      article.wip?.requiere_calidad,
                                    ),
                                  });
                                  setDialog('wip');
                                }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color={article.activo ? 'default' : 'success'}
                                aria-label={`${article.activo ? 'Inactivar' : 'Reactivar'} WIP ${article.nombre}`}
                                onClick={() => runMutation(
                                  () => actualizarArticuloWipScm(article.id, {
                                    version: article.version,
                                    activo: !article.activo,
                                  }),
                                  `Artículo WIP ${article.activo ? 'inactivado' : 'reactivado'}.`,
                                )}
                              >
                                <PowerSettingsNewOutlinedIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {articlePageLoading && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={24} aria-label="Cargando artículos" />
                        </TableCell>
                      </TableRow>
                    )}
                    {!articlePageLoading && !articlePageError && filteredArticles.length === 0 && (
                      <EmptyRow columns={6} />
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {articlePageError && (
                <Alert severity="error" action={<Button onClick={() => loadPagedTab(0)}>Reintentar sección</Button>}>
                  {articlePageError}
                </Alert>
              )}
              <TablePagination
                component="div"
                count={articlePage.total ?? 0}
                page={articlePageIndex}
                rowsPerPage={25}
                rowsPerPageOptions={[25]}
                onPageChange={(_, nextPage) => {
                  setArticlePageIndex(nextPage);
                  setArticleCursors((current) => ({
                    ...current,
                    [nextPage]: current[nextPage]
                      ?? (nextPage === articlePageIndex + 1 ? articlePage.next_cursor : null),
                  }));
                }}
                onRowsPerPageChange={() => {}}
              />
            </Paper>
          )}

          {tab === 1 && !canReadStructures && (
            <Alert severity="info">Sin permiso para consultar estructuras BOM.</Alert>
          )}
          {tab === 1 && canReadStructures && !canReadArticles && (
            <Alert severity="info">No se puede consultar BOM sin permiso para consultar artículos.</Alert>
          )}
          {tab === 1 && canReadStructures && canReadArticles && (
            <Stack spacing={2}>
              {structurePageError && (
                <Alert severity="error" action={<Button onClick={() => loadPagedTab(1)}>Reintentar BOM</Button>}>
                  {structurePageError}
                </Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <ScmArticleAutocomplete
                    label="Artículo resultado"
                    articles={structureResultArticles}
                    value={selectedArticleId}
                    resetKey={articleSearchScope}
                    remote
                    searchLoading={articlePageLoading}
                    onSearch={(value) => {
                      setArticleQuery(value.trim());
                      setArticlePageIndex(0);
                      setArticleCursors({ 0: null });
                    }}
                    placeholder="Buscar WIP o producto terminado"
                    onChange={(articleId) => {
                      setSelectedArticleId(articleId);
                      setShowStructureHistory(false);
                    }}
                  />
                  {canAdminStructures && <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={!selectedArticleId}
                    onClick={openBom}
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Nueva revisión
                  </Button>}
                </Stack>
              </Paper>
              {!selectedArticleId && (
                <Alert severity="info">
                  Selecciona explícitamente el artículo que producirá esta estructura.
                </Alert>
              )}
              {selectedArticleId && historicalStructuresForSelection.length > 0 && (
                <Box>
                  <Button
                    size="small"
                    onClick={() => setShowStructureHistory((current) => !current)}
                  >
                    {showStructureHistory
                      ? 'Ocultar historial'
                      : `Mostrar historial (${historicalStructuresForSelection.length})`}
                  </Button>
                </Box>
              )}
              {visibleStructuresForSelection.map((revision) => (
                <Paper key={revision.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="h6">
                        Revisión {revision.numero_revision} · {revision.articulo_resultado?.nombre}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {revision.notas || 'Sin notas'} · creador #{revision.creada_por_id}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {statusChip(revision.estado)}
                      {canAdminStructures && revision.estado === 'BORRADOR' && (
                        <>
                          <Button size="small" onClick={() => editBom(revision)}>
                            Editar
                          </Button>
                          {canPublishStructuresDirectly ? (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                setStructureResolution({
                                  action: 'publish',
                                  revision,
                                  motivo: '',
                                });
                                setDialog('structureResolution');
                              }}
                            >
                              Publicar (queda aprobada)
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              onClick={() => runMutation(
                                () => enviarEstructuraScm(revision),
                                'Estructura enviada a aprobación.',
                              )}
                            >
                              Enviar a aprobación
                            </Button>
                          )}
                          {Number(actorId) === Number(revision.creada_por_id) && (
                            <Button
                              size="small"
                              color="warning"
                              onClick={() => {
                                setStructureResolution({
                                  action: 'discard',
                                  revision,
                                  motivo: '',
                                });
                                setDialog('structureResolution');
                              }}
                            >
                              Descartar
                            </Button>
                          )}
                        </>
                      )}
                      {revision.estado === 'PENDIENTE_APROBACION' && (
                        structureApprovalActions(revision)
                      )}
                      {canAdminStructures && revision.estado === 'APROBADA' && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => {
                            setStructureResolution({ action: 'retire', revision, motivo: '' });
                            setDialog('structureResolution');
                          }}
                        >
                          Retirar
                        </Button>
                      )}
                      {canAdminStructures
                        && ['RECHAZADA', 'RETIRADA', 'DESCARTADA'].includes(revision.estado)
                        && (
                          <Button
                            size="small"
                            disabled={hasOpenStructure}
                            onClick={() => {
                              setStructureResolution({ action: 'clone', revision, motivo: '' });
                              setDialog('structureResolution');
                            }}
                          >
                            Crear nueva basada en esta
                          </Button>
                        )}
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                    {revision.componentes.map((line, lineIndex) => (
                      <Chip
                        key={`${line.id ?? line.articulo_id ?? 'component'}-${lineIndex}`}
                        label={`${line.articulo?.codigo} · ${line.articulo?.nombre} × ${compactDecimal(line.cantidad)} UN`}
                      />
                    ))}
                  </Stack>
                  {revision.motivo_rechazo && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      Motivo de rechazo: {revision.motivo_rechazo}
                    </Alert>
                  )}
                  {revision.motivo_descarte && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                      Motivo de descarte: {revision.motivo_descarte}
                    </Alert>
                  )}
                  {revision.estado === 'RETIRADA' && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      Esta revisión no puede reactivarse. Puedes crear una nueva basada en ella.
                    </Alert>
                  )}
                </Paper>
              ))}
              {selectedArticleId && currentStructuresForSelection.length === 0 && (
                <Alert
                  severity="warning"
                  action={canAdminStructures ? (
                    <Button color="inherit" size="small" onClick={openBom}>
                      Crear primera revisión
                    </Button>
                  ) : undefined}
                >
                  {selectedArticle?.nombre || 'El artículo'} no tiene una estructura vigente o en preparación.
                  {historicalStructuresForSelection.length > 0
                    ? ' Consulta el historial para reutilizar una composición anterior.'
                    : ' Crea su primera revisión.'}
                </Alert>
              )}
            </Stack>
          )}

          {tab === 2 && !canReadRoutes && (
            <Alert severity="info">Sin permiso para consultar rutas.</Alert>
          )}
          {tab === 2 && canReadRoutes && !canReadArticles && (
            <Alert severity="info">No se puede consultar rutas sin permiso para consultar artículos.</Alert>
          )}
          {tab === 2 && canReadRoutes && canReadArticles && (
            <Stack spacing={2}>
              {planningContext.orderCode && planningContext.missingArticleCode && (
                <Alert
                  severity="warning"
                  action={planningContext.returnTo ? (
                    <Button
                      component="a"
                      href={planningContext.returnTo}
                      color="inherit"
                      size="small"
                    >
                      Volver a {planningContext.orderCode}
                    </Button>
                  ) : undefined}
                >
                  La planificación de {planningContext.orderCode} requiere una operación cuya
                  salida sea {planningContext.missingArticleCode}. Revisa la ruta del artículo
                  seleccionado, publica únicamente la definición técnica correcta y vuelve a
                  recalcular el plan.
                </Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
                  <ScmArticleAutocomplete
                    label="Artículo objetivo"
                    articles={routeTargetArticles}
                    value={selectedRouteArticleId}
                    resetKey={articleSearchScope}
                    remote
                    searchLoading={articlePageLoading}
                    onSearch={(value) => {
                      setArticleQuery(value.trim());
                      setArticlePageIndex(0);
                      setArticleCursors({ 0: null });
                    }}
                    onChange={setSelectedRouteArticleId}
                  />
                  {routeTargetArticle && (
                    <Chip
                      variant="outlined"
                      color={routeTargetArticle.clase === 'SUBENSAMBLE_WIP' ? 'info' : 'default'}
                      label={`${ARTICLE_CLASS[routeTargetArticle.clase]} · ${routeTargetArticle.codigo}`}
                      sx={{ alignSelf: { xs: 'flex-start', lg: 'center' }, flexShrink: 0 }}
                    />
                  )}
                  {canAdminRoutes && (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      sx={{ flexShrink: 0 }}
                    >
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setEditingCenter(null);
                          setCenterForm(emptyCenter);
                          setDialog('center');
                        }}
                        sx={{ whiteSpace: 'nowrap', flex: { sm: 1, lg: 'initial' } }}
                      >
                        Nuevo centro de trabajo
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        disabled={Boolean(newRouteDisabledReason)}
                        onClick={openRoute}
                        sx={{ whiteSpace: 'nowrap', flex: { sm: 1, lg: 'initial' } }}
                      >
                        Nueva ruta
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
              {canAdminRoutes && newRouteDisabledReason && (
                <Alert severity="info">{newRouteDisabledReason}</Alert>
              )}
              {routesError && (
                <Alert
                  severity="error"
                  action={selectedRouteArticleId ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => loadPagedTab(2)}
                    >
                      Reintentar
                    </Button>
                  ) : undefined}
                >
                  {routesError}
                </Alert>
              )}
              {routesLoading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Cargando rutas de {routeTargetArticle?.codigo || 'artículo seleccionado'}…
                  </Typography>
                </Stack>
              )}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {centers.map((center) => (
                  <Chip
                    key={center.id}
                    label={`${center.codigo} · ${center.nombre} (${OPERATION_TYPE_LABEL[center.tipo] || center.tipo})`}
                    variant="outlined"
                    color={center.activo ? 'default' : 'warning'}
                    onClick={canAdminRoutes ? () => {
                      setEditingCenter(center);
                      setCenterForm({
                        nombre: center.nombre,
                        tipo: center.tipo,
                      });
                      setDialog('center');
                    } : undefined}
                    onDelete={canAdminRoutes ? () => runMutation(
                      () => actualizarCentroTrabajoScm(center.id, {
                        version: center.version,
                        activo: !center.activo,
                      }),
                      `Centro ${center.activo ? 'inactivado' : 'reactivado'}.`,
                    ) : undefined}
                    deleteIcon={<PowerSettingsNewOutlinedIcon />}
                  />
                ))}
              </Stack>
              {routesForSelection.map((revision) => (
                <Paper key={revision.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">
                        Ruta {ARTICLE_CLASS[revision.articulo_objetivo?.clase] || 'de artículo'}
                        {' · '}{revision.articulo_objetivo?.codigo || routeTargetArticle?.codigo}
                        {' · '}revisión {revision.numero_revision}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {revision.notas || 'Sin notas'} · creador #{revision.creada_por_id}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {statusChip(revision.estado)}
                      {revision.estado === 'BORRADOR' && (
                        <>
                          {canAdminRoutes && <Button size="small" onClick={() => editRoute(revision)}>
                            Editar
                          </Button>}
                          {routeApprovalAction(revision)}
                        </>
                      )}
                      {canAdminRoutes && revision.estado === 'APROBADA' && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => runRouteMutation(
                            () => retirarRutaScm(revision),
                            'Ruta retirada.',
                          )}
                        >
                          Retirar
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                  <Table size="small" sx={{ mt: 1.5 }} aria-label={`Pasos de ruta revisión ${revision.numero_revision}`}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Paso</TableCell>
                        <TableCell>Transformación</TableCell>
                        <TableCell>Centro</TableCell>
                        <TableCell>Forma de ejecución</TableCell>
                        <TableCell>Salida</TableCell>
                        <TableCell>Precedencia</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {revision.operaciones.map((operation, operationIndex) => {
                        const incoming = revision.precedencias.find(
                          (edge) => Number(edge.siguiente_id ?? edge.operacion_siguiente_id)
                            === Number(operation.id),
                        );
                        const previousIndex = incoming
                          ? revision.operaciones.findIndex(
                            (candidate) => Number(candidate.id)
                              === Number(incoming.anterior_id ?? incoming.operacion_anterior_id),
                          )
                          : -1;
                        const isTerminal = !revision.precedencias.some(
                          (edge) => Number(edge.anterior_id ?? edge.operacion_anterior_id)
                            === Number(operation.id),
                        );
                        return (
                          <TableRow key={operation.id}>
                            <TableCell>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <strong>Paso {operationIndex + 1}</strong>
                                {isTerminal && <Chip size="small" color="primary" label="Terminal" />}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {OPERATION_TYPE_LABEL[operation.tipo] || operation.tipo}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {operation.nombre}
                              </Typography>
                              {operation.permite_concurrente && (
                                <Chip size="small" color="info" label="Concurrente" sx={{ ml: 1 }} />
                              )}
                            </TableCell>
                            <TableCell>{operation.centro_trabajo?.nombre || 'Sin centro'}</TableCell>
                            <TableCell>{EXECUTOR_LABEL[operation.executor_kind] || operation.executor_kind}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={isTerminal ? 600 : 400}>
                                {operation.articulo_salida?.codigo || operation.articulo_salida?.nombre}
                              </Typography>
                              {operation.articulo_salida?.codigo && operation.articulo_salida?.nombre && (
                                <Typography variant="caption" color="text.secondary">
                                  {operation.articulo_salida.nombre}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {previousIndex >= 0
                                ? `Después del Paso ${previousIndex + 1}`
                                : 'Inicio de ruta'}
                              {!isTerminal && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  Continúa al Paso {operationIndex + 2}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              ))}
              {selectedRouteArticleId && !routesLoading && !routesError
                && routesForSelection.length === 0 && (
                <Alert severity="warning">
                  El artículo objetivo todavía no tiene una ruta revisionada.
                </Alert>
              )}
            </Stack>
          )}

          {tab === 3 && !canReadPackaging && (
            <Alert severity="info">Sin permiso para consultar empaque.</Alert>
          )}
          {tab === 3 && canReadPackaging && (
            <Stack spacing={2}>
              {refreshFailure?.tab === 3 && refreshFailure.actorId === actorId && (
                <Alert
                  severity="warning"
                  action={<Button onClick={retryRefreshFailure}>Reintentar actualización</Button>}
                >
                  {refreshFailure.message}
                </Alert>
              )}
              {articleProfilesError && <Alert severity="error">{articleProfilesError}</Alert>}
              {packagingArticle && (
                <Alert severity="info">
                  Configurando empaque para {packagingArticle.codigo} · {packagingArticle.nombre}.
                  El perfil puede compartirse con otro artículo que conserve la misma estructura
                  física, pero un supervisor debe validar físicamente el acomodo, la capacidad,
                  la tara y los límites de peso antes de publicar la regla.
                </Alert>
              )}
              {canAdminPackaging && canReadArticles && <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Perfil predeterminado por artículo</Typography>
                <Typography variant="caption" color="text.secondary">
                  Define la regla física que usará el plan de mangas para cada salida.
                </Typography>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ mt: 2 }}
                >
                  <ScmArticleAutocomplete
                    label="Artículo empacable"
                    articles={packagingArticles}
                    value={packagingArticleId}
                    resetKey={articleSearchScope}
                    remote
                    searchLoading={articlePageLoading}
                    onSearch={(value) => {
                      setArticleQuery(value.trim());
                      setArticlePageIndex(0);
                      setArticleCursors({ 0: null });
                    }}
                    onChange={(articleId) => {
                      setPackagingArticleId(articleId);
                      setPackagingProfileId('');
                    }}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Perfil predeterminado</InputLabel>
                    <Select
                      label="Perfil predeterminado"
                      disabled={selectedProfileLoading}
                      value={packagingProfileId}
                      onChange={(event) => setPackagingProfileId(event.target.value)}
                    >
                      {profiles.filter((profile) => profile.activo).map((profile) => (
                        <MenuItem key={profile.id} value={String(profile.id)}>
                          {profile.codigo} · {profile.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    disabled={!packagingArticleId || !packagingProfileId || selectedProfileLoading || saving}
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => {
                      const article = packagingArticles.find(
                        (item) => item.id === Number(packagingArticleId),
                      );
                      runMutation(
                        () => asignarPerfilesArticuloScm(article, [{
                          perfil_empacable_id: Number(packagingProfileId),
                          es_predeterminado: true,
                          activo: true,
                        }]),
                        'Perfil predeterminado asignado al artículo.',
                        { profileAssignment: true },
                      );
                    }}
                  >
                    Asignar perfil
                  </Button>
                </Stack>
              </Paper>}
              {canReadArticles ? <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Asignaciones actuales</Typography>
                <Typography variant="caption" color="text.secondary">
                  Evidencia del perfil predeterminado que utilizará el plan de mangas.
                </Typography>
                <TextField
                  label="Buscar asignaciones de empaque"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                  size="small" fullWidth sx={{ mt: 2 }}
                  inputProps={{ maxLength: 200 }}
                />
                {assignmentLoading ? <CircularProgress size={24} sx={{ m: 2 }} /> : (
                  <>
                    <TableContainer sx={{ mt: 1.5 }}>
                      <Table size="small" aria-label="Asignaciones actuales de perfiles empacables">
                        <TableHead><TableRow>
                          <TableCell>Artículo</TableCell><TableCell>Clase</TableCell>
                          <TableCell>Perfil predeterminado</TableCell><TableCell>Estado</TableCell>
                          {canAdminPackaging && <TableCell align="right">Acción</TableCell>}
                        </TableRow></TableHead>
                        <TableBody>
                          {assignmentPayload.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell><Typography fontWeight={700}>{item.articulo.codigo}</Typography><Typography variant="caption">{item.articulo.nombre}</Typography></TableCell>
                              <TableCell><Chip size="small" label={ARTICLE_CLASS[item.articulo.clase] || item.articulo.clase} variant="outlined" /></TableCell>
                              <TableCell><Typography fontWeight={700}>{item.perfil.codigo} · {item.perfil.nombre}</Typography><Typography variant="caption">{item.perfil.descripcion_fisica || 'Sin descripción física'}</Typography></TableCell>
                              <TableCell><Chip size="small" color="success" label="Predeterminado" /></TableCell>
                              {canAdminPackaging && <TableCell align="right"><Button size="small" onClick={() => {
                                setPackagingArticleId(String(item.articulo.id));
                                setPackagingProfileId(String(item.perfil.id));
                              }}>Cambiar</Button></TableCell>}
                            </TableRow>
                          ))}
                          {assignmentPayload.items.length === 0 && <EmptyRow columns={canAdminPackaging ? 5 : 4} />}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <TablePagination
                      component="div" count={assignmentPayload.total} rowsPerPage={25}
                      rowsPerPageOptions={[25]} page={assignmentPage}
                      labelRowsPerPage="Filas por página"
                      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                      getItemAriaLabel={(type) => type === 'next' ? 'Siguiente página de asignaciones' : 'Anterior página de asignaciones'}
                      slotProps={{ actions: { nextButton: { disabled: !assignmentPayload.has_more }, previousButton: { disabled: assignmentPage === 0 } } }}
                      onPageChange={(_, nextPage) => {
                        if (nextPage > assignmentPage) {
                          setAssignmentCursors((current) => ({ ...current, [nextPage]: assignmentPayload.next_cursor }));
                        }
                        setAssignmentPage(nextPage);
                      }}
                    />
                  </>
                )}
              </Paper> : (
                <Alert severity="info">Sin permiso para consultar asignaciones por artículo.</Alert>
              )}
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">Tipos de contenedor</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tara y límites físicos de mangas, bolsas, jabas o cajas.
                      </Typography>
                    </Box>
                    {canAdminPackaging && <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setEditingContainer(null);
                        setContainerForm(emptyContainer);
                        setDialog('container');
                      }}
                    >
                      Nuevo
                    </Button>}
                  </Stack>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {containers.map((container) => (
                      <Paper key={container.id} variant="outlined" sx={{ p: 1.25 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>
                              {container.codigo} · {container.nombre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {container.clase} · tara {container.tara_nominal_g} g · bruto máx. {container.peso_bruto_max_kg} kg
                            </Typography>
                          </Box>
                          {canAdminPackaging && <Stack direction="row">
                            <IconButton
                              size="small"
                              aria-label={`Editar contenedor ${container.nombre}`}
                              onClick={() => {
                                setEditingContainer(container);
                                setContainerForm({
                                  clase: container.clase,
                                  nombre: container.nombre,
                                  material: container.material || '',
                                  tara_nominal_g: String(container.tara_nominal_g),
                                  tolerancia_tara_g: String(container.tolerancia_tara_g),
                                  peso_bruto_max_kg: String(container.peso_bruto_max_kg),
                                });
                                setDialog('container');
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`${container.activo ? 'Inactivar' : 'Reactivar'} contenedor ${container.nombre}`}
                              onClick={() => runMutation(
                                () => actualizarTipoContenedorScm(container.id, {
                                  version: container.version,
                                  activo: !container.activo,
                                }),
                                `Contenedor ${container.activo ? 'inactivado' : 'reactivado'}.`,
                                {
                                  refreshScope: {
                                    catalogs: ['containers'],
                                    ruleViews: [ruleHistory ? 'historial' : 'actual'],
                                    approvalDomains: ['EMPAQUE'],
                                  },
                                },
                              )}
                            >
                              <PowerSettingsNewOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Stack>}
                        </Stack>
                      </Paper>
                    ))}
                    {containers.length === 0 && <Typography color="text.secondary">Sin contenedores.</Typography>}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">Perfiles empacables</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Agrupan artículos con comportamiento físico equivalente.
                      </Typography>
                    </Box>
                    {canAdminPackaging && <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setEditingProfile(null);
                        setProfileForm(emptyPackagingProfileValue());
                        setDialog('profile');
                      }}
                    >
                      Nuevo
                    </Button>}
                  </Stack>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {profiles.map((profile) => (
                      <Paper key={profile.id} variant="outlined" sx={{ p: 1.25 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>
                              {profile.codigo} · {profile.nombre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {profile.descripcion_fisica || 'Sin descripción física'}
                            </Typography>
                          </Box>
                          {canAdminPackaging && <Stack direction="row">
                            <IconButton
                              size="small"
                              aria-label={`Editar perfil ${profile.nombre}`}
                              onClick={() => {
                                setEditingProfile(profile);
                                setProfileForm({
                                  nombre: profile.nombre,
                                  descripcion_fisica: profile.descripcion_fisica || '',
                                });
                                setDialog('profile');
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`${profile.activo ? 'Inactivar' : 'Reactivar'} perfil ${profile.nombre}`}
                              onClick={() => runMutation(
                                () => actualizarPerfilEmpacableScm(profile.id, {
                                  version: profile.version,
                                  activo: !profile.activo,
                                }),
                                `Perfil ${profile.activo ? 'inactivado' : 'reactivado'}.`,
                                {
                                  refreshScope: {
                                    catalogs: ['profiles'],
                                    ruleViews: [ruleHistory ? 'historial' : 'actual'],
                                    approvalDomains: ['EMPAQUE'],
                                  },
                                },
                              )}
                            >
                              <PowerSettingsNewOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Stack>}
                        </Stack>
                      </Paper>
                    ))}
                    {profiles.length === 0 && <Typography color="text.secondary">Sin perfiles.</Typography>}
                  </Stack>
                </Paper>
              </Stack>
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
                  <Box>
                    <Typography variant="h6">Reglas de empaque</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cantidad objetivo, máximo probado y límites operativos revisionados.
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    label="Buscar regla"
                    value={ruleQuery}
                    onChange={(event) => {
                      setRuleQuery(event.target.value);
                      setRulePageIndex(0);
                      setRuleCursors({ 0: null });
                    }}
                  />
                  {canAdminPackaging && <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={!profiles.length || !containers.length}
                    onClick={() => {
                      setEditingRule(null);
                      setRuleForm(emptyPackagingRuleValue());
                      setDialog('rule');
                    }}
                  >
                    Nueva regla
                  </Button>}
                  <Button
                    size="small"
                    onClick={() => {
                      setRuleHistory((current) => !current);
                      setRulePageIndex(0);
                      setRuleCursors({ 0: null });
                    }}
                  >
                    {ruleHistory ? 'Ocultar historial' : 'Mostrar historial'}
                  </Button>
                </Stack>
                <TableContainer aria-busy={rulePageLoading}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Perfil</TableCell>
                        <TableCell>Contenedor</TableCell>
                        <TableCell>Revisión</TableCell>
                        <TableCell>Objetivo / máximo</TableCell>
                        <TableCell>Neto máximo</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rules.map((rule) => (
                        <TableRow key={rule.revision_id}>
                          <TableCell>{rule.perfil_empacable?.nombre}</TableCell>
                          <TableCell>{rule.tipo_contenedor?.nombre}</TableCell>
                          <TableCell>{rule.numero_revision}</TableCell>
                          <TableCell>{rule.cantidad_objetivo_un} / {rule.cantidad_maxima_probada_un} un</TableCell>
                          <TableCell>{rule.peso_neto_operativo_max_kg} kg</TableCell>
                          <TableCell>{statusChip(rule.estado)}</TableCell>
                          <TableCell align="right">
                            {canAdminPackaging && rule.estado === 'BORRADOR' && (
                              <IconButton
                                size="small"
                                aria-label={`Editar regla ${rule.revision_id}`}
                                onClick={() => editRule(rule)}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rules.length === 0 && <EmptyRow columns={7} />}
                    </TableBody>
                  </Table>
                </TableContainer>
                {rulePageError && (
                  <Alert severity="error" action={<Button onClick={() => loadPagedTab(3)}>Reintentar sección</Button>}>
                    {rulePageError}
                  </Alert>
                )}
                <TablePagination
                  component="div"
                  count={rulePage.total ?? 0}
                  page={rulePageIndex}
                  rowsPerPage={25}
                  rowsPerPageOptions={[25]}
                  onPageChange={(_, nextPage) => {
                    setRulePageIndex(nextPage);
                    setRuleCursors((current) => ({
                      ...current,
                      [nextPage]: current[nextPage]
                        ?? (nextPage === rulePageIndex + 1 ? rulePage.next_cursor : null),
                    }));
                  }}
                  onRowsPerPageChange={() => {}}
                />
              </Paper>
            </Stack>
          )}

          {tab === 4 && (
            <Stack spacing={2}>
              {refreshFailure?.tab === 4 && refreshFailure.actorId === actorId && (
                <Alert
                  severity="warning"
                  action={<Button onClick={retryRefreshFailure}>Reintentar actualización</Button>}
                >
                  {refreshFailure.message}
                </Alert>
              )}
              <Alert
                severity={canPublishStructuresDirectly || canPublishRoutesDirectly
                  || canPublishPackagingDirectly
                  ? 'info' : 'warning'}
                icon={<ApprovalOutlinedIcon />}
              >
                {canPublishStructuresDirectly || canPublishRoutesDirectly
                  || canPublishPackagingDirectly
                  ? 'Tu perfil de jefatura o gerencia puede publicar directamente sus borradores de estructuras, rutas y reglas de empaque.'
                  : 'Para los flujos con segregación, cree o envíe con un actor y cambie al actor aprobador. El backend rechazará la autoaprobación.'}
              </Alert>
              <TextField
                size="small"
                label="Buscar pendientes"
                value={approvalQuery}
                onChange={(event) => {
                  setApprovalQuery(event.target.value);
                  setApprovalPage({});
                  setApprovalCursors(initialApprovalCursors());
                }}
              />
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Estructuras pendientes</Typography>
                {approvalDenied.ESTRUCTURA && <Alert severity="info" sx={{ mt: 1 }}>Sin permiso para consultar aprobaciones de estructuras.</Alert>}
                {approvalErrors.ESTRUCTURA && <Alert severity="warning" sx={{ mt: 1 }} action={<Button onClick={() => loadPagedTab(4, { approvalDomains: ['ESTRUCTURA'] })}>Reintentar sección</Button>}>No se pudo actualizar esta sección.</Alert>}
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {approvalStructureItems.map((revision) => (
                    <Stack
                      key={revision.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography>
                        {revision.articulo_resultado?.codigo} · rev. {revision.numero_revision}
                        {' '}· creador #{revision.creada_por_id}
                      </Typography>
                      <ApprovalActionPanel
                        domain="ESTRUCTURA"
                        revision={revision}
                        actorId={actorId}
                        capabilities={canonicalCapabilities}
                        busy={saving}
                        onAction={(action, item) => runApprovalPanelAction(
                          'ESTRUCTURA', action, item,
                        )}
                      />
                    </Stack>
                  ))}
                  {approvalStructureItems.length === 0 && <Typography color="text.secondary">Sin estructuras pendientes.</Typography>}
                  {approvalPages.ESTRUCTURA && (
                    <TablePagination
                      component="div"
                      count={approvalPages.ESTRUCTURA.total ?? 0}
                      page={approvalPage.ESTRUCTURA || 0}
                      rowsPerPage={25}
                      rowsPerPageOptions={[25]}
                      onPageChange={(_, nextPage) => {
                        setApprovalPage((current) => ({ ...current, ESTRUCTURA: nextPage }));
                        setApprovalCursors((current) => ({
                          ...current,
                          ESTRUCTURA: {
                            ...(current.ESTRUCTURA || {}),
                            [nextPage]: nextPage === 0
                              ? null
                              : current.ESTRUCTURA?.[nextPage]
                                ?? approvalPages.ESTRUCTURA.next_cursor,
                          },
                        }));
                      }}
                      onRowsPerPageChange={() => {}}
                    />
                  )}
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Rutas en borrador</Typography>
                {approvalDenied.RUTA && <Alert severity="info" sx={{ mt: 1 }}>Sin permiso para consultar aprobaciones de rutas.</Alert>}
                {approvalErrors.RUTA && <Alert severity="warning" sx={{ mt: 1 }} action={<Button onClick={() => loadPagedTab(4, { approvalDomains: ['RUTA'] })}>Reintentar sección</Button>}>No se pudo actualizar esta sección.</Alert>}
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {approvalRouteItems.map((revision) => (
                    <Stack key={revision.id} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography>
                        {ARTICLE_CLASS[revision.articulo_objetivo?.clase] || 'Artículo'}
                        {' · '}{revision.articulo_objetivo?.codigo} · rev. {revision.numero_revision}
                        {' '}· creador #{revision.creada_por_id}
                      </Typography>
                      <ApprovalActionPanel
                        domain="RUTA"
                        revision={revision}
                        actorId={actorId}
                        capabilities={canonicalCapabilities}
                        busy={saving}
                        onAction={(action, item) => runApprovalPanelAction(
                          'RUTA', action, item,
                        )}
                      />
                    </Stack>
                  ))}
                  {approvalRouteItems.length === 0 && <Typography color="text.secondary">Sin rutas por aprobar.</Typography>}
                  {approvalPages.RUTA && (
                    <TablePagination
                      component="div"
                      count={approvalPages.RUTA.total ?? 0}
                      page={approvalPage.RUTA || 0}
                      rowsPerPage={25}
                      rowsPerPageOptions={[25]}
                      onPageChange={(_, nextPage) => {
                        setApprovalPage((current) => ({ ...current, RUTA: nextPage }));
                        setApprovalCursors((current) => ({
                          ...current,
                          RUTA: {
                            ...(current.RUTA || {}),
                            [nextPage]: nextPage === 0
                              ? null
                              : current.RUTA?.[nextPage] ?? approvalPages.RUTA.next_cursor,
                          },
                        }));
                      }}
                      onRowsPerPageChange={() => {}}
                    />
                  )}
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Reglas de empaque en borrador</Typography>
                {approvalDenied.EMPAQUE && <Alert severity="info" sx={{ mt: 1 }}>Sin permiso para consultar aprobaciones de empaque.</Alert>}
                {approvalErrors.EMPAQUE && <Alert severity="warning" sx={{ mt: 1 }} action={<Button onClick={() => loadPagedTab(4, { approvalDomains: ['EMPAQUE'] })}>Reintentar sección</Button>}>No se pudo actualizar esta sección.</Alert>}
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {approvalRuleItems.map((revision) => (
                    <Stack key={revision.revision_id} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography>
                        {revision.perfil_empacable?.nombre} + {revision.tipo_contenedor?.nombre}
                        {' '}· rev. {revision.numero_revision} · creador #{revision.creada_por_id}
                      </Typography>
                      <ApprovalActionPanel
                        domain="EMPAQUE"
                        revision={revision}
                        actorId={actorId}
                        capabilities={canonicalCapabilities}
                        busy={saving}
                        onAction={(action, item) => runApprovalPanelAction(
                          'EMPAQUE', action, item,
                        )}
                      />
                    </Stack>
                  ))}
                  {approvalRuleItems.length === 0 && <Typography color="text.secondary">Sin reglas por aprobar.</Typography>}
                  {approvalPages.EMPAQUE && (
                    <TablePagination
                      component="div"
                      count={approvalPages.EMPAQUE.total ?? 0}
                      page={approvalPage.EMPAQUE || 0}
                      rowsPerPage={25}
                      rowsPerPageOptions={[25]}
                      onPageChange={(_, nextPage) => {
                        setApprovalPage((current) => ({ ...current, EMPAQUE: nextPage }));
                        setApprovalCursors((current) => ({
                          ...current,
                          EMPAQUE: {
                            ...(current.EMPAQUE || {}),
                            [nextPage]: nextPage === 0
                              ? null
                              : current.EMPAQUE?.[nextPage] ?? approvalPages.EMPAQUE.next_cursor,
                          },
                        }));
                      }}
                      onRowsPerPageChange={() => {}}
                    />
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </>
      )}

      <Dialog open={dialog === 'wip'} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editingWip ? 'Editar WIP' : 'Nuevo WIP'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={editingWip ? 'Código' : 'Código automático'}
              value={editingWip?.codigo || 'WIP-######'}
              disabled
            />
            <TextField
              label="Nombre"
              value={wipForm.nombre}
              onChange={(event) => setWipForm({ ...wipForm, nombre: event.target.value })}
              autoFocus
            />
            <TextField
              label="Descripción"
              multiline
              minRows={2}
              value={wipForm.descripcion}
              onChange={(event) => setWipForm({ ...wipForm, descripcion: event.target.value })}
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={wipForm.requiere_calidad}
                  onChange={(event) => setWipForm({
                    ...wipForm,
                    requiere_calidad: event.target.checked,
                  })}
                />
              )}
              label="Requiere control de calidad"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!wipForm.nombre.trim() || saving}
            onClick={() => runMutation(
              () => editingWip
                ? actualizarArticuloWipScm(editingWip.id, {
                  version: editingWip.version,
                  nombre: wipForm.nombre,
                  descripcion: wipForm.descripcion || null,
                  requiere_calidad: wipForm.requiere_calidad,
                })
                : crearArticuloWipScm({
                  nombre: wipForm.nombre,
                  descripcion: wipForm.descripcion || null,
                  requiere_calidad: wipForm.requiere_calidad,
                }),
              editingWip ? 'Artículo WIP actualizado.' : 'Artículo WIP creado.',
            )}
          >
            {editingWip ? 'Guardar cambios' : 'Crear WIP'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'bom'} onClose={() => setDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {editingBom
            ? `Editar estructura · revisión ${editingBom.numero_revision}`
            : `Nueva estructura · ${selectedArticle?.nombre}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {hydratingEditor && <Alert severity="info">Resolviendo referencias del borrador…</Alert>}
            {hydrationError && <Alert severity="warning">{hydrationError}</Alert>}
            <StructureRevisionEditor
              targetArticle={selectedArticle}
              componentArticles={structureComponentArticles}
              structures={structures}
              revision={editingBom}
              value={bomForm}
              onChange={changeBom}
              onNavigateStructure={goToStructuresForArticle}
              onCancel={() => setDialog(null)}
              onSubmit={saveBom}
              busy={saving || hydratingEditor || Boolean(hydrationError)}
              showHeading={false}
              submitLabel={editingBom ? 'Guardar borrador' : 'Crear borrador'}
            />
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'structureResolution'}
        onClose={() => setDialog(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {{
            reject: 'Rechazar estructura',
            discard: 'Descartar borrador de estructura',
            retire: 'Retirar revisión aprobada',
            publish: 'Publicar estructura (queda aprobada)',
            clone: 'Crear nueva revisión basada en esta',
          }[structureResolution.action]}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={structureResolution.action === 'retire' ? 'warning' : 'info'}>
              {structureResolution.action === 'retire'
                ? 'El retiro es irreversible: la revisión quedará en el historial y no podrá reactivarse. Si necesitas reutilizarla, deberás crear y aprobar una nueva revisión.'
                : structureResolution.action === 'publish'
                  ? 'La jefatura publicará este borrador directamente. La composición quedará vigente y la revisión aprobada anterior se retirará automáticamente.'
                : structureResolution.action === 'clone'
                  ? 'Se copiarán sus componentes a un nuevo borrador. La revisión original conservará su estado histórico.'
                  : 'La revisión conservará su historial y no se eliminará físicamente.'}
            </Alert>
            {['reject', 'discard'].includes(structureResolution.action) && (
              <TextField
                autoFocus
                required
                multiline
                minRows={3}
                label="Motivo"
                value={structureResolution.motivo}
                onChange={(event) => setStructureResolution({
                  ...structureResolution,
                  motivo: event.target.value,
                })}
                inputProps={{ maxLength: 500 }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={structureResolution.action === 'reject' ? 'error' : 'warning'}
            disabled={saving || (
              ['reject', 'discard'].includes(structureResolution.action)
              && !structureResolution.motivo.trim()
            )}
            onClick={confirmStructureResolution}
          >
            {{
              reject: 'Confirmar rechazo',
              discard: 'Confirmar descarte',
              retire: 'Confirmar retiro',
              publish: 'Publicar (queda aprobada)',
              clone: 'Crear borrador',
            }[structureResolution.action]}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'center'} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editingCenter ? 'Editar centro de trabajo' : 'Nuevo centro de trabajo'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!editingCenter && (
              <Alert severity="info">
                El código se generará automáticamente al crear el centro.
              </Alert>
            )}
            <TextField
              label="Nombre"
              value={centerForm.nombre}
              onChange={(event) => setCenterForm({ ...centerForm, nombre: event.target.value })}
            />
            <FormControl>
              <InputLabel id="work-center-operation-type-label">Tipo de operación</InputLabel>
              <Select
                id="work-center-operation-type"
                labelId="work-center-operation-type-label"
                label="Tipo de operación"
                value={centerForm.tipo}
                onChange={(event) => setCenterForm({ ...centerForm, tipo: event.target.value })}
              >
                {OPERATION_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{OPERATION_TYPE_LABEL[type]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!centerForm.nombre.trim() || saving}
            onClick={() => runMutation(
              () => editingCenter
                ? actualizarCentroTrabajoScm(editingCenter.id, {
                  version: editingCenter.version,
                  nombre: centerForm.nombre,
                  tipo: centerForm.tipo,
                })
                : crearCentroTrabajoScm(centerForm),
              editingCenter ? 'Centro de trabajo actualizado.' : 'Centro de trabajo creado.',
            )}
          >
            {editingCenter ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'route'} onClose={() => setDialog(null)} fullWidth maxWidth="lg">
        <DialogTitle>
          {editingRoute
            ? `Editar ruta · revisión ${editingRoute.numero_revision}`
            : `Nueva ruta · ${ARTICLE_CLASS[routeTargetArticle?.clase] || 'Artículo'} ${routeTargetArticle?.codigo || 'objetivo'}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {hydratingEditor && <Alert severity="info">Resolviendo referencias del borrador…</Alert>}
            {hydrationError && <Alert severity="warning">{hydrationError}</Alert>}
            <RouteRevisionEditor
              targetArticle={routeTargetArticle}
              articles={[...new Map([...articles, ...articleCache]
                .map((item) => [Number(item.id), item])).values()]}
              centers={centers}
              structures={structures}
              revision={editingRoute}
              value={routeForm}
              onChange={setRouteForm}
              onNavigateStructure={goToStructuresForArticle}
              onCancel={() => setDialog(null)}
              onSubmit={saveRoute}
              busy={saving || hydratingEditor || Boolean(hydrationError)}
              showHeading={false}
              submitLabel={editingRoute ? 'Guardar borrador' : 'Crear borrador'}
            />
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'container'} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editingContainer ? 'Editar tipo de contenedor' : 'Nuevo tipo de contenedor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={editingContainer ? 'Código' : 'Código automático'}
              value={editingContainer?.codigo || (
                containerForm.clase === 'MANGA' ? 'TMG-######' : 'TCO-######'
              )}
              disabled
            />
            <FormControl>
              <InputLabel>Clase</InputLabel>
              <Select
                label="Clase"
                value={containerForm.clase}
                onChange={(event) => setContainerForm({ ...containerForm, clase: event.target.value })}
                disabled={Boolean(editingContainer)}
              >
                {CONTAINER_CLASSES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Nombre" value={containerForm.nombre} onChange={(event) => setContainerForm({ ...containerForm, nombre: event.target.value })} />
            <TextField label="Material" value={containerForm.material} onChange={(event) => setContainerForm({ ...containerForm, material: event.target.value })} />
            <Stack direction="row" spacing={1}>
              <TextField fullWidth label="Tara nominal (g)" type="number" value={containerForm.tara_nominal_g} onChange={(event) => setContainerForm({ ...containerForm, tara_nominal_g: event.target.value })} />
              <TextField fullWidth label="Tolerancia tara (g)" type="number" value={containerForm.tolerancia_tara_g} onChange={(event) => setContainerForm({ ...containerForm, tolerancia_tara_g: event.target.value })} />
              <TextField fullWidth label="Bruto máximo (kg)" type="number" value={containerForm.peso_bruto_max_kg} onChange={(event) => setContainerForm({ ...containerForm, peso_bruto_max_kg: event.target.value })} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!containerForm.nombre.trim() || Number(containerForm.peso_bruto_max_kg) <= 0 || saving}
            onClick={() => runMutation(
              () => {
                const values = {
                  nombre: containerForm.nombre,
                  material: containerForm.material || null,
                  dimensiones: null,
                  tara_nominal_g: Number(containerForm.tara_nominal_g),
                  tolerancia_tara_g: Number(containerForm.tolerancia_tara_g),
                  peso_bruto_max_kg: Number(containerForm.peso_bruto_max_kg),
                };
                return editingContainer
                  ? actualizarTipoContenedorScm(editingContainer.id, {
                    ...values,
                    version: editingContainer.version,
                  })
                  : crearTipoContenedorScm({
                    ...values,
                    clase: containerForm.clase,
                  });
              },
              editingContainer ? 'Tipo de contenedor actualizado.' : 'Tipo de contenedor creado.',
            )}
          >
            {editingContainer ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'profile'} onClose={() => setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingProfile ? 'Editar perfil empacable' : 'Nuevo perfil empacable'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PackagingProfileEditor
              value={profileForm}
              onChange={setProfileForm}
              onCancel={() => setDialog(null)}
              onSubmit={(payload) => runMutation(
                () => editingProfile
                  ? actualizarPerfilEmpacableScm(editingProfile.id, {
                    ...payload,
                    version: editingProfile.version,
                  })
                  : crearPerfilEmpacableScm(payload),
                editingProfile
                  ? 'Perfil empacable actualizado.'
                  : 'Perfil empacable creado.',
              )}
              busy={saving || hydratingEditor || Boolean(hydrationError)}
              showHeading={false}
              submitLabel={editingProfile ? 'Guardar cambios' : 'Crear'}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'rule'} onClose={() => setDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {editingRule ? 'Editar regla de empaque' : 'Nueva regla de empaque'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {hydratingEditor && <Alert severity="info">Resolviendo referencias de la regla…</Alert>}
            {hydrationError && <Alert severity="warning">{hydrationError}</Alert>}
            <PackagingRuleEditor
              value={ruleForm}
              profiles={profiles}
              containers={containers}
              revision={editingRule}
              onChange={setRuleForm}
              onCancel={() => setDialog(null)}
              onSubmit={(payload) => {
                const {
                  perfil_empacable_id: _profileId,
                  tipo_contenedor_id: _containerId,
                  ...mutableRule
                } = payload;
                return runMutation(
                  () => editingRule
                    ? actualizarReglaEmpaqueScm(editingRule.revision_id, {
                      ...mutableRule,
                      version: editingRule.version,
                    })
                    : crearReglaEmpaqueScm(payload),
                  editingRule
                    ? 'Borrador de regla actualizado.'
                    : 'Borrador de regla creado.',
                );
              }}
              busy={saving || hydratingEditor || Boolean(hydrationError)}
              showHeading={false}
              submitLabel={editingRule ? 'Guardar borrador' : 'Crear borrador'}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

export default ScmEngineeringAdmin;
