import { Box, Stack, Typography } from '@mui/material';

/** A reference swatch supplements the color name; it never conveys status. */
export default function ProductionColorLabel({ name, hex, compact = false }) {
  const reference = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex.trim())
    ? hex.trim().toUpperCase()
    : null;

  return (
    <Stack component="span" direction="row" spacing={0.75} alignItems="center">
      <Box
        component="span"
        aria-hidden="true"
        title={reference ? `Muestra de referencia: ${reference}` : 'Sin hexadecimal de referencia'}
        sx={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
          bgcolor: reference || 'transparent', border: '1px solid',
          borderColor: 'text.secondary', color: 'text.secondary', fontSize: 12,
        }}
      >
        {!reference && '—'}
      </Box>
      <Box component="span" sx={{ minWidth: 0 }}>
        <Typography component="span" fontWeight={compact ? 700 : 800} sx={compact ? { fontSize: '13px', lineHeight: 1.25 } : undefined}>{name}</Typography>
        {!reference && <Typography component="span" display="block" variant="caption" color="text.secondary" sx={compact ? { fontSize: '12px', lineHeight: 1.2 } : undefined}>Sin muestra</Typography>}
      </Box>
    </Stack>
  );
}
