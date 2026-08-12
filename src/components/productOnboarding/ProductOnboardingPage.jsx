import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  aplicarPasoAltaProducto,
  crearAltaProducto,
  finalizarAltaProducto,
  guardarPasoAltaProducto,
  listarAltasProducto,
  obtenerAltaProducto,
  obtenerResultadosDeAplicacion,
  obtenerSesionActualDeAplicacion,
  obtenerSesionActualDeConflicto,
  restaurarColoresDesdeEstructura,
  subirImagenAltaProducto,
  validarAltaProducto,
} from '../../services/scmProductOnboardingApi';
import OnboardingActions from './OnboardingActions';
import OnboardingAssistant from './OnboardingAssistant';
import OnboardingPhaseRail from './OnboardingPhaseRail';
import OnboardingImagePanel from './OnboardingImagePanel';
import ProductIdentityStep from './ProductIdentityStep';
import ProductComponentsStep from './ProductComponentsStep';
import ProductColorsStep from './ProductColorsStep';
import ProductStructureStep from './ProductStructureStep';
import ProductRoutePackagingStep from './ProductRoutePackagingStep';
import ProductReviewStep from './ProductReviewStep';
import {
  normalizeReviewData,
  reviewIsConfirmed,
} from './reviewStepModel';
import {
  identityIsComplete,
  normalizeIdentityData,
  ONBOARDING_STEPS,
  prerequisiteBlocker,
  stepByCode,
  stepBySlug,
} from './onboardingModel';
import {
  colorsAreComplete,
  componentsAreComplete,
  createMatrix,
  normalizeColorsData,
  normalizeComponentsData,
  serializeColorsData,
  serializeComponentsData,
} from './technicalStepModel';
import {
  normalizeRoutePackagingStepData,
  normalizeStructureStepData,
  serializeRoutePackagingStepData,
  serializeStructureStepData,
} from './engineeringStepModel';

const getApiMessage = (error, fallback) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const currentStepRecord = (session, code) => (
  session?.pasos?.find((step) => step.codigo === code) || {
    codigo: code, estado: 'PENDIENTE', data: {}, bloqueos: [],
  }
);

const serializeIdentityData = (value) => {
  const identity = normalizeIdentityData(value);
  const mode = identity.modo === 'SELECCIONAR' ? 'REUTILIZAR' : identity.modo;
  return {
    modo: mode,
    ...(mode === 'REUTILIZAR' ? {
      producto_ref: identity.producto_ref?.cod_sku_pt || identity.producto_ref,
    } : {}),
    ...(mode === 'COPIAR' ? {
      producto_fuente_ref: identity.producto_fuente_ref?.cod_sku_pt
        || identity.producto_fuente_ref,
    } : {}),
    producto: {
      producto: identity.producto.producto.trim(),
      linea_id: Number(identity.producto.linea_id),
      familia_id: Number(identity.producto.familia_id),
      peso_g: identity.producto.peso_g === '' ? null : Number(identity.producto.peso_g),
      marca: identity.producto.marca.trim() || null,
      ...(identity.producto.doc_x_paq === '' || identity.producto.doc_x_paq == null
        ? {} : { doc_x_paq: Number(identity.producto.doc_x_paq) }),
      ...(identity.producto.doc_x_bulto === '' || identity.producto.doc_x_bulto == null
        ? {} : { doc_x_bulto: Number(identity.producto.doc_x_bulto) }),
      ...(identity.producto.codigo_barra
        ? { codigo_barra: identity.producto.codigo_barra.trim() }
        : {}),
      ...(identity.producto.um ? { um: identity.producto.um.trim() } : {}),
    },
    procedencia: identity.procedencia,
  };
};

const applicationKeyMemory = new Map();

const applicationStorageKey = (draftId, stepCode) => (
  `envaperu.alta-producto.${draftId}.${stepCode}.application-key`
);

