import {
  useCallback,
  useEffect,
  useMemo,
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
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaqueScm,
  listarRutasArticuloScm,
  listarTiposContenedorScm,
  mensajeErrorScm,
  obtenerPerfilesArticuloScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
  publicarRutaScm,
  rechazarEstructuraScm,
  retirarEstructuraScm,
  retirarRutaScm,
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
  && ['SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO'].includes(item.clase)
);

const statusChip = (state) => (
  <Chip
    size="small"
    label={String(state || 'SIN DEFINIR').replaceAll('_', ' ')}
    color={STATUS_COLOR[state] || 'default'}
    variant="outlined"
  />
);

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
  const [tab, setTab] = useState(() => ({
    articulos: 0,
    estructuras: 1,
    rutas: 2,
    empaque: 3,
    aprobaciones: 4,
  }[new URLSearchParams(globalThis.location?.search || '').get('tab')] || 0));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState([]);
  const [structures, setStructures] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState('');
  const [routeReloadToken, setRouteReloadToken] = useState(0);
  const [centers, setCenters] = useState([]);
  const [containers, setContainers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [articleProfilesById, setArticleProfilesById] = useState({});
  const [rules, setRules] = useState([]);
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
  const [planningContext] = useState(initialPlanningContext);

  const routeTargetArticles = useMemo(
    () => articles.filter(isRoutableArticle),
    [articles],
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
    () => articles.filter((item) => (
      item.clase === 'SUBENSAMBLE_WIP'
      || item.clase === 'PRODUCTO_TERMINADO'
    )),
    [articles],
  );
  const selectedArticle = articles.find((item) => item.id === Number(selectedArticleId));
  const packagingArticle = articles.find(
    (item) => item.id === Number(packagingArticleId),
  );
  const structureComponentArticles = useMemo(
    () => articles.filter((item) => (
      (item.clase === 'PIEZA_COLOR' || item.clase === 'SUBENSAMBLE_WIP')
      && item.id !== Number(selectedArticleId)
    )),
    [articles, selectedArticleId],
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        listarArticulosScm(),
        listarCentrosTrabajoScm(),
        listarTiposContenedorScm(),
        listarPerfilesEmpacablesScm(),
        listarReglasEmpaqueScm(),
      ]);
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => mensajeErrorScm(result.reason));
      const [
        articleResult,
        centerResult,
        containerResult,
        profileResult,
        ruleResult,
      ] = results;
      const articleRows = articleResult.status === 'fulfilled' ? articleResult.value : [];
      const centerRows = centerResult.status === 'fulfilled' ? centerResult.value : [];
      const containerRows = containerResult.status === 'fulfilled' ? containerResult.value : [];
      const profileRows = profileResult.status === 'fulfilled' ? profileResult.value : [];
      const ruleRows = ruleResult.status === 'fulfilled' ? ruleResult.value : [];
      const routeTargets = articleRows.filter(isRoutableArticle);
      const [structureResults, articleProfileResults] = await Promise.all([
        Promise.allSettled(articleRows.map((item) => listarEstructurasScm(item.id))),
        profileResult.status === 'fulfilled'
          ? Promise.allSettled(articleRows.map((item) => obtenerPerfilesArticuloScm(item.id)))
          : Promise.resolve([]),
      ]);
      errors.push(...structureResults
        .filter((result) => result.status === 'rejected')
        .map((result) => mensajeErrorScm(result.reason)));
      errors.push(...articleProfileResults
        .filter((result) => result.status === 'rejected')
        .map((result) => mensajeErrorScm(result.reason)));
      setArticles(articleRows);
      setCenters(centerRows);
      setContainers(containerRows);
      setProfiles(profileRows);
      setArticleProfilesById(Object.fromEntries(articleRows.map((article, index) => [
        article.id,
        articleProfileResults[index]?.status === 'fulfilled'
          ? articleProfileResults[index].value.perfiles
          : [],
      ])));
      setRules(ruleRows);
      setStructures(structureResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value));
      const requestedArticleId = requestedPackagingArticleId();
      const requestedArticleIndex = articleRows.findIndex(
        (item) => String(item.id) === String(requestedArticleId),
      );
      if (requestedArticleIndex >= 0) {
        const requestedProfiles = (
          articleProfileResults[requestedArticleIndex]?.status === 'fulfilled'
            ? articleProfileResults[requestedArticleIndex].value.perfiles
            : []
        );
        const currentDefault = requestedProfiles.find(
          (item) => item.activo && item.es_predeterminado,
        );
        setPackagingArticleId(String(requestedArticleId));
        setPackagingProfileId(
          currentDefault ? String(currentDefault.perfil_empacable_id) : '',
        );
      }
      if (errors.length) {
        setError([...new Set(errors)].join(' · '));
      }
      setSelectedArticleId((current) => (
        articleRows.some((item) => (
          String(item.id) === String(current)
          && (item.clase === 'SUBENSAMBLE_WIP' || item.clase === 'PRODUCTO_TERMINADO')
        )) ? current : ''
      ));
      setSelectedRouteArticleId((current) => {
        if (routeTargets.some((item) => String(item.id) === String(current))) {
          return current;
        }
        const params = new URLSearchParams(globalThis.location?.search || '');
        const requestedArticle = params.get('articulo');
        const requestedProduct = params.get('producto');
        const requestedTarget = routeTargets.find((item) => (
          String(item.id) === String(requestedArticle)
          || (
            requestedProduct
            && item.subtipo?.producto_terminado_id === requestedProduct
          )
        ));
        return requestedTarget ? String(requestedTarget.id) : '';
      });
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se pudieron cargar los maestros R-core para el actor seleccionado.',
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;
    if (!selectedRouteArticleId) {
      setRoutes([]);
      setRoutesError('');
      setRoutesLoading(false);
      return undefined;
    }
    setRoutes([]);
    setRoutesError('');
    setRoutesLoading(true);
    listarRutasArticuloScm(Number(selectedRouteArticleId))
      .then((items) => {
        if (active) setRoutes(items);
      })
      .catch((requestError) => {
        if (active) {
          setRoutesError(mensajeErrorScm(
            requestError,
            'No se pudieron cargar las rutas del artículo seleccionado.',
          ));
        }
      })
      .finally(() => {
        if (active) setRoutesLoading(false);
      });
    return () => { active = false; };
  }, [routeReloadToken, selectedRouteArticleId]);

  const runMutation = async (operation, successMessage, { refreshRoute = false } = {}) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setDialog(null);
      setNotice(successMessage);
      await loadData();
      if (refreshRoute) setRouteReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError));
    } finally {
      setSaving(false);
    }
  };

  const runRouteMutation = (operation, successMessage) => runMutation(
    operation,
    successMessage,
    { refreshRoute: true },
  );

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
    ? 'Selecciona un artículo objetivo WIP o producto terminado antes de crear una ruta.'
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
    setEditingBom(null);
    setBomForm(emptyStructureValue());
    setDialog('bom');
  };
  const editBom = (revision) => {
    setEditingBom(revision);
    setBomForm(normalizeStructureRevision(revision));
    setDialog('bom');
  };
  const openRoute = () => {
    setEditingRoute(null);
    setRouteForm(emptyRouteValue(routeTargetArticle));
    setDialog('route');
  };
  const editRoute = (revision) => {
    setEditingRoute(revision);
    setRouteForm(normalizeRouteRevision(revision, routeTargetArticle, articles));
    setDialog('route');
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
        );
      }
      if (action === 'approve') {
        return runMutation(
          () => aprobarEstructuraScm(revision),
          'Estructura aprobada.',
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
        return runRouteMutation(() => aprobarRutaScm(revision), 'Ruta aprobada.');
      }
      if (action === 'publish') {
        return runRouteMutation(
          () => publicarRutaScm(revision),
          'Ruta publicada directamente por jefatura.',
        );
      }
    }
    if (domain === 'EMPAQUE') {
      if (action === 'approve') {
        return runMutation(
          () => aprobarReglaEmpaqueScm(revision),
          'Regla de empaque aprobada.',
        );
      }
      if (action === 'publish') {
        return runMutation(
          () => publicarReglaEmpaqueScm(revision),
          'Regla de empaque publicada directamente por jefatura.',
        );
      }
    }
    return undefined;
  };

  const tabs = ['Artículos', 'Estructuras BOM', 'Rutas', 'Empaque', 'Aprobaciones'];

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Ingeniería SCM"
        description="Artículos, estructuras multinivel, rutas y reglas físicas de empaque conectadas a la API R-core."
        actions={(
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton aria-label="Recargar ingeniería SCM" onClick={loadData}>
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

      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Maestros de ingeniería SCM"
        >
          {tabs.map((label, index) => (
            <Tab
              key={label}
              label={index === 4
                ? `${label} (${pendingStructures.length + pendingRoutes.length + pendingRules.length})`
                : label}
            />
          ))}
        </Tabs>
      </Paper>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : (
        <>
          {tab === 0 && (
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
                    {filteredArticles.length === 0 && <EmptyRow columns={6} />}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {tab === 1 && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <ScmArticleAutocomplete
                    label="Artículo resultado"
                    articles={structureResultArticles}
                    value={selectedArticleId}
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
                    sx={{ whiteSpace: 'nowrap' }}
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
                    {revision.componentes.map((line) => (
                      <Chip
                        key={line.id}
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

          {tab === 2 && (
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
                      onClick={() => setRouteReloadToken((current) => current + 1)}
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

          {tab === 3 && (
            <Stack spacing={2}>
              {packagingArticle && (
                <Alert severity="info">
                  Configurando empaque para {packagingArticle.codigo} · {packagingArticle.nombre}.
                  El perfil puede compartirse con otro artículo que conserve la misma estructura
                  física, pero un supervisor debe validar físicamente el acomodo, la capacidad,
                  la tara y los límites de peso antes de publicar la regla.
                </Alert>
              )}
              {canAdminPackaging && <Paper variant="outlined" sx={{ p: 2 }}>
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
                    articles={articles}
                    value={packagingArticleId}
                    onChange={(articleId) => {
                      const currentDefault = (articleProfilesById[articleId] || []).find(
                        (item) => item.activo && item.es_predeterminado,
                      );
                      setPackagingArticleId(articleId);
                      setPackagingProfileId(
                        currentDefault ? String(currentDefault.perfil_empacable_id) : '',
                      );
                    }}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Perfil predeterminado</InputLabel>
                    <Select
                      label="Perfil predeterminado"
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
                    disabled={!packagingArticleId || !packagingProfileId || saving}
                    sx={{ whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const article = articles.find(
                        (item) => item.id === Number(packagingArticleId),
                      );
                      runMutation(
                        () => asignarPerfilesArticuloScm(article, [{
                          perfil_empacable_id: Number(packagingProfileId),
                          es_predeterminado: true,
                          activo: true,
                        }]),
                        'Perfil predeterminado asignado al artículo.',
                      );
                    }}
                  >
                    Asignar perfil
                  </Button>
                </Stack>
              </Paper>}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Asignaciones actuales</Typography>
                <Typography variant="caption" color="text.secondary">
                  Evidencia del perfil predeterminado que utilizará el plan de mangas.
                </Typography>
                <TableContainer sx={{ mt: 1.5 }}>
                  <Table size="small" aria-label="Asignaciones actuales de perfiles empacables">
                    <TableHead>
                      <TableRow>
                        <TableCell>Artículo</TableCell>
                        <TableCell>Clase</TableCell>
                        <TableCell>Perfil predeterminado</TableCell>
                        <TableCell>Estado</TableCell>
                        {canAdminPackaging && <TableCell align="right">Acción</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {articles.flatMap((article) => (
                        (articleProfilesById[article.id] || [])
                          .filter((item) => item.activo && item.es_predeterminado)
                          .map((item) => (
                            <TableRow key={`${article.id}-${item.perfil_empacable_id}`}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {article.codigo}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {article.nombre}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={ARTICLE_CLASS[article.clase] || article.clase} variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {item.perfil?.codigo} · {item.perfil?.nombre}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.perfil?.descripcion_fisica || 'Sin descripción física'}
                                </Typography>
                              </TableCell>
                              <TableCell><Chip size="small" color="success" label="Predeterminado" /></TableCell>
                              {canAdminPackaging && (
                                <TableCell align="right">
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      setPackagingArticleId(String(article.id));
                                      setPackagingProfileId(String(item.perfil_empacable_id));
                                    }}
                                  >
                                    Cambiar
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                      ))}
                      {articles.every((article) => !(articleProfilesById[article.id] || []).some(
                        (item) => item.activo && item.es_predeterminado,
                      )) && <EmptyRow columns={canAdminPackaging ? 5 : 4} />}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
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
                </Stack>
                <TableContainer>
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
                                onClick={() => {
                                  setEditingRule(rule);
                                  setRuleForm({
                                    perfil_empacable_id: String(rule.perfil_empacable_id),
                                    tipo_contenedor_id: String(rule.tipo_contenedor_id),
                                    medicion_fisica_probada: rule.medicion_fisica_probada,
                                    cantidad_objetivo_un: String(rule.cantidad_objetivo_un),
                                    cantidad_maxima_probada_un: String(rule.cantidad_maxima_probada_un),
                                    peso_neto_operativo_max_kg: String(rule.peso_neto_operativo_max_kg),
                                    margen_seguridad_kg: String(rule.margen_seguridad_kg),
                                    tolerancia_peso_abs_g: String(rule.tolerancia_peso_abs_g),
                                    tolerancia_peso_pct: String(rule.tolerancia_peso_pct),
                                    notas: rule.notas || '',
                                  });
                                  setDialog('rule');
                                }}
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
              </Paper>
            </Stack>
          )}

          {tab === 4 && (
            <Stack spacing={2}>
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
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Estructuras pendientes</Typography>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {pendingStructures.map((revision) => (
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
                  {pendingStructures.length === 0 && <Typography color="text.secondary">Sin estructuras pendientes.</Typography>}
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Rutas en borrador</Typography>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {pendingRoutes.map((revision) => (
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
                  {pendingRoutes.length === 0 && <Typography color="text.secondary">Sin rutas por aprobar.</Typography>}
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Reglas de empaque en borrador</Typography>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {pendingRules.map((revision) => (
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
                  {pendingRules.length === 0 && <Typography color="text.secondary">Sin reglas por aprobar.</Typography>}
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
            <StructureRevisionEditor
              targetArticle={selectedArticle}
              componentArticles={structureComponentArticles}
              structures={structures}
              revision={editingBom}
              value={bomForm}
              onChange={setBomForm}
              onNavigateStructure={goToStructuresForArticle}
              onCancel={() => setDialog(null)}
              onSubmit={saveBom}
              busy={saving}
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
            <RouteRevisionEditor
              targetArticle={routeTargetArticle}
              articles={articles}
              centers={centers}
              structures={structures}
              revision={editingRoute}
              value={routeForm}
              onChange={setRouteForm}
              onNavigateStructure={goToStructuresForArticle}
              onCancel={() => setDialog(null)}
              onSubmit={saveRoute}
              busy={saving}
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
              busy={saving}
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
              busy={saving}
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
