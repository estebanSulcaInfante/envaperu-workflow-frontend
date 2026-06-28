import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, Button, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';

import { getMoldeDetalle, updateMolde, addFormaMolde, addColorForma, deleteForma, obtenerColores } from '../services/api';

function MoldeDetalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [molde, setMolde] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coloresDisponibles, setColoresDisponibles] = useState([]);
  
  // Edit molde data
  const [editMoldeData, setEditMoldeData] = useState({});
  const [savingMolde, setSavingMolde] = useState(false);

  // Dialog for new Forma
  const [openFormaDialog, setOpenFormaDialog] = useState(false);
  const [formaData, setFormaData] = useState({ nombre: '', cavidades: 1, peso_unitario_gr: 0 });

  // Dialog for new Color
  const [openColorDialog, setOpenColorDialog] = useState(false);
  const [selectedFormaId, setSelectedFormaId] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState('');

  const fetchMolde = async () => {
    try {
      setLoading(true);
      const data = await getMoldeDetalle(codigo);
      setMolde(data);
      setEditMoldeData({
        peso_tiro_gr: data.peso_tiro_gr,
        tiempo_ciclo_std: data.tiempo_ciclo_std
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el detalle del molde');
    } finally {
      setLoading(false);
    }
  };

  const fetchColores = async () => {
    try {
      const colors = await obtenerColores();
      setColoresDisponibles(colors);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMolde();
    fetchColores();
  }, [codigo]);

  const handleSaveMolde = async () => {
    try {
      setSavingMolde(true);
      await updateMolde(codigo, editMoldeData);
      fetchMolde(); // refresh
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar molde');
    } finally {
      setSavingMolde(false);
    }
  };

  const handleAddForma = async () => {
    try {
      await addFormaMolde(codigo, formaData);
      setOpenFormaDialog(false);
      fetchMolde();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al añadir forma');
    }
  };

  const handleAddColor = async () => {
    if (!selectedColorId) return;
    try {
      await addColorForma(selectedFormaId, selectedColorId);
      setOpenColorDialog(false);
      setSelectedColorId('');
      fetchMolde();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al añadir color (posible duplicado)');
    }
  };

  const handleDeleteForma = async (formaId) => {
    if (!window.confirm("¿Está seguro de eliminar esta forma? Solo se puede si no tiene SKUs.")) return;
    try {
      await deleteForma(formaId);
      fetchMolde();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar forma');
    }
  };

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (!molde) return <Box p={3}><Alert severity="error">{error || 'No encontrado'}</Alert></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/catalogo/moldes')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">Detalle de Molde: {molde.codigo}</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* PANEL DEL MOLDE */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Parámetros del Molde</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Nombre"
              value={molde.nombre}
              disabled
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
             <TextField
              label="Tiempo Ciclo Std (s)"
              type="number"
              value={editMoldeData.tiempo_ciclo_std || ''}
              onChange={(e) => setEditMoldeData({ ...editMoldeData, tiempo_ciclo_std: parseFloat(e.target.value) })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Peso Tiro (g)"
              type="number"
              value={editMoldeData.peso_tiro_gr || ''}
              onChange={(e) => setEditMoldeData({ ...editMoldeData, peso_tiro_gr: parseFloat(e.target.value) })}
              fullWidth
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
           <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveMolde} disabled={savingMolde}>
             Guardar Cambios
           </Button>
        </Box>
      </Paper>

      {/* SECCIÓN DE FORMAS */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">Formas (Cavidades)</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
            setFormaData({ nombre: '', cavidades: 1, peso_unitario_gr: 0 });
            setOpenFormaDialog(true);
        }}>
          Agregar Forma
        </Button>
      </Box>

      {molde.formas && molde.formas.map((forma) => (
        <Accordion key={forma.id} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold', width: '33%', flexShrink: 0 }}>
              {forma.nombre}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Cavidades: {forma.cavidades} | Peso: {forma.peso_unitario_gr}g
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
             <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" variant="text" startIcon={<AddIcon />} onClick={() => {
                   setSelectedFormaId(forma.id);
                   setOpenColorDialog(true);
                }}>Añadir Variante de Color</Button>
                <Button size="small" color="error" variant="text" startIcon={<DeleteIcon />} onClick={() => handleDeleteForma(forma.id)}>
                   Borrar Forma
                </Button>
             </Box>
             
             {(!forma.variantes || forma.variantes.length === 0) ? (
                 <Typography variant="body2" color="text.secondary">No hay variantes de color creadas para esta forma.</Typography>
             ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Nombre (Color)</TableCell>
                        <TableCell>Color</TableCell>
                        <TableCell>Peso (g)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {forma.variantes.map(v => (
                        <TableRow key={v.sku}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{v.sku}</TableCell>
                          <TableCell>{v.piezas}</TableCell>
                          <TableCell>{v.color}</TableCell>
                          <TableCell>{v.peso}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
             )}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Modal Agregar Forma */}
      <Dialog open={openFormaDialog} onClose={() => setOpenFormaDialog(false)}>
        <DialogTitle>Nueva Forma Física</DialogTitle>
        <DialogContent>
           <TextField fullWidth margin="normal" label="Nombre (Ej. Base, Tapa)" value={formaData.nombre} onChange={e => setFormaData({...formaData, nombre: e.target.value})} />
           <TextField fullWidth margin="normal" label="Cavidades" type="number" value={formaData.cavidades} onChange={e => setFormaData({...formaData, cavidades: e.target.value})} />
           <TextField fullWidth margin="normal" label="Peso Unitario (g)" type="number" value={formaData.peso_unitario_gr} onChange={e => setFormaData({...formaData, peso_unitario_gr: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFormaDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddForma}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Agregar Color */}
      <Dialog open={openColorDialog} onClose={() => setOpenColorDialog(false)}>
        <DialogTitle>Añadir Variante de Color</DialogTitle>
        <DialogContent>
           <FormControl fullWidth margin="normal">
             <InputLabel>Seleccione un Color</InputLabel>
             <Select value={selectedColorId} label="Seleccione un Color" onChange={e => setSelectedColorId(e.target.value)}>
                {coloresDisponibles.map(c => (
                   <MenuItem key={c.id} value={c.id}>{c.nombre} (Cod: {c.codigo})</MenuItem>
                ))}
             </Select>
           </FormControl>
           <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
             Al añadir el color, se generará el SKU automáticamente.
           </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenColorDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddColor} disabled={!selectedColorId}>Añadir SKU</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default MoldeDetalle;
