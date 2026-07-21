import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink } from 'react-router-dom';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

const catalogEntries = [
  { id: 'productos', area: 'PRODUCTO', name: 'Productos terminados', object: 'ProductoTerminado y BOM', path: '/datos-maestros/productos', maturity: 'DISPONIBLE' },
  { id: 'piezas', area: 'PRODUCTO', name: 'Piezas y SKU', object: 'Pieza, PiezaColor y SKU de pieza', path: '/datos-maestros/piezas', maturity: 'DISPONIBLE' },
  { id: 'moldes', area: 'PRODUCTO', name: 'Moldes', object: 'Molde, cavidades y salidas por ciclo', path: '/datos-maestros/moldes', maturity: 'DISPONIBLE' },
  { id: 'colores', area: 'PRODUCTO', name: 'Colores y recetas', object: 'FamiliaColor, ColorProducción y receta versionada', path: null, maturity: 'PENDIENTE' },
  { id: 'materiales', area: 'ABASTECIMIENTO', name: 'Materias primas', object: 'Resinas, colorantes, aditivos y recuperado', path: '/datos-maestros/materiales?catalogo=materials', maturity: 'PROTOTIPO' },
  { id: 'proveedores', area: 'ABASTECIMIENTO', name: 'Proveedores', object: 'Identidad y reglas de abastecimiento', path: '/datos-maestros/materiales?catalogo=providers', maturity: 'PROTOTIPO' },
  { id: 'categorias', area: 'ABASTECIMIENTO', name: 'Categorías de recepción', object: 'Modalidad, unidad y requisitos por material', path: '/datos-maestros/materiales?catalogo=categoryRules', maturity: 'PROTOTIPO' },
  { id: 'maquinas', area: 'PLANTA', name: 'Máquinas', object: 'Recursos de producción y compatibilidad', path: '/datos-maestros/maquinas', maturity: 'DISPONIBLE' },
  { id: 'trabajadores', area: 'PLANTA', name: 'Trabajadores', object: 'Personal, funciones y estado operativo', path: '/datos-maestros/trabajadores', maturity: 'DISPONIBLE' },
  { id: 'ubicaciones', area: 'CONTROL', name: 'Ubicaciones', object: 'Ámbitos de materia prima, WIP, piezas y PT', path: '/datos-maestros/materiales?catalogo=locations', maturity: 'PROTOTIPO' },
  { id: 'motivos', area: 'CONTROL', name: 'Motivos', object: 'Calidad, corrección, devolución y excepción', path: '/datos-maestros/materiales?catalogo=motives', maturity: 'PROTOTIPO' },
  { id: 'politicas', area: 'CONTROL', name: 'Políticas y tolerancias', object: 'Versiones aprobadas para decisiones operativas', path: '/datos-maestros/materiales?catalogo=policies', maturity: 'PROTOTIPO' },
  { id: 'configurar', area: 'MANTENIMIENTO', name: 'Configuración rápida', object: 'Asistente legacy de relaciones de catálogo', path: '/catalogo/configurar', maturity: 'DISPONIBLE' },
  { id: 'importar', area: 'MANTENIMIENTO', name: 'Importar datos', object: 'Carga controlada desde archivos de catálogo', path: '/catalogo/importar', maturity: 'DISPONIBLE' },
  { id: 'revision', area: 'MANTENIMIENTO', name: 'Revisión de datos', object: 'Pendientes y calidad del catálogo', path: '/catalogo/revision', maturity: 'DISPONIBLE' },
];

const maturityConfig = {
  DISPONIBLE: { label: 'Disponible', color: 'success' },
  PROTOTIPO: { label: 'Prototipo local', color: 'info' },
  PENDIENTE: { label: 'Vista pendiente', color: 'default' },
};

function MasterDataHub() {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('TODAS');

  const visibleEntries = useMemo(() => catalogEntries.filter((entry) => (
    (area === 'TODAS' || entry.area === area)
    && matchesOmniSearch(entry, search)
  )), [area, search]);

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        eyebrow="Gobierno de datos"
        title="Datos maestros"
        description="Identidades compartidas por planificación, materiales, producción y logística."
      />

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
        totalCount={catalogEntries.length}
        onClear={() => { setSearch(''); setArea('TODAS'); }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Catalogos maestros">
          <TableHead>
            <TableRow>
              <TableCell>Catalogo</TableCell>
              <TableCell>Area</TableCell>
              <TableCell>Objeto administrado</TableCell>
              <TableCell>Madurez</TableCell>
              <TableCell align="right">Abrir</TableCell>
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
                        Abrir
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
