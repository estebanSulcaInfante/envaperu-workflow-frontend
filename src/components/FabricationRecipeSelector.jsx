import {
  Alert, Box, Button, Chip, Link, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { approvedRecipesForRun } from './fabricationRecipeOptions';
import SearchableCatalogAutocomplete from './ui/SearchableCatalogAutocomplete';

const recipeName = (recipe) => recipe?.nombre_variante || recipe?.nombre || `Receta ${recipe?.id}`;

const recipeLabel = (recipe) => [
  `Rev. ${recipe.revision}`,
  recipe.es_default ? 'Predeterminada' : null,
].filter(Boolean).join(' · ');

const amountLabel = (line, recipe) => {
  if (line.tipo_componente === 'MATERIA_PRIMA') {
    return `${Number(line.cantidad * 100).toLocaleString('es-PE', { maximumFractionDigits: 2 })}% de la mezcla`;
  }
  const base = line.base_kg ?? recipe.base_virgen_kg;
  return `${Number(line.cantidad).toLocaleString('es-PE', { maximumFractionDigits: 4 })} g / ${Number(base).toLocaleString('es-PE', { maximumFractionDigits: 3 })} kg virgen`;
};

export default function FabricationRecipeSelector({
  idPrefix,
  run,
  colorId,
  recipes,
  value,
  frozenRecipe,
  editable,
  onChange,
  onOpenWorkspace,
  compact = false,
}) {
  const approved = approvedRecipesForRun(recipes, run, colorId);
  const catalogSelected = approved.find((recipe) => Number(recipe.id) === Number(value));
  const selected = catalogSelected
    || (Number(frozenRecipe?.id) === Number(value) ? frozenRecipe : null);
  const selectable = selected && !approved.some((recipe) => recipe.id === selected.id)
    ? [selected, ...approved]
    : approved;

  return (
    <Stack spacing={1.25} sx={compact ? undefined : { px: 2, pb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
        <SearchableCatalogAutocomplete
          id={`${idPrefix}-recipe`}
          label="Formulación de material"
          options={selectable}
          value={selected}
          disabled={!editable}
          onChange={(option) => onChange(option?.id || '')}
          getOptionKey={(option) => option?.id}
          getOptionDisabled={(option) => !approved.some((recipe) => Number(recipe.id) === Number(option.id))}
          getPrimary={recipeName}
          getSecondary={recipeLabel}
          getSearchText={(option) => [recipeName(option), recipeLabel(option), option?.revision, option?.codigo, option?.color_nombre].filter(Boolean).join(' ')}
          getColorHex={(option) => option?.hex_referencia || option?.color_hex || option?.color_produccion?.hex_referencia}
          noOptionsText="No hay formulaciones aprobadas compatibles"
        />
        {!compact && !editable && selected && (
          <Chip size="small" color="success" variant="outlined" label="Congelada al liberar" />
        )}
        {!compact && editable && onOpenWorkspace && <Button variant="outlined" onClick={onOpenWorkspace}>Crear o editar aquí</Button>}
      </Stack>

      {!compact && !selected && (
        <Alert severity="warning">
          {editable
            ? (onOpenWorkspace
              ? 'Este color no tiene una formulación aprobada compatible con el objetivo. Crea o aprueba una aquí antes de liberar la OF. '
              : 'Este color no tiene una formulación aprobada compatible. Tu perfil no puede crearla; solicita administración de artículos. ')
            : 'Este objetivo no conserva una formulación visible. Revísalo en Datos maestros. '}
          <Link component={RouterLink} to="/datos-maestros/colores" fontWeight={700}>
            Abrir Colores y recetas
          </Link>
        </Alert>
      )}
      {!compact && editable && selected && !catalogSelected && (
        <Alert severity="warning">
          La formulación asociada ya no está aprobada o no es compatible con este objetivo.
          Selecciona una variante vigente antes de liberar.
        </Alert>
      )}
      {!compact && selected && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 1.5, py: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" fontWeight={800}>{recipeName(selected)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Revisión {selected.revision} · Base de referencia {selected.base_virgen_kg} kg virgen
              {selected.producto_sku ? ` · Solo ${selected.producto_sku}` : ' · Uso general'}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small" aria-label={`Composición de ${recipeName(selected)}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Componente</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell align="right">Proporción / dosis</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(selected.lineas || []).map((line) => (
                  <TableRow key={line.id || `${line.material_id}-${line.tipo_componente}`}>
                    <TableCell>
                      {line.material_nombre || `Material ${line.material_id}`}
                      {line.material_codigo && (
                        <Typography display="block" variant="caption" color="text.secondary">
                          {line.material_codigo}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{line.tipo_componente.replaceAll('_', ' ')}</TableCell>
                    <TableCell align="right">{amountLabel(line, selected)}</TableCell>
                  </TableRow>
                ))}
                {!(selected.lineas || []).length && (
                  <TableRow>
                    <TableCell colSpan={3}>La formulación no contiene componentes visibles.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  );
}
