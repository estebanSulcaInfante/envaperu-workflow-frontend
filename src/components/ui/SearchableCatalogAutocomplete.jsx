import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete, Box, CircularProgress, IconButton, Menu, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';

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
  getInputLabel,
  getTitleLabel,
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
  sx,
  actions = [],
  onSearch,
  onLoadMore,
  hasMore = false,
}) {
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const searchHandlerRef = useRef(onSearch);
  const searchMountedRef = useRef(false);
  const previousValueKeyRef = useRef(Symbol('uninitialized'));
  searchHandlerRef.current = onSearch;
  const loadMoreOption = useMemo(() => ({ __loadMore: true, id: `${id}-load-more` }), [id]);
  const normalizedOptions = useMemo(() => {
    const rows = options.filter(Boolean);
    return hasMore && onLoadMore ? [...rows, loadMoreOption] : rows;
  }, [hasMore, loadMoreOption, onLoadMore, options]);
  const valueKey = value == null ? null : String(getOptionKey(value));
  const isLoadMore = (option) => Boolean(option?.__loadMore);
  const selectedValue = normalizedOptions.find((option) => !isLoadMore(option) && String(getOptionKey(option)) === valueKey) || value;
  const optionLabel = (option) => isLoadMore(option)
    ? 'Cargar más resultados'
    : getInputLabel?.(option) || getPrimary(option);
  const optionTitle = (option) => isLoadMore(option)
    ? 'Cargar más resultados'
    : getTitleLabel?.(option) || [getPrimary(option), getSecondary(option)].filter(Boolean).join(' · ');
  const selectedLabel = selectedValue ? optionLabel(selectedValue) : '';
  const restoreSelectedInput = () => {
    setInputValue(selectedLabel);
  };

  useEffect(() => {
    if (previousValueKeyRef.current === valueKey) return;
    previousValueKeyRef.current = valueKey;
    setInputValue(selectedLabel);
  }, [selectedLabel, valueKey]);

  useEffect(() => {
    if (!searchHandlerRef.current || !searchMountedRef.current) {
      searchMountedRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => searchHandlerRef.current?.(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

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
      getOptionLabel={optionLabel}
      getOptionDisabled={(option) => isLoadMore(option) ? loading : getOptionDisabled?.(option)}
      isOptionEqualToValue={(option, selected) => !isLoadMore(option) && !isLoadMore(selected) && String(getOptionKey(option)) === String(getOptionKey(selected))}
      filterOptions={(available, state) => {
        const query = normalize(state.inputValue.trim());
        if (!query) return available;
        return available.filter((option) => isLoadMore(option)
          || normalize(getSearchText?.(option) || [getPrimary(option), getSecondary(option)].join(' ')).includes(query));
      }}
      inputValue={inputValue}
      onInputChange={(event, next, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setInputValue(next);
          return;
        }
        // Ignore MUI's internal reset: explicit Escape/blur is handled by
        // onClose/onKeyDown, while a refreshed page with the same identity
        // must not erase an active query.
      }}
      onClose={(_, reason) => {
        if (reason === 'escape' || reason === 'blur') restoreSelectedInput();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selectedValue) restoreSelectedInput();
      }}
      onChange={(event, next, reason) => {
        if (isLoadMore(next)) {
          onLoadMore?.();
          return;
        }
        // Clearing the search text is not clearing the persisted identity.
        if (reason === 'clear' && event?.type !== 'click') return;
        if ((next == null ? null : String(getOptionKey(next))) === valueKey) return;
        onChange?.(next || null);
      }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        if (isLoadMore(option)) {
          return <Box component="li" key={key} {...optionProps}><Typography color="primary" fontWeight={750}>Cargar más resultados</Typography></Box>;
        }
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
      renderInput={(params) => {
        const input = (<TextField
          {...params}
          label={label}
          required={required}
          size={size}
          sx={sx}
          placeholder={placeholder}
          error={error}
          helperText={helperText || (selectedValue ? getSecondary(selectedValue) : undefined)}
          inputProps={{ ...params.inputProps, title: selectedValue ? optionTitle(selectedValue) : undefined, 'aria-disabled': disabled ? 'true' : undefined }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
                {actions.length > 0 && (
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label={`${label}: acciones`}
                    aria-haspopup="menu"
                    aria-expanded={actionsAnchor ? 'true' : undefined}
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => setActionsAnchor(event.currentTarget)}
                  >
                    <MoreVertOutlinedIcon fontSize="small" />
                  </IconButton>
                )}
              </>
            ),
          }}
        />);
        if (!actions.length) return input;
        return (
          <>
            {input}
            <Menu
              anchorEl={actionsAnchor}
              open={Boolean(actionsAnchor)}
              onClose={() => setActionsAnchor(null)}
              MenuListProps={{ 'aria-label': `${label}: acciones` }}
            >
              {actions.map((action) => (
                <MenuItem
                  key={action.label}
                  onClick={() => {
                    setActionsAnchor(null);
                    action.onClick?.();
                  }}
                  disabled={disabled || action.disabled}
                  aria-label={action.ariaLabel || action.label}
                >
                  {action.icon && <Box component="span" sx={{ display: 'inline-flex', mr: 1 }}>{action.icon}</Box>}
                  {action.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        );
      }}
    />
  );
}
