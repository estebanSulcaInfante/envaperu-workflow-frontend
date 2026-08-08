import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';

function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar en toda la tabla',
  filters = [],
  resultCount,
  totalCount,
  onClear,
  actions,
  sx,
}) {
  const hasActiveFilter = Boolean(searchValue) || filters.some((filter) => {
    const neutralValues = filter.allValue === undefined
      ? ['TODOS', 'TODAS']
      : [filter.allValue];
    return filter.value !== undefined
      && filter.value !== null
      && filter.value !== ''
      && !neutralValues.includes(filter.value);
  });

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderRadius: 1,
        ...sx,
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
        <TextField
          size="small"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          sx={{ minWidth: { lg: 300 }, flex: { lg: '1 1 360px' } }}
          slotProps={{
            htmlInput: {
              'aria-label': 'Omnibúsqueda',
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {filters.map((filter) => (
          <TextField
            key={filter.id}
            select
            size="small"
            label={filter.label}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            sx={{ minWidth: filter.minWidth || 170 }}
          >
            {(filter.options || []).map((option) => {
              const normalized = typeof option === 'object' ? option : { value: option, label: option };
              return <MenuItem key={normalized.value} value={normalized.value}>{normalized.label}</MenuItem>;
            })}
          </TextField>
        ))}

        {hasActiveFilter && onClear && (
          <Button
            variant="text"
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={onClear}
            sx={{ whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', lg: 'center' } }}
          >
            Limpiar
          </Button>
        )}

        {(Number.isFinite(resultCount) || actions) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            sx={{ ml: { lg: 'auto' }, width: { xs: '100%', lg: 'auto' } }}
          >
            {Number.isFinite(resultCount) && (
              <Typography
                role="status"
                aria-live="polite"
                variant="caption"
                color="text.secondary"
                sx={{ whiteSpace: 'nowrap' }}
              >
                {resultCount}{Number.isFinite(totalCount) ? ` de ${totalCount}` : ''} resultados
              </Typography>
            )}
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default DataTableToolbar;
