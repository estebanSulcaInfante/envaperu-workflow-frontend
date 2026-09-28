import { useMemo, useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, List, ListItem, ListItemButton, ListItemText, Stack, TextField,
  Typography,
} from '@mui/material';
import { normalizeSearchText } from '../../models/productionHistoryFilters';

export default function SearchableMultiSelect({ label, options, value, onApply, helperText, immediate = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(value || []);

  const visibleOptions = useMemo(() => {
    const needle = normalizeSearchText(query.trim());
    return options.filter(({ label: optionLabel, value: optionValue }) => (
      !needle || normalizeSearchText(`${optionLabel} ${optionValue}`).includes(needle)
    ));
  }, [options, query]);
  const visibleValues = visibleOptions.map(({ value: optionValue }) => optionValue);
  const selectedVisible = visibleValues.filter((item) => draft.includes(item));
  const allVisibleSelected = visibleValues.length > 0 && selectedVisible.length === visibleValues.length;
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;

  const openDialog = () => {
    setDraft(value || []);
    setQuery('');
    setOpen(true);
  };
  const closeDialog = () => {
    setOpen(false);
    setQuery('');
  };
  const toggle = (optionValue) => {
    setDraft((current) => (current.includes(optionValue)
      ? current.filter((item) => item !== optionValue)
      : [...current, optionValue]));
  };
  const selectVisible = () => setDraft((current) => [...new Set([...current, ...visibleValues])]);
  const clearVisible = () => setDraft((current) => current.filter((item) => !visibleValues.includes(item)));
  const commit = (next) => {
    setDraft(next);
    if (immediate) onApply(next);
  };
  const toggleOption = (optionValue) => {
    const next = draft.includes(optionValue)
      ? draft.filter((item) => item !== optionValue)
      : [...draft, optionValue];
    commit(next);
  };
  const selectVisibleNow = () => {
    const next = [...new Set([...draft, ...visibleValues])];
    commit(next);
  };
  const clearVisibleNow = () => commit(draft.filter((item) => !visibleValues.includes(item)));
  const apply = () => {
    onApply([...draft]);
    closeDialog();
  };

  return <>
    <Button
      variant="outlined"
      onClick={openDialog}
      aria-haspopup="dialog"
      aria-label={label}
      aria-invalid={Boolean(helperText)}
      aria-describedby={helperText ? `${label}-error` : undefined}
      sx={{ justifyContent: 'space-between', minWidth: { sm: 190 } }}
    >
      <span>{label}</span>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
        {(value || []).length} seleccionadas
      </Typography>
    </Button>
    {helperText && <Typography id={`${label}-error`} role="alert" aria-live="polite" variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{helperText}</Typography>}
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm" aria-labelledby={`${label}-dialog-title`}>
      <DialogTitle id={`${label}-dialog-title`}>{label}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          <TextField
            autoFocus
            size="small"
            label={`Buscar ${label.toLocaleLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputProps={{ 'aria-label': `Buscar opciones de ${label}` }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
             <Button size="small" onClick={immediate ? selectVisibleNow : selectVisible} disabled={visibleValues.length === 0 || allVisibleSelected}>
              Seleccionar visibles
            </Button>
             <Button size="small" onClick={immediate ? clearVisibleNow : clearVisible} disabled={selectedVisible.length === 0}>
              Limpiar visibles
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
              {selectedVisible.length}/{visibleValues.length} visibles seleccionadas
              {someVisibleSelected ? ' · selección parcial' : ''}
            </Typography>
          </Stack>
          <Divider />
          <List dense disablePadding aria-label={`Opciones de ${label}`}>
            {visibleOptions.map(({ value: optionValue, label: optionLabel }) => <ListItem key={optionValue} disablePadding>
              <ListItemButton onClick={() => (immediate ? toggleOption(optionValue) : toggle(optionValue))} dense>
                <Checkbox
                  edge="start"
                  tabIndex={-1}
                  checked={draft.includes(optionValue)}
                  inputProps={{ 'aria-label': optionLabel }}
                  readOnly
                />
                <ListItemText primary={optionLabel} />
              </ListItemButton>
            </ListItem>)}
            {visibleOptions.length === 0 && <ListItem><ListItemText primary="Sin opciones" /></ListItem>}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog}>{immediate ? 'Cerrar' : 'Cancelar'}</Button>
        {!immediate && <Button variant="contained" onClick={apply}>Aplicar selección</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
