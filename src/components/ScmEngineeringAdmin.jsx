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
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
  crearRutaScm,
  crearTipoContenedorScm,
  descartarEstructuraScm,
  enviarEstructuraScm,
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaqueScm,
  listarRutasScm,
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
const OPERATION_TYPES = ['INYECCION', 'SOPLADO', 'PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'];
const OPERATION_TYPE_LABEL = {
  INYECCION: 'INYECCIÓN',
  SOPLADO: 'SOPLADO',
  PREARMADO: 'PREARMADO',
  ENSAMBLE: 'ARMADO',
  ACABADO: 'ACABADO',
  EMPAQUE: 'EMPAQUE',
};
const CONTAINER_CLASSES = ['MANGA', 'BOLSA', 'JABA', 'CAJA', 'OTRO'];
const EXECUTOR_LABEL = {
  OP_OT: 'Fabricación mediante OF y Trabajo de color',
  ORDEN_OPERACION: 'Prearmado o armado mediante OA / OT de Armado',
};
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
const emptyProfile = { nombre: '', descripcion_fisica: '' };
const emptyRule = {
  perfil_empacable_id: '',
  tipo_contenedor_id: '',
  medicion_fisica_probada: false,
  cantidad_objetivo_un: '',
  cantidad_maxima_probada_un: '',
  peso_neto_operativo_max_kg: '',
  margen_seguridad_kg: '0',
  tolerancia_peso_abs_g: '0',
  tolerancia_peso_pct: '0',
  notas: '',
};
const newBomLine = () => ({ articulo_id: '', cantidad: '1', merma_tecnica_pct: '0' });
const compactDecimal = (value) => {
  const text = String(value ?? '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
};
const newOperation = (sequence = 1) => ({
  clave: `OP${sequence}`,
  secuencia_visible: String(sequence),
  nombre: '',
  tipo: '',
  executor_kind: '',
  centro_trabajo_id: '',
  articulo_salida_id: '',
  estructura_revision_id: '',
  permite_concurrente: false,
});
const executorKindForOperationType = (type) => {
  if (['INYECCION', 'SOPLADO'].includes(type)) return 'OP_OT';
  if (['PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].includes(type)) {
    return 'ORDEN_OPERACION';
  }
  return '';
};
const nextOperationKey = (operations) => {
  const last = operations.reduce((maximum, operation) => {
    const match = /^OP(\d+)$/.exec(operation.clave);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `OP${last + 1}`;
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

const normalizeRouteOutputs = (operations, targetArticleId, articlesById) => (
  operations.map((operation, index) => {
    const isTerminal = index === operations.length - 1;
    if (isTerminal) {
      return { ...operation, articulo_salida_id: String(targetArticleId || '') };
    }
    const currentOutput = articlesById.get(Number(operation.articulo_salida_id));
    return currentOutput?.clase === 'PRODUCTO_TERMINADO'
      ? { ...operation, articulo_salida_id: '' }
      : operation;
  })
);

const hasMeaningfulRouteStepData = (operation) => Boolean(
  operation.nombre?.trim()
  || operation.centro_trabajo_id
  || operation.articulo_salida_id
  || operation.estructura_revision_id
  || operation.permite_concurrente
);

const isRoutableProduct = (item) => (
  item.clase === 'PRODUCTO_TERMINADO'
  && typeof item.subtipo?.producto_terminado_id === 'string'
  && item.subtipo.producto_terminado_id.trim().length > 0
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
  const [centers, setCenters] = useState([]);
  const [containers, setContainers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [articleProfilesById, setArticleProfilesById] = useState({});
  const [rules, setRules] = useState([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [dialog, setDialog] = useState(null);
  const [wipForm, setWipForm] = useState(emptyWip);
  const [bomForm, setBomForm] = useState({ notas: '', componentes: [newBomLine()] });
  const [centerForm, setCenterForm] = useState(emptyCenter);
  const [routeForm, setRouteForm] = useState({ notas: '', operaciones: [newOperation()] });
  const [containerForm, setContainerForm] = useState(emptyContainer);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [ruleForm, setRuleForm] = useState(emptyRule);
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
  const [routeStepToDelete, setRouteStepToDelete] = useState(null);
  const [planningContext] = useState(initialPlanningContext);

  const productArticles = useMemo(
    () => articles.filter(isRoutableProduct),
    [articles],
  );
  const activeCenters = useMemo(
    () => centers.filter((item) => item.activo !== false),
    [centers],
  );
  const articlesById = useMemo(
    () => new Map(articles.map((item) => [Number(item.id), item])),
    [articles],
  );
  const routeTargetArticle = useMemo(
    () => productArticles.find(
      (item) => item.subtipo?.producto_terminado_id === selectedProductId,
    ),
    [productArticles, selectedProductId],
  );
  const routeIntermediateArticles = useMemo(
    () => articles.filter((item) => (
      item.clase === 'PIEZA_COLOR' || item.clase === 'SUBENSAMBLE_WIP'
    )),
    [articles],
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
  const approvedStructureByArticleId = useMemo(() => {
    const approved = new Map();
    structures
      .filter((item) => item.estado === 'APROBADA')
      .sort((left, right) => right.numero_revision - left.numero_revision)
      .forEach((item) => {
        if (!approved.has(item.articulo_resultado_id)) {
          approved.set(item.articulo_resultado_id, item);
        }
      });
    return approved;
  }, [structures]);
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
      const products = articleRows.filter(isRoutableProduct);
      const [structureResults, routeResults, articleProfileResults] = await Promise.all([
        Promise.allSettled(articleRows.map((item) => listarEstructurasScm(item.id))),
        Promise.allSettled(products.map((item) => (
          listarRutasScm(item.subtipo?.producto_terminado_id)
        ))),
        profileResult.status === 'fulfilled'
          ? Promise.allSettled(articleRows.map((item) => obtenerPerfilesArticuloScm(item.id)))
          : Promise.resolve([]),
      ]);
      errors.push(...structureResults
        .filter((result) => result.status === 'rejected')
        .map((result) => mensajeErrorScm(result.reason)));
      errors.push(...routeResults
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
      setRoutes(routeResults
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
      setSelectedProductId((current) => (
        products.some((item) => (
          item.subtipo?.producto_terminado_id === current
        ))
          ? current
          : String(
            products.find((item) => (
              item.subtipo?.producto_terminado_id
                === new URLSearchParams(globalThis.location?.search || '').get('producto')
            ))?.subtipo?.producto_terminado_id
            || products[0]?.subtipo?.producto_terminado_id
            || '',
          )
      ));
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

  const runMutation = async (operation, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setDialog(null);
      setNotice(successMessage);
      await loadData();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError));
    } finally {
      setSaving(false);
    }
  };

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
  const routesForSelection = routes.filter((item) => item.producto_id === selectedProductId);
  const newRouteDisabledReason = !selectedProductId
    ? 'Selecciona un producto terminado antes de crear una ruta.'
    : activeCenters.length === 0
      ? 'Crea al menos un centro de trabajo activo antes de crear una ruta.'
      : '';
  const routeFormBlockingReasons = routeForm.operaciones.flatMap((operation, index) => {
    const step = `Paso ${index + 1}`;
    return [
      !operation.nombre.trim() ? `Escribe un nombre para el ${step}.` : '',
      !operation.tipo ? `Selecciona el tipo de operación del ${step}.` : '',
      !operation.executor_kind ? `Selecciona la forma de ejecución del ${step}.` : '',
      !operation.centro_trabajo_id ? `Selecciona el centro de trabajo del ${step}.` : '',
      !operation.articulo_salida_id ? `Define la salida del ${step}.` : '',
      operation.executor_kind === 'ORDEN_OPERACION' && !operation.estructura_revision_id
        ? `Selecciona una estructura aprobada compatible para el ${step}.`
        : '',
    ].filter(Boolean);
  });

  const goToStructuresForArticle = (articleId) => {
    setSelectedArticleId(String(articleId || ''));
    setShowStructureHistory(false);
    setDialog(null);
    setTab(1);
  };

  const openBom = () => {
    setEditingBom(null);
    setBomForm({ notas: '', componentes: [newBomLine()] });
    setDialog('bom');
  };
  const editBom = (revision) => {
    setEditingBom(revision);
    setBomForm({
      notas: revision.notas || '',
      componentes: revision.componentes.map((line) => ({
        articulo_id: String(line.articulo_id),
        cantidad: compactDecimal(line.cantidad),
        merma_tecnica_pct: compactDecimal(line.merma_tecnica_pct || 0),
      })),
    });
    setDialog('bom');
  };
  const openRoute = () => {
    setEditingRoute(null);
    setRouteForm({
      notas: '',
      operaciones: [{
        ...newOperation(),
        articulo_salida_id: String(routeTargetArticle?.id || ''),
      }],
    });
    setDialog('route');
  };
  const editRoute = (revision) => {
    const keysById = new Map(
      revision.operaciones.map((operation) => [operation.id, operation.clave]),
    );
    setEditingRoute(revision);
    setRouteForm({
      notas: revision.notas || '',
      operaciones: normalizeRouteOutputs(revision.operaciones.map((operation) => ({
        clave: operation.clave,
        secuencia_visible: String(operation.secuencia_visible),
        nombre: operation.nombre,
        tipo: operation.tipo,
        executor_kind: operation.executor_kind,
        centro_trabajo_id: String(operation.centro_trabajo_id),
        articulo_salida_id: String(operation.articulo_salida_id),
        estructura_revision_id: operation.estructura_revision_id
          ? String(operation.estructura_revision_id)
          : '',
        permite_concurrente: operation.permite_concurrente,
      })), routeTargetArticle?.id, articlesById),
      precedencias: revision.precedencias.map((edge) => ({
        anterior_clave: keysById.get(edge.anterior_id ?? edge.operacion_anterior_id),
        siguiente_clave: keysById.get(edge.siguiente_id ?? edge.operacion_siguiente_id),
      })),
    });
    setDialog('route');
  };

  const saveBom = () => {
    const payload = {
      notas: bomForm.notas || null,
      componentes: bomForm.componentes.map((line, index) => ({
        secuencia: index + 1,
        articulo_id: Number(line.articulo_id),
        cantidad: Number(line.cantidad),
        unidad: 'UN',
        merma_tecnica_pct: Number(line.merma_tecnica_pct || 0),
      })),
    };
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

  const saveRoute = () => {
    const payload = {
      notas: routeForm.notas || null,
      operaciones: routeForm.operaciones.map((operation, index) => ({
        clave: operation.clave,
        secuencia_visible: index + 1,
        nombre: operation.nombre,
        tipo: operation.tipo,
        executor_kind: operation.executor_kind,
        centro_trabajo_id: Number(operation.centro_trabajo_id),
        articulo_salida_id: Number(operation.articulo_salida_id),
        estructura_revision_id: operation.executor_kind === 'ORDEN_OPERACION'
          ? Number(operation.estructura_revision_id)
          : null,
        permite_concurrente: operation.permite_concurrente,
      })),
      precedencias: routeForm.operaciones.slice(1).map((operation, index) => ({
        anterior_clave: routeForm.operaciones[index].clave,
        siguiente_clave: operation.clave,
      })),
    };
    return runMutation(
      () => editingRoute
        ? actualizarRutaScm(
          editingRoute.id,
          { ...payload, version: editingRoute.version },
        )
        : crearRutaScm(selectedProductId, payload),
      editingRoute ? 'Borrador de ruta actualizado.' : 'Borrador de ruta creado.',
    );
  };

  const moveRouteOperation = (fromIndex, toIndex) => {
    if (
      fromIndex === toIndex
      || fromIndex < 0
      || toIndex < 0
      || fromIndex >= routeForm.operaciones.length
      || toIndex >= routeForm.operaciones.length
    ) {
      return;
    }
    const operations = [...routeForm.operaciones];
    const [moved] = operations.splice(fromIndex, 1);
    operations.splice(toIndex, 0, moved);
    setRouteForm({
      ...routeForm,
      operaciones: normalizeRouteOutputs(
        operations,
        routeTargetArticle?.id,
        articlesById,
      ),
    });
  };

  const removeRouteOperation = (index) => {
    const operations = routeForm.operaciones.filter((_, row) => row !== index);
    setRouteForm({
      ...routeForm,
      operaciones: normalizeRouteOutputs(
        operations,
        routeTargetArticle?.id,
        articlesById,
      ),
    });
    setRouteStepToDelete(null);
  };

  const approvalButton = (revision, approve, successMessage, allowed) => {
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
            onClick={() => runMutation(approve, successMessage)}
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
          onClick={() => runMutation(
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
                  salida sea {planningContext.missingArticleCode}. Revisa la ruta del producto
                  seleccionado, publica únicamente la definición técnica correcta y vuelve a
                  recalcular el plan.
                </Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
                  <ScmArticleAutocomplete
                    label="Producto terminado"
                    articles={productArticles}
                    value={selectedProductId}
                    getOptionValue={(article) => article.subtipo?.producto_terminado_id}
                    onChange={setSelectedProductId}
                  />
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
                      <Typography variant="h6">Ruta · revisión {revision.numero_revision}</Typography>
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
                          onClick={() => runMutation(
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
              {routesForSelection.length === 0 && (
                <Alert severity="warning">El producto todavía no tiene una ruta revisionada.</Alert>
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
                        setProfileForm(emptyProfile);
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
                      setRuleForm(emptyRule);
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
                      {structureApprovalActions(revision)}
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
                        {revision.articulo_objetivo?.codigo} · rev. {revision.numero_revision}
                        {' '}· creador #{revision.creada_por_id}
                      </Typography>
                      {routeApprovalAction(revision)}
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
                      {canPublishPackagingDirectly ? (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={saving}
                          onClick={() => runMutation(
                            () => publicarReglaEmpaqueScm(revision),
                            'Regla de empaque publicada directamente por jefatura.',
                          )}
                        >
                          Publicar (queda aprobada)
                        </Button>
                      ) : approvalButton(
                          revision,
                          () => aprobarReglaEmpaqueScm(revision),
                          'Regla de empaque aprobada.',
                          canApprovePackaging,
                        )}
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
          {editingBom ? `Editar estructura · revisión ${editingBom.numero_revision}` : `Nueva estructura · ${selectedArticle?.nombre}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Notas de revisión"
              value={bomForm.notas}
              onChange={(event) => setBomForm({ ...bomForm, notas: event.target.value })}
            />
            {bomForm.componentes.map((line, index) => {
              const componentArticle = articles.find(
                (item) => item.id === Number(line.articulo_id),
              );
              const selectedWip = componentArticle?.clase === 'SUBENSAMBLE_WIP'
                ? componentArticle : null;
              const approvedWipStructure = selectedWip
                ? approvedStructureByArticleId.get(selectedWip.id) : null;
              return (
                <Box key={index}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <ScmArticleAutocomplete
                      label="Artículo componente"
                      articles={structureComponentArticles}
                      value={line.articulo_id}
                      placeholder="Buscar pieza-color o WIP"
                      onChange={(articleId) => {
                      const next = [...bomForm.componentes];
                      next[index] = { ...line, articulo_id: articleId };
                      setBomForm({ ...bomForm, componentes: next });
                    }}
                    />
                    <TextField
                  label="Cantidad UN"
                  type="number"
                  size="small"
                  value={line.cantidad}
                  helperText="Unidades del componente necesarias para producir 1 unidad del resultado."
                  onChange={(event) => {
                    const next = [...bomForm.componentes];
                    next[index] = { ...line, cantidad: event.target.value };
                    setBomForm({ ...bomForm, componentes: next });
                  }}
                  sx={{
                    width: { xs: '100%', md: 150 },
                    flexShrink: 0,
                  }}
                    />
                    <TextField
                  label="Pérdida esperada del componente (%)"
                  type="number"
                  size="small"
                  value={line.merma_tecnica_pct}
                  helperText="Pérdida adicional esperada de este componente durante la transformación."
                  onChange={(event) => {
                    const next = [...bomForm.componentes];
                    next[index] = { ...line, merma_tecnica_pct: event.target.value };
                    setBomForm({ ...bomForm, componentes: next });
                  }}
                  sx={{
                    width: { xs: '100%', md: 270 },
                    flexShrink: 0,
                  }}
                    />
                    <IconButton
                  aria-label={`Quitar componente ${index + 1}`}
                  disabled={bomForm.componentes.length === 1}
                  onClick={() => setBomForm({
                    ...bomForm,
                    componentes: bomForm.componentes.filter((_, row) => row !== index),
                  })}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                  {selectedWip && approvedWipStructure && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight={800}>
                        Composición vigente de {selectedWip.codigo} · revisión{' '}
                        {approvedWipStructure.numero_revision}
                      </Typography>
                      <Typography variant="body2">
                        {approvedWipStructure.componentes.map((component) => (
                          `${compactDecimal(component.cantidad)} × ${component.articulo?.codigo} · ${component.articulo?.nombre}`
                        )).join(' + ')}
                      </Typography>
                    </Alert>
                  )}
                  {selectedWip && !approvedWipStructure && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {selectedWip.codigo} no tiene una estructura aprobada. No publiques
                      esta BOM hasta definir la composición del WIP.
                    </Alert>
                  )}
                </Box>
              );
            })}
            <Button
              startIcon={<AddIcon />}
              onClick={() => setBomForm({
                ...bomForm,
                componentes: [...bomForm.componentes, newBomLine()],
              })}
              sx={{ alignSelf: 'flex-start' }}
            >
              Agregar componente
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={saving || bomForm.componentes.some(
              (line) => !line.articulo_id || Number(line.cantidad) <= 0,
            )}
            onClick={saveBom}
          >
            {editingBom ? 'Guardar borrador' : 'Crear borrador'}
          </Button>
        </DialogActions>
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
          {editingRoute ? `Editar ruta · revisión ${editingRoute.numero_revision}` : `Nueva ruta · ${selectedProductId}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              La BOM define qué consume cada salida; la ruta define el orden, centro y
              forma de ejecución. Fabricación mediante OF y Trabajo de color se usa para
              trabajo de máquina. Prearmado o armado mediante OA / OT de Armado exige la
              estructura aprobada de su salida.
            </Alert>
            <TextField
              label="Notas de revisión"
              value={routeForm.notas}
              onChange={(event) => setRouteForm({ ...routeForm, notas: event.target.value })}
            />
            {routeForm.operaciones.map((operation, index) => {
              const isTerminal = index === routeForm.operaciones.length - 1;
              const previousOutput = index > 0
                ? articlesById.get(Number(routeForm.operaciones[index - 1].articulo_salida_id))
                : null;
              const outputArticle = isTerminal
                ? routeTargetArticle
                : articlesById.get(Number(operation.articulo_salida_id));
              const compatibleApprovedStructures = structures.filter((item) => (
                item.estado === 'APROBADA'
                && Number(item.articulo_resultado_id) === Number(outputArticle?.id)
              ));
              const inputLabel = index === 0
                ? 'Entradas definidas por la BOM'
                : previousOutput
                  ? `${previousOutput.codigo} · ${previousOutput.nombre}`
                  : `Salida pendiente del Paso ${index}`;
              const outputLabel = outputArticle
                ? `${outputArticle.codigo} · ${outputArticle.nombre}`
                : 'Salida pendiente';
              return (
                <Paper
                  key={operation.clave}
                  variant="outlined"
                  data-route-operation-index={index}
                  sx={{
                    p: 2,
                    borderWidth: isTerminal ? 2 : 1,
                    borderColor: isTerminal ? 'primary.main' : 'divider',
                    bgcolor: isTerminal ? 'action.hover' : 'background.paper',
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DragIndicatorIcon color="action" />
                        <Typography variant="h6">Paso {index + 1}</Typography>
                        {isTerminal && <Chip size="small" color="primary" label="Paso terminal" />}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary">Mover paso:</Typography>
                        <Button
                          size="small"
                          startIcon={<ArrowUpwardIcon />}
                          aria-label={`Mover paso ${index + 1} antes`}
                          disabled={index === 0}
                          onClick={() => moveRouteOperation(index, index - 1)}
                        >
                          Antes
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ArrowDownwardIcon />}
                          aria-label={`Mover paso ${index + 1} después`}
                          disabled={isTerminal}
                          onClick={() => moveRouteOperation(index, index + 1)}
                        >
                          Después
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          aria-label={`Eliminar paso ${index + 1}`}
                          disabled={routeForm.operaciones.length === 1}
                          onClick={() => hasMeaningfulRouteStepData(operation)
                            ? setRouteStepToDelete(index)
                            : removeRouteOperation(index)}
                        >
                          Eliminar paso
                        </Button>
                      </Stack>
                    </Stack>

                    <Box sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                      <Typography variant="body2">
                        <strong>Entrada:</strong> {inputLabel}
                        {' → '}<strong>Transformación:</strong> {OPERATION_TYPE_LABEL[operation.tipo] || operation.tipo || 'Por definir'}
                        {' → '}<strong>Salida:</strong> {outputLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isTerminal ? 'Fin de ruta' : `Continúa en el Paso ${index + 2}`}
                      </Typography>
                    </Box>

                    {!isTerminal && !operation.articulo_salida_id && (
                      <Alert severity="warning">
                        El Paso {index + 1} ahora es intermedio. Selecciona una salida Pieza-color o WIP.
                      </Alert>
                    )}

                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                      <TextField
                        label="Nombre de la operación"
                        size="small"
                        value={operation.nombre}
                        onChange={(event) => {
                          const next = [...routeForm.operaciones];
                          next[index] = { ...operation, nombre: event.target.value };
                          setRouteForm({ ...routeForm, operaciones: next });
                        }}
                        sx={{ flex: 1 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id={`route-step-${index}-type-label`}>
                          Tipo de operación
                        </InputLabel>
                        <Select
                          labelId={`route-step-${index}-type-label`}
                          label="Tipo de operación"
                          value={operation.tipo}
                          displayEmpty
                          renderValue={(value) => (
                            value ? OPERATION_TYPE_LABEL[value] || value : 'Selecciona'
                          )}
                          onChange={(event) => {
                            const executorKind = executorKindForOperationType(event.target.value);
                            const approvedStructure = executorKind === 'ORDEN_OPERACION'
                              ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                              : null;
                            const next = [...routeForm.operaciones];
                            next[index] = {
                              ...operation,
                              tipo: event.target.value,
                              executor_kind: executorKind,
                              estructura_revision_id: approvedStructure
                                ? String(approvedStructure.id) : '',
                              permite_concurrente: event.target.value === 'PREARMADO'
                                ? operation.permite_concurrente : false,
                            };
                            setRouteForm({ ...routeForm, operaciones: next });
                          }}
                        >
                          <MenuItem value="" disabled>Selecciona</MenuItem>
                          {OPERATION_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>{OPERATION_TYPE_LABEL[type]}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id={`route-step-${index}-executor-label`}>
                          Forma de ejecución
                        </InputLabel>
                        <Select
                          labelId={`route-step-${index}-executor-label`}
                          label="Forma de ejecución"
                          value={operation.executor_kind}
                          displayEmpty
                          renderValue={(value) => value ? EXECUTOR_LABEL[value] : 'Selecciona'}
                          onChange={(event) => {
                            const approvedStructure = event.target.value === 'ORDEN_OPERACION'
                              ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                              : null;
                            const next = [...routeForm.operaciones];
                            next[index] = {
                              ...operation,
                              executor_kind: event.target.value,
                              estructura_revision_id: approvedStructure
                                ? String(approvedStructure.id) : '',
                            };
                            setRouteForm({ ...routeForm, operaciones: next });
                          }}
                        >
                          <MenuItem value="" disabled>Selecciona</MenuItem>
                          <MenuItem value="OP_OT">{EXECUTOR_LABEL.OP_OT}</MenuItem>
                          <MenuItem value="ORDEN_OPERACION">{EXECUTOR_LABEL.ORDEN_OPERACION}</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`route-step-${index}-center-label`}>
                          Centro de trabajo
                        </InputLabel>
                        <Select
                          labelId={`route-step-${index}-center-label`}
                          label="Centro de trabajo"
                          value={operation.centro_trabajo_id}
                          onChange={(event) => {
                            const selectedCenter = activeCenters.find(
                              (center) => String(center.id) === String(event.target.value),
                            );
                            const type = selectedCenter?.tipo || '';
                            const executorKind = executorKindForOperationType(type);
                            const approvedStructure = executorKind === 'ORDEN_OPERACION'
                              ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                              : null;
                            const next = [...routeForm.operaciones];
                            next[index] = {
                              ...operation,
                              centro_trabajo_id: event.target.value,
                              tipo: type,
                              executor_kind: executorKind,
                              estructura_revision_id: approvedStructure
                                ? String(approvedStructure.id) : '',
                              permite_concurrente: type === 'PREARMADO'
                                ? operation.permite_concurrente : false,
                            };
                            setRouteForm({ ...routeForm, operaciones: next });
                          }}
                        >
                          {activeCenters.map((center) => (
                            <MenuItem key={center.id} value={String(center.id)}>
                              {center.codigo} · {center.nombre}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {isTerminal ? (
                        <TextField
                          fullWidth
                          size="small"
                          label="Salida terminal (bloqueada)"
                          value={outputLabel}
                          slotProps={{ input: { readOnly: true } }}
                          helperText={`Esta operación termina la ruta y produce ${routeTargetArticle?.codigo || 'el PT seleccionado'}.`}
                        />
                      ) : (
                        <ScmArticleAutocomplete
                          label="Salida intermedia (Pieza-color o WIP)"
                          articles={routeIntermediateArticles}
                          value={operation.articulo_salida_id}
                          onChange={(articleId) => {
                            const approvedStructure = operation.executor_kind === 'ORDEN_OPERACION'
                              ? approvedStructureByArticleId.get(Number(articleId))
                              : null;
                            const next = [...routeForm.operaciones];
                            next[index] = {
                              ...operation,
                              articulo_salida_id: articleId,
                              estructura_revision_id: approvedStructure
                                ? String(approvedStructure.id) : '',
                            };
                            setRouteForm({ ...routeForm, operaciones: next });
                          }}
                        />
                      )}
                      {operation.executor_kind === 'ORDEN_OPERACION' && (
                        <FormControl fullWidth size="small">
                          <InputLabel id={`route-step-${index}-structure-label`}>
                            Estructura aprobada
                          </InputLabel>
                          <Select
                            labelId={`route-step-${index}-structure-label`}
                            label="Estructura aprobada"
                            value={operation.estructura_revision_id}
                            displayEmpty
                            renderValue={(value) => {
                              const selected = compatibleApprovedStructures.find(
                                (item) => String(item.id) === String(value),
                              );
                              return selected
                                ? `${selected.articulo_resultado?.codigo} · rev. ${selected.numero_revision}`
                                : 'Selecciona una estructura compatible';
                            }}
                            onChange={(event) => {
                              const next = [...routeForm.operaciones];
                              next[index] = { ...operation, estructura_revision_id: event.target.value };
                              setRouteForm({ ...routeForm, operaciones: next });
                            }}
                          >
                            <MenuItem value="" disabled>
                              Selecciona una estructura compatible
                            </MenuItem>
                            {compatibleApprovedStructures.map((item) => (
                              <MenuItem key={item.id} value={String(item.id)}>
                                {item.articulo_resultado?.codigo} · rev. {item.numero_revision}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      {operation.executor_kind === 'ORDEN_OPERACION'
                        && outputArticle
                        && compatibleApprovedStructures.length === 0 && (
                        <Alert
                          severity="warning"
                          sx={{ flexBasis: '100%' }}
                          action={(
                            <Button
                              color="inherit"
                              size="small"
                              onClick={() => goToStructuresForArticle(outputArticle.id)}
                            >
                              Ir a Estructuras BOM
                            </Button>
                          )}
                        >
                          No existe una BOM aprobada cuyo resultado sea {outputArticle.codigo}.
                          Crea o publica la revisión correcta antes de continuar.
                        </Alert>
                      )}
                      {operation.tipo === 'PREARMADO' && (
                        <FormControlLabel
                          sx={{ minWidth: 230, m: 0 }}
                          control={(
                            <Checkbox
                              checked={operation.permite_concurrente}
                              onChange={(event) => {
                                const next = [...routeForm.operaciones];
                                next[index] = { ...operation, permite_concurrente: event.target.checked };
                                setRouteForm({ ...routeForm, operaciones: next });
                              }}
                            />
                          )}
                          label="Permite ejecución concurrente"
                        />
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                const operations = [
                  ...routeForm.operaciones,
                  {
                    ...newOperation(routeForm.operaciones.length + 1),
                    clave: nextOperationKey(routeForm.operaciones),
                  },
                ];
                setRouteForm({
                  ...routeForm,
                  operaciones: normalizeRouteOutputs(
                    operations,
                    routeTargetArticle?.id,
                    articlesById,
                  ),
                });
              }}
              sx={{ alignSelf: 'flex-start' }}
            >
              Agregar operación
            </Button>
            {routeFormBlockingReasons.length > 0 && (
              <Alert severity="info">
                <Typography variant="body2" fontWeight={800}>
                  Completa lo siguiente para crear el borrador:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {routeFormBlockingReasons.map((reason) => (
                    <Typography component="li" variant="body2" key={reason}>
                      {reason}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={saving || routeForm.operaciones.some((operation) => (
              !operation.clave.trim()
              || !operation.nombre.trim()
              || !operation.tipo
              || !operation.executor_kind
              || !operation.centro_trabajo_id
              || !operation.articulo_salida_id
              || (
                operation.executor_kind === 'ORDEN_OPERACION'
                && !operation.estructura_revision_id
              )
            ))}
            onClick={saveRoute}
          >
            {editingRoute ? 'Guardar borrador' : 'Crear borrador'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={routeStepToDelete !== null}
        onClose={() => setRouteStepToDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar paso de la ruta</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            El Paso {routeStepToDelete === null ? '' : routeStepToDelete + 1} contiene datos.
            Al eliminarlo, el sistema recalculará la secuencia y la salida terminal.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRouteStepToDelete(null)}>Conservar paso</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => removeRouteOperation(routeStepToDelete)}
          >
            Confirmar eliminación
          </Button>
        </DialogActions>
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
        <DialogTitle>{editingProfile ? 'Editar perfil empacable' : 'Nuevo perfil empacable'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={editingProfile ? 'Código' : 'Código automático'}
              value={editingProfile?.codigo || 'PEM-######'}
              disabled
            />
            <TextField label="Nombre" value={profileForm.nombre} onChange={(event) => setProfileForm({ ...profileForm, nombre: event.target.value })} />
            <TextField multiline minRows={3} label="Descripción física" value={profileForm.descripcion_fisica} onChange={(event) => setProfileForm({ ...profileForm, descripcion_fisica: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!profileForm.nombre.trim() || saving}
            onClick={() => runMutation(
              () => editingProfile
                ? actualizarPerfilEmpacableScm(editingProfile.id, {
                  version: editingProfile.version,
                  nombre: profileForm.nombre,
                  descripcion_fisica: profileForm.descripcion_fisica || null,
                })
                : crearPerfilEmpacableScm({
                  nombre: profileForm.nombre,
                  descripcion_fisica: profileForm.descripcion_fisica || null,
                }),
              editingProfile ? 'Perfil empacable actualizado.' : 'Perfil empacable creado.',
            )}
          >
            {editingProfile ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'rule'} onClose={() => setDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>{editingRule ? 'Editar regla de empaque' : 'Nueva regla de empaque'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <FormControl fullWidth>
                <InputLabel>Perfil empacable</InputLabel>
                <Select label="Perfil empacable" value={ruleForm.perfil_empacable_id} onChange={(event) => setRuleForm({ ...ruleForm, perfil_empacable_id: event.target.value })} disabled={Boolean(editingRule)}>
                  {profiles.map((profile) => <MenuItem key={profile.id} value={String(profile.id)}>{profile.codigo} · {profile.nombre}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Tipo de contenedor</InputLabel>
                <Select label="Tipo de contenedor" value={ruleForm.tipo_contenedor_id} onChange={(event) => setRuleForm({ ...ruleForm, tipo_contenedor_id: event.target.value })} disabled={Boolean(editingRule)}>
                  {containers.map((container) => <MenuItem key={container.id} value={String(container.id)}>{container.codigo} · {container.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={ruleForm.medicion_fisica_probada} onChange={(event) => setRuleForm({ ...ruleForm, medicion_fisica_probada: event.target.checked })} />}
              label="Acomodo máximo validado mediante prueba física"
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField fullWidth label="Cantidad operativa objetivo (un)" helperText="Carga recomendada; la capacidad final puede ser menor." type="number" value={ruleForm.cantidad_objetivo_un} onChange={(event) => setRuleForm({ ...ruleForm, cantidad_objetivo_un: event.target.value })} />
              <TextField fullWidth label="Máximo físico por acomodo (un)" helperText="Techo por geometría, volumen, anidamiento y manipulación." type="number" value={ruleForm.cantidad_maxima_probada_un} onChange={(event) => setRuleForm({ ...ruleForm, cantidad_maxima_probada_un: event.target.value })} />
              <TextField fullWidth label="Límite neto operativo (kg)" helperText="Con el peso unitario del artículo determina el techo por peso." type="number" value={ruleForm.peso_neto_operativo_max_kg} onChange={(event) => setRuleForm({ ...ruleForm, peso_neto_operativo_max_kg: event.target.value })} />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField fullWidth label="Margen seguridad (kg)" type="number" value={ruleForm.margen_seguridad_kg} onChange={(event) => setRuleForm({ ...ruleForm, margen_seguridad_kg: event.target.value })} />
              <TextField fullWidth label="Tolerancia absoluta (g)" type="number" value={ruleForm.tolerancia_peso_abs_g} onChange={(event) => setRuleForm({ ...ruleForm, tolerancia_peso_abs_g: event.target.value })} />
              <TextField fullWidth label="Tolerancia (%)" type="number" value={ruleForm.tolerancia_peso_pct} onChange={(event) => setRuleForm({ ...ruleForm, tolerancia_peso_pct: event.target.value })} />
            </Stack>
            <TextField multiline minRows={2} label="Notas" value={ruleForm.notas} onChange={(event) => setRuleForm({ ...ruleForm, notas: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              saving
              || !ruleForm.perfil_empacable_id
              || !ruleForm.tipo_contenedor_id
              || Number(ruleForm.cantidad_objetivo_un) <= 0
              || Number(ruleForm.cantidad_maxima_probada_un) <= 0
              || Number(ruleForm.peso_neto_operativo_max_kg) <= 0
            }
            onClick={() => runMutation(
              () => {
                const values = {
                  medicion_fisica_probada: ruleForm.medicion_fisica_probada,
                  cantidad_objetivo_un: Number(ruleForm.cantidad_objetivo_un),
                cantidad_maxima_probada_un: Number(ruleForm.cantidad_maxima_probada_un),
                peso_neto_operativo_max_kg: Number(ruleForm.peso_neto_operativo_max_kg),
                margen_seguridad_kg: Number(ruleForm.margen_seguridad_kg),
                tolerancia_peso_abs_g: Number(ruleForm.tolerancia_peso_abs_g),
                  tolerancia_peso_pct: Number(ruleForm.tolerancia_peso_pct),
                  notas: ruleForm.notas || null,
                };
                return editingRule
                  ? actualizarReglaEmpaqueScm(editingRule.revision_id, {
                    ...values,
                    version: editingRule.version,
                  })
                  : crearReglaEmpaqueScm({
                    ...values,
                    perfil_empacable_id: Number(ruleForm.perfil_empacable_id),
                    tipo_contenedor_id: Number(ruleForm.tipo_contenedor_id),
                  });
              },
              editingRule ? 'Borrador de regla actualizado.' : 'Borrador de regla creado.',
            )}
          >
            {editingRule ? 'Guardar borrador' : 'Crear borrador'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ScmEngineeringAdmin;
