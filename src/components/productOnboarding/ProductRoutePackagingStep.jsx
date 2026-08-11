import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaqueScm,
  listarRutasScm,
  listarTiposContenedorScm,
  mensajeErrorScm,
} from '../../services/scmEngineeringApi';
import { useScmActor } from '../../context/ScmActorContext';
import {
  normalizeRouteRevision,
  RouteRevisionEditor,
} from '../scmEngineering/editors';
import ApplicationResultSummary from './ApplicationResultSummary';
import ProductPackagingAssignmentCard from './ProductPackagingAssignmentCard';
import {
  buildRoutePayloadFromEditor,
  normalizeRoutePackagingStepData,
  routeEditorValue,
  routeOutputArticleIds,
  routePackagingStepErrors,
} from './engineeringStepModel';

const targetProductArticle = (articles, productRef) => articles.find((article) => (
  article.clase === 'PRODUCTO_TERMINADO'
  && String(article.subtipo?.producto_terminado_id) === String(productRef)
));

const ModeSelector = ({ label, value, options, onChange, disabled = false }) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    aria-label={label}
    disabled={disabled}
    onChange={(_, mode) => mode && onChange(mode)}
    sx={{ flexWrap: 'wrap' }}
  >
    {options.map((option) => (
      <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
    ))}
  </ToggleButtonGroup>
);

const DraftAction = ({ id, value, onChange, canPublish, disabled = false }) => (
  <FormControl fullWidth size="small" disabled={disabled}>
    <InputLabel id={`${id}-label`}>Al aplicar</InputLabel>
    <Select
      labelId={`${id}-label`}
      label="Al aplicar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value="GUARDAR_BORRADOR">Guardar como borrador</MenuItem>
      {canPublish && <MenuItem value="PUBLICAR">Publicar directamente</MenuItem>}
    </Select>
  </FormControl>
);

const assignmentSignature = (items = []) => items
  .map((item) => Number(item.articulo_ref))
  .sort((left, right) => left - right)
  .join(',');

const clonePackagingConfiguration = (source, target) => ({
  ...target,
  perfil_empacable: {
    ...source.perfil_empacable,
    payload: source.perfil_empacable.payload
      ? { ...source.perfil_empacable.payload }
      : source.perfil_empacable.payload,
  },
  regla_empaque: {
    ...source.regla_empaque,
    payload: source.regla_empaque.payload
      ? { ...source.regla_empaque.payload }
      : source.regla_empaque.payload,
  },
});

