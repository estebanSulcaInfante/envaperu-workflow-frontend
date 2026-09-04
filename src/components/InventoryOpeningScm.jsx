import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  actualizarAperturaInventarioScm, crearAperturaInventarioScm,
  enviarAperturaInventarioScm, listarAperturasInventarioScm,
  resolverAperturaInventarioScm,
} from '../services/scmInventoryApi';

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({
  item_key: '', cantidad: '', ubicacion_codigo: 'ALMACEN_GENERAL',
  ubicacion_nombre: 'Almacén general', estado_calidad: 'LIBERADO', observacion: '',
});
const emptyForm = () => ({
  fecha_corte: today(), motivo: '', metodo: 'CONTEO_FISICO_QR', lineas: [emptyLine()],
});
const catalogUnit = (item) => item?.unidad_base || item?.unidad || (item?.type === 'MATERIAL' ? 'KG' : 'UN');

export default function InventoryOpeningScm({
  articles, materials, onApplied, onRequestCatalog, refreshVersion = 0,
}) {
  const { actorId, can } = useScmActor();
  const canPrepare = can('INVENTARIO_APERTURA_PREPARAR');
  const canUseTabularContingency = can('INVENTARIO_APERTURA_CONTINGENCIA');
  const canApprove = can('INVENTARIO_APERTURA_APROBAR');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [resolution, setResolution] = useState(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [physicalTarget, setPhysicalTarget] = useState(null);
  const [targetForm, setTargetForm] = useState({ material_scm_id: '', ubicacion_codigo: 'A-ENVA-MP-GEN', estado_calidad: 'LIBERADO' });

  const catalog = useMemo(() => [
    ...articles.map((item) => ({ ...item, key: `A-${item.id}`, type: 'ARTICULO' })),
    ...materials.map((item) => ({ ...item, key: `M-${item.id}`, type: 'MATERIAL' })),
  ], [articles, materials]);
  const byCode = useMemo(() => new Map(catalog.map((item) => [item.codigo.toUpperCase(), item])), [catalog]);

  const load = useCallback(async () => {
    try {
      const payload = await listarAperturasInventarioScm();
      setItems(payload.items || []);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se cargaron los lotes de apertura.'));
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshVersion]);

  const payloadLines = () => form.lineas.map((line) => {
    const selected = catalog.find((item) => item.key === line.item_key);
    return {
      ...(selected?.type === 'MATERIAL'
        ? { material_scm_id: selected.id }
        : { articulo_scm_id: selected?.id }),
      cantidad: line.cantidad,
      ubicacion_codigo: line.ubicacion_codigo.trim().toUpperCase(),
      ubicacion_nombre: line.ubicacion_nombre.trim(),
      estado_calidad: line.estado_calidad,
      observacion: line.observacion.trim() || undefined,
    };
  });

  const save = async () => {
    const physical = form.metodo === 'CONTEO_FISICO_QR';
    if (!form.motivo.trim() || (!physical && form.lineas.some((line) => !line.item_key || Number(line.cantidad) <= 0))) {
      setError('Indica el motivo y completa artículo/material y cantidad en cada línea.');
      return;
    }
    setBusy(true); setError('');
    try {
      const payload = {
        fecha_corte: form.fecha_corte, motivo: form.motivo.trim(),
        ...(editing ? {} : { metodo: form.metodo }),
        lineas: physical ? [] : payloadLines(),
      };
      if (editing) await actualizarAperturaInventarioScm(editing.id, { ...payload, version: editing.version });
      else await crearAperturaInventarioScm(payload);
      setOpen(false); setEditing(null); setForm(emptyForm());
      setNotice('Borrador guardado. Todavía no modifica el Kardex.');
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se guardó el lote de apertura.'));
    } finally { setBusy(false); }
  };

  const send = async (item) => {
    setBusy(true); setError('');
    try {
      await enviarAperturaInventarioScm(item.id, item.version);
      setNotice('Lote enviado. El Jefe de Producción debe revisarlo con otro actor.');
      await load();
    } catch (requestError) { setError(mensajeErrorScm(requestError, 'No se envió el lote.')); }
    finally { setBusy(false); }
  };

  const resolve = async (decision) => {
    if (!resolutionReason.trim()) { setError('La resolución requiere una evidencia o motivo.'); return; }
    setBusy(true); setError('');
    try {
      const result = await resolverAperturaInventarioScm(resolution.id, {
        version: resolution.version, decision, motivo_resolucion: resolutionReason.trim(),
      });
      setResolution(null); setResolutionReason('');
      setNotice(result.estado === 'APLICADO'
        ? 'Apertura aplicada. Sus saldos ya forman parte del Kardex.'
        : 'Lote rechazado sin modificar el Kardex.');
      await load();
      if (result.estado === 'APLICADO') await onApplied?.();
    } catch (requestError) { setError(mensajeErrorScm(requestError, 'No se resolvió el lote.')); }
    finally { setBusy(false); }
  };

  const ensureCatalog = async () => {
    try {
      setBusy(true);
      await onRequestCatalog?.();
      return true;
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se cargó el catálogo para la apertura.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openNew = async () => {
    if (!await ensureCatalog()) return;
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const edit = async (item) => {
    if (!await ensureCatalog()) return;
    setEditing(item);
    setForm({
      fecha_corte: item.fecha_corte, motivo: item.motivo, metodo: item.metodo,
      lineas: item.lineas.map((line) => ({
        item_key: `${line.item_tipo === 'MATERIAL' ? 'M' : 'A'}-${line.material_scm_id || line.articulo_scm_id}`,
        cantidad: line.cantidad, ubicacion_codigo: line.ubicacion_codigo,
        ubicacion_nombre: line.ubicacion_nombre, estado_calidad: line.estado_calidad,
        observacion: line.observacion || '',
      })),
    });
    setOpen(true);
  };

  const configurePhysicalCapture = async (item) => {
    if (!await ensureCatalog()) return;
    setPhysicalTarget(item);
    setTargetForm({ material_scm_id: '', ubicacion_codigo: 'A-ENVA-MP-GEN', estado_calidad: 'LIBERADO' });
  };

  const targetQr = useMemo(() => {
    if (!physicalTarget || !targetForm.material_scm_id || !targetForm.ubicacion_codigo.trim()) return '';
    const selectedMaterial = materials.find((item) => Number(item.id) === Number(targetForm.material_scm_id));
    return JSON.stringify({
      type: 'SCM_INVENTORY_OPENING_TARGET', v: 1,
      opening_id: physicalTarget.id,
      opening_codigo: physicalTarget.codigo,
      material_scm_id: Number(targetForm.material_scm_id),
      material_codigo: selectedMaterial?.codigo || '',
      material_nombre: selectedMaterial?.nombre || '',
      unidad_medida: 'KG',
      ubicacion_codigo: targetForm.ubicacion_codigo.trim().toUpperCase(),
      estado_calidad: targetForm.estado_calidad,
    });
  }, [physicalTarget, targetForm, materials]);

  const importPaste = () => {
    try {
      const parsed = pasteText.split(/\r?\n/).filter((row) => row.trim()).map((row, index) => {
        const [code, quantity, location = 'ALMACEN_GENERAL', quality = 'LIBERADO', observation = ''] = row.split(/\t|;/).map((value) => value.trim());
        const selected = byCode.get(code.toUpperCase());
        if (!selected) throw new Error(`Línea ${index + 1}: no existe el código ${code}.`);
        if (!(Number(quantity) > 0)) throw new Error(`Línea ${index + 1}: cantidad inválida.`);
        return {
          item_key: selected.key, cantidad: quantity,
          ubicacion_codigo: location.toUpperCase(), ubicacion_nombre: location,
          estado_calidad: quality.toUpperCase(), observacion: observation,
        };
      });
      setForm({ ...form, lineas: parsed }); setPasteOpen(false); setPasteText('');
    } catch (parseError) { setError(parseError.message); }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={850}>Apertura inicial controlada</Typography>
            <Typography variant="body2" color="text.secondary">
              El borrador no cambia existencias. Solo otro actor autorizado puede aplicarlo.
            </Typography>
          </Box>
          {canPrepare && <Button variant="contained" startIcon={<AddIcon />} disabled={busy} onClick={openNew}>Nuevo lote de conteo</Button>}
        </Stack>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
        <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>Lote / corte</TableCell><TableCell>Contenido</TableCell><TableCell>Estado</TableCell><TableCell>Responsables</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell><Typography fontWeight={750}>{item.codigo}</Typography><Typography variant="caption">{item.fecha_corte} · v{item.version}</Typography></TableCell>
                <TableCell>{item.total_lineas} líneas · {item.total_unidades_logisticas || 0} bultos QR<Typography variant="caption" display="block">{item.metodo === 'CONTEO_FISICO_QR' ? 'Conteo físico pesado' : 'Carga tabular de contingencia'} · {item.motivo}</Typography></TableCell>
                <TableCell><Chip size="small" color={item.estado === 'APLICADO' ? 'success' : item.estado === 'PENDIENTE_APROBACION' ? 'warning' : 'default'} label={item.estado.replaceAll('_', ' ')} /></TableCell>
                <TableCell><Stack spacing={0.25}>
                  <Typography variant="body2"><b>Creó:</b> {item.creado_por?.nombre || `Actor #${item.creado_por_id}`}</Typography>
                  {item.enviado_por && <Typography variant="caption"><b>Envió:</b> {item.enviado_por.nombre}</Typography>}
                  {item.resuelto_por && <Typography variant="caption"><b>Resolvió:</b> {item.resuelto_por.nombre}</Typography>}
                </Stack></TableCell>
                <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={1}>
                  {canPrepare && item.metodo !== 'CONTEO_FISICO_QR' && item.estado === 'BORRADOR' && item.creado_por_id === actorId && <Button size="small" onClick={() => edit(item)}>Editar</Button>}
                  {canPrepare && item.metodo === 'CONTEO_FISICO_QR' && item.estado === 'BORRADOR' && item.creado_por_id === actorId && <Button size="small" variant="outlined" onClick={() => configurePhysicalCapture(item)}>Pesar bolsas</Button>}
                  {canPrepare && item.estado === 'BORRADOR' && item.creado_por_id === actorId && <Button size="small" variant="outlined" disabled={busy} onClick={() => send(item)}>Enviar</Button>}
                  {canApprove && item.estado === 'PENDIENTE_APROBACION' && item.creado_por_id !== actorId && <Button size="small" variant="contained" color="success" onClick={() => setResolution(item)}>Revisar</Button>}
                </Stack></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5}><Alert severity="info">Todavía no existe un lote de apertura.</Alert></TableCell></TableRow>}
          </TableBody>
        </Table></TableContainer>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{editing ? `Editar ${editing.codigo}` : 'Nuevo lote de apertura'}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Registra el conteo observado. Los saldos pendientes de Calidad tendrán disponibilidad cero.</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField type="date" label="Fecha de corte" InputLabelProps={{ shrink: true }} value={form.fecha_corte} onChange={(event) => setForm({ ...form, fecha_corte: event.target.value })} />
            <TextField fullWidth label="Motivo y referencia del conteo" value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} />
            {canUseTabularContingency && form.metodo === 'TABULAR_CONTINGENCIA' && <Button startIcon={<UploadFileIcon />} variant="outlined" onClick={() => setPasteOpen(true)}>Pegar tabla</Button>}
          </Stack>
          {!editing && <TextField select label="Método de apertura" value={form.metodo} onChange={(event) => setForm({ ...form, metodo: event.target.value })}>
            <MenuItem value="CONTEO_FISICO_QR">Conteo físico · balanza + QR</MenuItem>
            {canUseTabularContingency && <MenuItem value="TABULAR_CONTINGENCIA">Carga tabular · solo Gerencia General</MenuItem>}
          </TextField>}
          {form.metodo === 'CONTEO_FISICO_QR' && <Alert severity="success">
            Guarda la jornada sin cantidades. Luego usa <b>Pesar bolsas</b>: cada línea y cantidad se derivará del peso NET capturado en la estación.
          </Alert>}
          {form.metodo === 'TABULAR_CONTINGENCIA' && form.lineas.map((line, index) => (
            <Paper variant="outlined" sx={{ p: 1.5 }} key={`${index}-${line.item_key}`}>
              {(() => {
                const selectedItem = catalog.find((item) => item.key === line.item_key);
                const unit = selectedItem ? catalogUnit(selectedItem) : '';
                return (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      md: 'minmax(260px, 2fr) minmax(140px, .8fr) minmax(180px, 1fr)',
                      lg: 'minmax(280px, 2fr) minmax(140px, .75fr) minmax(180px, 1fr) minmax(150px, .8fr) minmax(200px, 1.2fr) auto',
                    },
                    gap: 1,
                    alignItems: 'center',
                  }}>
                    <FormControl fullWidth><InputLabel id={`opening-item-${index}-label`}>Artículo o material</InputLabel><Select id={`opening-item-${index}`} labelId={`opening-item-${index}-label`} label="Artículo o material" value={line.item_key} onChange={(event) => { const next = [...form.lineas]; next[index] = { ...line, item_key: event.target.value }; setForm({ ...form, lineas: next }); }}>{catalog.map((item) => <MenuItem key={item.key} value={item.key}>{item.codigo} · {item.nombre} · {catalogUnit(item)}</MenuItem>)}</Select></FormControl>
                    <TextField fullWidth type="number" label={unit ? `Cantidad (${unit})` : 'Cantidad'} value={line.cantidad} onChange={(event) => { const next = [...form.lineas]; next[index] = { ...line, cantidad: event.target.value }; setForm({ ...form, lineas: next }); }} inputProps={{ min: 0.001, step: 0.001 }} InputProps={unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined} />
                    <TextField fullWidth label="Ubicación" value={line.ubicacion_codigo} onChange={(event) => { const next = [...form.lineas]; next[index] = { ...line, ubicacion_codigo: event.target.value.toUpperCase(), ubicacion_nombre: event.target.value }; setForm({ ...form, lineas: next }); }} />
                    <TextField fullWidth select label="Calidad" value={line.estado_calidad} onChange={(event) => { const next = [...form.lineas]; next[index] = { ...line, estado_calidad: event.target.value }; setForm({ ...form, lineas: next }); }} sx={{ minWidth: 150 }}><MenuItem value="LIBERADO">Liberado</MenuItem><MenuItem value="PENDIENTE">Pendiente</MenuItem></TextField>
                    <TextField fullWidth label="Observación" value={line.observacion} onChange={(event) => { const next = [...form.lineas]; next[index] = { ...line, observacion: event.target.value }; setForm({ ...form, lineas: next }); }} />
                    <IconButton aria-label="Quitar línea" disabled={form.lineas.length === 1} onClick={() => setForm({ ...form, lineas: form.lineas.filter((_, itemIndex) => itemIndex !== index) })}><DeleteOutlineIcon /></IconButton>
                  </Box>
                );
              })()}
            </Paper>
          ))}
          {form.metodo === 'TABULAR_CONTINGENCIA' && <Button startIcon={<AddIcon />} onClick={() => setForm({ ...form, lineas: [...form.lineas, emptyLine()] })}>Agregar línea</Button>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancelar</Button><Button variant="contained" disabled={busy} onClick={save}>Guardar borrador</Button></DialogActions>
      </Dialog>

      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Importar conteo pegando una tabla</DialogTitle>
        <DialogContent><Stack spacing={1} sx={{ pt: 1 }}><Alert severity="info">Una fila por línea: CÓDIGO; CANTIDAD; UBICACIÓN; CALIDAD; OBSERVACIÓN. También acepta columnas separadas por tabulador.</Alert><TextField multiline minRows={8} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'PC-000013; 120; ALMACEN_PIEZAS; LIBERADO; Conteo anaquel 1\nMP-000001; 250; ALMACEN_MP; PENDIENTE; Sacos contados'} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setPasteOpen(false)}>Cancelar</Button><Button variant="contained" onClick={importPaste}>Validar e importar</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(resolution)} onClose={() => setResolution(null)} fullWidth maxWidth="sm">
        <DialogTitle>Resolver {resolution?.codigo}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="warning">Aprobar aplicará todas las líneas atómicamente. No se podrá editar ni eliminar el lote.</Alert><TextField multiline minRows={3} label="Evidencia o motivo de resolución" value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} /></Stack></DialogContent>
        <DialogActions><Button color="error" disabled={busy} onClick={() => resolve('RECHAZAR')}>Rechazar</Button><Button color="success" variant="contained" disabled={busy} onClick={() => resolve('APROBAR')}>Aprobar y aplicar</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(physicalTarget)} onClose={() => setPhysicalTarget(null)} fullWidth maxWidth="md">
        <DialogTitle>Pesaje físico · {physicalTarget?.codigo}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Selecciona qué material y ubicación representa el siguiente grupo de bolsas. Copia el contexto en la estación; cada captura generará un QR de unidad logística.</Alert>
          <TextField select label="Material (KG)" value={targetForm.material_scm_id} onChange={(event) => setTargetForm({ ...targetForm, material_scm_id: event.target.value })}>
            {materials.filter((item) => catalogUnit({ ...item, type: 'MATERIAL' }) === 'KG').map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
          </TextField>
          <TextField label="Ubicación canónica" value={targetForm.ubicacion_codigo} onChange={(event) => setTargetForm({ ...targetForm, ubicacion_codigo: event.target.value.toUpperCase() })} />
          <TextField select label="Estado inicial de Calidad" value={targetForm.estado_calidad} onChange={(event) => setTargetForm({ ...targetForm, estado_calidad: event.target.value })}>
            <MenuItem value="PENDIENTE">Pendiente de Calidad</MenuItem><MenuItem value="LIBERADO">Liberado por política de apertura</MenuItem>
          </TextField>
          <TextField label="Contexto QR para la estación" multiline minRows={4} value={targetQr} InputProps={{ readOnly: true }} />
          <Button variant="contained" disabled={!targetQr} onClick={() => window.open('http://127.0.0.1:5051/?tab=scm-inventory-opening', '_blank')}>Abrir estación de pesaje</Button>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setPhysicalTarget(null)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Paper>
  );
}
