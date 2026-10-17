import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, LinearProgress, Stack, TextField, Tooltip, Typography, Grid, MenuItem,
} from '@mui/material';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import FullscreenExitOutlinedIcon from '@mui/icons-material/FullscreenExitOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { listarAvanceOfTvScm } from '../services/scmProductionObservabilityApi';
import { useScmActor } from '../context/ScmActorContext';

const REFRESH_MS = 60_000;
const PAGE_MS = 12_000;
const TV_PART_SIZE = 4;
const TV_VERTICAL_CHROME = 180;
// Measured wide-TV lane height (including row spacing) from the target
// browser fixture. Pieces and outputs are horizontal, so their count does not
// consume additional vertical budget. Narrow layouts add their stacked rows.
const TV_BASE_LANE_HEIGHT = 73;
const TV_CARD_CHROME = 90;
const TV_PIECE_HEIGHT = 24;
const TV_ROW_GAP = 8;
const ACTIVE = new Set(['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION', 'ABIERTA', 'EN_COBERTURA']);
const statusLabels = {
  EN_AVANCE: 'En avance',
  COMPLETADA: 'Completa',
  SOBREPRODUCCION: 'Meta superada',
  SOBRE_REFERENCIA: 'Meta superada',
  SIN_META: 'Sin meta compatible',
  SIN_PESAJES: 'Sin pesajes vigentes',
  SIN_PERMISO_PESAJE: 'Pesajes no visibles',
  INCOMPLETO: 'Evidencia incompleta',
};
const orderStatusLabels = {
  EN_EJECUCION: 'En ejecución',
  EN_COBERTURA: 'En cobertura',
  PROGRAMADA: 'Programada',
  LIBERADA: 'Liberada',
  ABIERTA: 'Abierta',
};

const number = (value, fraction = 0) => value == null
  ? '-'
  : new Intl.NumberFormat('es-PE', { maximumFractionDigits: fraction }).format(value);

function displayColorName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return /^transparente(?:\s+transparente)+$/i.test(name) ? 'Transparente' : (name || 'Color sin nombre');
}

function isTransparentColor(value) {
  return /^transparente(?:\s+transparente)*$/i.test(String(value || '').trim().replace(/\s+/g, ' '));
}

function progressTone(percentage) {
  if (percentage == null) return null;
  if (percentage < 80) return 'error';
  if (percentage < 95) return 'warning';
  return 'success';
}

function metricLabel(output) {
  if (output.unidad === 'KG') {
    if (output.tipo_meta === 'ESTANDAR') return 'Meta estándar (kg)';
    if (output.tipo_meta === 'NETA') return 'Meta neta (kg)';
    return 'Meta (kg)';
  }
  if (output.unidad === 'UN') return 'Meta (un)';
  return 'Meta no definida';
}

function outputIdentity(output) {
  return `${output.corrida_id ?? 'sin-objetivo'}-${output.pieza_color_id ?? output.sku ?? 'sin-color'}`;
}

function canonicalBoardKey(group) {
  const ofKey = group.of_id ?? group.of ?? 'sin-of';
  const moldKey = group.molde_id ?? group.molde?.codigo ?? group.molde?.nombre ?? 'sin-molde';
  if (group.molde_visible !== true || !moldKey || moldKey === 'sin-molde') return `group:${group.group_id}`;
  return `${ofKey}|${moldKey}`;
}

function canonicalColorKey(group) {
  const base = group.color_id != null
    ? `color-id:${group.color_id}`
    : `color-name:${String(group.color || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE') || 'sin-color'}`;
  // Distinct runs with the same display color remain separate objectives in
  // the TV.  Legacy payloads without provenance retain their old lane shape.
  return group.ots || group.provenance ? `${base}|run:${group.corrida_id ?? group.group_id}` : base;
}

function groupProvenanceNote(group) {
  const issues = group.provenance?.issues || [];
  if (issues.includes('OT_ID_AUSENTE') && group.identity?.identity_status === 'COMPLETA') {
    return 'Incluye producción histórica sin OT vinculada';
  }
  return null;
}

function provenanceCount(group) {
  if (Array.isArray(group.ots)) return group.ots.length;
  return group.ot || group.ot_id ? 1 : 0;
}

function provenanceSummary(group) {
  const count = provenanceCount(group);
  if (!count) return groupProvenanceNote(group);
  return `${count} OT${count === 1 ? '' : 's'} vinculada${count === 1 ? '' : 's'}`;
}

function groupIdentityWarning(group) {
  if (group.identity?.identity_status === 'COMPLETA') return null;
  return 'Avance no calculable: falta vincular producción';
}

// eslint-disable-next-line react-refresh/only-export-components
export function calculateTvPageBudget({ viewportHeight = 768, pieceCount = 1, hasAlerts = false, layout = 'wide' } = {}) {
  const availableHeight = Math.max(1, viewportHeight - TV_VERTICAL_CHROME);
  const laneHeight = TV_BASE_LANE_HEIGHT
    // Wide TV lanes render pieces and their outputs horizontally. Their
    // count therefore does not consume additional vertical budget. Narrow
    // layouts retain the conservative estimate because those columns stack.
    + (layout === 'narrow' ? Math.max(0, pieceCount - 1) * 18 : 0)
    + (hasAlerts ? 26 : 0);
  return {
    availableHeight,
    laneHeight,
    maxLanes: Math.max(1, Math.floor(availableHeight / laneHeight)),
  };
}

