import { Fragment } from 'react';
import {
  Alert, Box, Button, Chip, Collapse, IconButton,
  LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import ProductionColorLabel from './ui/ProductionColorLabel';
import { projectOrderProgress, runNetMetrics } from './fabricationOrdersModel';
import { formatKg, formatGrams } from '../utils/weightDisplay';
import WeightInput from './ui/WeightInput';
import SearchableCatalogAutocomplete from './ui/SearchableCatalogAutocomplete';
import { fabricationProcessLabel, routeOptionsForRun } from './fabricationRoutes';

const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const recipeLineAmount = (line, recipe) => {
  if (line.tipo_componente === 'MATERIA_PRIMA') {
    return `${Number(line.cantidad * 100).toLocaleString('es-PE', { maximumFractionDigits: 2 })}% de la mezcla`;
  }
  const base = line.base_kg ?? recipe.base_virgen_kg;
  return `${Number(line.cantidad).toLocaleString('es-PE', { maximumFractionDigits: 4 })} g / ${Number(base).toLocaleString('es-PE', { maximumFractionDigits: 3 })} kg virgen`;
};

function ProgressCell({ progress, run }) {
  const row = progress?.rows?.find((item) => item.run?.id === run.id)?.progress;
  if (!progress || progress.state === 'restricted') return <Typography variant="body2" color="text.secondary">Avance restringido</Typography>;
  if (progress.state === 'error') return <Typography variant="body2" color="text.secondary">Avance no disponible · usa Actualizar</Typography>;
  if (!row) return <Typography variant="body2" color="text.secondary">{progress.label || 'Sin cobertura'}</Typography>;
  const finalKg = finiteOrNull(row.kg_finalizados_efectivos);
  const savedTargetValue = finiteOrNull(run.objetivo_neto_kg);
  const savedTarget = savedTargetValue != null && savedTargetValue > 0 ? savedTargetValue : null;
  const valid = finalKg != null && finalKg >= 0 && savedTarget != null;
  const percentage = valid ? (finalKg / savedTarget) * 100 : null;
  if (progress.state !== 'ready') {
    return (
      <Stack spacing={0.25}>
        <Typography variant="body2">{progress.label || 'Avance parcial'}</Typography>
        {finalKg != null && finalKg > 0 && (
          <Typography variant="caption" color="text.secondary" title={`${row.kg_finalizados_efectivos} kg (valor original)`}>
            {formatKg(finalKg)} kg finalizados conocidos
          </Typography>
        )}
        {row.kg_medidos_en_abiertas != null && (
          <Typography variant="caption" color="text.secondary" title={`${row.kg_medidos_en_abiertas} kg (valor original)`}>
            {formatKg(row.kg_medidos_en_abiertas)} kg en abiertas
          </Typography>
        )}
      </Stack>
    );
  }
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" title={valid ? `${row.kg_finalizados_efectivos} / ${run.objetivo_neto_kg} kg (valores originales)` : undefined}>{valid ? `${formatKg(finalKg)} / ${formatKg(savedTarget)} kg` : progress.label}</Typography>
      {progress.state === 'ready' && valid && (
        <>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, percentage))}
            color={percentage >= 95 ? 'success' : percentage >= 80 ? 'warning' : 'error'}
            aria-label={`Avance ${percentage.toFixed(1)} por ciento`}
            sx={{ height: 6, borderRadius: 3, minWidth: 90 }}
          />
          <Typography variant="caption" color="text.secondary">{percentage.toFixed(1)}% · meta guardada</Typography>
        </>
      )}
      {row.kg_medidos_en_abiertas != null && <Typography variant="caption" color="text.secondary" title={`${row.kg_medidos_en_abiertas} kg (valor original)`}>{formatKg(row.kg_medidos_en_abiertas)} kg en abiertas</Typography>}
    </Stack>
  );
}