const createApplicationKey = (stepCode) => {
  const unique = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${stepCode.toLowerCase()}-${unique}`.slice(0, 100);
};

const rememberApplicationKey = (draftId, stepCode, value) => {
  const storageKey = applicationStorageKey(draftId, stepCode);
  applicationKeyMemory.set(storageKey, value);
  try {
    globalThis.localStorage?.setItem(storageKey, value);
  } catch {
    // El borrador sigue protegido en memoria cuando el navegador bloquea storage.
  }
  return value;
};

const applicationKeyFor = (draftId, stepCode, preferred = null) => {
  const storageKey = applicationStorageKey(draftId, stepCode);
  if (preferred) return rememberApplicationKey(draftId, stepCode, preferred);
  let stored = null;
  try {
    stored = globalThis.localStorage?.getItem(storageKey);
  } catch {
    stored = null;
  }
  return stored
    || applicationKeyMemory.get(storageKey)
    || rememberApplicationKey(draftId, stepCode, createApplicationKey(stepCode));
};

const clearApplicationKey = (draftId, stepCode) => {
  const storageKey = applicationStorageKey(draftId, stepCode);
  applicationKeyMemory.delete(storageKey);
  try {
    globalThis.localStorage?.removeItem(storageKey);
  } catch {
    // Sin storage persistente no queda nada adicional que limpiar.
  }
};

const stepReferences = (session, code) => {
  const references = session?.referencias || {};
  if (references[code]) return references[code];
  if (code === 'IDENTIDAD' && references.producto_terminado_id) return references;
  return {};
};

const engineeringStepCanReopen = (code, references = {}) => {
  if (code === 'ESTRUCTURA') return references.estado === 'BORRADOR';
  if (code !== 'RUTA_EMPAQUE') return false;
  const packaging = references.empaques || [];
  return references.ruta_estado === 'BORRADOR'
    && packaging.length > 0
    && packaging.every((item) => (
      (item.regla_estado || item.estado) === 'BORRADOR'
    ));
};

const sameReference = (candidate, values) => (
  candidate !== null
  && candidate !== undefined
  && values.some((value) => value !== null
    && value !== undefined
    && String(value) === String(candidate))
);

const sessionImages = (session) => (
  Array.isArray(session?.imagenes) ? session.imagenes : []
);

const existingImageFor = (session, entityType, entityId) => sessionImages(session).find(
  (image) => (
    String(image.entity_type || image.tipo_entidad) === String(entityType)
    && String(image.entity_id || image.entidad_id) === String(entityId)
  ),
);

const imageTargetsFor = ({ stepCode, data, session, componentsData }) => {
  if (stepCode === 'IDENTIDAD') {
    const identity = normalizeIdentityData(data);
    const references = stepReferences(session, 'IDENTIDAD');
    const entityId = references.producto_terminado_id
      || references.producto_ref
      || session?.producto_terminado_id
      || null;
    return [{
      key: 'PRODUCTO_TERMINADO:PT',
      entityType: 'PRODUCTO_TERMINADO',
      entityId,
      label: identity.producto.producto || session?.titulo || 'Producto Terminado',
      existingImage: entityId
        ? existingImageFor(session, 'PRODUCTO_TERMINADO', entityId)
        : null,
    }];
  }
  if (stepCode !== 'COLORES') return [];

  const references = stepReferences(session, 'COLORES');
  const colors = normalizeColorsData(data, references);
  const matrix = createMatrix(componentsData.piezas, colors.colores, colors.matriz);
  return componentsData.piezas.flatMap((piece) => colors.colores.flatMap((color) => {
    const pieceIds = [piece.client_id, piece.ref, piece.pieza_ref?.id];
    const colorIds = [color.client_id, color.color_ref];
    const cell = matrix.find((item) => (
      sameReference(item.pieza_ref || item.pieza_client_id, pieceIds)
      && sameReference(item.color_ref || item.color_client_id, colorIds)
    ));
    if (!cell || cell.seleccionada === false) return [];
    const resolved = (references.matriz || []).find((item) => (
      sameReference(item.pieza_ref || item.pieza_client_id, pieceIds)
      && sameReference(item.color_ref || item.color_client_id, colorIds)
    ));
    const entityId = cell.pieza_color_ref || resolved?.pieza_color_ref || null;
    const pieceName = piece.nombre || piece.pieza_ref?.nombre || `Pieza ${piece.ref}`;
    const colorName = color.nombre || `Color ${color.color_ref || color.client_id}`;
    return [{
      key: `PIEZA_COLOR:${piece.client_id || piece.ref}:${color.client_id || color.color_ref}`,
      entityType: 'PIEZA_COLOR',
      entityId,
      label: `${pieceName} · ${colorName}`,
      existingImage: entityId ? existingImageFor(session, 'PIEZA_COLOR', entityId) : null,
    }];
  }));
};

const normalizeStepData = (code, data, session) => {
  if (code === 'IDENTIDAD') {
    const identity = normalizeIdentityData(data);
    const references = stepReferences(session, code);
    const productId = references.producto_terminado_id || references.producto_ref;
    if (!productId) return identity;
    return {
      ...identity,
      modo: 'SELECCIONAR',
      producto_ref: {
        ...identity.producto,
        cod_sku_pt: productId,
      },
    };
  }
  if (code === 'COMPONENTES') {
    return normalizeComponentsData(data, stepReferences(session, code));
  }
  if (code === 'COLORES') {
    return normalizeColorsData(data, stepReferences(session, code));
  }
  if (code === 'ESTRUCTURA') {
    return normalizeStructureStepData(data, stepReferences(session, code));
  }
  if (code === 'RUTA_EMPAQUE') {
    return normalizeRoutePackagingStepData(data, stepReferences(session, code));
  }
  if (code === 'REVISION') return normalizeReviewData(data, session?.readiness);
  return data || {};
};

function OnboardingLanding() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarAltasProducto()
      .then((payload) => {
        const items = Array.isArray(payload) ? payload : payload?.items || [];
        setDrafts(items.filter((item) => !['FINALIZADA', 'ABANDONADA'].includes(item.estado)));
      })
      .catch(() => setError('No se pudieron consultar las altas en curso.'))
      .finally(() => setLoading(false));
  }, []);

  const createDraft = async () => {
    setCreating(true);
    setError('');
    try {
      const session = await crearAltaProducto({ titulo: 'Nuevo Producto Terminado' });
      navigate(`/datos-maestros/alta-producto/${session.id}/identidad`, { replace: true });
    } catch (requestError) {
      setError(getApiMessage(requestError, 'No se pudo iniciar el alta.'));
      setCreating(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 1260, mx: 'auto' }}>
      <Paper
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 2.5, md: 4 },
          color: 'common.white',
          background: 'linear-gradient(125deg, #142d4c 0%, #1e4f78 62%, #247d78 130%)',
          boxShadow: '0 22px 54px rgba(20,45,76,.22)',
          '&::after': {
            content: '""', position: 'absolute', width: 290, height: 290,
            right: -90, top: -150, borderRadius: '50%', bgcolor: 'rgba(125,226,200,.17)',
          },
        }}
      >
        <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>
          <Chip
            icon={<AutoAwesomeRoundedIcon />}
            label="Experiencia guiada"
            sx={{ alignSelf: 'flex-start', color: 'common.white', bgcolor: 'rgba(255,255,255,.14)' }}
          />
          <Box>
            <Typography component="h1" variant="h3" sx={{ fontWeight: 900, fontSize: { xs: 30, md: 43 } }}>
              Alta integral de Producto Terminado
            </Typography>
            <Typography sx={{ mt: 1, color: 'rgba(255,255,255,.82)', maxWidth: 740, lineHeight: 1.65 }}>
              {'Una sola sesi\u00f3n para capturar identidad, componentes, colores, estructura, ruta y empaque con trazabilidad desde la fuente.'}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="inherit"
            startIcon={creating ? <CircularProgress size={18} /> : <AddRoundedIcon />}
            onClick={createDraft}
            disabled={creating}
            sx={{ alignSelf: 'flex-start', color: 'primary.main', px: 2.25 }}
          >
            Iniciar nuevo producto
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 850 }}>Continuar una carga</Typography>
        <Typography variant="body2" color="text.secondary">
          Los borradores se guardan en el servidor y pueden retomarse desde otro equipo.
        </Typography>
      </Box>
      {loading ? <LinearProgress /> : drafts.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {drafts.map((draft) => {
            const active = stepByCode(draft.paso_actual) || ONBOARDING_STEPS[0];
            return (
              <Paper key={draft.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 850 }}>
                        {currentStepRecord(draft, 'IDENTIDAD')?.data?.producto?.producto
                          || draft.titulo
                          || 'Producto sin nombre'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Fase actual: {active.label}
                      </Typography>
                    </Box>
                    <HistoryRoundedIcon color="action" />
                  </Stack>
                  <Button
                    component={RouterLink}
                    to={`/datos-maestros/alta-producto/${draft.id}/${active.slug}`}
                    endIcon={<ArrowForwardRoundedIcon />}
                    variant="outlined"
                  >
                    Reanudar
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay altas pendientes.</Typography>
        </Paper>
      )}
    </Stack>
  );
}

function OnboardingDraft({ draftId, stepId }) {
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const autosaveTimer = useRef(null);
  const sessionRef = useRef(null);
  const stepDataRef = useRef({});
  const dirtyRef = useRef(false);
  const localRevisionRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const imageEntriesRef = useRef({});
  const activeStepCodeRef = useRef('IDENTIDAD');
  const loadedStepCodeRef = useRef(null);
  const [session, setSession] = useState(null);
  const [stepData, setStepData] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [error, setError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [applicationResults, setApplicationResults] = useState({});
  const [engineeringValidity, setEngineeringValidity] = useState({
    ESTRUCTURA: false,
    RUTA_EMPAQUE: false,
  });
  const [completionMessage, setCompletionMessage] = useState('');
  const [superseding, setSuperseding] = useState({});
  const [restoringColors, setRestoringColors] = useState(false);
  const [imageEntries, setImageEntries] = useState({});
  const handleProductsChange = useCallback((items) => setProducts(items), []);
  const handleEngineeringValidity = useCallback((code, valid) => {
    setEngineeringValidity((current) => (
      current[code] === valid ? current : { ...current, [code]: valid }
    ));
  }, []);

  const activeStep = stepBySlug(stepId)
    || stepByCode(session?.paso_actual)
    || ONBOARDING_STEPS[0];
  const activeIndex = ONBOARDING_STEPS.findIndex((step) => step.code === activeStep.code);
  const activeRecord = currentStepRecord(session, activeStep.code);
  const activeBlocker = prerequisiteBlocker(session, activeStep.code);
  const activeReferences = stepReferences(session, activeStep.code);
  const sessionFinalized = session?.estado === 'FINALIZADA';
  const activeSupersedesKey = superseding[activeStep.code] || null;
  const activeColorsPending = activeStep.code === 'COLORES'
    && activeRecord.estado === 'EN_PROGRESO'
    && (activeRecord.application_status?.pending || []).length > 0;
  const activeCanReopen = (
    activeStep.code === 'COMPONENTES'
  ) || (
    ['ESTRUCTURA', 'RUTA_EMPAQUE'].includes(activeStep.code)
      && engineeringStepCanReopen(activeStep.code, activeReferences)
  ) || activeColorsPending;
  const activeMaterialized = !activeSupersedesKey
    && ['IDENTIDAD', 'COMPONENTES', 'COLORES', 'ESTRUCTURA', 'RUTA_EMPAQUE']
    .includes(activeStep.code)
    && (activeRecord.application_status?.status === 'APPLIED'
      || activeRecord.application_status?.status === 'REPLAYED'
      || activeRecord.estado === 'COMPLETADO')
    && Object.keys(activeReferences).length > 0;
  const componentsRecord = currentStepRecord(session, 'COMPONENTES');
  const componentsData = normalizeComponentsData(
    componentsRecord.data,
    stepReferences(session, 'COMPONENTES'),
  );
  const productRef = session?.producto_terminado_id
    || stepReferences(session, 'IDENTIDAD').producto_terminado_id
    || stepReferences(session, 'IDENTIDAD').producto_ref
    || null;
  const imageTargets = useMemo(() => imageTargetsFor({
    stepCode: activeStep.code,
    data: stepData,
    session,
    componentsData,
  }), [activeStep.code, componentsData, session, stepData]);
  activeStepCodeRef.current = activeStep.code;

  const updateImageEntry = useCallback((key, updater) => {
    setImageEntries((current) => {
      const previous = current[key] || {};
      const nextEntry = typeof updater === 'function' ? updater(previous) : updater;
      const next = { ...current, [key]: nextEntry };
      imageEntriesRef.current = next;
      return next;
    });
  }, []);

  const replaceLocalStep = useCallback((data, { saved = true } = {}) => {
    localRevisionRef.current += 1;
    stepDataRef.current = data;
    dirtyRef.current = !saved;
    setStepData(data);
    setDirty(!saved);
  }, []);

  const replaceSession = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    const serverResults = Object.fromEntries((nextSession?.pasos || [])
      .filter((step) => step.application_status)
      .map((step) => [step.codigo, step.application_status]));
    Object.entries(serverResults).forEach(([code, result]) => {
      if (result.status === 'PARTIAL' && result.application_key) {
        rememberApplicationKey(draftId, code, result.application_key);
      } else if (result.status === 'APPLIED' || result.status === 'REPLAYED') {
        clearApplicationKey(draftId, code);
      }
    });
    setApplicationResults(serverResults);
  }, [draftId]);

  useEffect(() => () => {
    Object.values(imageEntriesRef.current).forEach((entry) => {
      if (entry.previewUrl && globalThis.URL?.revokeObjectURL) {
        globalThis.URL.revokeObjectURL(entry.previewUrl);
      }
    });
  }, []);

  const uploadImage = useCallback(async (target, entry) => {
    if (!target?.entityId || !entry?.file) return { ok: false, skipped: true };
    updateImageEntry(target.key, (current) => ({
      ...current,
      status: 'UPLOADING',
      error: '',
      entityId: target.entityId,
    }));
    try {
      const nextSession = await subirImagenAltaProducto(
        draftId,
        target.entityType,
        target.entityId,
        {
          file: entry.file,
          expectedVersion: sessionRef.current.version,
          applicationKey: entry.applicationKey,
        },
      );
      replaceSession(nextSession);
      updateImageEntry(target.key, (current) => ({
        ...current,
        status: 'DONE',
        entityId: target.entityId,
        imageUrl: nextSession.image_results?.imagen_url
          || existingImageFor(nextSession, target.entityType, target.entityId)?.imagen_url
          || current.previewUrl,
        error: '',
      }));
      return { ok: true, session: nextSession };
    } catch (requestError) {
      const currentSession = obtenerSesionActualDeConflicto(requestError)
        || obtenerSesionActualDeAplicacion(requestError);
      if (currentSession) replaceSession(currentSession);
      const message = getApiMessage(
        requestError,
        'No se pudo guardar la imagen. El archivo sigue disponible para reintentar.',
      );
      updateImageEntry(target.key, (current) => ({
        ...current,
        status: 'ERROR',
        entityId: target.entityId,
        error: message,
      }));
      return { ok: false, error: message };
    }
  }, [draftId, replaceSession, updateImageEntry]);

  const selectImage = useCallback((target, file) => {
    const previous = imageEntriesRef.current[target.key];
    if (previous?.previewUrl && globalThis.URL?.revokeObjectURL) {
      globalThis.URL.revokeObjectURL(previous.previewUrl);
    }
    const previewUrl = globalThis.URL?.createObjectURL
      ? globalThis.URL.createObjectURL(file)
      : '';
    const entry = {
      file,
      previewUrl,
      applicationKey: createApplicationKey('IMAGEN'),
      status: 'LOCAL',
      error: '',
      entityId: target.entityId || null,
    };
    updateImageEntry(target.key, entry);
    if (target.entityId) uploadImage(target, entry);
  }, [updateImageEntry, uploadImage]);

  const uploadPendingImages = useCallback(async (targets) => {
    const failures = [];
    for (const target of targets) {
      const entry = imageEntriesRef.current[target.key];
      if (!entry?.file || entry.status === 'DONE' || !target.entityId) continue;
      // Cada upload incrementa la versión; el siguiente usa sessionRef fresca.
      const result = await uploadImage(target, entry);
      if (!result.ok) failures.push({ target, result });
    }
    return failures;
  }, [uploadImage]);

  const applySession = useCallback((nextSession, preferredCode = null) => {
    replaceSession(nextSession);
    const code = preferredCode || activeStep.code || nextSession.paso_actual || 'IDENTIDAD';
    const record = currentStepRecord(nextSession, code);
    replaceLocalStep(normalizeStepData(code, record.data, nextSession));
    loadedStepCodeRef.current = code;
    setSaveState('saved');
  }, [activeStep.code, replaceLocalStep, replaceSession]);

  useEffect(() => {
    contentRef.current?.focus?.();
  }, [activeStep.code]);

  useEffect(() => {
    const warnIfDirty = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    globalThis.addEventListener?.('beforeunload', warnIfDirty);
    return () => globalThis.removeEventListener?.('beforeunload', warnIfDirty);
  }, [dirty]);

  const writeStep = useCallback(async ({
    expectedVersion,
    data,
    state = 'EN_PROGRESO',
    silent = false,
    stepCode = activeStepCodeRef.current,
  }) => {
    if (!sessionRef.current) return null;
    const snapshotRevision = localRevisionRef.current;
    const snapshot = data;
    if (!silent) setBusy(true);
    setSaveState('saving');
    setError('');
    const queuedSave = saveQueueRef.current
      .catch(() => null)
      .then(async () => {
        try {
          // Una escritura previa en la cola puede haber incrementado la versión.
          // Siempre usamos la sesión fresca, salvo que aún no exista una.
          const version = sessionRef.current?.version ?? expectedVersion;
          const next = await guardarPasoAltaProducto(draftId, stepCode, {
            expected_version: version,
            data: snapshot,
            estado_paso: state,
          });
          replaceSession(next);
          setConflict(null);

          const snapshotStillCurrent = (
            localRevisionRef.current === snapshotRevision
            && activeStepCodeRef.current === stepCode
          );
          if (snapshotStillCurrent) {
            stepDataRef.current = snapshot;
            dirtyRef.current = false;
            setStepData(snapshot);
            setDirty(false);
            setSaveState('saved');
          } else {
            // La respuesta confirma la nueva versión del servidor, pero nunca
            // reemplaza texto que el usuario escribió mientras estaba en vuelo.
            dirtyRef.current = true;
            setDirty(true);
            setSaveState('idle');
          }
          return next;
        } catch (requestError) {
          const current = obtenerSesionActualDeConflicto(requestError);
          if (current) setConflict({ current, localData: snapshot, state, stepCode });
          setSaveState('error');
          if (!silent) setError(getApiMessage(requestError, 'No se pudo guardar el paso.'));
          return null;
        } finally {
          if (!silent) setBusy(false);
        }
      });
    saveQueueRef.current = queuedSave;
    return queuedSave;
  }, [draftId, replaceSession]);

  useEffect(() => {
    let effectActive = true;
    const loadRequestedStep = async () => {
      const requestedFromUrl = stepBySlug(stepId);
      const previousCode = loadedStepCodeRef.current;

      // Back/Forward también es navegación SPA. Si cambió el segmento de ruta,
      // persistimos el paso anterior antes de aceptar el nuevo contenido.
      if (previousCode && requestedFromUrl && previousCode !== requestedFromUrl.code && dirtyRef.current) {
        globalThis.clearTimeout(autosaveTimer.current);
        const saved = await writeStep({
          expectedVersion: sessionRef.current?.version,
          data: stepDataRef.current,
          stepCode: previousCode,
        });
        if (!saved) {
          const previous = stepByCode(previousCode);
          if (effectActive && previous) {
            navigate(`/datos-maestros/alta-producto/${draftId}/${previous.slug}`, { replace: true });
          }
          return;
        }
      } else if (previousCode && requestedFromUrl?.code === previousCode && dirtyRef.current) {
        // Reversión de una navegación cuyo guardado falló: conserva el texto local.
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const payload = await obtenerAltaProducto(draftId);
        if (!effectActive) return;
        const requested = requestedFromUrl
          || stepByCode(payload.paso_actual)
          || ONBOARDING_STEPS[0];
        replaceSession(payload);
        const record = currentStepRecord(payload, requested.code);
        replaceLocalStep(normalizeStepData(requested.code, record.data, payload));
        loadedStepCodeRef.current = requested.code;
        setShowValidation(false);
        setConflict(null);
      } catch (requestError) {
        if (effectActive) setError(getApiMessage(requestError, 'No se pudo cargar el borrador.'));
      } finally {
        if (effectActive) setLoading(false);
      }
    };
    loadRequestedStep();
    return () => { effectActive = false; };
  }, [draftId, navigate, replaceLocalStep, replaceSession, stepId, writeStep]);

  useEffect(() => {
    if (!dirty || !session || conflict || activeSupersedesKey) return undefined;
    globalThis.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = globalThis.setTimeout(() => {
      writeStep({ expectedVersion: session.version, data: stepData, silent: true });
    }, 1400);
    return () => globalThis.clearTimeout(autosaveTimer.current);
  }, [activeSupersedesKey, conflict, dirty, session, stepData, writeStep]);

  const changeStepData = (next) => {
    if (activeMaterialized || sessionFinalized) return;
    replaceLocalStep(next, { saved: false });
    setSaveState('idle');
  };

  const navigateStep = async (step, { skipSave = false } = {}) => {
    globalThis.clearTimeout(autosaveTimer.current);
    if (dirtyRef.current && activeSupersedesKey && !skipSave) {
      setError('Aplica o cancela la corrección antes de cambiar de fase. El cambio aún vive sólo en esta pestaña.');
      return;
    }
    if (dirtyRef.current && !skipSave) {
      const saved = await writeStep({
        expectedVersion: sessionRef.current?.version,
        data: stepDataRef.current,
      });
      if (!saved) return;
    }
    navigate(`/datos-maestros/alta-producto/${draftId}/${step.slug}`);
  };

  const save = async () => {
    globalThis.clearTimeout(autosaveTimer.current);
    if (activeSupersedesKey) {
      setError('Esta corrección reemplaza una aplicación previa: usa Aplicar corrección para guardarla de forma atómica.');
      return null;
    }
    if (activeMaterialized || sessionFinalized) return sessionRef.current;
    return writeStep({
      expectedVersion: sessionRef.current?.version,
      data: stepDataRef.current,
    });
  };

  const continueFlow = async () => {
    globalThis.clearTimeout(autosaveTimer.current);
    if (sessionFinalized) return;
    const blocker = prerequisiteBlocker(sessionRef.current, activeStep.code);
    if (blocker) {
      setError(blocker.message);
      contentRef.current?.focus?.();
      return;
    }
    if (activeMaterialized) {
      const next = ONBOARDING_STEPS[activeIndex + 1];
      if (next) await navigateStep(next, { skipSave: true });
      return;
    }
    if (activeStep.code === 'REVISION') {
      setShowValidation(true);
      const reviewData = normalizeReviewData(
        stepDataRef.current,
        sessionRef.current?.readiness,
      );
      if (!reviewIsConfirmed(reviewData, sessionRef.current?.readiness)) {
        setError('Confirma la revisión de fuentes y pendientes antes de finalizar la captura.');
        contentRef.current?.focus?.();
        return;
      }
      setBusy(true);
      setError('');
      setCompletionMessage('');
      try {
        const saved = await writeStep({
          expectedVersion: sessionRef.current?.version,
          data: reviewData,
          state: 'COMPLETADO',
          stepCode: 'REVISION',
        });
        if (!saved) return;
        const validated = await validarAltaProducto(draftId, saved.version);
        replaceSession(validated);
        if (validated.readiness?.status === 'BLOCKED') {
          setError('La validación encontró bloqueos. Corrígelos desde las acciones enlazadas antes de finalizar.');
          return;
        }
        const finalized = await finalizarAltaProducto(draftId, validated.version);
        replaceSession(finalized);
        setCompletionMessage(finalized.readiness?.status === 'READY'
          ? 'Captura finalizada · Listo para planificar.'
          : 'Captura finalizada · Pendiente de aprobación.');
        setSaveState('saved');
      } catch (requestError) {
        const current = obtenerSesionActualDeConflicto(requestError);
        if (current) setConflict({
          current,
          localData: stepDataRef.current,
          state: 'COMPLETADO',
          stepCode: 'REVISION',
        });
        setError(getApiMessage(requestError, 'No se pudo finalizar la captura.'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!['IDENTIDAD', 'COMPONENTES', 'COLORES', 'ESTRUCTURA', 'RUTA_EMPAQUE'].includes(activeStep.code)) {
      const next = ONBOARDING_STEPS[activeIndex + 1];
      if (next) await navigateStep(next);
      return;
    }

    setShowValidation(true);
    let payload;
    let complete = false;
    if (activeStep.code === 'IDENTIDAD') {
      const identity = normalizeIdentityData(stepDataRef.current);
      complete = identityIsComplete(identity, products);
      payload = serializeIdentityData(identity);
    } else if (activeStep.code === 'COMPONENTES') {
      const components = normalizeComponentsData(
        stepDataRef.current,
        stepReferences(sessionRef.current, 'COMPONENTES'),
      );
      complete = componentsAreComplete(components);
      payload = serializeComponentsData(components);
    } else if (activeStep.code === 'COLORES') {
      const colors = normalizeColorsData(
        stepDataRef.current,
        stepReferences(sessionRef.current, 'COLORES'),
      );
      const singleMoldReference = componentsData.moldes.length === 1
        ? componentsData.moldes[0].molde.ref
        : null;
      const withMatrix = {
        ...colors,
        color_molde_ref: singleMoldReference
          ? colors.color_molde_ref || singleMoldReference
          : null,
        matriz: createMatrix(componentsData.piezas, colors.colores, colors.matriz),
      };
      complete = colorsAreComplete(withMatrix, componentsData.piezas);
      payload = serializeColorsData(withMatrix);
    } else if (activeStep.code === 'ESTRUCTURA') {
      complete = Boolean(engineeringValidity.ESTRUCTURA);
      payload = serializeStructureStepData(stepDataRef.current);
    } else {
      complete = Boolean(engineeringValidity.RUTA_EMPAQUE);
      payload = serializeRoutePackagingStepData(stepDataRef.current);
    }

    if (!complete) {
      setError('Completa los campos se\u00f1alados antes de continuar. El borrador incompleto s\u00ed puede guardarse.');
      contentRef.current?.focus?.();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveQueueRef.current.catch(() => null);
      // El comando aplica maestro y checkpoint con una sola clave idempotente.
      const partialKey = applicationResults[activeStep.code]?.status === 'PARTIAL'
        ? applicationResults[activeStep.code].application_key
        : null;
      const applicationKey = applicationKeyFor(draftId, activeStep.code, partialKey);
      const nextSession = await aplicarPasoAltaProducto(draftId, activeStep.code, {
        expected_version: sessionRef.current.version,
        application_key: applicationKey,
        ...(activeSupersedesKey
          ? { supersedes_application_key: activeSupersedesKey }
          : {}),
        data: payload,
      });
      replaceSession(nextSession);
      const result = obtenerResultadosDeAplicacion(nextSession);
      if (result) {
        setApplicationResults((current) => ({ ...current, [activeStep.code]: result }));
      }
      if (result?.status === 'APPLIED' || result?.status === 'REPLAYED') {
        clearApplicationKey(draftId, activeStep.code);
        setSuperseding((current) => {
          const next = { ...current };
          delete next[activeStep.code];
          return next;
        });
      }
      const savedRecord = currentStepRecord(nextSession, activeStep.code);
      const normalizedSavedData = normalizeStepData(
        activeStep.code,
        savedRecord.data,
        nextSession,
      );
      replaceLocalStep(normalizedSavedData);
      loadedStepCodeRef.current = activeStep.code;
      setSaveState('saved');
      setConflict(null);
      const imageFailures = await uploadPendingImages(imageTargetsFor({
        stepCode: activeStep.code,
        data: normalizedSavedData,
        session: nextSession,
        componentsData,
      }));
      if (imageFailures.length > 0) {
        setError('La fase se aplicó, pero una o más imágenes no llegaron al servidor. Reintenta la subida antes de salir.');
        return;
      }
      const next = ONBOARDING_STEPS[activeIndex + 1];
      if (next) navigate(`/datos-maestros/alta-producto/${draftId}/${next.slug}`);
    } catch (requestError) {
      const partialSession = obtenerSesionActualDeAplicacion(requestError);
      const partialResult = obtenerResultadosDeAplicacion(requestError);
      if (partialSession) {
        replaceSession(partialSession);
        const savedRecord = currentStepRecord(partialSession, activeStep.code);
        replaceLocalStep(normalizeStepData(activeStep.code, savedRecord.data, partialSession));
        loadedStepCodeRef.current = activeStep.code;
      }
      if (partialResult) {
        if (partialResult.application_key) {
          rememberApplicationKey(draftId, activeStep.code, partialResult.application_key);
        }
        setApplicationResults((current) => ({ ...current, [activeStep.code]: partialResult }));
      }
      const current = obtenerSesionActualDeConflicto(requestError);
      if (current) setConflict({
        current,
        localData: stepDataRef.current,
        state: 'EN_PROGRESO',
        stepCode: activeStep.code,
      });
      setError(getApiMessage(
        requestError,
        partialSession
          ? 'La aplicación quedó parcial. Las referencias creadas se conservaron; corrige el error y reintenta.'
          : `No se pudo aplicar la fase ${activeStep.label}.`,
      ));
      setSaveState('error');
    } finally {
      setBusy(false);
    }
  };

  const reloadConflict = () => {
    const fresh = conflict.current;
    setConflict(null);
    applySession(fresh, activeStep.code);
  };

  const exitSafely = async () => {
    globalThis.clearTimeout(autosaveTimer.current);
    if (dirtyRef.current && activeSupersedesKey) {
      setError('Aplica o cancela la corrección antes de salir. Aún no se ha materializado ni guardado en el servidor.');
      return;
    }
    if (!dirtyRef.current) {
      navigate('/datos-maestros');
      return;
    }
    const saved = await writeStep({
      expectedVersion: sessionRef.current?.version,
      data: stepDataRef.current,
    });
    if (saved) navigate('/datos-maestros');
  };

  const restoreColorsFromStructure = async () => {
    setRestoringColors(true);
    setError('');
    try {
      const recovered = await restaurarColoresDesdeEstructura(
        draftId,
        sessionRef.current.version,
      );
      replaceSession(recovered);
      const record = currentStepRecord(recovered, 'COLORES');
      replaceLocalStep(normalizeStepData('COLORES', record.data, recovered));
      if (record.application_status?.application_key) {
        setSuperseding((current) => ({
          ...current,
          COLORES: record.application_status.application_key,
        }));
      }
      loadedStepCodeRef.current = 'COLORES';
      setSaveState('saved');
      setShowValidation(false);
      setCompletionMessage(
        `Matriz recuperada: ${recovered.color_recovery?.piezas_color || 0} asociaciones PiezaColor de la BOM vigente. Revísala antes de aplicar.`,
      );
    } catch (requestError) {
      setError(getApiMessage(
        requestError,
        'No se pudo reconstruir la matriz desde la BOM vigente.',
      ));
    } finally {
      setRestoringColors(false);
    }
  };

  const retryConflict = async () => {
    const pending = conflict;
    setConflict(null);
    replaceSession(pending.current);
    await writeStep({
      expectedVersion: pending.current.version,
      data: pending.localData,
      state: pending.state,
      stepCode: pending.stepCode || activeStep.code,
    });
  };

  if (loading) {
    return (
      <Stack role="status" aria-label="Cargando alta de producto" alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!session) {
    return <Alert severity="error">{error || 'El borrador no est\u00e1 disponible.'}</Alert>;
  }

  const invalidated = new Set(session.invalidated_steps || []);
  const canRestoreColorsFromStructure = activeStep.code === 'COLORES'
    && activeRecord.estado === 'INVALIDADO'
    && Boolean(stepReferences(session, 'ESTRUCTURA').estructura_revision_ref);
  const completed = (session.pasos || []).filter((step) => step.estado === 'COMPLETADO').length;
  const activeEngineeringInvalid = ['ESTRUCTURA', 'RUTA_EMPAQUE'].includes(activeStep.code)
    && !activeMaterialized
    && !engineeringValidity[activeStep.code];

  return (
    <Stack spacing={2} sx={{ maxWidth: 1460, mx: 'auto' }}>
      <Box
        sx={{
          borderRadius: 3,
          p: { xs: 1.75, md: 2.5 },
          color: 'common.white',
          background: 'linear-gradient(112deg, #163451 0%, #245a78 68%, #27776f 120%)',
          boxShadow: '0 18px 42px rgba(22,52,81,.16)',
        }}
      >
        <Stack
          component="header"
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'flex-start' }}
          spacing={1.25}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h4" sx={{ color: 'common.white', fontWeight: 900 }}>
              Alta integral de producto
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255,255,255,.82)', maxWidth: 920 }}>
              {'Una sesi\u00f3n reanudable para construir maestros coherentes desde su fuente hasta la revisi\u00f3n final.'}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Chip
              label={`${sessionFinalized ? 'Captura finalizada' : 'Borrador'} · v${session.version}`}
              sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,.15)' }}
            />
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={(completed / ONBOARDING_STEPS.length) * 100}
            aria-label={`${completed} de ${ONBOARDING_STEPS.length} fases completas`}
            sx={{ flex: 1, height: 7, borderRadius: 99, bgcolor: 'rgba(255,255,255,.19)', '& .MuiLinearProgress-bar': { bgcolor: '#7de2c8' } }}
          />
          <Typography variant="caption" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
            {completed} / {ONBOARDING_STEPS.length}
          </Typography>
        </Stack>
      </Box>

      {conflict && (
        <Alert
          severity="warning"
          action={(
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
              <Button size="small" onClick={reloadConflict}>{'Cargar versi\u00f3n nueva'}</Button>
              <Button size="small" variant="outlined" onClick={retryConflict}>Reintentar mis cambios</Button>
            </Stack>
          )}
        >
          {'Otra persona guard\u00f3 este borrador. Elige qu\u00e9 versi\u00f3n conservar antes de seguir.'}
        </Alert>
      )}
      {invalidated.size > 0 && (
        <Alert severity="warning" icon={<RefreshRoundedIcon />}>
          {'Un cambio anterior invalid\u00f3 '}{invalidated.size}{' fase(s). El rail las marca para revisarlas sin borrar su historial.'}
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {completionMessage && !sessionFinalized && (
        <Alert severity="success">{completionMessage}</Alert>
      )}
      {sessionFinalized && (
        <Alert severity={session.readiness?.status === 'READY' ? 'success' : 'warning'}>
          {session.readiness?.status === 'READY'
            ? 'Captura finalizada · Listo para planificar.'
            : 'Captura finalizada · pendiente de aprobación.'}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: '270px minmax(0, 1fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ p: 1, position: { xl: 'sticky' }, top: { xl: 12 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 850 }}>
            Recorrido completo
          </Typography>
          <OnboardingPhaseRail
            session={session}
            activeCode={activeStep.code}
            onSelect={navigateStep}
          />
        </Paper>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <OnboardingAssistant
            stepCode={activeStep.code}
            invalidated={activeRecord.estado === 'INVALIDADO' || invalidated.has(activeStep.code)}
          />
          <Paper
            ref={contentRef}
            tabIndex={-1}
            aria-label={`Fase ${activeStep.label}`}
            variant="outlined"
            sx={{
              p: { xs: 1.5, md: 2.5 },
              minHeight: 440,
              outline: 'none',
              animation: 'phase-enter 210ms ease-out',
              '@keyframes phase-enter': { from: { opacity: 0, transform: 'translateY(7px)' }, to: { opacity: 1, transform: 'none' } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {activeBlocker && (
              <Alert
                severity="warning"
                icon={<LockOutlinedIcon />}
                sx={{ mb: 2, alignItems: 'center' }}
                action={(
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    onClick={() => {
                      const blockerStep = stepByCode(activeBlocker.code);
                      if (blockerStep) navigateStep(blockerStep);
                    }}
                  >
                    Ir a {activeBlocker.label}
                  </Button>
                )}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                  Esta fase todavía está bloqueada
                </Typography>
                <Typography variant="body2">
                  {activeBlocker.message} Puedes revisar el contenido, pero no aplicarlo todavía.
                </Typography>
              </Alert>
            )}
            {canRestoreColorsFromStructure && (
              <Alert
                severity="info"
                sx={{ mb: 2, alignItems: 'center' }}
                action={(
                  <Button
                    variant="contained"
                    size="small"
                    disabled={restoringColors}
                    onClick={restoreColorsFromStructure}
                  >
                    {restoringColors ? 'Restaurando…' : 'Restaurar desde la BOM'}
                  </Button>
                )}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                  La BOM vigente conserva las asociaciones anteriores
                </Typography>
                <Typography variant="body2">
                  Recupera sus PiezaColor existentes como borrador revisable. No crea colores ni duplica SKU.
                </Typography>
              </Alert>
            )}
            {activeMaterialized && (
              <Paper
                variant="outlined"
                sx={{
                  mb: 2,
                  p: { xs: 1.5, sm: 2 },
                  borderColor: activeColorsPending ? 'warning.main' : 'success.light',
                  bgcolor: activeColorsPending ? 'warning.50' : 'success.50',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems={{ md: 'center' }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {activeColorsPending ? 'Esta fase necesita completarse' : 'Fase aplicada a maestros'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {activeColorsPending
                        ? 'Quedaron datos pendientes. Continúa aquí para completar recetas, añadir colores o quitar asociaciones sin borrar maestros compartidos.'
                        : 'Se muestra en modo consulta para evitar reemplazos o invalidaciones accidentales.'}
                    </Typography>
                  </Box>
                  {activeCanReopen ? (
                  <Button
                    variant="contained"
                    color={activeColorsPending ? 'warning' : 'primary'}
                    size="large"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => {
                      setSuperseding((current) => ({
                        ...current,
                        [activeStep.code]: activeRecord.application_status.application_key,
                      }));
                      setError('');
                      setSaveState('idle');
                    }}
                    sx={{ minWidth: { md: 210 }, width: { xs: '100%', md: 'auto' }, flex: '0 0 auto' }}
                  >
                    {activeColorsPending
                      ? 'Completar fase'
                      : activeStep.code === 'COMPONENTES'
                        ? 'Añadir o vincular moldes'
                        : 'Reabrir borrador'}
                  </Button>
                ) : (
                  <Button
                    component={RouterLink}
                    to={activeStep.code === 'IDENTIDAD'
                      ? '/datos-maestros/productos'
                      : activeStep.code === 'COMPONENTES'
                        ? '/datos-maestros/moldes'
                        : activeStep.code === 'COLORES'
                          ? '/datos-maestros/colores'
                          : `/datos-maestros/ingenieria-scm?returnTo=${encodeURIComponent(`/datos-maestros/alta-producto/${draftId}/${activeStep.slug}`)}`}
                    size="large"
                    variant="outlined"
                    sx={{ width: { xs: '100%', md: 'auto' }, flex: '0 0 auto' }}
                  >
                    {['ESTRUCTURA', 'RUTA_EMPAQUE'].includes(activeStep.code)
                      ? 'Abrir Ingeniería SCM'
                      : 'Editar maestro'}
                  </Button>
                )}
                </Stack>
              </Paper>
            )}
            {activeSupersedesKey && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={(
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setSuperseding((current) => {
                        const next = { ...current };
                        delete next[activeStep.code];
                        return next;
                      });
                      const record = currentStepRecord(sessionRef.current, activeStep.code);
                      replaceLocalStep(normalizeStepData(
                        activeStep.code,
                        record.data,
                        sessionRef.current,
                      ));
                    }}
                  >
                    Cancelar corrección
                  </Button>
                )}
              >
                Editas la misma revisión en borrador. Al aplicar se enviará una nueva clave
                que sustituye explícitamente a la aplicación anterior; no se crea un reemplazo
                silencioso.
              </Alert>
            )}
            {['IDENTIDAD', 'COLORES'].includes(activeStep.code) && (
              <OnboardingImagePanel
                title={activeStep.code === 'IDENTIDAD'
                  ? 'Imagen del Producto Terminado'
                  : 'Muestras visuales por PiezaColor'}
                description={activeStep.code === 'IDENTIDAD'
                  ? 'La imagen se vincula al SKU del Producto Terminado cuando Identidad queda aplicada.'
                  : 'Cada muestra se vincula a la combinación PiezaColor resuelta. No se guarda base64 en el borrador.'}
                targets={imageTargets}
                entries={imageEntries}
                disabled={sessionFinalized}
                onSelect={selectImage}
                onRetry={(target) => uploadImage(
                  target,
                  imageEntriesRef.current[target.key],
                )}
              />
            )}
            <Box
              component="fieldset"
              disabled={activeMaterialized || sessionFinalized}
              aria-label={activeMaterialized || sessionFinalized
                ? `Datos aplicados de ${activeStep.label}`
                : undefined}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              {activeStep.code === 'IDENTIDAD' ? (
                <ProductIdentityStep
                  value={stepData}
                  onChange={changeStepData}
                  onProductsChange={handleProductsChange}
                  showValidation={showValidation}
                />
              ) : activeStep.code === 'COMPONENTES' ? (
                <ProductComponentsStep
                  value={stepData}
                  onChange={changeStepData}
                  resolvedReferences={stepReferences(session, 'COMPONENTES')}
                  applicationResult={applicationResults.COMPONENTES}
                  showValidation={showValidation}
                />
              ) : activeStep.code === 'COLORES' ? (
                <ProductColorsStep
                  value={stepData}
                  onChange={changeStepData}
                  pieces={componentsData.piezas}
                  moldReference={componentsData.moldes.length === 1
                    ? componentsData.moldes[0].molde.ref
                    : null}
                  resolvedReferences={stepReferences(session, 'COLORES')}
                  applicationResult={applicationResults.COLORES}
                  images={sessionImages(session)}
                  imageEntries={imageEntries}
                  showValidation={showValidation}
                />
              ) : activeStep.code === 'ESTRUCTURA' ? (
                <ProductStructureStep
                  value={stepData}
                  onChange={changeStepData}
                  productRef={productRef}
                  resolvedReferences={stepReferences(session, 'ESTRUCTURA')}
                  applicationResult={applicationResults.ESTRUCTURA}
                  onValidityChange={(valid) => handleEngineeringValidity('ESTRUCTURA', valid)}
                  showValidation={showValidation}
                />
              ) : activeStep.code === 'RUTA_EMPAQUE' ? (
                <ProductRoutePackagingStep
                  value={stepData}
                  onChange={changeStepData}
                  productRef={productRef}
                  resolvedReferences={stepReferences(session, 'RUTA_EMPAQUE')}
                  applicationResult={applicationResults.RUTA_EMPAQUE}
                  onValidityChange={(valid) => handleEngineeringValidity('RUTA_EMPAQUE', valid)}
                  showValidation={showValidation}
                />
              ) : (
                <ProductReviewStep
                  value={stepData}
                  onChange={changeStepData}
                  readiness={session.readiness}
                  busy={busy}
                  showValidation={showValidation}
                  onValidate={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      if (dirtyRef.current) {
                        const saved = await save();
                        if (!saved) return;
                      }
                      const next = await validarAltaProducto(
                        draftId,
                        sessionRef.current.version,
                      );
                      replaceSession(next);
                    } catch (requestError) {
                      setError(getApiMessage(requestError, 'No se pudo ejecutar la validación.'));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onOpenStep={(code) => {
                    const target = stepByCode(code);
                    if (target) navigateStep(target);
                  }}
                />
              )}
            </Box>
          </Paper>
        </Stack>
      </Box>

      <OnboardingActions
        canGoBack={activeIndex > 0}
        busy={busy}
        saveState={saveState}
        onBack={() => navigateStep(ONBOARDING_STEPS[activeIndex - 1])}
        onSave={save}
        onContinue={continueFlow}
        onExit={exitSafely}
        continueDisabled={Boolean(activeBlocker) || activeEngineeringInvalid}
        continueHint={activeBlocker?.message
          || (activeEngineeringInvalid ? 'Completa los datos y permisos requeridos para aplicar esta fase.' : '')}
        saveDisabled={activeMaterialized || Boolean(activeSupersedesKey)}
        saveHint={activeMaterialized
          ? activeCanReopen
            ? 'La fase está protegida. Usa “Completar fase” para habilitar sus acciones.'
            : 'La fase ya fue aplicada. Edítala desde su maestro canónico para conservar trazabilidad.'
          : activeSupersedesKey
            ? 'La corrección se registra únicamente con “Aplicar corrección”.'
            : ''}
        finalized={sessionFinalized}
        continueLabel={activeSupersedesKey
          ? 'Aplicar corrección'
          : activeStep.code === 'IDENTIDAD'
          ? activeMaterialized ? 'Continuar' : 'Guardar y continuar'
          : ['COMPONENTES', 'COLORES'].includes(activeStep.code)
            ? activeMaterialized ? 'Continuar' : 'Aplicar y continuar'
          : ['ESTRUCTURA', 'RUTA_EMPAQUE'].includes(activeStep.code)
            ? activeMaterialized ? 'Continuar'
              : activeSupersedesKey ? 'Aplicar corrección'
                : 'Aplicar y continuar'
            : activeIndex === ONBOARDING_STEPS.length - 1
              ? 'Finalizar captura'
              : 'Ir a la siguiente fase'}
      />
    </Stack>
  );
}

export default function ProductOnboardingPage() {
  const { draftId, stepId } = useParams();
  if (!draftId) return <OnboardingLanding />;
  return <OnboardingDraft draftId={draftId} stepId={stepId} />;
}
