import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';

const COLOR_HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const COLOR_HEX_PRESETS = [
  '#D32F2F', '#F57C00', '#FBC02D', '#388E3C', '#00897B',
  '#1976D2', '#303F9F', '#7B1FA2', '#E91E63', '#795548',
  '#FFFFFF', '#9E9E9E', '#212121',
];

export function ColorSwatch({ hex, size = 28 }) {
  const validHex = COLOR_HEX_PATTERN.test(hex || '') ? hex : null;
  return (
    <Box
      aria-label={validHex ? `Color ${validHex}` : 'Color sin HEX'}
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        bgcolor: validHex || 'grey.200',
        border: '1px solid',
        borderColor: 'divider',
        flex: '0 0 auto',
      }}
    />
  );
}

export default function ColorHexPickerField({ value = '', onChange, disabled = false }) {
  const normalizedValue = String(value || '').toUpperCase();
  const validHex = COLOR_HEX_PATTERN.test(normalizedValue) ? normalizedValue : null;
  const update = (nextValue) => onChange?.(String(nextValue || '').toUpperCase());

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <ColorSwatch hex={validHex} size={42} />
        <TextField
          label="Paleta de color"
          type="color"
          value={validHex || '#000000'}
          onChange={(event) => update(event.target.value)}
          disabled={disabled}
          sx={{ width: { xs: '100%', sm: 150 } }}
          slotProps={{ htmlInput: { 'aria-label': 'Escoger color de la paleta' } }}
        />
        <TextField
          label="HEX de referencia (opcional)"
          placeholder="#F2C94C"
          value={normalizedValue}
          onChange={(event) => update(event.target.value)}
          disabled={disabled}
          fullWidth
        />
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary">Colores frecuentes</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
          {COLOR_HEX_PRESETS.map((hex) => (
            <IconButton
              key={hex}
              aria-label={`Usar color ${hex}`}
              title={hex}
              onClick={() => update(hex)}
              disabled={disabled}
              sx={{ p: 0.25, border: '1px solid', borderColor: 'divider' }}
            >
              <ColorSwatch hex={hex} size={26} />
            </IconButton>
          ))}
          <Button size="small" onClick={() => update('')} disabled={disabled}>Sin color</Button>
        </Stack>
      </Box>
    </Stack>
  );
}
