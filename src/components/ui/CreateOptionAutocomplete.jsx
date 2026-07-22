import { useMemo } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  TextField,
  Typography,
  createFilterOptions,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const CREATE_OPTION = '__create_option__';
const filter = createFilterOptions();

/**
 * Autocomplete reutilizable que mantiene la creación como la última opción.
 * La fila especial no se convierte en un valor: delega la apertura del modal
 * mediante `onCreateOption`, conservando la selección actual hasta completar
 * el alta.
 */
function CreateOptionAutocomplete({
  options = [],
  value = null,
  onChange,
  onCreateOption,
  getOptionLabel = (option) => option?.nombre || '',
  isOptionEqualToValue = (option, selected) => option?.id === selected?.id,
  createLabel = 'Crear nuevo…',
  label,
  loading = false,
  disabled = false,
  required = false,
  placeholder,
  helperText,
  error = false,
  size = 'small',
  noOptionsText = 'No hay registros',
  textFieldProps = {},
}) {
  const normalizedOptions = useMemo(() => options.filter(Boolean), [options]);

  const optionLabel = (option) => {
    if (option?.[CREATE_OPTION]) return option.inputValue || '';
    return getOptionLabel(option);
  };

  const getCreateText = (inputValue) => {
    if (typeof createLabel === 'function') return createLabel(inputValue);
    return createLabel;
  };

  return (
    <Autocomplete
      fullWidth
      options={normalizedOptions}
      value={value}
      loading={loading}
      disabled={disabled}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, selected) => (
        !option?.[CREATE_OPTION]
        && !selected?.[CREATE_OPTION]
        && isOptionEqualToValue(option, selected)
      )}
      filterOptions={(availableOptions, params) => {
        const filtered = filter(availableOptions, params);
        filtered.push({
          [CREATE_OPTION]: true,
          inputValue: params.inputValue.trim(),
        });
        return filtered;
      }}
      onChange={(_, selected, reason) => {
        if (selected?.[CREATE_OPTION]) {
          onCreateOption?.(selected.inputValue);
          return;
        }
        onChange?.(selected, reason);
      }}
      noOptionsText={noOptionsText}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        if (option?.[CREATE_OPTION]) {
          return (
            <Box
              component="li"
              key="create-new-option"
              {...optionProps}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                color: 'primary.main',
                gap: 1,
                mt: 0.5,
                pt: 1,
                fontWeight: 700,
              }}
            >
              <AddCircleOutlineIcon fontSize="small" />
              <Typography component="span" variant="body2" fontWeight={700}>
                {getCreateText(option.inputValue)}
              </Typography>
            </Box>
          );
        }

        return (
          <li key={key} {...optionProps}>
            {getOptionLabel(option)}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          {...textFieldProps}
          label={label}
          size={size}
          required={required}
          placeholder={placeholder}
          helperText={helperText}
          error={error}
          InputProps={{
            ...params.InputProps,
            ...textFieldProps.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      selectOnFocus
      handleHomeEndKeys
    />
  );
}

export default CreateOptionAutocomplete;