export default function FabricationObjectivesTable({
  order,
  form,
  selectedMold,
  recipes,
  canEdit,
  progress,
  onChangeRun,
  onChangeOutput,
  onOpenRecipe,
  expandedRuns,
  onToggleRun,
  routeOptionsByArticle = {},
  routeLoading = false,
  routeReadOnly = false,
}) {
  const globalProgress = progress?.state === 'ready'
    ? `Avance global: ${formatKg(progress.kgFinalizados)} / ${formatKg(progress.metaTotal)} kg · ${progress.percentage.toFixed(1)}%`
    : progress?.state === 'restricted'
      ? 'Avance global: restringido por permisos'
      : progress?.state === 'error'
        ? 'Avance global: no disponible · usa Actualizar'
        : progress?.kgFinalizados > 0
          ? `Avance global: ${formatKg(progress.kgFinalizados)} kg finalizados conocidos · ${progress.label || 'Avance parcial'}`
          : `Avance global: ${progress?.label || 'Sin cobertura'}`;

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary" aria-live="polite" title={progress?.state !== 'restricted' && progress?.kgFinalizados != null ? `${progress.kgFinalizados} kg finalizados / ${progress.metaTotal ?? '—'} kg de meta (valores originales)` : undefined}>{globalProgress}</Typography>
      <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Objetivos de fabricación">
        <TableHead>
          <TableRow>
            <TableCell>Color / objetivo</TableCell>
            <TableCell align="right">Meta neta (kg)</TableCell>
            <TableCell>Ciclos y kg alcanzables</TableCell>
            <TableCell>Avance</TableCell>
            <TableCell>Receta seleccionada</TableCell>
            <TableCell aria-label="Detalle" />
          </TableRow>
        </TableHead>
        <TableBody>
          {order.corridas.map((run, runIndex) => {
            const draftRun = form.corridas[runIndex] || {};
            const metrics = runNetMetrics(run, draftRun, selectedMold);
            const savedObjective = finiteOrNull(run.objetivo_neto_kg);
            const draftObjectiveValue = finiteOrNull(draftRun.objetivo_neto_kg);
            const targetEdited = draftObjectiveValue !== savedObjective;
            const expanded = Boolean(expandedRuns[run.id]);
            const colorName = run.color_nombre || run.color?.nombre || run.color_produccion?.nombre || `Color ${run.color_produccion_id || 'sin asignar'}`;
            const rowProgress = progress?.rows?.find((item) => item.run?.id === run.id)?.progress;
            const runProgress = !progress || progress.state === 'restricted' || progress.state === 'error'
              ? progress
              : projectOrderProgress({ corridas: [run] }, rowProgress ? [rowProgress] : [], { loading: progress.state === 'loading' });
            const selectedRecipe = (recipes || []).find((recipe) => Number(recipe.id) === Number(draftRun.receta_revision_id))
              || (Number(run.receta?.id) === Number(draftRun.receta_revision_id) ? run.receta : null);
            const objectiveRequired = order.estado === 'BORRADOR'
              && order.origen_demanda !== 'REEMPLAZO_OF'
              && !draftRun.legacyWithoutNetTarget;
            const routeOptions = routeOptionsForRun(run, routeOptionsByArticle);
            const selectedRoute = routeOptions.find((option) => String(option.operacion_ruta_revision_id)
              === String(draftRun.operacion_ruta_revision_id))
              || (run.operacion_ruta && draftRun.operacion_ruta_revision_id ? {
                ...run.operacion_ruta,
                operacion_ruta_revision_id: run.operacion_ruta_revision_id,
                nombre: run.operacion_ruta.nombre || `Operación ${run.operacion_ruta_revision_id}`,
                proceso: run.operacion_ruta.tipo,
              } : null);
            return (
              <Fragment key={run.id}>
                <TableRow hover>
                  <TableCell>
                    <ProductionColorLabel name={colorName} hex={run.color_identidad?.hex ?? run.color_hex} />
                    <Typography variant="caption" color="text.secondary">{run.codigo || run.id}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 190 }}>
                      <WeightInput
                      size="small"
                      positive
                      type="number"
                      label={`Objetivo neto (kg) · ${runIndex + 1}`}
                      required={objectiveRequired}
                       value={draftRun.objetivo_neto_kg ?? ''}
                      disabled={!canEdit || order.estado !== 'BORRADOR' || order.origen_demanda === 'REEMPLAZO_OF'}
                       onChange={(event) => onChangeRun(runIndex, { objetivo_neto_kg: event.target.value })}
                       unit="kg"
                       error={objectiveRequired && !metrics.hasObjective}
                      helperText={objectiveRequired && !metrics.hasObjective
                        ? 'Obligatorio para este objetivo de color nuevo: indica kg netos para calcular ciclos antes de guardar.'
                        : 'Se cubre la demanda y se redondea a ciclos completos; los kg reales vienen del pesaje.'}
                    />
                    {targetEdited && (
                      <Typography variant="caption" color="warning.main">
                        {savedObjective == null
                          ? 'Meta aún no guardada; el avance no se recalcula hasta guardar.'
                          : `Meta editada; avance usa ${formatKg(savedObjective)} kg guardados.`}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 155 }}>
                    <Typography fontWeight={750}>{metrics.hasObjective || draftRun.legacyWithoutNetTarget ? `${metrics.cycles} ciclos calculados` : 'Se calculará al indicar kg'}</Typography>
                    <Typography display="block" variant="caption" color="text.secondary" title={metrics.reachableKg != null ? `${metrics.reachableKg} kg (valor original)` : undefined}>
                      {metrics.reachableKg != null ? `${formatKg(metrics.reachableKg)} kg alcanzables` : 'Se calculará con molde y meta'}
                    </Typography>
                    {metrics.roundingKg != null && <Typography display="block" variant="caption" color="text.secondary" title={`${metrics.roundingKg} kg (valor original)`}>redondeo de {formatKg(metrics.roundingKg)} kg</Typography>}
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}><ProgressCell progress={runProgress} run={run} /></TableCell>
                  <TableCell sx={{ minWidth: 260, maxWidth: 380 }}>
                      <Stack spacing={1}>
                        <FabricationRecipeSelector
                          idPrefix={`of-${order.id}-row-${run.id}`}
                          run={run}
                          colorId={draftRun.color_produccion_id}
                          recipes={recipes}
                          value={draftRun.receta_revision_id}
                          frozenRecipe={run.receta}
                          editable={canEdit && order.estado === 'BORRADOR'}
                          compact
                          onChange={(recipeId) => onChangeRun(runIndex, { receta_revision_id: recipeId })}
                          onOpenWorkspace={undefined}
                        />
                      {!selectedRecipe && (
                        <Alert severity="warning" sx={{ py: 0 }}>
                          {onOpenRecipe
                            ? 'Este color no tiene una formulación aprobada compatible.'
                            : 'Este color no tiene una formulación aprobada compatible. solicita administración de artículos.'}
                        </Alert>
                      )}
                      <SearchableCatalogAutocomplete
                        id={`of-${order.id}-row-${run.id}-route`}
                        label="Operación de ruta (opcional)"
                        options={routeOptions}
                        value={selectedRoute}
                        onChange={(option) => onChangeRun(runIndex, {
                          operacion_ruta_revision_id: option?.operacion_ruta_revision_id || null,
                        })}
                        getOptionKey={(option) => option?.operacion_ruta_revision_id}
                        getPrimary={(option) => `${option?.nombre || `Operación ${option?.id}`} · ${fabricationProcessLabel(option?.proceso || option?.tipo)}`}
                        getSecondary={(option) => {
                          const outputName = option?.articulo_salida?.nombre;
                          const outputCode = option?.articulo_salida?.codigo;
                          if (outputName || outputCode) return [outputName, outputCode].filter(Boolean).join(' · ');
                          return option?.ruta_numero_revision ? `Ruta rev. ${option.ruta_numero_revision}` : '';
                        }}
                        getSearchText={(option) => [option?.nombre, option?.proceso, option?.tipo, option?.articulo_salida?.nombre, option?.articulo_salida?.codigo].filter(Boolean).join(' ')}
                        loading={routeLoading}
                        disabled={!canEdit || routeReadOnly || order.estado !== 'BORRADOR' || order.origen_demanda === 'REEMPLAZO_OF'}
                        noOptionsText={routeLoading ? 'Cargando rutas compatibles…' : 'Sin ruta aprobada para la salida exacta'}
                        helperText="APROBADA · OP_OT · salida exacta del color/molde"
                      />
                      {order.estado !== 'BORRADOR' && selectedRecipe && <Chip size="small" color="success" variant="outlined" label="Congelada al liberar" sx={{ alignSelf: 'flex-start' }} />}
                      {selectedRecipe?.lineas?.map((line) => (
                        <Stack key={line.id || `${line.material_id}-${line.tipo_componente}`} spacing={0}>
                          <Typography variant="caption" color="text.secondary">{line.material_nombre || `Material ${line.material_id}`}</Typography>
                          <Typography variant="caption" color="text.secondary">{recipeLineAmount(line, selectedRecipe)}</Typography>
                        </Stack>
                      ))}
                      {canEdit && order.estado === 'BORRADOR' && onOpenRecipe && (
                        <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => onOpenRecipe(runIndex)}>Crear o editar aquí</Button>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} composición de ${colorName}`}
                      aria-expanded={expanded}
                      aria-controls={`run-detail-${run.id}`}
                      onClick={() => onToggleRun(run.id)}
                    >
                      <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
                {(run.salidas || []).map((output) => {
                  const derived = output.articulo?.pieza_id != null;
                  const moldShape = (selectedMold?.formas || []).find((shape) => shape.activo !== false && shape.pieza_id === output.articulo?.pieza_id);
                  const unitWeight = output.peso_unitario_snapshot_g ?? moldShape?.peso_unitario_gr;
                  return (
                    <TableRow key={`summary-${output.id}`}>
                      <TableCell colSpan={6} sx={{ py: 0.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                          <Typography variant="caption" fontWeight={700}>{output.articulo?.nombre}</Typography>
                          <Typography variant="caption" color="text.secondary">{output.articulo?.codigo}</Typography>
                          {derived && <Typography variant="caption">{output.articulo?.clase === 'PRODUCTO_TERMINADO' ? 'PT monopieza' : 'Pieza-Color'} · derivado</Typography>}
                          {derived && <Typography variant="caption" color="text.secondary">{output.articulo?.derivacion_molde === 'PT_MONOPIEZA' ? 'Componente único del PT' : 'Cavidades activas'}</Typography>}
                          {derived && <Typography variant="caption" color="text.secondary">{output.cantidad_por_ciclo_snapshot || moldShape?.cavidades || 'Del molde'}</Typography>}
                          {derived && <Typography variant="caption" color="text.secondary">Neto de una unidad</Typography>}
                          {derived && <Typography variant="caption" color="text.secondary" title={unitWeight != null ? `${unitWeight} g (valor original)` : undefined}>{unitWeight != null ? `${formatGrams(unitWeight)} g` : 'Del molde'}</Typography>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 0, borderBottom: expanded ? undefined : 0 }}>
                    <Collapse id={`run-detail-${run.id}`} in={expanded} unmountOnExit>
                      <Box sx={{ py: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Composición y salidas del objetivo. Expandir otra fila no oculta este detalle.
                        </Typography>
                        <FabricationRecipeSelector
                          idPrefix={`of-${order.id}-run-${run.id}`}
                          run={run}
                          colorId={draftRun.color_produccion_id}
                          recipes={recipes}
                          value={draftRun.receta_revision_id}
                          frozenRecipe={run.receta}
                          editable={canEdit && order.estado === 'BORRADOR'}
                          onChange={(recipeId) => onChangeRun(runIndex, { receta_revision_id: recipeId })}
                          onOpenWorkspace={onOpenRecipe ? () => onOpenRecipe(runIndex) : undefined}
                        />
                        <Table size="small" aria-label={`Salidas de ${colorName}`}>
                          <TableHead><TableRow><TableCell>Salida</TableCell><TableCell>Clase</TableCell><TableCell align="right">Demanda</TableCell><TableCell align="right">Por ciclo</TableCell><TableCell align="right">Peso unitario</TableCell><TableCell align="right">Excedente</TableCell></TableRow></TableHead>
                          <TableBody>{(run.salidas || []).map((output, outputIndex) => {
                            const derived = output.articulo?.pieza_id != null;
                            const moldShape = (selectedMold?.formas || []).find((shape) => shape.activo !== false && shape.pieza_id === output.articulo?.pieza_id);
                            const outputForm = draftRun.salidas?.[outputIndex] || {};
                            const unitWeight = output.peso_unitario_snapshot_g ?? moldShape?.peso_unitario_gr;
                            return (
                              <TableRow key={output.id}>
                                <TableCell>{output.articulo?.nombre}<br /><Typography variant="caption">{output.articulo?.codigo}</Typography></TableCell>
                                <TableCell>{output.articulo?.clase || '—'}</TableCell>
                                <TableCell align="right">{output.cantidad_objetivo} un</TableCell>
                              <TableCell align="right">{derived ? (output.cantidad_por_ciclo_snapshot || moldShape?.cavidades || 'Del molde') : <TextField size="small" type="number" value={outputForm.cantidad_por_ciclo ?? ''} disabled={!canEdit || order.estado !== 'BORRADOR' || order.origen_demanda === 'REEMPLAZO_OF'} onChange={(event) => onChangeOutput(runIndex, outputIndex, 'cantidad_por_ciclo', event.target.value)} />}</TableCell>
                                <TableCell align="right" title={derived && unitWeight != null ? `${unitWeight} g (valor original)` : undefined}>{derived ? (unitWeight != null ? `${formatGrams(unitWeight)} g` : 'Del molde') : <WeightInput size="small" unit="g" positive required label={`Peso unitario de ${output.articulo?.nombre || outputIndex + 1} (g)`} value={outputForm.peso_unitario_g ?? ''} disabled={!canEdit || order.estado !== 'BORRADOR' || order.origen_demanda === 'REEMPLAZO_OF'} onChange={(event) => onChangeOutput(runIndex, outputIndex, 'peso_unitario_g', event.target.value)} />}</TableCell>
                                <TableCell align="right">{output.excedente_objetivo} un</TableCell>
                              </TableRow>
                            );
                          })}</TableBody>
                        </Table>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      </TableContainer>
    </Stack>
  );
}
