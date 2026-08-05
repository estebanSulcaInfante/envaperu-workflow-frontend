import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink } from 'react-router-dom';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';
import { useScmActor } from '../context/ScmActorContext';

const catalogEntries = [
  { id: 'productos', area: 'PRODUCTO', name: 'Productos terminados', object: 'ProductoTerminado y BOM', path: '/datos-maestros/productos', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_VER'] },
  { id: 'piezas', area: 'PRODUCTO', name: 'Piezas y SKU', object: 'Pieza, PiezaColor y SKU de pieza', path: '/datos-maestros/piezas', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_VER'] },
  { id: 'moldes', area: 'PRODUCTO', name: 'Moldes', object: 'Molde, cavidades y salidas por ciclo', path: '/datos-maestros/moldes', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_VER', 'RUTA_VER'] },
  { id: 'configurar', area: 'PRODUCTO', name: 'Configuración guiada de producto', object: 'Asistente Molde ↔ Pieza y generación de PiezaColor', path: '/datos-maestros/configuracion-guiada', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_ADMINISTRAR'] },
  { id: 'ingenieria-scm', area: 'PRODUCTO', name: 'Ingeniería SCM', object: 'Artículos WIP, BOM multinivel, rutas, perfiles y reglas de empaque', path: '/datos-maestros/ingenieria-scm', maturity: 'DISPONIBLE', requiredAny: ['ESTRUCTURA_VER', 'RUTA_VER', 'EMPAQUE_VER'] },
  { id: 'clasificacion', area: 'PRODUCTO', name: 'Líneas y familias', object: 'Clasificadores de producto y combinaciones N:M habilitadas', path: '/datos-maestros/clasificacion', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_ADMINISTRAR'] },
  { id: 'colores', area: 'PRODUCTO', name: 'Colores y recetas', object: 'FamiliaColor, ColorProducción, HEX visual y receta versionada', path: '/datos-maestros/colores', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'] },
  { id: 'materiales', area: 'ABASTECIMIENTO', name: 'Materias primas', object: 'Resinas, colorantes, aditivos y recuperado', path: '/datos-maestros/materiales?catalogo=materials', maturity: 'DISPONIBLE', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR', 'PROVEEDOR_ADMINISTRAR'] },
  { id: 'proveedores', area: 'ABASTECIMIENTO', name: 'Proveedores', object: 'Identidad y reglas de abastecimiento', path: '/datos-maestros/materiales?catalogo=providers', maturity: 'DISPONIBLE', requiredAny: ['PROVEEDOR_ADMINISTRAR'] },
  { id: 'categorias', area: 'ABASTECIMIENTO', name: 'Categorías de recepción', object: 'Modalidad, unidad y requisitos por material', path: '/datos-maestros/materiales?catalogo=categoryRules', maturity: 'DISPONIBLE', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'maquinas', area: 'PLANTA', name: 'Máquinas', object: 'Recursos de producción y compatibilidad', path: '/datos-maestros/maquinas', maturity: 'DISPONIBLE', requiredAny: ['OF_EDITAR_BORRADOR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'trabajadores', area: 'PLANTA', name: 'Trabajadores', object: 'Personal, funciones y estado operativo', path: '/datos-maestros/trabajadores', maturity: 'DISPONIBLE', requiredAny: ['AUTORIZACION_SCM_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'ubicaciones', area: 'CONTROL', name: 'Ubicaciones', object: 'Ámbitos de materia prima, WIP, piezas y PT', path: '/datos-maestros/materiales?catalogo=locations', maturity: 'PROTOTIPO', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'motivos', area: 'CONTROL', name: 'Motivos', object: 'Calidad, corrección, devolución y excepción', path: '/datos-maestros/materiales?catalogo=motives', maturity: 'PROTOTIPO', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'politicas', area: 'CONTROL', name: 'Políticas y tolerancias', object: 'Versiones aprobadas para decisiones operativas', path: '/datos-maestros/materiales?catalogo=policies', maturity: 'PROTOTIPO', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
  { id: 'importar', area: 'MANTENIMIENTO', name: 'Importar datos', object: 'Carga controlada desde archivos de catálogo', path: '/catalogo/importar', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_ADMINISTRAR'] },
  { id: 'revision', area: 'MANTENIMIENTO', name: 'Revisión de datos', object: 'Pendientes y calidad del catálogo', path: '/catalogo/revision', maturity: 'DISPONIBLE', requiredAny: ['ARTICULO_ADMINISTRAR'] },
];

const maturityConfig = {
  DISPONIBLE: { label: 'Disponible', color: 'success' },
  PROTOTIPO: { label: 'Prototipo local', color: 'info' },
  PENDIENTE: { label: 'Vista pendiente', color: 'default' },
};

const loadingStages = [
  {
    id: 'base',
    title: 'Base de clasificación y planta',
    description: 'Define primero los nombres que aparecerán en los demás formularios.',
    items: [
      { label: 'Líneas y familias', path: '/datos-maestros/clasificacion', requiredAny: ['ARTICULO_ADMINISTRAR'] },
      { label: 'Trabajadores', path: '/datos-maestros/trabajadores', requiredAny: ['AUTORIZACION_SCM_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
      { label: 'Máquinas', path: '/datos-maestros/maquinas', requiredAny: ['OF_EDITAR_BORRADOR', 'CONFIG_RECEPCION_ADMINISTRAR'] },
    ],
    icon: <CheckCircleOutlineOutlinedIcon />,
  },
  {
    id: 'supplies',
    title: 'Abastecimiento y color',
    description: 'Las recetas necesitan materiales; las recepciones necesitan categorías y proveedores.',
    items: [
      { label: 'Categorías de recepción', path: '/datos-maestros/materiales?catalogo=categoryRules', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
      { label: 'Proveedores', path: '/datos-maestros/materiales?catalogo=providers', requiredAny: ['PROVEEDOR_ADMINISTRAR'] },
      { label: 'Materias primas', path: '/datos-maestros/materiales?catalogo=materials', requiredAny: ['CONFIG_RECEPCION_ADMINISTRAR'] },
      { label: 'Colores y recetas', path: '/datos-maestros/colores', requiredAny: ['ARTICULO_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'] },
    ],
    icon: <PaletteOutlinedIcon />,
  },
  {
    id: 'manufacturing',
    title: 'Piezas y fabricación',
    description: 'Crea la pieza, registra el molde y luego genera sus variantes Pieza-Color.',
    items: [
      { label: 'Piezas y SKU', path: '/datos-maestros/piezas', requiredAny: ['ARTICULO_ADMINISTRAR'] },
      { label: 'Moldes', path: '/datos-maestros/moldes', requiredAny: ['ARTICULO_ADMINISTRAR', 'RUTA_ADMINISTRAR'] },
      { label: 'Configuración guiada', path: '/datos-maestros/configuracion-guiada', requiredAny: ['ARTICULO_ADMINISTRAR'] },
    ],
    icon: <PrecisionManufacturingOutlinedIcon />,
  },
  {
    id: 'product',
    title: 'Producto e ingeniería',
    description: 'Al final crea el producto y define su composición, ruta y empaque revisionados.',
    items: [
      { label: 'Productos terminados', path: '/datos-maestros/productos', requiredAny: ['ARTICULO_ADMINISTRAR'] },
      { label: 'Ingeniería SCM', path: '/datos-maestros/ingenieria-scm', requiredAny: ['ESTRUCTURA_ADMINISTRAR', 'RUTA_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'] },
    ],
    icon: <Inventory2OutlinedIcon />,
  },
];

function MasterDataHub() {
  const { canAny, experience } = useScmActor();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('TODAS');
  const availableEntries = useMemo(
    () => catalogEntries.filter((entry) => canAny(entry.requiredAny || [])),
    [canAny],
  );
  const availableStages = useMemo(
    () => loadingStages
      .map((stage) => ({
        ...stage,
        items: stage.items.filter((item) => canAny(item.requiredAny)),
      }))
      .filter((stage) => stage.items.length > 0),
    [canAny],
  );
  const canMaintainCatalogs = availableStages.length > 0;

  const visibleEntries = useMemo(() => availableEntries.filter((entry) => (
    (area === 'TODAS' || entry.area === area)
    && matchesOmniSearch(entry, search)
  )), [area, availableEntries, search]);

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        eyebrow="Gobierno de datos"
        title="Datos maestros"
        description={`Catálogos disponibles para ${experience.label}. Aquí se definen las identidades que utilizará la operación.`}
      />

      {canMaintainCatalogs ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2, md: 2.5 }, bgcolor: 'primary.50' }}>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
              Carga inicial asistida
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 850 }}>
              Empieza por la base y evita registros huérfanos
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 900 }}>
              Esta secuencia permite que cada selector ya tenga la información necesaria cuando
              llegue el momento de crear piezas, productos, recetas y órdenes.
            </Typography>
          </Box>
          <Divider />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 0,
            }}
          >
            {availableStages.map((stage, index) => (
              <Box
                key={stage.id}
                sx={{
                  p: 2.25,
                  borderBottom: '1px solid',
                  borderRight: { md: index % 2 === 0 ? '1px solid' : 0 },
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'grid',
                      placeItems: 'center',
                      flex: '0 0 auto',
                      '& svg': { fontSize: 19 },
                    }}
                  >
                    {stage.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {index + 1}. {stage.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stage.description}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                      {stage.items.map((item) => (
                        <Chip
                          key={item.path}
                          component={RouterLink}
                          to={item.path}
                          clickable
                          size="small"
                          label={item.label}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>
        </Paper>
      ) : (
        <Alert severity="info">
          Tu perfil puede consultar estos catálogos. Los cambios deben realizarlos los responsables
          autorizados de datos maestros.
        </Alert>
      )}

      <Alert severity="warning">
        Antes de crear, busca por nombre y código. Si encuentras un registro parecido, consulta al
        responsable: inactivar o corregir es preferible a duplicar.
      </Alert>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Todos los catálogos disponibles</Typography>
        <Typography variant="body2" color="text.secondary">
          Usa la búsqueda si ya sabes qué entidad necesitas administrar.
        </Typography>
      </Box>

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar catálogo, entidad o alcance"
        filters={[{
          id: 'area',
          label: 'Área',
          value: area,
          onChange: setArea,
          options: [
            { value: 'TODAS', label: 'Todas las áreas' },
            { value: 'PRODUCTO', label: 'Producto' },
            { value: 'ABASTECIMIENTO', label: 'Abastecimiento' },
            { value: 'PLANTA', label: 'Planta' },
            { value: 'CONTROL', label: 'Control' },
            { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
          ],
        }]}
        resultCount={visibleEntries.length}
        totalCount={availableEntries.length}
        onClear={() => { setSearch(''); setArea('TODAS'); }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Catalogos maestros">
          <TableHead>
            <TableRow>
              <TableCell>Catálogo</TableCell>
              <TableCell>Área</TableCell>
              <TableCell>Objeto administrado</TableCell>
              <TableCell>Madurez</TableCell>
              <TableCell align="right">Acción</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEntries.map((entry) => {
              const maturity = maturityConfig[entry.maturity];
              return (
                <TableRow key={entry.id} hover>
                  <TableCell sx={{ fontWeight: 750 }}>{entry.name}</TableCell>
                  <TableCell>{entry.area}</TableCell>
                  <TableCell>{entry.object}</TableCell>
                  <TableCell><Chip size="small" label={maturity.label} color={maturity.color} variant="outlined" /></TableCell>
                  <TableCell align="right">
                    {entry.path ? (
                      <Button component={RouterLink} to={entry.path} size="small" endIcon={<ArrowForwardOutlinedIcon />}>
                        Administrar
                      </Button>
                    ) : (
                      <Button size="small" disabled startIcon={<LockOutlinedIcon />}>Pendiente</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleEntries.length === 0 && (
            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No hay catálogos para los filtros seleccionados.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ borderLeft: '4px solid', borderColor: 'info.main', pl: 2, py: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 750 }}>Un catálogo define identidades; no ejecuta recepciones, reservas ni órdenes.</Typography>
        <Typography variant="caption" color="text.secondary">Las acciones operativas permanecen dentro de su módulo y referencian estas identidades.</Typography>
      </Box>
    </Stack>
  );
}

export default MasterDataHub;
