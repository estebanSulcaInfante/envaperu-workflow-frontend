import { Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

const TITLES = { daily_summary: 'Resumen diario', production_daily_summary: 'Resumen diario de producción', production_order_progress: 'Avance de órdenes de producción', weighing_period: 'Periodo de pesajes', manga_trace: 'Trazabilidad de manga' };
const LABELS = { effective_kg: 'Kg efectivos', effective_count: 'Pesajes efectivos', effective_weighings: 'Pesajes efectivos', cancelled_kg: 'Kg anulados', cancelled_count: 'Pesajes anulados', cancelled_weighings: 'Pesajes anulados', objetivo_neto_kg: 'Objetivo neto (kg)', kg_finalizados_efectivos: 'Kg finalizados', porcentaje: 'Porcentaje', cobertura: 'Cobertura', coverage: 'Cobertura', readings: 'Lecturas', fecha_desde: 'Desde', fecha_hasta: 'Hasta', net_kg: 'Kg netos' };
const TECHNICAL = new Set(['target_policy', 'timezone', 'trace_id', 'provider', 'execution_mode', 'as_of_utc']);
const label = (value) => LABELS[value] || String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const first = (object, keys) => keys.map((key) => object?.[key]).find((value) => value !== undefined && value !== null);
const text = (value) => {
  if (value === null || value === undefined || value === '') return 'No informado';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return `${value.length} elementos`;
  if (typeof value === 'object') return first(value, ['nombre', 'codigo', 'id', 'estado', 'valor', 'of', 'color', 'fecha', 'date']) || 'Sin valores resumibles';
  return String(value);
};
const scalars = (data) => Object.entries(data || {}).filter(([key, value]) => !TECHNICAL.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value)));

function Fields({ entries, emphasis = false }) {
  if (!entries.length) return null;
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>{entries.map(([key, value]) => <Box key={key} sx={{ minWidth: 0 }}><Typography variant="caption" sx={{ color: '#9daaba' }}>{label(key)}</Typography><Typography variant="body2" sx={{ color: '#f5f7fa', fontWeight: emphasis ? 750 : 500, overflowWrap: 'anywhere' }}>{text(value)}</Typography></Box>)}</Box>;
}

function TableView({ rows, columns }) {
  if (!rows.length) return <Typography variant="body2" sx={{ color: '#b6c1cc' }}>No hay registros para este corte.</Typography>;
  const visible = rows.slice(0, 40);
  return <Box sx={{ overflowX: 'auto', mt: 1 }}><Table size="small" aria-label="Datos de respuesta" sx={{ minWidth: 420, '& .MuiTableCell-root': { color: '#d6dee8', borderColor: '#344454' } }}><TableHead><TableRow>{columns.map(([key, heading]) => <TableCell key={key}>{heading}</TableCell>)}</TableRow></TableHead><TableBody>{visible.map((row, index) => <TableRow key={`${index}-${row.id || row.of || row.codigo || 'row'}`}>{columns.map(([key]) => <TableCell key={key}>{text(row[key])}</TableCell>)}</TableRow>)}</TableBody></Table>{rows.length > 40 && <Typography variant="caption" sx={{ display: 'block', color: '#9daaba', mt: 0.75 }}>Mostrando 40 de {rows.length} registros.</Typography>}</Box>;
}

function DailyTable({ groups = [] }) {
  const rows = groups.map((group) => ({ of: first(group, ['of', 'of_id', 'orden_fabricacion']), color: first(group, ['color', 'color_nombre']), readings: first(group, ['weighings', 'effective_count', 'effective_weighings', 'readings']), net: first(group, ['net_kg', 'kg', 'effective_kg']) }));
  return <TableView rows={rows} columns={[['of', 'OF'], ['color', 'Color'], ['readings', 'Pesajes'], ['net', 'Kg netos']]} />;
}

function Nested({ value, depth = 0 }) {
  if (value === undefined) return null;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return <Typography variant="body2" sx={{ color: '#f5f7fa' }}>{text(value)}</Typography>;
  if (depth > 6) return <Typography variant="caption" sx={{ color: '#9daaba' }}>Detalle adicional disponible.</Typography>;
  if (Array.isArray(value)) return <Stack spacing={0.6}>{value.slice(0, 40).map((item, index) => <Box key={index} sx={{ borderLeft: '1px solid #53667a', pl: 1 }}><Nested value={item} depth={depth + 1} /></Box>)}{value.length > 40 && <Typography variant="caption" sx={{ color: '#9daaba' }}>Mostrando 40 de {value.length} elementos.</Typography>}</Stack>;
  return <Stack spacing={0.75}>{Object.entries(value).filter(([key]) => !TECHNICAL.has(key)).map(([key, nested]) => <Box key={key} sx={{ borderLeft: depth ? '1px solid #344454' : undefined, pl: depth ? 1 : 0 }}><Typography variant="caption" sx={{ color: '#9daaba', fontWeight: 700 }}>{label(key)}</Typography><Nested value={nested} depth={depth + 1} /></Box>)}</Stack>;
}

