import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputAdornment, InputLabel, MenuItem,
  Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import InventoryOpeningScm from './InventoryOpeningScm';
import { useScmActor } from '../context/ScmActorContext';
import {
  listarArticulosScm,
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import {
  explorarSaldosInventarioScm,
  listarMovimientosInventarioScm,
  registrarMovimientoInventarioScm,
} from '../services/scmInventoryApi';
import { listarMaterialesScm } from '../services/scmCatalogApi';
import {
  obtenerAlcanceAlmacenScm,
  obtenerResumenInventarioScm,
} from '../services/scmWarehouseOperationsApi';

const initialForm = {
  articulo_scm_id: '',
  cantidad: '',
  tipo: 'SALDO_INICIAL',
  ubicacion_codigo: 'ALMACEN_GENERAL',
  ubicacion_nombre: 'Almacén general',
  motivo: '',
};

const number = (value) => Number(value || 0);

const LEDGER_API_NAMES = {
  materials: 'MATERIALES',
  pieces: 'PIEZAS_WIP',
  finished: 'PRODUCTO_TERMINADO',
};

function BalanceGrid({ items, busy, emptyMessage }) {
  return (
    <TableContainer sx={{ maxHeight: 560 }}>
      <Table
        size="small"
        stickyHeader
        aria-label="Saldos del Kardex"
        sx={{
          minWidth: 1050,
          '& th': { fontWeight: 800, whiteSpace: 'nowrap' },
          '& tbody tr:nth-of-type(even)': { bgcolor: 'action.hover' },
          '& tbody tr:hover': { bgcolor: 'primary.50' },
          '& td': { borderColor: 'divider' },
        }}
      >
          <TableHead><TableRow>
            <TableCell>Código</TableCell>
            <TableCell>Artículo</TableCell>
            <TableCell>Clase</TableCell>
            <TableCell>Ubicación</TableCell>
            <TableCell align="right">Físico</TableCell>
            <TableCell align="right">Reservado</TableCell>
            <TableCell align="right">No disponible</TableCell>
            <TableCell align="right">Libre</TableCell>
            <TableCell>Actualizado</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {item.articulo.codigo}
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{item.articulo.nombre}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={item.articulo.clase.replaceAll('_', ' ')}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={650}>{item.ubicacion.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.ubicacion.codigo}</Typography>
                </TableCell>
                {[item.cantidad_fisica, item.cantidad_reservada, item.cantidad_no_disponible].map((value, index) => (
                  <TableCell
                    key={`${item.id}-${index}`}
                    align="right"
                    sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {value} {item.articulo.unidad}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <Chip
                    size="small"
                    color={number(item.cantidad_libre) > 0 ? 'success' : 'default'}
                    label={`${item.cantidad_libre} ${item.articulo.unidad}`}
                    sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {item.updated_at ? new Date(item.updated_at).toLocaleString('es-PE') : '—'}
                </TableCell>
              </TableRow>
            ))}
            {!busy && items.length === 0 && (
              <TableRow><TableCell colSpan={9}>
                <Alert severity="info">{emptyMessage}</Alert>
              </TableCell></TableRow>
            )}
          </TableBody>
      </Table>
    </TableContainer>
  );
}

function MovementGrid({ items, busy }) {
  return (
    <TableContainer sx={{ maxHeight: 560 }}>
      <Table
        size="small"
        stickyHeader
        aria-label="Movimientos del Kardex"
        sx={{
          minWidth: 980,
          '& th': { fontWeight: 800, whiteSpace: 'nowrap' },
          '& tbody tr:nth-of-type(even)': { bgcolor: 'action.hover' },
          '& tbody tr:hover': { bgcolor: 'primary.50' },
        }}
      >
        <TableHead><TableRow>
          <TableCell>Fecha</TableCell>
          <TableCell>Código</TableCell>
          <TableCell>Artículo</TableCell>
          <TableCell>Ubicación</TableCell>
          <TableCell>Tipo</TableCell>
          <TableCell align="right">Variación</TableCell>
          <TableCell align="right">Saldo resultante</TableCell>
          <TableCell>Motivo</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {item.created_at ? new Date(item.created_at).toLocaleString('es-PE') : '—'}
              </TableCell>
              <TableCell sx={{ fontWeight: 800 }}>{item.articulo_codigo}</TableCell>
              <TableCell>{item.articulo_nombre}</TableCell>
              <TableCell>{item.ubicacion_codigo || '—'}</TableCell>
              <TableCell><Chip size="small" label={item.tipo.replaceAll('_', ' ')} /></TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {item.cantidad_delta} {item.unidad || 'UN'}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {item.saldo_fisico_resultante} {item.unidad || 'UN'}
              </TableCell>
              <TableCell>{item.motivo}</TableCell>
            </TableRow>
          ))}
          {!busy && items.length === 0 && (
            <TableRow><TableCell colSpan={8}>
              <Alert severity="info">No hay movimientos que coincidan con los filtros.</Alert>
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function InventoryScm() {
  const { can } = useScmActor();
  const canAdjust = can('INVENTARIO_AJUSTAR');
  const [rows, setRows] = useState([]);
  const [pageMeta, setPageMeta] = useState({ total: 0, has_more: false, next_cursor: null });
  const [summary, setSummary] = useState({ items: [], materiales: [] });
  const [articles, setArticles] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [catalogsLoaded, setCatalogsLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [warehouseScope, setWarehouseScope] = useState(null);
  const [activeLedger, setActiveLedger] = useState('materials');
  const [locationFilter, setLocationFilter] = useState('TODAS');
  const [stockFilter, setStockFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('CODIGO');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [pageCursors, setPageCursors] = useState({ 0: null });
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refresh = useCallback(() => {
    setPage(0);
    setPageCursors({ 0: null });
    setRefreshVersion((value) => value + 1);
  }, []);

  const loadCatalogs = useCallback(async () => {
    if (catalogsLoaded) return;
    const [articleItems, materialItems] = await Promise.all([
      listarArticulosScm(), listarMaterialesScm(),
    ]);
    setArticles((articleItems || []).filter((item) => item.activo !== false));
    setMaterials((materialItems || []).filter((item) => item.activo !== false));
    setCatalogsLoaded(true);
  }, [catalogsLoaded]);

  useEffect(() => {
    let alive = true;
    Promise.all([obtenerAlcanceAlmacenScm(), obtenerResumenInventarioScm()])
      .then(([scopePayload, summaryPayload]) => {
        if (!alive) return;
        setWarehouseScope(scopePayload);
        setSummary(summaryPayload || { items: [], materiales: [] });
      })
      .catch((requestError) => {
        if (alive) setError(mensajeErrorScm(requestError, 'No se cargó el resumen del Kardex.'));
      });
    return () => { alive = false; };
  }, [refreshVersion]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
      setPageCursors({ 0: null });
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [query]);

  const totals = useMemo(() => (summary.items || []).reduce((accumulator, item) => ({
    physical: accumulator.physical + number(item.fisico),
    reserved: accumulator.reserved + number(item.reservado),
    unavailable: accumulator.unavailable + number(item.no_disponible),
    free: accumulator.free + number(item.fisico) - number(item.reservado) - number(item.no_disponible),
  }), { physical: 0, reserved: 0, unavailable: 0, free: 0 }), [summary]);
  const materialTotals = useMemo(() => (summary.materiales || []).reduce((accumulator, item) => ({
    physical: accumulator.physical + number(item.fisico),
    reserved: accumulator.reserved + number(item.reservado),
    unavailable: accumulator.unavailable + number(item.no_disponible),
    free: accumulator.free + number(item.fisico) - number(item.reservado) - number(item.no_disponible),
  }), { physical: 0, reserved: 0, unavailable: 0, free: 0 }), [summary]);

  const visibleClasses = useMemo(() => new Set(
    (warehouseScope?.almacenes || []).flatMap((item) => item.clases_articulo || []),
  ), [warehouseScope]);
  const scopeAllows = useCallback((classes) => (
    warehouseScope?.control_transversal
    || !warehouseScope?.configurado
    || classes.some((articleClass) => visibleClasses.has(articleClass))
  ), [visibleClasses, warehouseScope]);
  const showPiecesAndWip = scopeAllows(['PIEZA_COLOR', 'SUBENSAMBLE_WIP']);
  const showFinishedProducts = scopeAllows(['PRODUCTO_TERMINADO']);
  const showMaterials = scopeAllows(['MATERIA_PRIMA', 'COLORANTE']);
  const ledgers = useMemo(() => [
    ...(showMaterials ? [{
      id: 'materials', label: 'Materias primas',
      emptyMessage: 'Todavía no hay saldos de materias primas o colorantes en tus ubicaciones.',
    }] : []),
    ...(showPiecesAndWip ? [{
      id: 'pieces', label: 'Piezas y WIP',
      emptyMessage: 'Tienes acceso a Piezas y WIP, pero todavía no hay saldo. Aparecerá con una apertura aprobada o al recibir producción.',
    }] : []),
    ...(showFinishedProducts ? [{
      id: 'finished', label: 'Producto terminado',
      emptyMessage: 'Tienes acceso a Producto terminado, pero todavía no hay saldo. Aparecerá al recibir y liberar producción terminada.',
    }] : []),
    { id: 'movements', label: 'Movimientos' },
  ], [showFinishedProducts, showMaterials, showPiecesAndWip]);
  const effectiveLedger = ledgers.some((item) => item.id === activeLedger)
    ? activeLedger
    : ledgers[0]?.id;
  const ledger = ledgers.find((item) => item.id === effectiveLedger) || ledgers[0];
  const isMovements = effectiveLedger === 'movements';
  const balanceSorts = ['CODIGO', 'NOMBRE', 'FISICO_DESC', 'LIBRE_DESC', 'ACTUALIZADO'];
  const effectiveSort = isMovements
    ? (['RECIENTES', 'ANTIGUOS'].includes(sortBy) ? sortBy : 'RECIENTES')
    : (balanceSorts.includes(sortBy) ? sortBy : 'CODIGO');
  const locationOptions = useMemo(() => {
    const values = new Set(rows.map((item) => (
      isMovements ? item.ubicacion_codigo : item.ubicacion?.codigo
    )).filter(Boolean));
    if (locationFilter !== 'TODAS') values.add(locationFilter);
    return [...values].sort((left, right) => left.localeCompare(right, 'es'));
  }, [isMovements, locationFilter, rows]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError('');
    const request = isMovements
      ? listarMovimientosInventarioScm()
      : explorarSaldosInventarioScm({
        kardex: LEDGER_API_NAMES[effectiveLedger],
        q: debouncedQuery || undefined,
        ubicacion: locationFilter === 'TODAS' ? undefined : locationFilter,
        disponibilidad: stockFilter,
        ordenar: effectiveSort,
        limite: rowsPerPage,
        cursor: pageCursors[page] || undefined,
      });
    request.then((payload) => {
      if (!alive) return;
      if (isMovements) {
        const normalized = debouncedQuery.toLocaleLowerCase('es');
        const filtered = (payload.items || []).filter((item) => {
          const haystack = `${item.articulo_codigo} ${item.articulo_nombre} ${item.ubicacion_codigo || ''} ${item.tipo} ${item.motivo || ''}`;
          return (!normalized || haystack.toLocaleLowerCase('es').includes(normalized))
            && (locationFilter === 'TODAS' || item.ubicacion_codigo === locationFilter);
        }).sort((left, right) => {
          const direction = effectiveSort === 'ANTIGUOS' ? 1 : -1;
          return direction * String(left.created_at || '').localeCompare(String(right.created_at || ''));
        });
        setRows(filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
        setPageMeta({ total: filtered.length, has_more: false, next_cursor: null });
      } else {
        const nextRows = payload.items || [];
        setRows(nextRows);
        setPageMeta(payload.page || {
          total: nextRows.length, has_more: false, next_cursor: null,
        });
      }
    }).catch((requestError) => {
      if (alive) setError(mensajeErrorScm(requestError, 'No se pudo cargar esta página del Kardex.'));
    }).finally(() => {
      if (alive) setBusy(false);
    });
    return () => { alive = false; };
  }, [
    debouncedQuery, effectiveLedger, effectiveSort, isMovements,
    locationFilter, page, pageCursors, refreshVersion, rowsPerPage, stockFilter,
  ]);

  const changeLedger = (_event, value) => {
    setActiveLedger(value);
    setQuery('');
    setLocationFilter('TODAS');
    setStockFilter('TODOS');
    setSortBy(value === 'movements' ? 'RECIENTES' : 'CODIGO');
    setPage(0);
    setPageCursors({ 0: null });
  };

  const submit = async () => {
    if (!form.articulo_scm_id || number(form.cantidad) <= 0 || !form.motivo.trim()) {
      setError('Selecciona un artículo, indica una cantidad positiva y explica el motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registrarMovimientoInventarioScm({
        ...form,
        articulo_scm_id: Number(form.articulo_scm_id),
        cantidad: number(form.cantidad),
        motivo: form.motivo.trim(),
      });
      setOpen(false);
      setForm(initialForm);
      setNotice('Movimiento registrado. El saldo libre ya participa en nuevos cálculos.');
      refresh();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se registró el movimiento.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Kardex de mi almacén"
        description="Consulta existencias, reservas y movimientos dentro de los almacenes y clases asignados a tu trabajo."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={refresh}>
              Actualizar
            </Button>
            {canAdjust && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={() => {
                  setForm({
                    ...initialForm,
                    tipo: 'AJUSTE_POSITIVO',
                  });
                  setOpen(true);
                }}
              >
                Registrar movimiento
              </Button>
            )}
          </Stack>
        )}
      />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {warehouseScope?.configurado && warehouseScope.control_transversal && (
        <Alert severity="info"><strong>Control transversal:</strong> puedes consultar todos los almacenes. Las operaciones físicas conservan sus permisos propios.</Alert>
      )}
      {warehouseScope?.configurado && !warehouseScope.control_transversal && (warehouseScope.almacenes || []).length > 0 && (
        <Alert severity="success">
          <strong>Alcance activo:</strong> {(warehouseScope.almacenes || []).map((item) => `${item.codigo} (${(item.clases_articulo || []).map((value) => value.replaceAll('_', ' ')).join(', ')})`).join(' · ')}
        </Alert>
      )}
      {warehouseScope?.configurado && !warehouseScope.control_transversal && (warehouseScope.almacenes || []).length === 0 && (
        <Alert severity="warning">No tienes un almacén asignado. Administración debe asignarte almacén y clases antes de mostrar saldos.</Alert>
      )}
      <Alert severity="info">
        El saldo inicial no crea mangas ficticias. Las mangas nuevas ingresarán al Kardex
        cuando Almacén confirme su recepción; una reserva no equivale todavía a consumo.
      </Alert>

      <InventoryOpeningScm
        articles={articles}
        materials={materials}
        onRequestCatalog={loadCatalogs}
        onApplied={refresh}
        refreshVersion={refreshVersion}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {[
          ['Existencia física', totals.physical, materialTotals.physical, 'Todo lo registrado'],
          ['No disponible', totals.unavailable, materialTotals.unavailable, 'Pendiente, bloqueado o rechazado'],
          ['Reservada', totals.reserved, materialTotals.reserved, 'Comprometida por planes'],
          ['Libre', totals.free, materialTotals.free, 'Disponible para nuevas OP'],
        ].map(([label, value, materialValue, help]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h5" fontWeight={800}>{value.toLocaleString('es-PE')} UN</Typography>
            <Typography variant="body2" fontWeight={700}>{materialValue.toLocaleString('es-PE')} KG</Typography>
            <Typography variant="caption" color="text.secondary">{help}</Typography>
          </Paper>
        ))}
      </Stack>

      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', borderRadius: 3, boxShadow: '0 14px 42px rgba(15, 39, 71, 0.08)' }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 2.5 }, py: 2,
            background: 'linear-gradient(135deg, rgba(18, 61, 99, 0.08), rgba(42, 130, 91, 0.06))',
          }}
        >
          <Typography component="h2" variant="h5" fontWeight={900}>
            Explorador de Kardex
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Trabaja como en una hoja de cálculo: elige un Kardex, filtra y revisa una sola tabla a la vez.
          </Typography>
        </Box>
        <Tabs
          value={effectiveLedger}
          onChange={changeLedger}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Kardex disponibles"
          sx={{
            px: 1,
            '& .MuiTab-root': { minHeight: 58, fontWeight: 800, textTransform: 'none' },
          }}
        >
          {ledgers.map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              label={item.id === effectiveLedger ? `${item.label} · ${pageMeta.total}` : item.label}
            />
          ))}
        </Tabs>
        <Divider />
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          alignItems={{ lg: 'center' }}
          sx={{ p: 2, bgcolor: 'background.default' }}
        >
          <TextField
            fullWidth
            size="small"
            label={`Buscar en ${ledger?.label || 'Kardex'}`}
            placeholder="Código, nombre, ubicación o referencia"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              },
            }}
            sx={{ flex: 2, minWidth: { lg: 330 } }}
          />
          <FormControl size="small" sx={{ minWidth: { lg: 220 } }}>
            <InputLabel>Ubicación</InputLabel>
            <Select
              label="Ubicación"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value);
                setPage(0);
                setPageCursors({ 0: null });
              }}
              startAdornment={<InputAdornment position="start"><FilterAltOutlinedIcon fontSize="small" /></InputAdornment>}
            >
              <MenuItem value="TODAS">Todas las ubicaciones</MenuItem>
              {locationOptions.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
            </Select>
          </FormControl>
          {!isMovements && (
            <FormControl size="small" sx={{ minWidth: { lg: 190 } }}>
              <InputLabel>Disponibilidad</InputLabel>
              <Select
                label="Disponibilidad"
                value={stockFilter}
                onChange={(event) => {
                  setStockFilter(event.target.value);
                  setPage(0);
                  setPageCursors({ 0: null });
                }}
              >
                <MenuItem value="TODOS">Todos los saldos</MenuItem>
                <MenuItem value="CON_EXISTENCIA">Con existencia</MenuItem>
                <MenuItem value="LIBRE">Con saldo libre</MenuItem>
                <MenuItem value="RESERVADO">Con reserva</MenuItem>
                <MenuItem value="NO_DISPONIBLE">No disponible</MenuItem>
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: { lg: 190 } }}>
            <InputLabel>Ordenar</InputLabel>
            <Select
              label="Ordenar"
              value={effectiveSort}
              onChange={(event) => {
                setSortBy(event.target.value);
                setPage(0);
                setPageCursors({ 0: null });
              }}
            >
              {isMovements ? [
                <MenuItem key="RECIENTES" value="RECIENTES">Más recientes</MenuItem>,
                <MenuItem key="ANTIGUOS" value="ANTIGUOS">Más antiguos</MenuItem>,
              ] : [
                <MenuItem key="CODIGO" value="CODIGO">Código A–Z</MenuItem>,
                <MenuItem key="NOMBRE" value="NOMBRE">Nombre A–Z</MenuItem>,
                <MenuItem key="FISICO_DESC" value="FISICO_DESC">Mayor existencia</MenuItem>,
                <MenuItem key="LIBRE_DESC" value="LIBRE_DESC">Mayor saldo libre</MenuItem>,
                <MenuItem key="ACTUALIZADO" value="ACTUALIZADO">Actualización reciente</MenuItem>,
              ]}
            </Select>
          </FormControl>
        </Stack>
        <Box sx={{ px: 2, pb: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>{rows.length}</strong> de {pageMeta.total} registro(s) visible(s)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Encabezado fijo · filas compactas · números alineados
            </Typography>
          </Stack>
        </Box>
        <Divider />
        {isMovements ? (
          <MovementGrid items={rows} busy={busy} />
        ) : (
          <BalanceGrid
            items={rows}
            busy={busy}
            emptyMessage={debouncedQuery || locationFilter !== 'TODAS' || stockFilter !== 'TODOS'
              ? 'No hay saldos que coincidan con los filtros seleccionados.'
              : ledger?.emptyMessage}
          />
        )}
        <Divider />
        <TablePagination
          component="div"
          count={pageMeta.total}
          page={page}
          onPageChange={(_event, value) => {
            if (value > page) {
              if (!pageMeta.next_cursor && !isMovements) return;
              setPageCursors((current) => ({
                ...current, [value]: pageMeta.next_cursor,
              }));
            }
            setPage(value);
          }}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
            setPageCursors({ 0: null });
          }}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar movimiento de inventario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de movimiento</InputLabel>
              <Select
                label="Tipo de movimiento"
                value={form.tipo}
                onChange={(event) => setForm({ ...form, tipo: event.target.value })}
              >
                {canAdjust && <MenuItem value="AJUSTE_POSITIVO">Ajuste positivo</MenuItem>}
                {canAdjust && <MenuItem value="AJUSTE_NEGATIVO">Ajuste negativo</MenuItem>}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Artículo SCM</InputLabel>
              <Select
                label="Artículo SCM"
                value={form.articulo_scm_id}
                onChange={(event) => setForm({ ...form, articulo_scm_id: event.target.value })}
              >
                {articles.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo} · {item.nombre} · {item.clase}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Cantidad"
              type="number"
              inputProps={{ min: 0.001, step: 0.001 }}
              value={form.cantidad}
              onChange={(event) => setForm({ ...form, cantidad: event.target.value })}
            />
            <TextField
              label="Ubicación"
              value={form.ubicacion_codigo}
              onChange={(event) => setForm({
                ...form,
                ubicacion_codigo: event.target.value.toUpperCase(),
              })}
              helperText="Para el arranque puede usarse ALMACEN_GENERAL."
            />
            <TextField
              label="Motivo o referencia de conteo"
              multiline
              minRows={2}
              value={form.motivo}
              onChange={(event) => setForm({ ...form, motivo: event.target.value })}
              helperText="Este texto queda en el Kardex y no puede borrarse."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={busy} onClick={submit}>
            Registrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
