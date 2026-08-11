import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import CreateOptionAutocomplete from '../ui/CreateOptionAutocomplete';
import ClassificationQuickCreateDialog from '../ui/ClassificationQuickCreateDialog';
import {
  buscarProductos,
  obtenerFamilias,
  obtenerLineas,
} from '../../services/api';
import {
  findExactProductDuplicate,
  normalizeIdentityData,
  validateIdentity,
} from './onboardingModel';

const MODE_OPTIONS = [
  { value: 'NUEVO', label: 'Crear nuevo', icon: <AddBoxOutlinedIcon /> },
  { value: 'COPIAR', label: 'Copiar existente', icon: <ContentCopyRoundedIcon /> },
  { value: 'SELECCIONAR', label: 'Usar existente', icon: <Inventory2OutlinedIcon /> },
];

const optionalProductNumber = (value) => (
  value === '' || value === null || value === undefined ? '' : value
);

const productReference = (product) => product ? ({
  cod_sku_pt: product.cod_sku_pt || product.sku,
  producto: product.producto || product.nombre,
}) : null;

export default function ProductIdentityStep({
  value,
  onChange,
  onProductsChange,
  showValidation = false,
}) {
  const identity = useMemo(() => normalizeIdentityData(value), [value]);
  const [catalogs, setCatalogs] = useState({ products: [], lines: [], families: [] });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });

  useEffect(() => {
    let active = true;
    Promise.all([buscarProductos(''), obtenerLineas()])
      .then(([products, lines]) => {
        if (!active) return;
        const normalizedProducts = Array.isArray(products) ? products : products?.items || [];
        setCatalogs((current) => ({ ...current, products: normalizedProducts, lines }));
        onProductsChange?.(normalizedProducts);
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar los cat\u00e1logos de apoyo.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onProductsChange]);

  useEffect(() => {
    const query = String(identity.producto.producto || '').trim();
    if (query.length < 2 || identity.modo === 'SELECCIONAR') return undefined;
    const timer = globalThis.setTimeout(() => {
      buscarProductos(query)
        .then((matches) => {
          const incoming = Array.isArray(matches) ? matches : matches?.items || [];
          setCatalogs((current) => {
            const bySku = new Map(current.products.map((item) => [
              String(item.cod_sku_pt || item.sku), item,
            ]));
            incoming.forEach((item) => bySku.set(String(item.cod_sku_pt || item.sku), item));
            const products = [...bySku.values()];
            onProductsChange?.(products);
            return { ...current, products };
          });
        })
        .catch(() => {});
    }, 360);
    return () => globalThis.clearTimeout(timer);
  }, [identity.modo, identity.producto.producto, onProductsChange]);

  useEffect(() => {
    let active = true;
    const lineId = identity.producto.linea_id;
    if (!lineId) {
      setCatalogs((current) => ({ ...current, families: [] }));
      return () => { active = false; };
    }
    obtenerFamilias({ linea_id: lineId })
      .then((families) => {
        if (!active) return;
        setCatalogs((current) => ({ ...current, families }));
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar las familias vinculadas a la L\u00ednea.');
      });
    return () => { active = false; };
  }, [identity.producto.linea_id]);

  const errors = validateIdentity(identity, catalogs.products);
  const duplicate = findExactProductDuplicate(identity, catalogs.products);
  const locked = identity.modo === 'SELECCIONAR';

  const emit = (next) => onChange(normalizeIdentityData(next));
  const patchProduct = (patch) => emit({
    ...identity,
    producto: { ...identity.producto, ...patch },
  });
  const patchSource = (patch) => emit({
    ...identity,
    procedencia: { ...identity.procedencia, ...patch },
  });

  const selectProduct = (selected, mode = identity.modo) => {
    if (!selected) {
      emit({
        ...identity,
        producto_ref: null,
        producto_fuente_ref: null,
        producto: { ...identity.producto, cod_sku_pt: '' },
      });
      return;
    }
    const sourceRef = productReference(selected);
    const copiedProduct = {
      cod_sku_pt: mode === 'SELECCIONAR' ? sourceRef.cod_sku_pt : '',
      producto: mode === 'COPIAR'
        ? `${selected.producto || selected.nombre || ''} - COPIA`
        : selected.producto || selected.nombre || '',
      linea_id: selected.linea_id || '',
      familia_id: selected.familia_id || '',
      peso_g: optionalProductNumber(selected.peso_g),
      marca: selected.marca || '',
    };
    emit({
      ...identity,
      producto_ref: mode === 'SELECCIONAR' ? sourceRef : null,
      producto_fuente_ref: mode === 'COPIAR' ? sourceRef : null,
      producto: copiedProduct,
      procedencia: {
        ...identity.procedencia,
        tipo: mode === 'COPIAR' ? 'SISTEMA' : identity.procedencia.tipo,
        referencia: mode === 'COPIAR'
          ? sourceRef.cod_sku_pt
          : identity.procedencia.referencia,
      },
    });
  };

  const changeMode = (_, mode) => {
    if (!mode || mode === identity.modo) return;
    emit({
      ...normalizeIdentityData(),
      modo: mode,
      procedencia: identity.procedencia,
    });
  };

  const registerClassification = (created) => {
    if (classificationDialog.entity === 'linea') {
      setCatalogs((current) => ({
        ...current,
        lines: current.lines.some((item) => item.id === created.id)
          ? current.lines : [...current.lines, created],
        families: [],
      }));
      patchProduct({ linea_id: created.id, familia_id: '' });
      return;
    }
    setCatalogs((current) => ({
      ...current,
      families: current.families.some((item) => item.id === created.id)
        ? current.families : [...current.families, created],
    }));
    patchProduct({ familia_id: created.id });
  };

  if (loading) {
    return (
      <Stack spacing={1.25} aria-label="Cargando identidad">
        <Skeleton height={54} />
        <Skeleton height={170} />
        <Skeleton height={170} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.25}>
      <Box>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
          1. Identidad y fuente
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          Crea una identidad nueva, parte de un producto parecido o retoma uno existente.
        </Typography>
      </Box>

      {catalogError && <Alert severity="error">{catalogError}</Alert>}
      {duplicate && (
        <Alert severity="warning">
          Ya existe <strong>{duplicate.cod_sku_pt}</strong> con el mismo nombre. Usa
          {' “Usar existente” '}o cambia el nombre antes de completar esta fase.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.25 } }}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
          Estrategia de alta
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={identity.modo}
          onChange={changeMode}
          aria-label="Estrategia de alta"
          sx={{
            mt: 0.75,
            '& .MuiToggleButton-root': { gap: 0.75, py: 1.1, textTransform: 'none', fontWeight: 750 },
          }}
        >
          {MODE_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.icon}{option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {(identity.modo === 'COPIAR' || identity.modo === 'SELECCIONAR') && (
          <Autocomplete
            options={catalogs.products}
            value={catalogs.products.find((item) => (
              String(item.cod_sku_pt || item.sku) === String(
                identity.modo === 'COPIAR'
                  ? identity.producto_fuente_ref?.cod_sku_pt
                  : identity.producto_ref?.cod_sku_pt,
              )
            )) || null}
            onChange={(_, selected) => selectProduct(selected)}
            getOptionLabel={(option) => `${option.cod_sku_pt || option.sku} · ${option.producto || option.nombre}`}
            renderInput={(params) => (
              <TextField
                {...params}
                label={identity.modo === 'COPIAR' ? 'Producto base para copiar' : 'Producto existente'}
                required
                error={showValidation && Boolean(errors.producto_ref)}
                helperText={showValidation ? errors.producto_ref : ''}
                sx={{ mt: 2 }}
              />
            )}
          />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.25 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}>
          <Inventory2OutlinedIcon color="primary" />
          <Box>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 850 }}>Producto Terminado</Typography>
            <Typography variant="caption" color="text.secondary">
              La BOM, ruta y empaque se agregan en fases posteriores.
            </Typography>
          </Box>
        </Stack>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="SKU"
              value={identity.producto.cod_sku_pt || 'PT-###### · autom\u00e1tico'}
              slotProps={{ input: { readOnly: true } }}
              helperText="Identificador estable asignado por el sistema."
              fullWidth
            />
            <TextField
              label="Nombre del producto"
              value={identity.producto.producto}
              onChange={(event) => patchProduct({ producto: event.target.value })}
              slotProps={{ input: { readOnly: locked } }}
              required
              error={showValidation && Boolean(errors.producto || errors.duplicate)}
              helperText={showValidation ? errors.producto || (errors.duplicate ? 'El nombre ya est\u00e1 registrado.' : '') : ''}
              autoFocus
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <CreateOptionAutocomplete
              options={catalogs.lines}
              value={catalogs.lines.find((item) => String(item.id) === String(identity.producto.linea_id)) || null}
              getOptionLabel={(option) => option.nombre}
              onChange={(selected) => patchProduct({ linea_id: selected?.id || '', familia_id: '' })}
              onCreateOption={(name) => setClassificationDialog({ open: true, entity: 'linea', initialName: name })}
              createLabel={(name) => name ? `Crear L\u00ednea “${name}”\u2026` : 'Crear nueva L\u00ednea\u2026'}
              label={'L\u00ednea'}
              required
              disabled={locked}
              error={showValidation && Boolean(errors.linea_id)}
              helperText={showValidation ? errors.linea_id : 'Clasificaci\u00f3n comercial principal.'}
            />
            <CreateOptionAutocomplete
              options={catalogs.families}
              value={catalogs.families.find((item) => String(item.id) === String(identity.producto.familia_id)) || null}
              getOptionLabel={(option) => option.nombre}
              onChange={(selected) => patchProduct({ familia_id: selected?.id || '' })}
              onCreateOption={(name) => setClassificationDialog({ open: true, entity: 'familia', initialName: name })}
              createLabel={(name) => name ? `Crear Familia “${name}” en esta L\u00ednea\u2026` : 'Crear Familia vinculada\u2026'}
              label="Familia"
              required
              disabled={locked || !identity.producto.linea_id}
              error={showValidation && Boolean(errors.familia_id)}
              helperText={showValidation && errors.familia_id
                ? errors.familia_id
                : identity.producto.linea_id
                  ? 'Solo aparecen familias ya vinculadas a la L\u00ednea.'
                  : 'Selecciona primero una L\u00ednea.'}
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Marca"
              value={identity.producto.marca}
              onChange={(event) => patchProduct({ marca: event.target.value })}
              slotProps={{ input: { readOnly: locked } }}
              fullWidth
            />
            <TextField
              label="Peso referencial (g)"
              type="number"
              value={identity.producto.peso_g}
              onChange={(event) => patchProduct({ peso_g: event.target.value })}
              slotProps={{ input: { readOnly: locked }, htmlInput: { min: 0, step: 0.001 } }}
              fullWidth
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.25 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <SourceOutlinedIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 850 }}>Procedencia del dato</Typography>
            <Typography variant="caption" color="text.secondary">
              Obligatoria para completar; el borrador puede guardarse incompleto.
            </Typography>
          </Box>
          <Chip size="small" label="Trazabilidad" variant="outlined" color="primary" />
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="source-type-label">Tipo de fuente</InputLabel>
              <Select
                labelId="source-type-label"
                label="Tipo de fuente"
                value={identity.procedencia.tipo}
                onChange={(event) => patchSource({ tipo: event.target.value })}
              >
                <MenuItem value="EXCEL">Excel o archivo</MenuItem>
                <MenuItem value="SISTEMA">Otro registro del sistema</MenuItem>
                <MenuItem value="ENTREVISTA">Conocimiento del trabajador</MenuItem>
                <MenuItem value="FICHA">{'Ficha t\u00e9cnica'}</MenuItem>
                <MenuItem value="OTRO">Otra fuente</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Archivo o fuente"
              value={identity.procedencia.referencia}
              onChange={(event) => patchSource({ referencia: event.target.value })}
              required
              error={showValidation && Boolean(errors.referencia)}
              helperText={showValidation ? errors.referencia : 'Nombre, enlace, persona o documento de origen.'}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={'Hoja o secci\u00f3n'}
              value={identity.procedencia.hoja}
              onChange={(event) => patchSource({ hoja: event.target.value })}
              fullWidth
            />
            <TextField
              label="Fila o referencia"
              value={identity.procedencia.fila}
              onChange={(event) => patchSource({ fila: event.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            label={'Notas de interpretaci\u00f3n'}
            value={identity.procedencia.notas}
            onChange={(event) => patchSource({ notas: event.target.value })}
            multiline
            minRows={2}
            helperText={'Registra dudas, equivalencias o decisiones que otra persona deber\u00eda conocer.'}
          />
        </Stack>
      </Paper>

      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={catalogs.lines.find((item) => String(item.id) === String(identity.producto.linea_id)) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({ ...current, open: false }))}
        onCreated={registerClassification}
      />
    </Stack>
  );
}