export default function ProductRoutePackagingStep({
  value,
  onChange,
  productRef,
  resolvedReferences,
  applicationResult,
  onValidityChange,
  showValidation = false,
}) {
  const { can } = useScmActor();
  const [catalogs, setCatalogs] = useState({
    articles: [], centers: [], structures: [], routes: [], profiles: [], containers: [], rules: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedStructureArticles = useRef(new Set());
  const targetArticle = targetProductArticle(catalogs.articles, productRef);
  const data = normalizeRoutePackagingStepData(value, resolvedReferences, {
    targetProductRef: productRef,
    targetArticleRef: targetArticle?.id,
  });
  const routeValue = useMemo(
    () => routeEditorValue(data.ruta.payload, targetArticle),
    [data.ruta.payload, targetArticle],
  );
  const outputArticleIds = useMemo(
    () => routeOutputArticleIds(data.ruta.payload, targetArticle?.id),
    [data.ruta.payload, targetArticle?.id],
  );
  const routeRevision = catalogs.routes.find(
    (item) => Number(item.id) === Number(data.ruta.revision_ref),
  ) || null;
  const canViewRoute = can('RUTA_VER');
  const canAdminRoute = can('RUTA_ADMINISTRAR');
  const canViewPackaging = can('EMPAQUE_VER');
  const canAdminPackaging = can('EMPAQUE_ADMINISTRAR');
  const canUseRoute = data.ruta.modo === 'REUTILIZAR' ? canViewRoute : canAdminRoute;
  const canUsePackaging = canAdminPackaging && data.empaques.every((assignment) => (
    ![
      assignment.perfil_empacable.modo,
      assignment.regla_empaque.modo,
    ].includes('REUTILIZAR') || canViewPackaging
  ));
  const capabilityErrors = [
    ...(!canUseRoute ? [data.ruta.modo === 'REUTILIZAR'
      ? 'Se requiere Ruta · ver para vincular una ruta existente.'
      : 'Se requiere Ruta · administrar para crear o editar una ruta.'] : []),
    ...(!canUsePackaging ? ['Falta la capacidad de empaque requerida por el modo seleccionado.'] : []),
    ...(data.ruta.accion === 'PUBLICAR' && !can('RUTA_PUBLICAR_DIRECTO')
      ? ['Se requiere la capacidad de publicación directa de rutas.'] : []),
    ...(data.empaques.some((item) => item.regla_empaque.accion === 'PUBLICAR')
      && !can('EMPAQUE_PUBLICAR_DIRECTO')
      ? ['Se requiere la capacidad de publicación directa de empaque.'] : []),
  ];
  const errors = [
    ...routePackagingStepErrors(data, targetArticle, catalogs.articles),
    ...capabilityErrors,
  ];

  useEffect(() => {
    let active = true;
    Promise.all([
      listarArticulosScm(),
      listarCentrosTrabajoScm(),
      listarTiposContenedorScm(),
      listarPerfilesEmpacablesScm(),
      listarReglasEmpaqueScm(),
    ])
      .then(async ([articles, centers, containers, profiles, rules]) => {
        const target = targetProductArticle(articles, productRef);
        const routes = target ? await listarRutasScm(productRef) : [];
        if (!active) return;
        setCatalogs({
          articles,
          centers,
          containers,
          profiles,
          rules,
          routes,
          structures: [],
        });
      })
      .catch((requestError) => {
        if (active) setError(mensajeErrorScm(
          requestError,
          'No se pudieron cargar ruta y empaque.',
        ));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [productRef]);

  useEffect(() => {
    let active = true;
    const pending = outputArticleIds.filter(
      (articleId) => !loadedStructureArticles.current.has(Number(articleId)),
    );
    pending.forEach((articleId) => loadedStructureArticles.current.add(Number(articleId)));
    if (pending.length === 0) return undefined;
    Promise.allSettled(pending.map((articleId) => listarEstructurasScm(articleId)))
      .then((results) => {
        if (!active) return;
        const received = results
          .filter((result) => result.status === 'fulfilled')
          .flatMap((result) => result.value);
        setCatalogs((current) => {
          const byId = new Map(current.structures.map((item) => [Number(item.id), item]));
          received.forEach((item) => byId.set(Number(item.id), item));
          return { ...current, structures: [...byId.values()] };
        });
      });
    return () => { active = false; };
  }, [outputArticleIds]);

  useEffect(() => {
    if (!targetArticle) return;
    if (data.target_article_ref && data.target_product_ref
      && assignmentSignature(value?.empaques) === assignmentSignature(data.empaques)) return;
    onChange({
      ...data,
      target_product_ref: productRef,
      target_article_ref: targetArticle.id,
    });
  }, [data, onChange, productRef, targetArticle, value?.empaques]);

  useEffect(() => {
    onValidityChange?.(errors.length === 0);
  }, [errors.length, onValidityChange]);

  const updateRoute = (patch) => onChange({
    ...data,
    target_product_ref: data.target_product_ref || productRef,
    target_article_ref: data.target_article_ref || targetArticle?.id || null,
    ruta: { ...data.ruta, ...patch },
  });

  if (loading) {
    return <Stack role="status" alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  }

  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
          5 · Flujo y unidad operativa
        </Typography>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
          Ruta y empaque
        </Typography>
        <Typography color="text.secondary">
          La salida terminal permanece fijada al PT y cada salida conserva su propio empaque.
        </Typography>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {capabilityErrors.length > 0 && (
        <Alert severity="info">
          {capabilityErrors.join(' ')} Solicita el handoff al actor autorizado antes de aplicar.
        </Alert>
      )}
      {!targetArticle && (
        <Alert severity="warning">No se resolvió el Artículo SCM del PT {productRef}.</Alert>
      )}
      <ApplicationResultSummary
        title="Ruta y empaque aplicados"
        result={applicationResult}
        references={resolvedReferences}
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={2}>
          {!canUseRoute && (
            <Alert severity="info">
              {data.ruta.modo === 'REUTILIZAR'
                ? 'Para vincular esta revisión se requiere Ruta · ver.'
                : 'Para crear o editar esta revisión se requiere Ruta · administrar.'}
            </Alert>
          )}
          <ModeSelector
            label="Origen de la ruta"
            value={data.ruta.modo}
            disabled={!canViewRoute && !canAdminRoute}
            options={[
              { value: 'NUEVA', label: 'Nueva ruta' },
              { value: 'REUTILIZAR', label: 'Vincular existente' },
              ...(data.ruta.revision_ref ? [{ value: 'EDITAR', label: 'Editar borrador' }] : []),
            ]}
            onChange={(mode) => updateRoute({
              modo: mode,
              revision_ref: mode === 'NUEVA' ? null : data.ruta.revision_ref,
              expected_version: mode === 'NUEVA' ? null : data.ruta.expected_version,
              accion: mode === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR',
            })}
          />
          {data.ruta.modo === 'REUTILIZAR' && (
            <FormControl fullWidth size="small" disabled={!canViewRoute}>
              <InputLabel id="onboarding-route-existing-label">Ruta existente</InputLabel>
              <Select
                labelId="onboarding-route-existing-label"
                label="Ruta existente"
                value={data.ruta.revision_ref || ''}
                onChange={(event) => {
                  const revision = catalogs.routes.find(
                    (item) => Number(item.id) === Number(event.target.value),
                  );
                  const normalized = normalizeRouteRevision(
                    revision,
                    targetArticle,
                    catalogs.articles,
                  );
                  updateRoute({
                    revision_ref: event.target.value,
                    expected_version: revision?.version || null,
                    accion: 'VINCULAR',
                    payload: revision
                      ? buildRoutePayloadFromEditor(normalized, targetArticle, catalogs.articles)
                      : data.ruta.payload,
                  });
                }}
              >
                {catalogs.routes.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    Rev. {item.numero_revision} · {item.estado}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {data.ruta.modo !== 'REUTILIZAR' && (
            <DraftAction
              id="onboarding-route-action"
              value={data.ruta.accion}
              canPublish={can('RUTA_PUBLICAR_DIRECTO')}
              disabled={!canAdminRoute}
              onChange={(accion) => updateRoute({ accion })}
            />
          )}
          <RouteRevisionEditor
            targetArticle={targetArticle}
            articles={catalogs.articles}
            centers={catalogs.centers}
            structures={catalogs.structures}
            revision={data.ruta.modo === 'EDITAR' ? routeRevision : null}
            value={routeValue}
            onChange={(next) => updateRoute({
              payload: buildRoutePayloadFromEditor(next, targetArticle, catalogs.articles),
            })}
            readOnly={!canUseRoute || data.ruta.modo === 'REUTILIZAR'}
          />
        </Stack>
      </Paper>

      <Box>
        <Typography component="h2" variant="h5" fontWeight={900}>
          Empaque por cada salida
        </Typography>
        <Typography color="text.secondary">
          Cada artículo que sale de la ruta genera su propia manga y conserva una asignación
          explícita. Puedes copiar medidas, pero no se mezclan sus identidades.
        </Typography>
      </Box>
      {data.empaques.length === 0 && (
        <Alert severity="warning">Define las salidas de la ruta para configurar sus mangas.</Alert>
      )}
      {data.empaques.map((assignment) => (
        <ProductPackagingAssignmentCard
          key={assignment.client_id}
          assignment={assignment}
          article={catalogs.articles.find(
            (item) => Number(item.id) === Number(assignment.articulo_ref),
          )}
          profiles={catalogs.profiles}
          rules={catalogs.rules}
          containers={catalogs.containers}
          canView={canViewPackaging}
          canAdmin={canAdminPackaging}
          canPublish={can('EMPAQUE_PUBLICAR_DIRECTO')}
          onChange={(nextAssignment) => onChange({
            ...data,
            empaques: data.empaques.map((item) => (
              item.client_id === assignment.client_id ? nextAssignment : item
            )),
          })}
          onCopyToOthers={data.empaques.length > 1 ? () => onChange({
            ...data,
            empaques: data.empaques.map((item) => (
              item.client_id === assignment.client_id
                ? item
                : clonePackagingConfiguration(assignment, item)
            )),
          }) : null}
        />
      ))}
      {showValidation && errors.length > 0 && <Alert severity="error">{errors.join(' ')}</Alert>}
    </Stack>
  );
}
