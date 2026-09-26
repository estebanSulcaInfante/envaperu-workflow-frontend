import { useMemo } from 'react';
import {
  Autocomplete, Box, CircularProgress, Stack, TextField, Typography,
} from '@mui/material';

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleUpperCase();

const defaultPrimary = (option) => option?.nombre || option?.name || '';
const defaultSecondary = (option) => option?.codigo || option?.code || '';

const colorHexFor = (option) => option?.hex_referencia
  || option?.color_hex
  || option?.color?.hex_referencia
  || option?.color?.hex
  || option?.color_produccion?.hex_referencia
  || option?.color_produccion?.hex
  || null;

export default function SearchableCatalogAutocomplete({
  id,
  label,
  options = [],
  value = null,
  onChange,
  getOptionKey = (option) => option?.id ?? option?.codigo,
  getPrimary = defaultPrimary,
  getSecondary = defaultSecondary,
  getSearchText,
  getOptionDisabled,
  getColorHex = colorHexFor,
  disabled = false,
  required = false,
  loading = false,
  error = false,
  helperText,
  placeholder,
  noOptionsText = 'Sin coincidencias',
  clearText = 'Limpiar selección',
  size = 'small',
}) {
  const normalizedOptions = useMemo(() => options.filter(Boolean), [options]);
  const valueKey = value == null ? null : String(getOptionKey(value));
  const selectedValue = normalizedOptions.find((option) => String(getOptionKey(option)) === valueKey) || value;
  const optionLabel = (option) => [getPrimary(option), getSecondary(option)].filter(Boolean).join(' · ');

  return (
    <Autocomplete
      id={id}
      fullWidth
      options={normalizedOptions}
      value={selectedValue || null}
      disabled={disabled}
      loading={loading}
      clearText={clearText}
      openText="Abrir opciones"
      closeText="Cerrar opciones"
      loadingText="Cargando opciones…"
      slotProps={{ clearIndicator: { tabIndex: 0, sx: { visibility: 'visible' } } }}
      noOptionsText={normalizedOptions.length ? 'Sin coincidencias' : noOptionsText}
      getOptionLabel={getPrimary}
      getOptionDisabled={getOptionDisabled}
      isOptionEqualToValue={(option, selected) => String(getOptionKey(option)) === String(getOptionKey(selected))}
      filterOptions={(available, state) => {
        const query = normalize(state.inputValue.trim());
        if (!query) return available;
        return available.filter((option) => normalize(getSearchText?.(option) || [getPrimary(option), getSecondary(option)].join(' ')).includes(query));
      }}
      onChange={(event, next, reason) => {
        // Clearing the search text is not clearing the persisted identity.
        if (reason === 'clear' && event?.type !== 'click') return;
        if ((next == null ? null : String(getOptionKey(next))) === valueKey) return;
        onChange?.(next || null);
      }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        const primary = getPrimary(option);
        const secondary = getSecondary(option);
        const hex = getColorHex?.(option);
        const validHex = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex.trim()) ? hex.trim().toUpperCase() : null;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
              {validHex && <Box component="span" aria-hidden="true" sx={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid', borderColor: 'text.secondary', bgcolor: validHex, flexShrink: 0 }} />}
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap fontWeight={750}>{primary}</Typography>
                {secondary && <Typography noWrap variant="caption" color="text.secondary">{secondary}</Typography>}
              </Box>
            </Stack>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          size={size}
          placeholder={placeholder}
          error={error}
          helperText={helperText || (selectedValue ? getSecondary(selectedValue) : undefined)}
          inputProps={{ ...params.inputProps, title: selectedValue ? optionLabel(selectedValue) : undefined, 'aria-disabled': disabled ? 'true' : undefined }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