function Evidence({ result, response }) {
  const provider = result?.provider || response?.provider;
  const groups = Array.isArray(result?.data?.groups) ? result.data.groups : [];
  const effectiveIds = [...new Set(groups.flatMap((group) => Array.isArray(group?.weighing_ids) ? group.weighing_ids : []))];
  const cancelledIds = [...new Set(groups.flatMap((group) => Array.isArray(group?.cancelled_weighing_ids) ? group.cancelled_weighing_ids : []))];
  const fields = [['Fuente', result?.source], ['Corte UTC', result?.as_of_utc], ['Referencia', result?.trace_id || response?.trace_id], ['Modo', response?.execution_mode || provider?.mode], ['Estado reportado', provider?.status], ['Pesajes efectivos (IDs)', effectiveIds.length ? effectiveIds.join(', ') : null], ['Pesajes anulados (IDs)', cancelledIds.length ? cancelledIds.join(', ') : null]].filter(([, value]) => value);
  if (!fields.length) return null;
  return <Box component="details" sx={{ mt: 1 }}><Box component="summary" sx={{ cursor: 'pointer', color: '#b6c1cc', fontSize: 12 }}>Ver fuente y corte</Box><Stack spacing={0.4} sx={{ mt: 0.75 }}>{fields.map(([key, value]) => <Typography key={key} variant="caption" sx={{ color: '#9daaba', overflowWrap: 'anywhere' }}>{key}: {value}</Typography>)}</Stack></Box>;
}

function Card({ result, response, index }) {
  const intent = result?.intent || result?.type || `resultado_${index + 1}`;
  const data = result?.data && typeof result.data === 'object' ? result.data : result;
  const totals = scalars(data?.totals);
  let content;
  if (intent === 'daily_summary' || intent === 'production_daily_summary') content = <><Fields entries={scalars(data).filter(([key]) => key === 'date_lima' || key === 'fecha')} /><Fields entries={totals} emphasis /><DailyTable groups={data?.groups || []} /></>;
  else if (intent === 'production_order_progress') {
    const rows = (data?.items || data?.rows || []).map((item) => ({ of: first(item, ['of', 'of_id']), ot: item.ot, color: item.color, objetivo: item.objetivo_neto_kg, finalizados: item.kg_finalizados_efectivos, porcentaje: item.porcentaje, cobertura: item.coverage || item.cobertura, mangas: item.mangas?.total ?? item.mangas }));
    content = <><TableView rows={rows} columns={[['of', 'OF'], ['ot', 'OT'], ['color', 'Color'], ['objetivo', 'Objetivo neto (kg)'], ['finalizados', 'Kg finalizados'], ['porcentaje', 'Porcentaje'], ['cobertura', 'Cobertura'], ['mangas', 'Mangas']]} /><Nested value={data?.items || data?.rows || []} /></>;
  } else if (intent === 'weighing_period') content = <><Fields entries={scalars(data).filter(([key]) => ['fecha_desde', 'fecha_hasta'].includes(key))} /><Fields entries={totals} emphasis />{(data?.days || []).map((day, dayIndex) => <Box key={dayIndex} sx={{ borderTop: '1px solid #344454', pt: 1, mt: 1 }}><Typography variant="subtitle2" sx={{ color: '#f5c84c', fontWeight: 750 }}>{day.date_lima || day.fecha || day.date || `Día ${dayIndex + 1}`}</Typography><Fields entries={scalars(day.totals)} emphasis /><Fields entries={scalars(day)} /><DailyTable groups={day.groups || []} /><Nested value={day.correcciones || day.adjustments} /></Box>)}<Typography variant="caption" sx={{ color: '#9daaba' }}>Los pesajes reflejan lecturas registradas en el corte; no representan toda la fabricacion.</Typography></>;
  else if (intent === 'manga_trace') content = <><Fields entries={scalars(data).filter(([key]) => ['id', 'as_of'].includes(key))} /><Typography variant="caption" sx={{ color: '#9daaba', fontWeight: 700 }}>Visibilidad</Typography><Nested value={data?.visibilidad} /><Nested value={data?.secciones || data} /></>;
  else content = <><Fields entries={scalars(data)} /><Nested value={data} /></>;
  return <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#18212b', borderColor: '#344454' }}><Stack spacing={0.9}><Typography component="h3" variant="subtitle2" sx={{ fontWeight: 800, color: '#f5c84c' }}>{TITLES[intent] || label(intent)}</Typography>{content}<Evidence result={result} response={response} /></Stack></Paper>;
}

export default function AssistantV2ResultsV3({ response }) {
  if (!response) return null;
  return <Stack spacing={1} sx={{ mt: 1 }}>{response.message && <Typography variant="body2" sx={{ color: '#f5f7fa', whiteSpace: 'pre-wrap' }}>{response.message}</Typography>}{(response.results || []).map((result, index) => <Card key={`${result?.intent || 'result'}-${index}`} result={result} response={response} index={index} />)}</Stack>;
}
