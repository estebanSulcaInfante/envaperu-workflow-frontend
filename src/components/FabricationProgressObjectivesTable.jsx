import { Fragment, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { formatKg } from '../utils/weightDisplay';
import ProductionColorLabel from './ui/ProductionColorLabel';
import {
  groupObjectiveComparisonRows, objectiveComparisonRows,
} from './fabricationOrdersModel';

const format = (value) => value == null ? '—' : `${formatKg(value)} kg`;
const progressTone = (value) => (value >= 95 ? 'success' : value >= 80 ? 'warning' : 'error');

const groupSummary = (rows) => {
  if (rows.some((row) => row.status.key === 'RESTRINGIDO')) {
    return { target: null, final: null, open: null, percentage: null, label: 'Avance restringido', color: 'default' };
  }
  const targets = rows.map((row) => row.target);
  const finals = rows.map((row) => row.final);
  const opens = rows.map((row) => row.open);
  const targetComplete = targets.every((value) => value != null && value > 0);
  const finalComplete = finals.every((value) => value != null && value >= 0);
  const target = targetComplete ? targets.reduce((sum, value) => sum + value, 0) : null;
  const final = finalComplete ? finals.reduce((sum, value) => sum + value, 0) : null;
  const open = opens.every((value) => value != null && value >= 0) ? opens.reduce((sum, value) => sum + value, 0) : null;
  if (!targetComplete) return { target, final, open, percentage: null, label: 'Meta incompleta', color: 'warning' };
  if (!finalComplete || !rows.every((row) => row.status.key === 'LISTO')) return { target, final, open, percentage: null, label: rows.every((row) => row.status.key === 'SIN_PESAJES') ? 'Sin pesajes' : 'Avance parcial', color: 'warning' };
  const percentage = target > 0 ? (final / target) * 100 : null;
  return { target, final, open, percentage, label: 'Avance calculable', color: 'success' };
};

function ColorCell({ row }) {
  return <ProductionColorLabel name={row.color} hex={row.colorHex} />;
}

function IdentityCell({ identity }) {
  if (!identity) return <Typography variant="body2" color="text.secondary">Sin vínculo</Typography>;
  return <Stack spacing={0.15}><Typography variant="body2" fontWeight={700}>{identity.nombre || 'Molde sin nombre'}</Typography>{identity.codigo && <Typography variant="caption" color="text.secondary">{identity.codigo}</Typography>}</Stack>;
}

function OutputsCell({ outputs = [] }) {
  if (!outputs.length) return <Typography variant="body2" color="text.secondary">Sin salidas registradas</Typography>;
  return <Stack spacing={0.35}>{outputs.map((output, index) => { const article = output.articulo || output; const name = article.nombre || output.nombre; const code = article.codigo || output.codigo; return <Stack key={`${code || name || 'salida'}-${index}`} spacing={0.05}><Typography variant="body2" fontWeight={700}>{name || 'Salida sin nombre'}</Typography>{code && <Typography variant="caption" color="text.secondary">{code}</Typography>}</Stack>; })}</Stack>;
}

function FabricationIdentityCell({ rows = [], renderOrder }) {
  const first = rows[0] || {};
  const outputs = rows.flatMap((row) => row.salidas || []).map((output) => output.articulo || output);
  const pieces = outputs.map((output) => output.pieza || output.pieza_base).filter(Boolean).filter((piece, index, all) => (piece.codigo || piece.nombre) && all.findIndex((candidate) => (candidate.codigo || candidate.nombre) === (piece.codigo || piece.nombre)) === index);
  return <Stack spacing={0.35}>{renderOrder && first._order ? renderOrder(first._order, { compact: true }) : <Typography fontWeight={800}>{first.of}</Typography>}<Typography variant="caption" color="text.secondary">Molde de la OF</Typography><IdentityCell identity={first.molde} />{pieces.length > 0 && <Stack spacing={0.1}><Typography variant="caption" color="text.secondary">Piezas base</Typography>{pieces.map((piece) => <Typography key={piece.codigo || piece.nombre} variant="body2">{piece.nombre || 'Pieza sin nombre'}{piece.codigo ? ` · ${piece.codigo}` : ''}</Typography>)}</Stack>}<Typography variant="caption" color="text.secondary">{rows.length} objetivo{rows.length === 1 ? '' : 's'}</Typography></Stack>;
}

export default function FabricationProgressObjectivesTable({
  items = [], visibility = {}, orders = [], loading = false, error = '', onRetry,
  asOf = null, title = 'Comparación de objetivos', description, renderOrder,
  expandedKeys, onExpandedChange,
}) {
  const rows = useMemo(() => objectiveComparisonRows(items, { visibility, orders }), [items, orders, visibility]);
  const groups = useMemo(() => [...groupObjectiveComparisonRows(rows).values()], [rows]);
  const [internalExpanded, setInternalExpanded] = useState({});
  const expanded = expandedKeys ?? internalExpanded;
  const commitExpanded = (next) => {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
  };
  const allExpanded = groups.length > 0 && groups.every((group) => expanded[group.key]);
  const toggleAll = () => commitExpanded(Object.fromEntries(groups.map((group) => [group.key, !allExpanded])));
  const toggle = (key) => commitExpanded({ ...expanded, [key]: !expanded[key] });

  return (
    <Paper variant="outlined" data-testid="fabrication-objective-comparison">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ p: 2, pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description || 'Metas netas, finalizados y abiertas permanecen separados por objetivo.'}</Typography>
          {asOf && <Typography variant="caption" color="text.secondary">Fuente consultada: {asOf}</Typography>}
        </Box>
        {groups.length > 0 && <Button size="small" onClick={toggleAll} aria-label={allExpanded ? 'Ocultar objetivos' : 'Mostrar todos los objetivos'}>{allExpanded ? 'Ocultar objetivos' : 'Mostrar todos los objetivos'}</Button>}
      </Stack>
      {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }} action={onRetry ? <Button color="inherit" onClick={onRetry}>Reintentar</Button> : undefined}>{error}</Alert>}
      {loading && <Typography role="status" sx={{ p: 2 }}>Cargando objetivos…</Typography>}
      {!loading && !error && !rows.length && <Typography sx={{ p: 2 }} color="text.secondary">No hay objetivos de producción para mostrar.</Typography>}
      {!loading && rows.length > 0 && (
        <TableContainer sx={{ maxHeight: 520, overflowX: 'auto' }}>
          <Table size="small" stickyHeader aria-label="Bandeja y comparación de objetivos de fabricación" sx={{ tableLayout: 'fixed', minWidth: 1000, '& th, & td': { px: 1, overflowWrap: 'anywhere' }, '& th': { whiteSpace: 'normal' }, '& .MuiChip-root': { maxWidth: '100%', height: 'auto', minHeight: 24 }, '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}>
            <colgroup>{['4%', '22%', '12%', '14%', '12%', '10%', '10%', '8%', '8%'].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
            <TableHead><TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell>OF · molde y piezas</TableCell><TableCell>Objetivo de color</TableCell><TableCell>Color</TableCell><TableCell>Salidas</TableCell>
              <TableCell align="right">Meta neta</TableCell><TableCell align="right">Finalizados</TableCell><TableCell align="right">Abiertas</TableCell>
              <TableCell>Avance / estado</TableCell>
            </TableRow></TableHead>
            <TableBody>{groups.map((group) => {
              const open = Boolean(expanded[group.key]);
              const summary = groupSummary(group.rows);
              return (
                <Fragment key={group.key}>
                  <TableRow hover sx={{ '& > td': { borderBottom: open ? 0 : undefined } }}>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggle(group.key)} aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Expandir'} objetivos ${group.of}`}>
                        <ExpandMoreRoundedIcon sx={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                      </IconButton>
                    </TableCell>
                    <TableCell><FabricationIdentityCell rows={group.rows} renderOrder={renderOrder} /></TableCell><TableCell>—</TableCell><TableCell>—</TableCell><TableCell>—</TableCell>
                    <TableCell align="right">{format(summary.target)}</TableCell><TableCell align="right">{format(summary.final)}</TableCell><TableCell align="right">{format(summary.open)}</TableCell>
                    <TableCell><Stack spacing={0.25}><Chip size="small" variant="outlined" color={summary.color} label={summary.label} sx={{ width: 'fit-content' }} />{summary.percentage != null && <><Typography variant="caption">{summary.percentage.toFixed(1)}%</Typography><LinearProgress color={progressTone(summary.percentage)} variant="determinate" value={Math.min(100, Math.max(0, summary.percentage))} /></>}</Stack></TableCell>
                  </TableRow>
                  {open && group.rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ width: 48 }} />
                      <TableCell>{group.of}</TableCell><TableCell>{row.objective}</TableCell><TableCell><ColorCell row={row} /></TableCell><TableCell><OutputsCell outputs={row.salidas} /></TableCell>
                      <TableCell align="right">{format(row.target)}</TableCell><TableCell align="right">{format(row.final)}</TableCell><TableCell align="right">{format(row.open)}</TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Chip size="small" variant="outlined" color={row.status.color} label={row.status.label} sx={{ width: 'fit-content' }} />
                          {row.percentage != null && <><Typography variant="caption">{row.percentage.toFixed(1)}%</Typography><LinearProgress color={progressTone(row.percentage)} variant="determinate" value={Math.min(100, Math.max(0, row.percentage))} /></>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