function estimateLaneHeight(group, pieceCount, layout) {
  const budget = calculateTvPageBudget({
    pieceCount,
    layout,
    hasAlerts: group.identity?.identity_status !== 'COMPLETA',
  });
  // In wide TV mode output cells are horizontal columns in one lane. Only
  // the narrow fallback stacks them and needs the extra conservative height.
  const outputCount = Math.max(1, (group.salidas || []).length);
  return budget.laneHeight + (layout === 'narrow' ? Math.max(0, outputCount - 1) * 42 : 0);
}

// eslint-disable-next-line react-refresh/only-export-components
export function splitTvLanes(groups, { viewportHeight = 768, pieceCount = 1, layout = 'wide' } = {}) {
  const { availableHeight } = calculateTvPageBudget({ viewportHeight, pieceCount, layout });
  const pages = [];
  let current = [];
  let used = 0;
  groups.forEach((group) => {
    const laneHeight = estimateLaneHeight(group, pieceCount, layout);
    if (current.length && used + laneHeight > availableHeight) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(group);
    used += laneHeight;
  });
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

function partPieceCount(part) {
  if (Array.isArray(part.pieceKeys)) return Math.max(1, part.pieceKeys.length);
  if (Array.isArray(part.groups)) return Math.max(1, canonicalPieces(part.groups).length);
  return Math.max(1, new Set((part.rows || []).map(({ output }) => output?.pieza_id ?? output?.pieza)).size);
}

// Estimate a complete compact card, not only one color lane. The estimate is
// deliberately deterministic so TV packing can be tested without a browser
// layout pass. Wide matrices spend a small amount of vertical space on each
// additional piece header; lanes remain the dominant cost.
// eslint-disable-next-line react-refresh/only-export-components
export function estimateTvPartHeight(part, { layout = 'wide' } = {}) {
  if (Number.isFinite(part?.estimatedHeight)) return Math.max(1, part.estimatedHeight);
  const groups = part.groups || [];
  const laneHeight = groups.length
    ? groups.reduce((total, group) => total + estimateLaneHeight(group, partPieceCount(part), layout), 0)
    : calculateTvPageBudget({ pieceCount: partPieceCount(part), layout }).laneHeight;
  const pieceHeight = layout === 'wide' ? Math.max(0, partPieceCount(part) - 1) * TV_PIECE_HEIGHT : 0;
  return TV_CARD_CHROME + laneHeight + pieceHeight;
}

function flushTvRow(rows, parts, height) {
  if (parts.length) rows.push({ parts, height });
}

// Forms stable rows first. A row has at most two cards and never pairs two
// parts from the same OF. Full-width/exclusive cards are barriers of their own.
// Height is the maximum card height in the row, so a page can contain several
// rows without using a masonry layout.
// eslint-disable-next-line react-refresh/only-export-components
export function packTvRows(parts, {
  availableHeight = Number.POSITIVE_INFINITY,
  maxColumns = 2,
  layout = 'wide',
} = {}) {
  const rows = [];
  let current = [];
  let currentHeight = 0;
  const limit = Math.max(1, Math.min(2, maxColumns));
  const pushCurrent = () => {
    flushTvRow(rows, current, currentHeight);
    current = [];
    currentHeight = 0;
  };

  parts.forEach((part) => {
    const height = estimateTvPartHeight(part, { layout });
    const fullWidth = part.exclusive || part.requiresFullWidth || limit < 2;
    const sameOf = current.some((candidate) => candidate.of_id != null && candidate.of_id === part.of_id);
    const wouldOverflow = current.length > 0 && currentHeight > availableHeight;
    if (fullWidth) {
      pushCurrent();
      rows.push({ parts: [part], height });
    } else if (current.length >= limit || sameOf || wouldOverflow) {
      pushCurrent();
      current = [part];
      currentHeight = height;
    } else {
      current.push(part);
      currentHeight = Math.max(currentHeight, height);
    }
  });
  pushCurrent();
  return rows;
}

// Converts stable rows into TV pages. A row that is taller than the available
// viewport is kept intact (there is no safe way to split a card), while normal
// rows are accumulated until the measured height budget is reached.
// eslint-disable-next-line react-refresh/only-export-components
export function packTvPages(parts, {
  availableHeight = 588,
  maxColumns = 2,
  layout = 'wide',
} = {}) {
  const rows = packTvRows(parts, { availableHeight, maxColumns, layout });
  const pages = [];
  let currentRows = [];
  let usedHeight = 0;
  rows.forEach((row) => {
    const nextHeight = usedHeight + (currentRows.length ? TV_ROW_GAP : 0) + row.height;
    if (currentRows.length && nextHeight > availableHeight) {
      pages.push({ rows: currentRows, usedHeight });
      currentRows = [];
      usedHeight = 0;
    }
    currentRows.push(row);
    usedHeight += row.height + (currentRows.length > 1 ? TV_ROW_GAP : 0);
  });
  if (currentRows.length) pages.push({ rows: currentRows, usedHeight });
  return pages.length ? pages : [{ rows: [], usedHeight: 0 }];
}

function groupByPiece(rows) {
  const groups = new Map();
  rows.forEach(({ output }, index) => {
    const key = output.pieza_id != null
      ? `pieza:${output.pieza_id}`
      : `sin-pieza:${output.corrida_id ?? index}:${output.pieza_color_id ?? output.sku ?? index}`;
    if (!groups.has(key)) {
      groups.set(key, {
        pieceId: output.pieza_id ?? null,
        name: output.pieza || 'Pieza sin identificar',
        outputs: [],
      });
    }
    groups.get(key).outputs.push(output);
  });
  return [...groups.values()];
}

function canonicalPieceKey(output) {
  return output.pieza_id != null
    ? `pieza:${output.pieza_id}`
    : `nombre:${output.pieza || 'Pieza sin identificar'}`;
}

function canonicalPieces(groups) {
  const pieces = new Map();
  groups.forEach((group) => (group.salidas || []).forEach((output) => {
    const key = canonicalPieceKey(output);
    if (!pieces.has(key)) pieces.set(key, { key, name: output.pieza || 'Pieza sin identificar', pieceId: output.pieza_id ?? null });
  }));
  return [...pieces.values()];
}

function OutputRow({ output, compact = false, showColor = true }) {
  const swatch = output.color_hex && /^#[\da-f]{6}$/i.test(output.color_hex) ? output.color_hex : '#94A3B8';
  const colorName = displayColorName(output.color);
  const statusTone = ['SOBREPRODUCCION', 'SOBRE_REFERENCIA'].includes(output.estado_avance)
    ? 'warning'
    : ['EN_AVANCE', 'COMPLETADA'].includes(output.estado_avance) ? 'success' : 'default';
  const barValue = output.porcentaje == null ? 0 : Math.max(0, Math.min(output.porcentaje, 100));
  const progressColor = progressTone(output.porcentaje);
  return (
    <Box
      component="article"
      data-testid="output-progress-row"
      data-output-key={outputIdentity(output)}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: compact ? { xs: 0.5, md: 0.75 } : 1,
        minWidth: 0,
      }}
    >
      <Stack direction={compact ? { xs: 'column', sm: 'row' } : 'column'} spacing={compact ? 0.75 : 1} alignItems={compact ? { sm: 'flex-start' } : 'stretch'}>
          <Stack direction={compact ? { xs: 'row', sm: 'column' } : 'row'} spacing={0.5} alignItems="center" sx={{ width: compact ? { xs: '100%', sm: 125, md: 145 } : '100%', flex: compact ? { sm: '0 0 auto' } : undefined, minWidth: 0, flexWrap: 'wrap' }}>
          {showColor && <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            <Box
              aria-label={`Color ${colorName}`}
              sx={{ width: compact ? 18 : 22, height: compact ? 18 : 22, flex: '0 0 auto', borderRadius: '50%', bgcolor: swatch, border: '2px solid', borderColor: 'text.secondary' }}
            />
            <Typography fontWeight={750} sx={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: compact ? { xs: 14, md: 18 } : 16, lineHeight: 1.1 }}>
              {colorName}
            </Typography>
          </Stack>}
          {(!compact || !['EN_AVANCE', 'COMPLETADA'].includes(output.estado_avance)) && (
            <Chip
              size="small"
              color={statusTone}
              label={statusLabels[output.estado_avance] || output.estado_avance}
              sx={{ alignSelf: 'flex-start', maxWidth: '100%', height: 'auto', minHeight: compact ? 20 : 22, fontSize: 11, '& .MuiChip-label': { px: 0.75, py: 0.2, whiteSpace: 'normal', display: 'block', overflowWrap: 'anywhere', lineHeight: 1.1 } }}
            />
          )}
          {output.unidad !== 'KG' && output.peso_fisico_kg != null && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? 9 : 10, lineHeight: 1.1 }}>
              Peso neto: <strong>{number(output.peso_fisico_kg, 1)} kg</strong>
            </Typography>
          )}
        </Stack>
        <Grid container columnSpacing={compact ? 0.5 : 1} rowSpacing={0} sx={{ flex: 1, minWidth: 0, width: compact ? undefined : '100%' }}>
          {compact ? (
            <>
              <Grid size={{ xs: 7, sm: 8 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10, lineHeight: 1.1 }}>Avance / meta</Typography>
                <Typography fontWeight={800} sx={{ fontSize: { xs: 16, md: 21 }, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {number(output.avance, output.unidad === 'KG' ? 1 : 0)} / {number(output.meta, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
                </Typography>
              </Grid>
              <Grid size={{ xs: 5, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10, lineHeight: 1.1 }}>Porcentaje</Typography>
                <Typography data-testid="output-percent" fontWeight={800} sx={{ fontSize: { xs: 16, md: 21 }, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {output.porcentaje == null ? '-' : `${number(output.porcentaje, 1)}%`}
                </Typography>
              </Grid>
            </>
          ) : (
            <>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{metricLabel(output)}</Typography>
                <Typography fontWeight={800} sx={{ fontSize: 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {number(output.meta, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Avance</Typography>
                <Typography fontWeight={800} sx={{ fontSize: 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {number(output.avance, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Pendiente</Typography>
                <Typography fontWeight={800} sx={{ fontSize: 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {number(output.pendiente, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Cumplimiento</Typography>
                <Typography fontWeight={800} sx={{ fontSize: 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                  {output.porcentaje == null ? '-' : `${number(output.porcentaje, 1)}%`}
                </Typography>
              </Grid>
            </>
          )}
        </Grid>
      </Stack>
      {output.meta != null && output.porcentaje != null && (
        <LinearProgress
          variant="determinate"
          value={barValue}
          data-progress-tone={progressColor}
          aria-label={`Cumplimiento ${number(output.porcentaje, 1)} por ciento`}
          sx={{
            mt: compact ? 0.5 : 0.75,
            height: compact ? 4 : 7,
            borderRadius: 8,
            border: '1px solid',
            borderColor: 'text.secondary',
            bgcolor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': { bgcolor: `${progressColor}.main` },
          }}
        />
      )}
    </Box>
  );
}

function PieceGroups({ rows, compact = false, showColor = true }) {
  return (
    <Stack spacing={compact ? 1 : 1.5}>
      {groupByPiece(rows).map((group, index) => (
        <Box
          key={group.pieceId == null ? `missing-${index}` : String(group.pieceId)}
          component="section"
          data-testid="piece-progress-group"
          data-piece-id={group.pieceId ?? undefined}
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant={compact ? 'h6' : 'subtitle1'}
            fontWeight={850}
            sx={{ mb: compact ? 0.15 : 0.75, fontSize: compact ? { xs: 16, md: 19 } : undefined, overflowWrap: 'anywhere', lineHeight: 1.1 }}
          >
            {group.name}
          </Typography>
          <Stack spacing={compact ? 0.35 : 0.75}>{group.outputs.map((output) => (
            <OutputRow key={outputIdentity(output)} output={output} compact={compact} showColor={showColor} />
          ))}</Stack>
        </Box>
      ))}
    </Stack>
  );
}

function CanonicalMetricCell({ output, pieceName, colorName, groupId }) {
  if (!output) {
    return <Box data-testid="canonical-piece-cell" sx={{ minWidth: 0, p: 0.4, color: 'text.disabled' }}>-</Box>;
  }
  const barValue = output.porcentaje == null ? 0 : Math.max(0, Math.min(output.porcentaje, 100));
  const exception = !['EN_AVANCE', 'COMPLETADA'].includes(output.estado_avance);
  const overTarget = ['SOBREPRODUCCION', 'SOBRE_REFERENCIA'].includes(output.estado_avance);
  const progressColor = progressTone(output.porcentaje);
  const advance = `${number(output.avance, output.unidad === 'KG' ? 1 : 0)} / ${number(output.meta, output.unidad === 'KG' ? 1 : 0)} ${output.unidad || ''}`.trim();
  const percentage = output.porcentaje == null ? '-' : `${number(output.porcentaje, 1)}%`;
  const status = statusLabels[output.estado_avance] || output.estado_avance || 'Estado no disponible';
  return (
    <Box
      component="article"
      data-testid="output-progress-row"
      data-canonical-piece={pieceName}
      data-group-id={groupId}
      data-output-key={outputIdentity(output)}
      aria-label={`Color ${colorName}; pieza ${pieceName}; avance/meta ${advance}; porcentaje ${percentage}; estado ${status}`}
      sx={{ minWidth: 0, p: { xs: 0.35, md: 0.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
    >
      <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ minWidth: 0, mb: 0.1, flexWrap: 'wrap' }}>
        <Typography fontWeight={800} sx={{ minWidth: 0, fontSize: { xs: 12, md: 14 }, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          {advance}
        </Typography>
        {overTarget && <Chip data-testid="over-target-label" size="small" color="warning" label="Exceso" sx={{ height: 20, maxWidth: '100%', fontWeight: 800, fontSize: 10, '& .MuiChip-label': { px: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' } }} />}
      </Stack>
      {exception && !overTarget && <Chip size="small" color="default" label={status} sx={{ maxWidth: '100%', height: 18, fontSize: 9, mb: 0.25, '& .MuiChip-label': { px: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' } }} />}
      <Typography data-testid="output-percent" color="text.secondary" sx={{ display: 'block', fontSize: { xs: 11, md: 12 }, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {percentage}
      </Typography>
      {output.meta != null && output.porcentaje != null && (
        <LinearProgress
          variant="determinate"
          value={barValue}
          data-progress-tone={progressColor}
          aria-label={`Cumplimiento ${number(output.porcentaje, 1)} por ciento`}
          aria-valuetext={`${percentage}; estado ${status}`}
          sx={{ mt: 0.25, height: 3, borderRadius: 4, bgcolor: 'action.disabledBackground', '& .MuiLinearProgress-bar': { bgcolor: `${progressColor}.main` } }}
        />
      )}
    </Box>
  );
}

function CanonicalBoardCard({ board, compact = false, wide = true, partLabel = null, pieceKeys = null }) {
  const groups = board.groups || [];
  const firstGroup = groups[0] || {};
  const pieces = canonicalPieces(groups).filter((piece) => !pieceKeys || pieceKeys.includes(piece.key));
  const colorLanes = [...groups.reduce((lanes, group) => {
    const key = canonicalColorKey(group);
    if (!lanes.has(key)) lanes.set(key, { key, groups: [] });
    lanes.get(key).groups.push(group);
    return lanes;
  }, new Map()).values()];
  const moldVisible = groups.some((group) => group.molde_visible === true);
  const moldLabel = firstGroup.molde?.nombre || firstGroup.molde?.codigo;
  const boardHeader = (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: compact ? 0.75 : 1, flexWrap: 'wrap' }}>
      <Typography variant={compact ? 'h4' : 'h5'} fontWeight={900} sx={compact ? { fontSize: { xs: 25, md: 32 }, lineHeight: 1.05 } : undefined}>{board.of || 'OF sin identificar'}</Typography>
      <Chip size="small" label={orderStatusLabels[board.estado] || board.estado || 'Estado no disponible'} sx={compact ? { height: 22, fontSize: 11 } : undefined} />
      {moldVisible && (moldLabel
        ? <Chip size="small" variant="outlined" label={`Molde ${moldLabel}`} />
        : <Chip size="small" color="warning" variant="outlined" label="Molde sin identificar" />)}
      {partLabel && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important', whiteSpace: 'nowrap' }}>{partLabel}</Typography>}
    </Stack>
  );
  const laneOutputs = (lane, piece) => lane.groups.flatMap((group) => (group.salidas || [])
    .filter((output) => canonicalPieceKey(output) === piece.key)
    .map((output) => ({ output, group })));
  const colorCell = (lane) => {
    const group = lane.groups[0] || {};
    const colorName = displayColorName(group.color);
    const transparent = isTransparentColor(colorName);
    const swatch = group.color_hex && /^#[\da-f]{6}$/i.test(group.color_hex) ? group.color_hex : '#94A3B8';
    const swatchSx = transparent
      ? { background: 'repeating-linear-gradient(45deg, #FFFFFF 0 4px, #CBD5E1 4px 8px)' }
      : { bgcolor: swatch };
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }}>
        <Box aria-label={`Color ${colorName}`} data-color-kind={transparent ? 'transparent' : 'named'} data-testid="group-color-swatch" sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: 'text.secondary', flex: '0 0 auto', ...swatchSx }} />
        <Typography fontWeight={800} sx={{ fontSize: { xs: 12, md: 14 }, overflowWrap: 'anywhere' }}>{colorName}</Typography>
        {!group.color_hex && !transparent && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>(neutral)</Typography>}
        {lane.groups.map((subgroup) => (
          <Fragment key={subgroup.group_id}>
            <Typography component="span" variant="caption" color="text.secondary" data-testid="canonical-progress-group" data-group-id={subgroup.group_id} sx={{ width: '100%', fontSize: 10 }}>
              {provenanceSummary(subgroup)}
            </Typography>
            {groupProvenanceNote(subgroup) && <Typography component="span" variant="caption" color="text.secondary" data-testid="provenance-note" sx={{ width: '100%', fontSize: 10 }}>{groupProvenanceNote(subgroup)}</Typography>}
          </Fragment>
        ))}
      </Stack>
    );
  };
  return (
    <Card variant="outlined" data-testid="of-progress-card" data-board-key={board.key} data-of-id={board.of_id} sx={{ boxShadow: compact ? 2 : undefined, minHeight: 0 }}>
      <CardContent sx={{ p: compact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 }, '&:last-child': { pb: compact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 } } }}>
        {boardHeader}
        {wide ? (
          <Box data-testid="canonical-matrix" sx={{ display: 'grid', gridTemplateColumns: `minmax(132px, 0.8fr) repeat(${Math.max(pieces.length, 1)}, minmax(88px, 1fr))`, minWidth: 0, '& > *': { minWidth: 0 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ p: 0.5, fontWeight: 800 }}>Color</Typography>
            {pieces.map((piece) => <Typography key={piece.key} data-testid="canonical-piece-header" variant="caption" fontWeight={850} sx={{ p: 0.5, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{piece.name}</Typography>)}
            {colorLanes.map((lane) => {
              return (
                <Box key={lane.key} component="section" data-testid="canonical-color-lane" data-color-key={lane.key} sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid', borderTop: '1px solid', borderColor: 'divider', py: 0.35, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, p: 0.25 }}>{colorCell(lane)}</Box>
                  {pieces.map((piece) => {
                    const outputs = laneOutputs(lane, piece);
                    const colorName = displayColorName(lane.groups[0]?.color);
                    return <Box key={`${lane.key}-${piece.key}`} data-testid="canonical-piece-cell" sx={{ minWidth: 0, p: 0.2 }}>{outputs.length ? outputs.map(({ output, group }) => <CanonicalMetricCell key={`${group.group_id}-${outputIdentity(output)}`} output={output} pieceName={piece.name} colorName={colorName} groupId={group.group_id} />) : '-'}</Box>;
                  })}
                  {lane.groups.map((group) => groupIdentityWarning(group) && <Alert key={`${group.group_id}-identity`} severity="warning" sx={{ gridColumn: '1 / -1', mt: 0.25, py: 0, fontSize: 12 }}>{groupIdentityWarning(group)}</Alert>)}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Stack spacing={0.75} data-testid="canonical-compact-grid">
            {colorLanes.map((lane) => {
              return (
                <Box key={lane.key} component="section" data-testid="canonical-color-lane" data-color-key={lane.key} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 0.5, minWidth: 0 }}>
                  {colorCell(lane)}
                  {lane.groups.map((group) => groupIdentityWarning(group) && <Alert key={`${group.group_id}-identity`} severity="warning" sx={{ my: 0.5, py: 0, fontSize: 12 }}>{groupIdentityWarning(group)}</Alert>)}
                  <Grid container spacing={0.35} sx={{ mt: 0.25 }}>
                    {pieces.map((piece) => {
                      const outputs = laneOutputs(lane, piece);
                      const colorName = displayColorName(lane.groups[0]?.color);
                      return <Grid key={`${lane.key}-${piece.key}`} size={{ xs: 6, sm: 3 }} sx={{ minWidth: 0 }}><Typography variant="caption" fontWeight={750} sx={{ display: 'block', fontSize: 10, overflowWrap: 'anywhere' }}>{piece.name}</Typography>{outputs.length ? outputs.map(({ output, group }) => <CanonicalMetricCell key={`${group.group_id}-${outputIdentity(output)}`} output={output} pieceName={piece.name} colorName={colorName} groupId={group.group_id} />) : <CanonicalMetricCell pieceName={piece.name} colorName={colorName} />}</Grid>;
                    })}
                  </Grid>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function pairDistinctOrders(parts) {
  const remaining = [...parts];
  const pages = [];
  while (remaining.length) {
    const first = remaining.shift();
    const differentOrderIndex = remaining.findIndex((part) => part.of.of_id !== first.of.of_id);
    pages.push(differentOrderIndex < 0
      ? [first]
      : [first, ...remaining.splice(differentOrderIndex, 1)]);
  }
  return pages;
}

export default function ControlAvanceOfTv() {
  const { actorId } = useScmActor();
  const [payload, setPayload] = useState(null);
  const [payloadActorId, setPayloadActorId] = useState(null);
  const [lastSuccess, setLastSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [orderDirection, setOrderDirection] = useState('asc');
  const [tvMode, setTvMode] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1366);
  const [wideViewport, setWideViewport] = useState(() => window.innerWidth >= 900);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight || 768);
  const [fullscreenWarning, setFullscreenWarning] = useState('');
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth || 1366);
      setWideViewport(window.innerWidth >= 900);
      setViewportHeight(window.innerHeight || 768);
    };
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const refresh = useCallback(async (signal) => {
    const requestId = ++requestSeq.current;
    try {
      const result = await listarAvanceOfTvScm({ signal });
      if (signal?.aborted || requestId !== requestSeq.current) return;
      setPayload(result);
      setPayloadActorId(actorId);
      setLastSuccess(result.as_of || 'unknown');
      setError('');
    } catch (requestError) {
      if (signal?.aborted || requestId !== requestSeq.current || requestError?.name === 'CanceledError' || requestError?.name === 'AbortError') return;
      setError('No se pudo actualizar. Los datos visibles pertenecen a la última consulta exitosa.');
    } finally {
      if (!signal?.aborted && requestId === requestSeq.current) setLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    requestSeq.current += 1;
    setPayload(null);
    setPayloadActorId(null);
    setLastSuccess(null);
    setError('');
    setLoading(true);
    setSlide(0);
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = window.setInterval(() => refresh(controller.signal), REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(controller.signal); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const activePayload = payloadActorId === actorId ? payload : null;
  const canonicalGroups = useMemo(() => (activePayload?.items || [])
    .filter((group) => group.group_id)
    .filter((group) => ACTIVE.has(String(group.estado || '').toUpperCase()))
    .filter((group) => {
      const otValues = [group.ot, ...(group.ot_ids || []), ...(group.ots || []).flatMap((ot) => [ot.id, ot.codigo])];
      return `${group.of || ''} ${otValues.join(' ')} ${group.molde?.nombre || ''} ${group.molde?.codigo || ''} ${group.color || ''} ${(group.salidas || []).map((output) => `${output.pieza || ''} ${output.sku || ''}`).join(' ')}`.toLowerCase().includes(search.toLowerCase());
    })
    .sort((left, right) => {
      const order = String(left.of || '').localeCompare(String(right.of || ''), 'es', { numeric: true });
      const inner = String(left.group_id).localeCompare(String(right.group_id), 'es', { numeric: true });
      return (order || inner) * (orderDirection === 'asc' ? 1 : -1);
    }), [activePayload, search, orderDirection]);
  const hasCanonicalGroups = canonicalGroups.length > 0 || Boolean((activePayload?.items || []).some((group) => group.group_id));
  const flatRows = useMemo(() => (activePayload?.items || [])
    .filter((of) => ACTIVE.has(String(of.estado || '').toUpperCase()))
    .flatMap((of) => (of.salidas || []).map((output, index) => ({ of, output, index })))
    .filter(({ of, output }) => `${of.of} ${output.pieza || ''} ${output.color || ''} ${output.sku || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => {
      const order = left.of.of.localeCompare(right.of.of, 'es', { numeric: true });
      const inner = `${left.output.pieza_id ?? ''}-${left.output.corrida ?? ''}-${left.output.pieza_color_id ?? ''}`
        .localeCompare(`${right.output.pieza_id ?? ''}-${right.output.corrida ?? ''}-${right.output.pieza_color_id ?? ''}`, 'es', { numeric: true });
      return (order || inner) * (orderDirection === 'asc' ? 1 : -1);
    }), [activePayload, search, orderDirection]);

  const canonicalBoards = useMemo(() => canonicalGroups.reduce((boards, group) => {
    const key = canonicalBoardKey(group);
    if (!boards.has(key)) {
      boards.set(key, {
        key,
        of_id: group.of_id,
        of: group.of,
        estado: group.estado,
        groups: [],
      });
    }
    boards.get(key).groups.push(group);
    return boards;
  }, new Map()), [canonicalGroups]);
  const orderedGroups = hasCanonicalGroups
    ? new Map(canonicalGroups.map((group) => [group.group_id, { of: group, outputs: (group.salidas || []).map((output, index) => ({ of: group, output, index })) }]))
    : flatRows.reduce((groups, row) => {
      const id = row.of.of_id;
      if (!groups.has(id)) groups.set(id, { of: row.of, outputs: [] });
      groups.get(id).outputs.push(row);
      return groups;
    }, new Map());

  const legacyTvParts = [...orderedGroups.values()].flatMap(({ of, outputs }) => {
    const pieceIds = new Set(outputs.map(({ output }) => output.pieza_id).filter((id) => id != null));
    const hasOneStablePiece = outputs.length > 0
      && pieceIds.size === 1
      && outputs.every(({ output }) => output.pieza_id != null);
    const chunks = chunkRows(outputs, hasOneStablePiece ? 7 : TV_PART_SIZE);
    return chunks.map((rows, index) => ({
      of,
      rows,
      part: index + 1,
      partCount: chunks.length,
    }));
  });
  const canonicalParts = useMemo(() => [...canonicalBoards.values()].flatMap((board) => {
    // The additive DTO marks the new aggregation/provenance shape.  Split a
    // dense OF by visible color lanes; each part repeats the OF header and is
    // presented alone so a TV never needs manual scrolling.
    const isConsolidated = board.groups.some((group) => group.ots || group.provenance);
    const allPieces = canonicalPieces(board.groups);
    const pieceCount = allPieces.length;
    const minFullWidth = 132 + pieceCount * 88 + 16;
    const chunks = isConsolidated
      ? splitTvLanes(board.groups, { viewportHeight, pieceCount, layout: wideViewport ? 'wide' : 'narrow' })
      : [board.groups];
    const budget = calculateTvPageBudget({ viewportHeight, pieceCount, layout: wideViewport ? 'wide' : 'narrow' });
    const maxFullWidthPieces = Math.max(1, Math.floor((viewportWidth - 24 - 132 - 16) / 88));
    const pieceChunks = wideViewport && minFullWidth > viewportWidth - 24
      ? chunkRows(allPieces, maxFullWidthPieces)
      : [null];
    return chunks.flatMap((groups, index) => pieceChunks.map((pieceChunk, columnIndex) => {
      const part = {
        ...board,
        key: `${chunks.length > 1 ? `${board.key}|parte-${index + 1}` : board.key}${pieceChunk ? `|columnas-${columnIndex + 1}` : ''}`,
        groups,
        pieceKeys: pieceChunk?.map((piece) => piece.key) || null,
        partLabel: chunks.length > 1 || pieceChunks.length > 1
          ? `${chunks.length > 1 ? `Parte ${index + 1} de ${chunks.length}` : ''}${pieceChunks.length > 1 ? ` · Piezas ${columnIndex + 1} de ${pieceChunks.length}` : ''}`.trim()
          : null,
        // Two half-width cards must not force the matrix below its measured
        // minimum width. A full-width card is safe at 1366; narrower viewports
        // split columns and repeat the board/color headers on each page.
        requiresFullWidth: wideViewport && minFullWidth > (viewportWidth / 2 - 24),
        exclusive: chunks.length > 1 || pieceChunks.length > 1,
        laneBudget: budget.maxLanes,
      };
      return { ...part, estimatedHeight: estimateTvPartHeight(part, { layout: wideViewport ? 'wide' : 'narrow' }) };
    }));
  }), [canonicalBoards, viewportHeight, viewportWidth, wideViewport]);
  const canonicalSlides = useMemo(() => {
    const budget = calculateTvPageBudget({
      viewportHeight,
      layout: wideViewport ? 'wide' : 'narrow',
    });
    return packTvPages(canonicalParts, {
      availableHeight: budget.availableHeight,
      maxColumns: wideViewport ? 2 : 1,
      layout: wideViewport ? 'wide' : 'narrow',
    });
  }, [canonicalParts, viewportHeight, wideViewport]);
  const tvSlides = useMemo(() => hasCanonicalGroups
    ? canonicalSlides
    : wideViewport ? pairDistinctOrders(legacyTvParts) : legacyTvParts.map((part) => [part]), [legacyTvParts, wideViewport, hasCanonicalGroups, canonicalSlides]);
  const visibleSlide = slide % Math.max(1, tvSlides.length);
  const currentPage = tvSlides[visibleSlide] || (hasCanonicalGroups ? { rows: [], usedHeight: 0 } : []);
  const currentRows = hasCanonicalGroups ? currentPage.rows : [currentPage];

  useEffect(() => {
    if (!tvMode || tvSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (!paused) setSlide((current) => (current + 1) % tvSlides.length);
    }, PAGE_MS);
    return () => window.clearInterval(timer);
  }, [tvMode, tvSlides.length, paused]);

  const setFullscreen = async () => {
    if (tvMode) {
      try { await document.exitFullscreen?.(); } catch { /* keep the TV view dismissible */ }
      setTvMode(false);
      setFullscreenWarning('');
      return;
    }
    setTvMode(true);
    try {
      if (!rootRef.current?.requestFullscreen) setFullscreenWarning('Pantalla completa no está disponible; el modo TV sigue activo.');
      else { await rootRef.current.requestFullscreen(); setFullscreenWarning(''); }
    } catch {
      setFullscreenWarning('No se pudo activar pantalla completa; el modo TV sigue activo.');
    }
  };

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setTvMode(false); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const lastSuccessLabel = lastSuccess === 'unknown'
    ? 'Hora fuente no disponible'
    : lastSuccess
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(lastSuccess))
      : 'Sin consulta exitosa';

  return (
    <Box
      ref={rootRef}
      data-testid="control-avance-of-tv"
      data-tv-scroll="disabled"
      data-tv-budget-method={tvMode ? 'conservative-lane-estimate' : undefined}
      data-tv-viewport-height={tvMode ? viewportHeight : undefined}
      sx={{ maxWidth: tvMode ? 'none' : 1500, mx: 'auto', p: tvMode ? { xs: 1.5, md: 2 } : 0, bgcolor: 'background.default', minHeight: tvMode ? '100vh' : undefined, overflow: tvMode ? 'hidden' : undefined, '&:fullscreen': { overflow: 'hidden', bgcolor: 'background.default' } }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: tvMode ? 1 : 2 }}>
        <Box>
          <Typography component="h1" variant={tvMode ? 'h4' : 'h4'} fontWeight={850}>Avance OF</Typography>
          {!tvMode && <Typography color="text.secondary">Pesajes vigentes por OF, objetivo de color y pieza-color.</Typography>}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">Última consulta exitosa: {lastSuccessLabel}</Typography>
          <Tooltip title="Actualizar ahora"><IconButton aria-label="Actualizar ahora" onClick={() => refresh()}><RefreshOutlinedIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={tvMode ? <FullscreenExitOutlinedIcon /> : <FullscreenOutlinedIcon />} onClick={setFullscreen}>{tvMode ? 'Salir de TV' : 'Modo TV'}</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {!tvMode && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField fullWidth size="small" label="Filtrar OF, pieza o objetivo de color" value={search} onChange={(event) => { setSearch(event.target.value); setSlide(0); }} />
          <TextField select size="small" label="Orden de OF" value={orderDirection} onChange={(event) => { setOrderDirection(event.target.value); setSlide(0); }} sx={{ minWidth: 180 }}>
            <MenuItem value="asc">Ascendente</MenuItem><MenuItem value="desc">Descendente</MenuItem>
          </TextField>
          <Chip label="Solo OF activas" color="primary" variant="outlined" />
        </Stack>
      )}
      {fullscreenWarning && <Alert severity="warning" sx={{ mb: 1 }}>{fullscreenWarning}</Alert>}
      {loading && !payload && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /><Typography sx={{ mt: 1 }}>Consultando avance.</Typography></Stack>}
      {!loading && !legacyTvParts.length && !canonicalParts.length && <Alert severity="info">No hay salidas de OF activas para mostrar.</Alert>}
      {tvMode && (hasCanonicalGroups ? currentPage.rows.length > 0 : currentPage.length > 0) && (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" color="text.secondary" aria-live="polite" sx={{ fontSize: { xs: 14, md: 18 } }}>
              Pantalla {visibleSlide + 1} de {tvSlides.length}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={() => setSlide((current) => (current - 1 + tvSlides.length) % tvSlides.length)}>Anterior</Button>
              <Button size="small" onClick={() => setPaused((value) => !value)}>{paused ? 'Reanudar' : 'Pausar'}</Button>
              <Button size="small" onClick={() => setSlide((current) => (current + 1) % tvSlides.length)}>Siguiente</Button>
            </Stack>
          </Stack>
          <Stack spacing={1} data-testid="of-progress-layout" data-columns={wideViewport ? '2' : '1'} data-page-columns={hasCanonicalGroups ? String(currentPage.rows[0]?.parts.length || 1) : undefined} data-page-rows={hasCanonicalGroups ? String(currentPage.rows.length) : undefined} data-tv-used-height={hasCanonicalGroups ? String(currentPage.usedHeight) : undefined} data-tv-lane-budget={hasCanonicalGroups ? currentPage.rows[0]?.parts[0]?.laneBudget : undefined} data-tv-viewport-height={viewportHeight} key={`tv-page-${visibleSlide}`} sx={{ animation: 'tv-page-enter 180ms ease-out', '@keyframes tv-page-enter': { from: { opacity: 0.65, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
            {hasCanonicalGroups
              ? currentRows.map((row, rowIndex) => (
                <Grid container spacing={1} key={`tv-row-${rowIndex}`} data-testid="tv-page-row" data-row-columns={row.parts.length} data-row-height={row.height}>
                  {row.parts.map((board) => (
                    <Grid key={board.key} size={{ xs: 12, md: row.parts.length === 1 ? 12 : 6 }}>
                      <CanonicalBoardCard board={board} compact wide={wideViewport} partLabel={board.partLabel} pieceKeys={board.pieceKeys} />
                    </Grid>
                  ))}
                </Grid>
              ))
              : (
                <Grid container spacing={1} data-testid="tv-page-row" data-row-columns={currentPage.length}>
                  {currentPage.map((part) => (
                    <Grid key={`${part.of.of_id}-${part.part}`} size={{ xs: 12, md: 6 }}>
                      <Card variant="outlined" data-testid="of-progress-card" data-of-id={part.of.of_id} sx={{ boxShadow: 2, minHeight: 0 }}>
                        <CardContent sx={{ p: { xs: 1, md: 1.25 }, '&:last-child': { pb: { xs: 1, md: 1.25 } } }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 25, md: 32 }, lineHeight: 1.05 }}>{part.of.of}</Typography>
                            <Chip size="small" label={part.of.estado} sx={{ height: 22, fontSize: 11 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important', fontSize: { xs: 11, md: 12 }, whiteSpace: 'nowrap' }}>
                              Parte {part.part} de {part.partCount}{part.part < part.partCount ? ' · Continúa' : ''}
                            </Typography>
                          </Stack>
                          <PieceGroups rows={part.rows} compact />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
          </Stack>
        </Stack>
      )}
      {!tvMode && (hasCanonicalGroups ? canonicalBoards.size : orderedGroups.size) > 0 && (
        <Grid container spacing={2} data-testid="of-progress-layout" data-columns={wideViewport ? '2' : '1'}>
          {hasCanonicalGroups
            ? [...canonicalBoards.values()].map((board) => (
              <Grid key={board.key} size={{ xs: 12, md: 6 }}>
                <CanonicalBoardCard board={board} compact wide={wideViewport} />
              </Grid>
            ))
            : [...orderedGroups.values()].map(({ of, outputs }) => (
            <Grid key={of.of_id} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" data-testid="of-progress-card" data-of-id={of.of_id}>
                  <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                    <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="h5" fontWeight={900}>{of.of}</Typography>
                      <Chip size="small" label={of.estado} />
                    </Stack>
                    <PieceGroups rows={outputs} />
                  </CardContent>
                </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {activePayload?.visibilidad?.pesaje === false && <Alert severity="warning" sx={{ mt: 2 }}>Tu permiso permite ver OF, pero no los datos de pesaje.</Alert>}
    </Box>
  );
}
