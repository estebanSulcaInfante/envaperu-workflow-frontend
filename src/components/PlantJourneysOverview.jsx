import {
  Alert, Box, Button, Card, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CheckIcon from '@mui/icons-material/Check';

const stateLabel = (value) => String(value || '').replaceAll('_', ' ');
const compactQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat('es-PE').format(parsed) : '0';
};
const assemblyModeText = (value) => (
  value === 'CONCURRENTE' ? 'Concurrente con fabricación' : 'En mesa de armado'
);
const assemblyOrderCode = (ot) => ot?.orden_armado?.codigo
  || ot?.orden_operacion?.codigo
  || ot?.orden_fabricacion?.codigo
  || 'OA';
const assemblyOrderId = (ot) => ot?.orden_armado?.id || ot?.orden_operacion_id || '';
const journeyLink = ({ ot, filters, returnTo }) => {
  const params = new URLSearchParams();
  const orderId = assemblyOrderId(ot);
  if (orderId) params.set('oa', orderId);
  if (ot?.public_id) params.set('ot', ot.public_id);
  if (filters?.fecha_operativa) params.set('fecha', filters.fecha_operativa);
  if (filters?.turno) params.set('turno', filters.turno);
  params.set('modo', 'armado');
  if (returnTo) params.set('return_to', returnTo);
  return `/produccion/ordenes-armado?${params.toString()}`;
};

const centerKey = (center) => String(
  center?.id || center?.codigo || center?.nombre || 'sin-centro',
);

