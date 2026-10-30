import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  TextField,
  Typography,
} from '@mui/material';

const CLASS_LABEL = {
  PIEZA_COLOR: 'PiezaColor',
  SUBENSAMBLE_WIP: 'WIP',
  PRODUCTO_TERMINADO: 'Producto terminado',
};

const normalize = (value) => String(value || '')
  .toLocaleLowerCase('es')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const searchableText = (article) => normalize([
    article.codigo,
    article.nombre,
    article.clase,
    CLASS_LABEL[article.clase],
    article.subtipo?.pieza_color_sku,
    article.subtipo?.producto_terminado_id,
    article.subtipo?.color,
    article.color,
    article.wip?.descripcion,
  ].filter(Boolean).join(' '));

const filterArticles = (articles, state) => {
  const terms = normalize(state.inputValue).split(/\s+/).filter(Boolean);
  if (!terms.length) return articles;
  return articles.filter((article) => {
    const haystack = searchableText(article);
    return terms.every((term) => haystack.includes(term));
  });
};

function ScmArticleAutocomplete({
  label,
  articles,
  value,
  onChange,
  getOptionValue = (article) => article.id,
  helperText,
  placeholder = 'Buscar por código, nombre o clase',
  disabled = false,
  required = false,
  size = 'small',
  remote = false,
  onSearch,
  searchLoading = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const selectedFromValue = useMemo(() => articles.find(
    (article) => String(getOptionValue(article)) === String(value),
  ) || null, [articles, getOptionValue, value]);
  const options = useMemo(() => {
    if (!selectedFromValue || articles.some((article) => String(getOptionValue(article)) === String(value))) {
      return articles;
    }
    return [selectedFromValue, ...articles];
  }, [articles, getOptionValue, selectedFromValue, value]);
  const selectedArticle = selectedFromValue;

  return (
    <Autocomplete
      fullWidth
      openOnFocus
      autoHighlight
      options={options}
      value={selectedArticle}
      disabled={disabled}
      loading={remote ? searchLoading : false}
      filterOptions={remote ? (available) => available : filterArticles}
      inputValue={inputValue}
      onInputChange={(_, nextValue, reason) => {
        setInputValue(nextValue);
        if (remote && reason !== 'reset') onSearch?.(nextValue);
      }}
      getOptionLabel={(article) => `${article.codigo} · ${article.nombre}`}
      isOptionEqualToValue={(option, selected) => (
        String(getOptionValue(option)) === String(getOptionValue(selected))
      )}
      onChange={(_, article) => onChange(
        article ? String(getOptionValue(article)) : '',
        article,
      )}
      noOptionsText={searchLoading ? 'Buscando artículos…' : 'No hay artículos que coincidan con la búsqueda.'}
      renderOption={(props, article) => {
        const { key, ...optionProps } = props;
        return (
          <Box
            component="li"
            key={key}
            {...optionProps}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {article.codigo}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {article.nombre}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={CLASS_LABEL[article.clase] || article.clase}
            />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={helperText}
          required={required}
          size={size}
        />
      )}
    />
  );
}

export default ScmArticleAutocomplete;
