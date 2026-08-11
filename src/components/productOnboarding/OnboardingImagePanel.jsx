import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const validateImage = (file) => {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Usa una imagen JPEG, PNG o WEBP.';
  }
  if (file.size > IMAGE_MAX_BYTES) return 'La imagen debe pesar como máximo 2 MB.';
  return '';
};

const imageUrl = (target, entry) => (
  entry?.previewUrl
  || entry?.imageUrl
  || target.existingImage?.imagen_url
  || target.existingImage?.image_url
  || ''
);

export default function OnboardingImagePanel({
  title,
  description = 'Adjunta una muestra visual verificable. El archivo no se guarda dentro del JSON del borrador.',
  targets = [],
  entries = {},
  onSelect,
  onRetry,
  disabled = false,
}) {
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedKeys, setSelectedKeys] = useState({});

  if (!targets.length) return null;

  const choose = (target, file) => {
    const validationError = validateImage(file);
    setValidationErrors((current) => ({
      ...current,
      [target.key]: validationError,
    }));
    if (!validationError) {
      setSelectedKeys((current) => ({ ...current, [target.key]: true }));
      onSelect?.(target, file);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2, borderRadius: 2.5 }}>
      <Stack spacing={1.5}>
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <ImageOutlinedIcon color="primary" />
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 850 }}>
              {title}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          {targets.map((target) => {
            const entry = entries[target.key] || {};
            const validationError = validationErrors[target.key];
            const persistedUrl = imageUrl(target, entry);
            const isUploading = entry.status === 'UPLOADING';
            const isPersisted = entry.status === 'DONE' || Boolean(target.existingImage);
            return (
              <Paper key={target.key} variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
                      {target.label}
                    </Typography>
                    <Chip
                      size="small"
                      color={entry.status === 'ERROR' ? 'error' : isPersisted ? 'success' : 'default'}
                      label={entry.status === 'ERROR'
                        ? 'Error'
                        : isUploading ? 'Subiendo…'
                          : isPersisted ? 'Guardada' : 'Sin guardar'}
                    />
                  </Stack>

                  {persistedUrl && (
                    <Box
                      component="img"
                      src={persistedUrl}
                      alt={`Vista previa de ${target.label}`}
                      sx={{
                        width: '100%', height: 150, objectFit: 'contain', borderRadius: 1.5,
                        bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider',
                      }}
                    />
                  )}

                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    disabled={disabled || isUploading}
                    startIcon={<AddPhotoAlternateOutlinedIcon />}
                  >
                    {entry.file || isPersisted ? 'Reemplazar imagen' : 'Seleccionar imagen'}
                    <input
                      hidden
                      type="file"
                      accept={IMAGE_ACCEPT}
                      aria-label={`Seleccionar imagen de ${target.label}`}
                      onChange={(event) => choose(target, event.target.files?.[0])}
                    />
                  </Button>

                  {validationError && <Alert severity="error">{validationError}</Alert>}
                  {(entry.status === 'LOCAL' || selectedKeys[target.key]) && !target.entityId && (
                    <Alert severity="info">
                      El archivo queda solo en esta pestaña hasta aplicar la fase. No recargues
                      ni cierres el navegador si deseas conservarlo.
                    </Alert>
                  )}
                  {entry.status === 'ERROR' && (
                    <Alert
                      severity="error"
                      action={(
                        <Button
                          color="inherit"
                          size="small"
                          startIcon={<RefreshRoundedIcon />}
                          onClick={() => onRetry?.(target)}
                          disabled={disabled || !entry.file}
                        >
                          Reintentar subida
                        </Button>
                      )}
                    >
                      {entry.error || 'No se pudo guardar la imagen. Puedes reintentar sin volver a seleccionarla.'}
                    </Alert>
                  )}
                  {!target.entityId && entry.status !== 'LOCAL' && !selectedKeys[target.key] && (
                    <Typography variant="caption" color="text.secondary">
                      La subida se habilita cuando esta fase resuelva el SKU canónico.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Stack>
    </Paper>
  );
}
