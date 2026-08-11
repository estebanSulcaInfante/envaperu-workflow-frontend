import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  listarArticulosScm,
  listarEstructurasScm,
  mensajeErrorScm,
} from '../../services/scmEngineeringApi';
import { useScmActor } from '../../context/ScmActorContext';
import { StructureRevisionEditor } from '../scmEngineering/editors';
import ApplicationResultSummary from './ApplicationResultSummary';
import WipQuickCreateDialog from './WipQuickCreateDialog';
import {
  buildStructurePayloadFromEditor,
  normalizeStructureStepData,
  structureEditorValue,
  structureStepErrors,
} from './engineeringStepModel';

const productArticle = (articles, productRef) => articles.find((article) => (
  article.clase === 'PRODUCTO_TERMINADO'
  && String(article.subtipo?.producto_terminado_id) === String(productRef)
));

export default function ProductStructureStep({
  value,
  onChange,
  productRef,
  resolvedReferences,
  applicationResult,
  onValidityChange,
  showValidation = false,
}) {
  const { can } = useScmActor();
  const data = normalizeStructureStepData(value, resolvedReferences);
  const [catalogs, setCatalogs] = useState({ articles: [], structures: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const targetArticle = productArticle(catalogs.articles, productRef);
  const editorValue = useMemo(
    () => structureEditorValue(data.estructura.payload),
    [data.estructura.payload],
  );
  const contextualWips = data.wips_nuevos.map((wip) => ({
    id: `wip:${wip.client_id}`,
    codigo: 'WIP NUEVO',
    nombre: wip.nombre,
    clase: 'SUBENSAMBLE_WIP',
    onboarding_pending: true,
  }));
  const componentArticles = [...catalogs.articles.filter((article) => (
    article.clase === 'PIEZA_COLOR' || article.clase === 'SUBENSAMBLE_WIP'
  )), ...contextualWips];
  const selectedRevision = catalogs.structures.find(
    (item) => Number(item.id) === Number(data.estructura.revision_ref),
  ) || null;
  const canViewStructure = can('ESTRUCTURA_VER');
  const canAdminStructure = can('ESTRUCTURA_ADMINISTRAR');
  const canCreateWip = can('ARTICULO_ADMINISTRAR') && canAdminStructure;
  const canUseCurrentMode = data.estructura.modo === 'REUTILIZAR'
    ? canViewStructure
    : canAdminStructure;
  const errors = [...structureStepErrors({
    ...data,
    target_article_ref: data.target_article_ref || targetArticle?.id,
  }), ...(!canUseCurrentMode ? [data.estructura.modo === 'REUTILIZAR'
    ? 'Se requiere Estructura · ver para vincular una revisión existente.'
    : 'Se requiere Estructura · administrar para crear o editar una revisión.'] : []),
  ...(data.estructura.accion === 'PUBLICAR' && !can('ESTRUCTURA_PUBLICAR_DIRECTO')
    ? ['Se requiere la capacidad de publicación directa de estructuras.']
    : [])];

  useEffect(() => {
    let active = true;
    listarArticulosScm()
      .then(async (articles) => {
        const target = productArticle(articles, productRef);
        const structures = target ? await listarEstructurasScm(target.id) : [];
        if (!active) return;
        setCatalogs({
          articles,
          structures,
        });
      })
      .catch((requestError) => {
        if (active) setError(mensajeErrorScm(
          requestError,
          'No se pudo cargar el catálogo de ingeniería.',
        ));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [productRef]);

  useEffect(() => {
    if (!targetArticle || data.target_article_ref) return;
    onChange({ ...data, target_article_ref: targetArticle.id });
  }, [data, onChange, targetArticle]);

  useEffect(() => {
    onValidityChange?.(errors.length === 0);
  }, [errors.length, onValidityChange]);

  const updateStructure = (patch) => onChange({
    ...data,
    target_article_ref: data.target_article_ref || targetArticle?.id || null,
    estructura: { ...data.estructura, ...patch },
  });

  if (loading) {
    return <Stack role="status" alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  }

  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
          4 · Ingeniería de producto
        </Typography>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
          BOM y WIP revisionados
        </Typography>
        <Typography color="text.secondary">
          Define la composición con el mismo editor canónico de Ingeniería SCM.
        </Typography>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!targetArticle && (
        <Alert severity="warning">
          El PT {productRef || 'de la sesión'} aún no tiene un Artículo SCM resoluble.
        </Alert>
      )}
      <ApplicationResultSummary
        title="Estructura aplicada"
        result={applicationResult}
        references={resolvedReferences}
      />
      {!canUseCurrentMode && (
        <Alert severity="info">
          {data.estructura.modo === 'REUTILIZAR'
            ? 'Para vincular una revisión necesitas Estructura · ver. Solicita al responsable de ingeniería que complete este paso.'
            : 'Para crear o editar una revisión necesitas Estructura · administrar. Puedes inspeccionar la fase sin aplicar cambios.'}
        </Alert>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={data.estructura.modo}
        aria-label="Origen de la estructura"
        disabled={!canViewStructure && !canAdminStructure}
        onChange={(_, mode) => mode && updateStructure({
          modo: mode,
          revision_ref: mode === 'NUEVA' ? null : data.estructura.revision_ref,
          expected_version: mode === 'NUEVA' ? null : data.estructura.expected_version,
          accion: mode === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR',
        })}
      >
        <ToggleButton value="NUEVA">Nueva revisión</ToggleButton>
        <ToggleButton value="REUTILIZAR">Vincular existente</ToggleButton>
        {data.estructura.revision_ref && <ToggleButton value="EDITAR">Editar borrador</ToggleButton>}
      </ToggleButtonGroup>
      {data.estructura.modo === 'REUTILIZAR' && (
        <FormControl fullWidth>
          <InputLabel id="onboarding-structure-revision-label">Revisión existente</InputLabel>
          <Select
            labelId="onboarding-structure-revision-label"
            label="Revisión existente"
            value={data.estructura.revision_ref || ''}
            disabled={!canViewStructure}
            onChange={(event) => {
              const revision = catalogs.structures.find(
                (item) => Number(item.id) === Number(event.target.value),
              );
              updateStructure({
                revision_ref: event.target.value,
                expected_version: revision?.version || null,
                payload: revision ? buildStructurePayloadFromEditor(
                  structureEditorValue({
                    notas: revision.notas,
                    componentes: revision.componentes,
                  }),
                ) : data.estructura.payload,
              });
            }}
          >
            {catalogs.structures
              .filter((item) => Number(item.articulo_resultado_id) === Number(targetArticle?.id))
              .map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  Rev. {item.numero_revision} · {item.estado}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      )}
      {data.estructura.modo !== 'REUTILIZAR' && (
        <FormControl fullWidth>
          <InputLabel id="onboarding-structure-action-label">Al aplicar</InputLabel>
          <Select
            labelId="onboarding-structure-action-label"
            label="Al aplicar"
            value={data.estructura.accion}
            disabled={!canAdminStructure}
            onChange={(event) => updateStructure({ accion: event.target.value })}
          >
            <MenuItem value="GUARDAR_BORRADOR">Guardar como borrador</MenuItem>
            <MenuItem value="ENVIAR_APROBACION">Enviar a aprobación</MenuItem>
            {can('ESTRUCTURA_PUBLICAR_DIRECTO') && (
              <MenuItem value="PUBLICAR">Publicar directamente</MenuItem>
            )}
          </Select>
        </FormControl>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Button
          variant="outlined"
          disabled={!canCreateWip}
          onClick={() => setWipDialogOpen(true)}
        >
          Crear WIP en esta alta
        </Button>
        <Typography variant="caption" color="text.secondary">
          Se añade al borrador y queda autoseleccionado; no se crea un maestro hasta aplicar.
        </Typography>
      </Stack>
      {!canCreateWip && (
        <Alert severity="info">
          El alta contextual de WIP requiere Artículo · administrar y Estructura · administrar.
        </Alert>
      )}
      <StructureRevisionEditor
        targetArticle={targetArticle}
        componentArticles={componentArticles}
        structures={catalogs.structures}
        revision={data.estructura.modo === 'EDITAR' ? selectedRevision : null}
        value={editorValue}
        onChange={(next) => updateStructure({
          payload: buildStructurePayloadFromEditor(next),
        })}
        readOnly={!canUseCurrentMode || data.estructura.modo === 'REUTILIZAR'}
      />
      <WipQuickCreateDialog
        open={wipDialogOpen}
        onClose={() => setWipDialogOpen(false)}
        existingNames={[
          ...catalogs.articles.filter((item) => item.clase === 'SUBENSAMBLE_WIP')
            .map((item) => item.nombre),
          ...data.wips_nuevos.map((item) => item.nombre),
        ]}
        onCreate={(draft) => {
          const clientId = globalThis.crypto?.randomUUID?.()
            || `wip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const nextWip = { client_id: clientId, ...draft };
          const nextEditor = {
            ...editorValue,
            componentes: editorValue.componentes.some((line) => !line.articulo_id)
              ? editorValue.componentes.map((line) => (
                line.articulo_id ? line : { ...line, articulo_id: `wip:${clientId}` }
              ))
              : [...editorValue.componentes, {
                articulo_id: `wip:${clientId}`,
                cantidad: '1',
                merma_tecnica_pct: '0',
              }],
          };
          onChange({
            ...data,
            target_article_ref: data.target_article_ref || targetArticle?.id || null,
            wips_nuevos: [...data.wips_nuevos, nextWip],
            estructura: {
              ...data.estructura,
              payload: buildStructurePayloadFromEditor(nextEditor),
            },
          });
          setWipDialogOpen(false);
        }}
      />
      {showValidation && errors.length > 0 && (
        <Alert severity="error">{errors.join(' ')}</Alert>
      )}
    </Stack>
  );
}