function AssemblyDailyBoard({
  ots, centers, filters, selectedOtId, journeysReturnTo,
}) {
  const initialGroups = centers.reduce((result, center) => {
    result[centerKey(center)] = { center, ots: [] };
    return result;
  }, {});
  const groups = Object.values(ots.reduce((result, ot) => {
    const center = ot.centro_trabajo || {};
    const key = centerKey(center);
    if (!result[key]) result[key] = { center, ots: [] };
    result[key].ots.push(ot);
    return result;
  }, initialGroups));

  if (!groups.length) {
    return (
      <Alert
        severity="info"
        action={(
          <Button component={RouterLink} to="/produccion/ordenes-armado" size="small">
            Abrir OA
          </Button>
        )}
      >
        No hay jornadas de Armado para esta fecha y turno.
      </Alert>
    );
  }

  return (
    <Box
      data-testid="daily-assembly-board"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
        gap: 1.5,
      }}
    >
      {groups.map(({ center, ots: centerOts }) => (
        <Card key={center.id || center.codigo || center.nombre || 'sin-centro'} variant="outlined">
          <Box sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography component="h3" variant="h6" fontWeight={900}>
                  {center.nombre || 'Centro de Armado no informado'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {center.codigo || `${centerOts.length} jornada(s)`}
                </Typography>
              </Box>
              {!centerOts.length && (
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Stack spacing={0.75}>
                    <Typography fontWeight={850}>Sin jornada para este turno</Typography>
                    <Typography variant="body2" color="text.secondary">
                      El centro está disponible, pero todavía no tiene una OT de Armado.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to={journeyLink({ filters, returnTo: journeysReturnTo })}
                      size="small"
                      variant="outlined"
                    >
                      Abrir OA
                    </Button>
                  </Stack>
                </Paper>
              )}
              {centerOts.map((ot) => {
                const oaCode = assemblyOrderCode(ot);
                const mode = ot.modo_ejecucion_armado || ot.modo_ejecucion_ensamble;
                const context = ot.trabajo_color_contexto || ot.ot_fabricacion_contexto;
                const output = ot.orden_armado?.salida || null;
                const outputArticle = output?.articulo || null;
                const supply = ot.abastecimiento || null;
                const mangaSummary = ot.mangas_resumen || null;
                const mangaCounts = mangaSummary?.por_estado
                  ? Object.entries(mangaSummary.por_estado)
                    .map(([state, value]) => [
                      stateLabel(state || 'SIN ESTADO'),
                      Number(value?.total ?? value?.cantidad ?? value ?? 0),
                    ])
                    .filter(([, count]) => count > 0)
                  : Object.entries((ot.mangas || []).reduce((result, manga) => {
                    const state = stateLabel(manga.estado || 'SIN ESTADO');
                    result[state] = (result[state] || 0) + 1;
                    return result;
                  }, {}));
                const mangaTotal = mangaSummary?.por_estado
                  ? Object.values(mangaSummary.por_estado).reduce(
                    (total, value) => total + Number(value?.total ?? value?.cantidad ?? value ?? 0),
                    0,
                  )
                  : (ot.mangas || []).length;
                return (
                  <Paper
                    key={ot.public_id}
                    variant="outlined"
                    aria-current={selectedOtId === ot.public_id ? 'true' : undefined}
                    sx={{
                      p: 1.25,
                      bgcolor: selectedOtId === ot.public_id ? 'action.selected' : undefined,
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={850}>{ot.codigo_ot}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            OA: {oaCode}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={ot.estado === 'EN_EJECUCION' ? 'success' : 'default'}
                          label={stateLabel(ot.estado)}
                        />
                      </Stack>
                      <Typography variant="body2">
                        {assemblyModeText(mode)} · {ot.responsable || 'Responsable por asignar'}
                      </Typography>
                      {outputArticle && (
                        <Typography variant="body2" fontWeight={750}>
                          Salida: {outputArticle.codigo} · {outputArticle.nombre}
                        </Typography>
                      )}
                      {mode === 'CONCURRENTE' && context && (
                        <Typography variant="caption" color="text.secondary">
                          Contexto: {context.codigo || context.codigo_ot || 'Trabajo de color'}
                          {context.color ? ` · ${context.color}` : ''}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Avance {compactQuantity(ot.cantidad_confirmada)} / {compactQuantity(ot.cantidad_objetivo)} un
                      </Typography>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        <Chip size="small" variant="outlined" label={`Mangas ${mangaTotal}`} />
                        {mangaCounts.map(([state, count]) => (
                          <Chip key={state} size="small" variant="outlined" label={`${state} ${count}`} />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Abastecimiento: {supply
                          ? `${supply.codigo} · ${stateLabel(supply.estado)}`
                          : 'Sin solicitud'}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to={journeyLink({ ot, filters, returnTo: journeysReturnTo })}
                        size="small"
                        variant="outlined"
                        aria-label={`Abrir ${oaCode} y ${ot.codigo_ot}`}
                      >
                        Abrir OA y jornada
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </Card>
      ))}
    </Box>
  );
}

export default function PlantJourneysOverview({
  filters,
  onFiltersChange,
  onSubmit,
  busy,
  perspective,
  onPerspectiveChange,
  journeyCount,
  runningCount,
  machineCount,
  assemblyCenterCount,
  assemblyOts = [],
  assemblyCenters = [],
  journeysReturnTo = '',
  centerCatalogWarning,
  journeyWarnings = {},
  selectedAssemblyOtId = '',
  machineOptions = [],
  machineFilter = '',
  onMachineFilterChange,
  boardStateFilter = 'TODOS',
  onBoardStateFilterChange,
  boardStatusCounts = { all: 0, withOt: 0, running: 0, withoutOt: 0 },
  embedded = false,
}) {
  const ControlSurface = embedded ? Box : Paper;
  const hasJourneyData = !busy && (
    journeyCount > 0
    || machineCount > 0
    || assemblyCenterCount > 0
    || boardStatusCounts.all > 0
  );
  return (
    <Stack spacing={1.5}>
      <ControlSurface data-testid="plant-journeys-control-band" {...(!embedded ? { variant: 'outlined' } : {})} sx={{ p: 1.25 }}>
      <Box component="form" onSubmit={onSubmit}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
        >
          <Box sx={{ flex: 1, minWidth: { md: 200 } }}>
            <Typography fontWeight={850}>Turno consultado</Typography>
            <Typography variant="body2" color="text.secondary">
              Estos filtros actualizan Fabricación y Armado al mismo tiempo.
            </Typography>
          </Box>
          <TextField
            size="small"
            label="Fecha de jornada"
            type="date"
            value={filters.fecha_operativa}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => onFiltersChange({
              ...filters, fecha_operativa: event.target.value,
            })}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="plant-shift-filter-label">Turno</InputLabel>
            <Select
              labelId="plant-shift-filter-label"
              label="Turno"
              value={filters.turno}
              onChange={(event) => onFiltersChange({
                ...filters, turno: event.target.value,
              })}
            >
              <MenuItem value="DIA">Día</MenuItem>
              <MenuItem value="NOCHE">Noche</MenuItem>
              <MenuItem value="EXTRA">Extra</MenuItem>
            </Select>
          </FormControl>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !filters.fecha_operativa || !filters.turno}
          >
            Actualizar jornadas
          </Button>
        </Stack>
      </Box>

      {hasJourneyData && !(embedded && perspective === 'FABRICACION') && <Stack
        data-testid="plant-journeys-summary"
        role="status"
        aria-live="polite"
        aria-label="Resumen de jornadas de planta"
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1, columnGap: 2, rowGap: 0.75 }}
      >
        {[
          ['Jornadas', journeyCount],
          ['En ejecución', runningCount],
          ['Máquinas', machineCount],
          ['Centros de armado', assemblyCenterCount],
        ].map(([label, count]) => (
          <Box key={label} aria-label={`${label} ${count}`}
            sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={800}
              sx={{ fontVariantNumeric: 'tabular-nums' }}>{count}</Typography>
          </Box>
        ))}
      </Stack>}

      <Tabs
        value={perspective}
        onChange={(_event, value) => onPerspectiveChange(value)}
        aria-label="Perspectiva de jornadas"
        variant="fullWidth"
        sx={{ '& .MuiTab-root': { minHeight: 44, fontWeight: 800 } }}
      >
        <Tab
          id="plant-journeys-tab-fabrication"
          aria-controls="plant-journeys-panel-fabrication"
          value="FABRICACION"
          label="Fabricación · Máquinas"
        />
        <Tab
          id="plant-journeys-tab-assembly"
          aria-controls="plant-journeys-panel-assembly"
          value="ENSAMBLE"
          label="Armado · Centros"
        />
      </Tabs>
      {perspective === 'FABRICACION' && hasJourneyData && (
        <Stack spacing={1}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 260 } }}>
            <InputLabel>Filtrar lista por máquina</InputLabel>
            <Select
              label="Filtrar lista por máquina"
              inputProps={{ 'aria-label': 'Filtrar lista por máquina' }}
              value={machineFilter}
              onChange={(event) => onMachineFilterChange?.(event.target.value)}
            >
              <MenuItem value=""><em>Todas las máquinas</em></MenuItem>
              {machineOptions.map((item) => {
                const primary = item.nombre || item.codigo || item.id;
                const secondary = item.codigo && item.codigo !== primary ? item.codigo : item.id;
                return (
                  <MenuItem key={item.id} value={item.id}>
                    <Box component="span" sx={{ display: 'grid', lineHeight: 1.15 }}>
                      <Typography component="span" variant="body2">{primary}</Typography>
                      {secondary && <Typography component="span" variant="caption" color="text.secondary">{secondary}</Typography>}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Box
            role="group"
            aria-label="Filtrar máquinas por estado de OT"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
          >
            {[
              ['TODOS', 'Todas', boardStatusCounts.all],
              ['CON_OT', 'Con OT', boardStatusCounts.withOt],
              ['EN_EJECUCION', 'En ejecución', boardStatusCounts.running],
              ['SIN_OT', 'Sin OT', boardStatusCounts.withoutOt],
            ].map(([value, text, count]) => {
              const selected = boardStateFilter === value;
              return (
                <Chip
                  key={value}
                  component="button"
                  type="button"
                  role="button"
                  clickable
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  icon={selected ? <CheckIcon aria-hidden="true" /> : undefined}
                  label={`${text} ${count}`}
                  aria-pressed={selected}
                  onClick={() => onBoardStateFilterChange?.(value)}
                  sx={{ minHeight: 44, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
                />
              );
            })}
          </Box>
        </Stack>
      )}
      </ControlSurface>

      {Object.entries(journeyWarnings).map(([family, warning]) => warning && (
        <Alert key={family} severity="warning">{warning}</Alert>
      ))}

      {perspective === 'ENSAMBLE' && (
        <Paper
          id="plant-journeys-panel-assembly"
          role="tabpanel"
          aria-labelledby="plant-journeys-tab-assembly"
          variant="outlined"
          sx={{ p: { xs: 1.5, md: 2 } }}
        >
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="overline" color="primary.main">
                Centros de Armado
              </Typography>
              <Typography component="h2" variant="h6" fontWeight={850}>
                Jornadas distribuidas desde las OA
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abre una jornada para continuar su abastecimiento, mangas y cierre en la OA correspondiente.
              </Typography>
            </Box>
            {centerCatalogWarning && (
              <Alert severity="warning">{centerCatalogWarning}</Alert>
            )}
            {busy
              ? <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress /></Box>
              : (
                <AssemblyDailyBoard
                  ots={assemblyOts}
                  centers={assemblyCenters}
                  filters={filters}
                  selectedOtId={selectedAssemblyOtId}
                  journeysReturnTo={journeysReturnTo}
                />
              )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
