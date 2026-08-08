import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  actualizarFamilia,
  actualizarLinea,
  asociarFamiliaALinea,
  crearFamilia,
  crearLinea,
  desasociarFamiliaDeLinea,
  inactivarFamilia,
  inactivarLinea,
  obtenerFamilias,
  obtenerFamiliasDeLinea,
  obtenerLineas,
} from '../services/api';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

const emptyForm = { codigo: '', nombre: '', activo: true };

const asList = (response) => {
  if (Array.isArray(response)) return response;
  return response?.items || response?.resultados || [];
};

const normalizeAssociatedFamilies = (response) => {
  const rows = Array.isArray(response) ? response : response?.familias || response?.items || [];
  return rows.map((row) => {
    if (!row.familia) return row;
    return {
      ...row.familia,
      asociacion_id: row.id,
      asociacion_activa: row.activo,
      asociacion_version: row.version,
    };
  });
};

const apiErrorMessage = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.message
  || fallback
);

const normalizedName = (value = '') => value
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleUpperCase('es-PE');

function CatalogTable({
  title,
  noun,
  rows,
  search,
  onSearchChange,
  onNew,
  onEdit,
  onToggle,
  selectedId,
  onSelect,
}) {
  const visibleRows = useMemo(
    () => rows.filter((row) => matchesOmniSearch(row, search)),
    [rows, search],
  );

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 750 }}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {visibleRows.length} de {rows.length} registros
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNew}>
          Nueva {noun}
        </Button>
      </Stack>

      <Box sx={{ px: 2, py: 1.5 }}>
        <TextField
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          label={`Buscar ${noun}`}
          size="small"
          fullWidth
          slotProps={{ input: { startAdornment: <SearchOutlinedIcon color="action" sx={{ mr: 1 }} /> } }}
        />
      </Box>

      <TableContainer sx={{ maxHeight: 380 }}>
        <Table size="small" stickyHeader aria-label={`Catálogo de ${title.toLowerCase()}`}>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow
                key={row.id}
                hover
                selected={row.id === selectedId}
                onClick={() => onSelect?.(row.id)}
                sx={{ cursor: onSelect ? 'pointer' : 'default' }}
              >
                <TableCell sx={{ fontWeight: 700 }}>{row.codigo_display || row.codigo}</TableCell>
                <TableCell>{row.nombre}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.activo === false ? 'Inactivo' : 'Activo'}
                    color={row.activo === false ? 'default' : 'success'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label={`Editar ${noun} ${row.nombre}`}
                    onClick={(event) => { event.stopPropagation(); onEdit(row); }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color={row.activo === false ? 'success' : 'default'}
                    aria-label={`${row.activo === false ? 'Reactivar' : 'Inactivar'} ${noun} ${row.nombre}`}
                    onClick={(event) => { event.stopPropagation(); onToggle(row); }}
                  >
                    <PowerSettingsNewOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {rows.length === 0
                    ? `Todavía no hay ${title.toLowerCase()} registradas.`
                    : 'No hay resultados para la búsqueda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function LineasFamiliasAdmin() {
  const [lineas, setLineas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [associatedFamilies, setAssociatedFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [lineSearch, setLineSearch] = useState('');
  const [familySearch, setFamilySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [associationLoading, setAssociationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState({ open: false, type: 'linea', item: null });
  const [formData, setFormData] = useState(emptyForm);

  const selectedLine = lineas.find((linea) => linea.id === selectedLineId) || null;

  const loadCatalogs = async () => {
    setLoading(true);
    setError('');
    try {
      const [lineResponse, familyResponse] = await Promise.all([
        obtenerLineas({ include_inactive: true }),
        obtenerFamilias({ include_inactive: true }),
      ]);
      const nextLines = asList(lineResponse);
      setLineas(nextLines);
      setFamilias(asList(familyResponse));
      setSelectedLineId((current) => (
        nextLines.some((linea) => linea.id === current) ? current : nextLines[0]?.id ?? null
      ));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las líneas y familias.'));
    } finally {
      setLoading(false);
    }
  };

  const loadAssociations = async (lineId) => {
    if (!lineId) {
      setAssociatedFamilies([]);
      return;
    }
    setAssociationLoading(true);
    setError('');
    try {
      const response = await obtenerFamiliasDeLinea(lineId);
      setAssociatedFamilies(normalizeAssociatedFamilies(response).filter(
        (family) => family.asociacion_activa !== false,
      ));
    } catch (err) {
      setAssociatedFamilies([]);
      setError(apiErrorMessage(err, 'No se pudieron cargar las familias de la línea.'));
    } finally {
      setAssociationLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  useEffect(() => {
    setSelectedFamilyId('');
    loadAssociations(selectedLineId);
  }, [selectedLineId]);

  const openCreate = (type) => {
    setDialog({ open: true, type, item: null });
    setFormData(emptyForm);
    setError('');
  };

  const openEdit = (type, item) => {
    setDialog({ open: true, type, item });
    setFormData({ codigo: item.codigo ?? '', codigo_display: item.codigo_display, nombre: item.nombre ?? '', activo: item.activo !== false });
    setError('');
  };

  const closeDialog = () => {
    if (!saving) setDialog((current) => ({ ...current, open: false }));
  };

  const saveCatalog = async () => {
    const nombre = formData.nombre.trim();
    if (!nombre) {
      setError('Ingresa un nombre.');
      return;
    }
    const comparisonRows = dialog.type === 'linea' ? lineas : familias;
    const duplicate = comparisonRows.find((row) => (
      row.id !== dialog.item?.id
      && normalizedName(row.nombre) === normalizedName(nombre)
    ));
    if (duplicate) {
      setError(
        `Ya existe ${dialog.type === 'linea' ? 'la línea' : 'la familia'} `
        + `${duplicate.codigo_display || duplicate.codigo} con ese nombre. Revísala antes de crear otra.`,
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { nombre, activo: formData.activo };
      if (dialog.item) {
        payload.codigo = Number(formData.codigo);
        payload.version = dialog.item.version;
        if (dialog.type === 'linea') await actualizarLinea(dialog.item.id, payload);
        else await actualizarFamilia(dialog.item.id, payload);
      } else if (dialog.type === 'linea') {
        await crearLinea(payload);
      } else {
        await crearFamilia(payload);
      }
      setDialog((current) => ({ ...current, open: false }));
      setNotice(`${dialog.type === 'linea' ? 'Línea' : 'Familia'} guardada correctamente.`);
      await loadCatalogs();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el catálogo.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCatalog = async (type, item) => {
    const reactivate = item.activo === false;
    if (!reactivate && !window.confirm(`¿Inactivar ${type} ${item.nombre}?`)) return;

    setError('');
    try {
      if (reactivate) {
        const payload = {
          codigo: item.codigo,
          nombre: item.nombre,
          activo: true,
          version: item.version,
        };
        if (type === 'línea') await actualizarLinea(item.id, payload);
        else await actualizarFamilia(item.id, payload);
      } else if (type === 'línea') {
        await inactivarLinea(item.id, item.version);
      } else {
        await inactivarFamilia(item.id, item.version);
      }
      setNotice(`${type === 'línea' ? 'Línea' : 'Familia'} ${reactivate ? 'reactivada' : 'inactivada'}.`);
      await loadCatalogs();
      if (type === 'línea' && item.id === selectedLineId) await loadAssociations(item.id);
    } catch (err) {
      setError(apiErrorMessage(err, `No se pudo ${reactivate ? 'reactivar' : 'inactivar'} el registro.`));
    }
  };

  const addAssociation = async () => {
    if (!selectedLineId || !selectedFamilyId) return;
    setAssociationLoading(true);
    setError('');
    try {
      await asociarFamiliaALinea(selectedLineId, Number(selectedFamilyId));
      setSelectedFamilyId('');
      setNotice('Familia asociada a la línea.');
      await loadAssociations(selectedLineId);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo asociar la familia.'));
      setAssociationLoading(false);
    }
  };

  const removeAssociation = async (family) => {
    if (!window.confirm(`¿Desasociar ${family.nombre} de ${selectedLine?.nombre}?`)) return;
    setAssociationLoading(true);
    setError('');
    try {
      await desasociarFamiliaDeLinea(selectedLineId, family.id);
      setNotice('Familia desasociada de la línea.');
      await loadAssociations(selectedLineId);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo desasociar la familia.'));
      setAssociationLoading(false);
    }
  };

  const associatedIds = new Set(associatedFamilies.map((family) => family.id));
  const availableFamilies = familias.filter((family) => family.activo !== false && !associatedIds.has(family.id));

  if (loading && lineas.length === 0 && familias.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '55vh' }}>
        <CircularProgress aria-label="Cargando líneas y familias" />
      </Box>
    );
  }

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Líneas y familias"
        description="Catálogos de clasificación y combinaciones válidas para productos y piezas."
      />

      <Alert severity="info">
        Flujo recomendado: crea la línea y la familia; después selecciona la línea y asocia las
        familias válidas. Los formularios de piezas y productos solo mostrarán combinaciones asociadas.
      </Alert>

      {error && (
        <Alert severity="error" action={!lineas.length && <Button color="inherit" onClick={loadCatalogs}>Reintentar</Button>}>
          {error}
        </Alert>
      )}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <CatalogTable
          title="Líneas"
          noun="línea"
          rows={lineas}
          search={lineSearch}
          onSearchChange={setLineSearch}
          onNew={() => openCreate('linea')}
          onEdit={(item) => openEdit('linea', item)}
          onToggle={(item) => toggleCatalog('línea', item)}
          selectedId={selectedLineId}
          onSelect={setSelectedLineId}
        />
        <CatalogTable
          title="Familias"
          noun="familia"
          rows={familias}
          search={familySearch}
          onSearchChange={setFamilySearch}
          onNew={() => openCreate('familia')}
          onEdit={(item) => openEdit('familia', item)}
          onToggle={(item) => toggleCatalog('familia', item)}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2.25 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 750 }}>Familias habilitadas por línea</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedLine
                ? `Gestionando las familias que pueden utilizarse con ${selectedLine.nombre}.`
                : 'Selecciona una línea para administrar sus familias.'}
            </Typography>
          </Box>

          {selectedLine && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 280, flex: 1 }} disabled={selectedLine.activo === false || associationLoading}>
                <InputLabel id="family-association-label">Familia por asociar</InputLabel>
                <Select
                  labelId="family-association-label"
                  label="Familia por asociar"
                  value={selectedFamilyId}
                  onChange={(event) => setSelectedFamilyId(event.target.value)}
                >
                  {availableFamilies.map((family) => (
                    <MenuItem key={family.id} value={family.id}>{family.codigo_display || family.codigo} — {family.nombre}</MenuItem>
                  ))}
                  {availableFamilies.length === 0 && <MenuItem disabled value="">No hay familias disponibles</MenuItem>}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<LinkOutlinedIcon />}
                onClick={addAssociation}
                disabled={!selectedFamilyId || selectedLine.activo === false || associationLoading}
              >
                Asociar familia
              </Button>
            </Stack>
          )}

          {associationLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} aria-label="Cargando familias asociadas" />
            </Box>
          ) : associatedFamilies.length > 0 ? (
            <TableContainer>
              <Table size="small" aria-label="Familias asociadas a la línea">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Familia</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {associatedFamilies.map((family) => (
                    <TableRow key={family.id}>
                      <TableCell>{family.codigo_display || family.codigo}</TableCell>
                      <TableCell sx={{ fontWeight: 650 }}>{family.nombre}</TableCell>
                      <TableCell>
                        <Chip size="small" label={family.activo === false ? 'Familia inactiva' : 'Habilitada'} color={family.activo === false ? 'default' : 'success'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOffOutlinedIcon />}
                          onClick={() => removeAssociation(family)}
                          disabled={selectedLine?.activo === false}
                          aria-label={`Desasociar ${family.nombre}`}
                        >
                          Desasociar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              {selectedLine
                ? 'Esta línea todavía no tiene familias asociadas.'
                : 'No hay una línea seleccionada.'}
            </Box>
          )}

          {selectedLine?.activo === false && (
            <Alert severity="info">Reactiva la línea para modificar sus asociaciones.</Alert>
          )}
        </Stack>
      </Paper>

      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialog.item ? 'Editar' : 'Nueva'} {dialog.type === 'linea' ? 'línea' : 'familia'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Código automático"
              value={dialog.item ? (formData.codigo_display || formData.codigo) : `${dialog.type === 'linea' ? 'LIN' : 'FAM'}-######`}
              disabled
              helperText={dialog.item ? 'Código interno inmutable' : 'Se asignará al guardar'}
            />
            <TextField
              label="Nombre"
              value={formData.nombre}
              onChange={(event) => setFormData((current) => ({ ...current, nombre: event.target.value }))}
              required
              autoFocus
              helperText="Usa un nombre corto, único y reconocible para planta."
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={formData.activo}
                  onChange={(event) => setFormData((current) => ({ ...current, activo: event.target.checked }))}
                />
              )}
              label="Activo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={saveCatalog}
            disabled={saving || !formData.nombre.trim()}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default LineasFamiliasAdmin;
