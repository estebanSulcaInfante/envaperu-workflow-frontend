import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { hasInitialObservation, pieceCompletion } from './qualityPieceModel';

export function physicalKey(piece) {
  return piece.output.pieza_id != null ? 'pieza:' + piece.output.pieza_id : 'salida:' + piece.outputId;
}
export function physicalName(p) {
  const suffix = ' ' + p.workLabel;
  return p.outputLabel.toUpperCase().endsWith(suffix.toUpperCase()) ? p.outputLabel.slice(0,-suffix.length) : p.outputLabel;
}
export function QualityPieceIndex({pieces,onOpen}) {
  const groups = new Map();
  for (const piece of pieces) {
    const key = physicalKey(piece);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(piece);
  }
  return <Stack spacing={{ xs: 1.5, sm: 2 }}>
    <Typography component="h2" variant="h6" fontWeight={850}>Piezas de esta OT</Typography>
    {!pieces.length && <Alert severity="info">Esta OT aún no tiene piezas para inspeccionar.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1, sm: 1.5 } }}>
      {[...groups].map(([key, rows]) => <Paper key={key} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1.25, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack spacing={0.75}>
          <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.25 }}>{physicalName(rows[0])}</Typography>
          <Chip size="small" variant="outlined" color="primary" sx={{ alignSelf: 'flex-start' }} label={`${rows.length} ${rows.length === 1 ? 'trabajo de color' : 'trabajos de color'}`} />
        </Stack>
        <Button variant="contained" fullWidth sx={{ minHeight: 44 }} onClick={() => onOpen(rows[0])}>Abrir pieza</Button>
      </Paper>)}
    </Box>
  </Stack>;
}
export function ControlRow({ title, detail, onOpen, disabled = false, ariaLabel }) {
  return (
    <Button variant="outlined" fullWidth onClick={onOpen} disabled={disabled} aria-label={ariaLabel}
      sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5, textAlign: 'left', minHeight: 52, py: 1, px: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper', borderColor: 'primary.main',
        '&.Mui-disabled': { color: 'text.secondary', bgcolor: 'action.hover', borderColor: 'divider' },
        '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: 2 },
      }}>
      <Typography component="span" fontWeight={750}>{title}</Typography>
      <Typography component="span" variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'left', sm: 'right' } }}>{detail}</Typography>
    </Button>
  );
}

export function QualityPieceControls({ piece, pieces, records, visits, onRegister, initialClosed = false, readOnly = false, cutoffLabel = '08:00' }) {
  const rows = pieces.filter(row => physicalKey(row) === physicalKey(piece));
  const rowKeys = new Set(rows.map(row => row.key));
  const periodics = visits.filter(visit =>
    visit.kind === 'PERIODICA' && visit.pieceKeys?.some(key => rowKeys.has(key))
  );
  const completed = rows.filter(row => pieceCompletion(records[row.key]).complete).length;
  const ownRow = rows.find((row) => row.workId === piece.workId) || piece;
  const initialRow = !pieceCompletion(records[ownRow.key]).complete ? ownRow : (rows.find(row => !pieceCompletion(records[row.key]).complete) || piece);
  const initialVisit = visits.find((visit) => visit.kind === 'INICIAL' && visit.pieceKeys?.includes(initialRow.key));
  const nextNumber = 2 + periodics.length;
  const hasInitialRecord = hasInitialObservation(records[ownRow.key]);
  const initialDisabled = readOnly || (initialClosed && !hasInitialRecord);
  const disabledDetail = readOnly ? 'Solo consulta' : initialClosed && !hasInitialRecord ? `Plazo cerrado a las ${cutoffLabel} (Lima)` : null;
  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }} data-testid="quality-piece-detail">
      <Box>
        <Typography component="h2" variant="h5" fontWeight={850} sx={{ lineHeight: 1.2 }}>{physicalName(piece)}</Typography>
        <Typography variant="body2" color="text.secondary">Controles de la pieza · {rows.length} {rows.length === 1 ? 'trabajo de color' : 'trabajos de color'}</Typography>
      </Box>
      {readOnly && <Alert severity="info">Esta estación está en modo consulta y no permite crear ni editar controles o incidencias.</Alert>}
      <ControlRow title="Control de arranque"
        detail={disabledDetail || (rows.length === 1 ? (completed ? 'Realizado' : 'Pendiente') : completed + ' de ' + rows.length + ' trabajos')}
        disabled={initialDisabled}
        onOpen={() => onRegister(initialRow, 'INICIAL', initialVisit?.id || '', 1)} />
      {periodics.map((visit, index) => {
        const row = rows.find(candidate => visit.pieceKeys.includes(candidate.key));
        const number = index + 2;
        return <ControlRow key={visit.id} title={'Control #' + number}
          detail={visit.status === 'DRAFT' ? 'Continuar borrador' : 'Realizado'}
          disabled={readOnly}
          onOpen={() => onRegister(row, 'PERIODICA', visit.id, number)} />;
      })}
      <ControlRow title={'Control #' + nextNumber} detail={readOnly ? 'Solo consulta' : 'Registrar'} disabled={readOnly}
        onOpen={() => onRegister(piece, 'PERIODICA', '', nextNumber)} />
    </Stack>
  );
}
