import {useState} from 'react';
import {Alert,Box,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,Stack,TextField,Typography} from '@mui/material';

const keyOf=(o,i)=>o.public_id || o.id || o.codigo || o.pieza_id || o.articulo_id || ('salida-'+(i+1));
const nameOf=o=>o.nombre || o.pieza?.nombre || o.articulo?.nombre || o.codigo;
const n=value=>Number(String(value??'').trim().replace(',','.'));
function Capture({ot,work,outputs,kind,onSave,onClose}) {
  const nowLima=new Date(Date.now()-5*3600000).toISOString().slice(0,16);
  const [at,setAt]=useState(ot?.fecha_operativa===nowLima.slice(0,10)?nowLima:'');
  const [rows,setRows]=useState(()=>outputs.map((o,i)=>({outputId:keyOf(o,i),name:nameOf(o),checked:outputs.length===1,quantity:'',grams:''})));
  const [note,setNote]=useState('');
  const [cycle,setCycle]=useState('');
  const cycleOK=!cycle.trim() || (Number.isFinite(n(cycle)) && n(cycle)>0);
  const [submit,setSubmit]=useState(false);
  const chosen=rows.filter(r=>r.checked);
  const unitsOK=r=>Number.isSafeInteger(n(r.quantity)) && n(r.quantity)>0;
  const gramsOK=r=>Number.isFinite(n(r.grams)) && n(r.grams)>0;
  function edit(id,v){setRows(old=>old.map(r=>r.outputId===id?{...r,...v}:r));}
  const timeOK=at && at<=nowLima;
  function save(e){
    e.preventDefault(); setSubmit(true);
    if(!timeOK || !cycleOK || !chosen.length || !chosen.every(r=>unitsOK(r)&&gramsOK(r)))return;
    const samples=chosen.map(r=>({outputId:r.outputId,name:r.name,quantity:n(r.quantity),grams:n(r.grams),result:n(r.grams)/n(r.quantity)}));
    onSave({kind,cycleSeconds:cycle.trim()?n(cycle):null,observedAt:at,observedTimeZone:'America/Lima',note,selectedOutputIds:samples.map(r=>r.outputId),samples,...(samples.length===1?{quantity:samples[0].quantity,grams:samples[0].grams,result:samples[0].result}:{})});
  }
  return <Box component="form" noValidate onSubmit={save}>
    <DialogTitle id="quality-visit-title">{kind==='PERIODICA'?'Registrar visita periódica':'Registrar control de arranque'}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Typography variant="body2">{[ot.codigo_ot,work.orden_fabricacion_codigo,work.molde?.nombre||work.molde?.codigo||work.molde_codigo,work.color?.nombre||work.color].filter(v=>typeof v==='string').join(' · ')}</Typography>
      <TextField required size="small" label="Fecha y hora observada" type="datetime-local" value={at} onChange={e=>setAt(e.target.value)} slotProps={{inputLabel:{shrink:true},htmlInput:{max:nowLima}}} error={submit&&!timeOK} helperText={submit&&!timeOK?'Ingresa cuándo tomaste la muestra; no puede ser en el futuro.':'Hora de planta (Lima). Jornada de la OT: '+ot.fecha_operativa}/>
      <Box><Typography variant="subtitle2">Piezas inspeccionadas</Typography><Typography variant="body2" color="text.secondary">Marca las piezas que revisaste. Pesa cada tipo por separado.</Typography></Box>
      {submit&&!chosen.length&&<Alert severity="warning">Selecciona al menos una pieza.</Alert>}
      {rows.map(r=><Box key={r.outputId} sx={{borderTop:1,borderColor:'divider',pt:.5}}>
        <FormControlLabel control={<Checkbox checked={r.checked} onChange={e=>edit(r.outputId,{checked:e.target.checked})}/>} label={r.name}/>
        {r.checked&&<Stack direction={{xs:'column',sm:'row'}} spacing={1} sx={{py:.75,alignItems:{sm:'center'}}}>
          <TextField required size="small" label="Cantidad contada" value={r.quantity} slotProps={{htmlInput:{inputMode:'numeric'}}} onChange={e=>edit(r.outputId,{quantity:e.target.value})} error={submit&&!unitsOK(r)} helperText={submit&&!unitsOK(r)?'Ingresa piezas enteras mayores que cero.':undefined}/>
          <TextField required size="small" label="Gramos netos" value={r.grams} slotProps={{htmlInput:{inputMode:'decimal'}}} onChange={e=>edit(r.outputId,{grams:e.target.value})} error={submit&&!gramsOK(r)} helperText={submit&&!gramsOK(r)?'Ingresa un peso neto mayor que cero.':undefined}/>
          <Typography sx={{minWidth:'9ch'}} variant="subtitle2">{unitsOK(r)&&gramsOK(r)?(n(r.grams)/n(r.quantity)).toLocaleString('es-PE',{maximumFractionDigits:3}):'—'} g/pieza</Typography>
        </Stack>}
      </Box>)}
      <TextField size="small" label="Tiempo de ciclo (s)" value={cycle} onChange={e=>setCycle(e.target.value)} slotProps={{htmlInput:{inputMode:"decimal"}}} error={submit&&!cycleOK} helperText={submit&&!cycleOK?"Ingresa segundos mayores que cero.":"Opcional. Una medición para todo el ciclo del molde."}/>
      <TextField size="small" label="Observación" multiline minRows={2} value={note} onChange={e=>setNote(e.target.value)}/>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancelar</Button><Button type="submit" variant="contained">Guardar visita</Button></DialogActions>
  </Box>;
}
export default function QualityVisitDialog({open,...props}){
 return <Dialog open={open} onClose={props.onClose} maxWidth="sm" fullWidth aria-labelledby="quality-visit-title">{open&&<Capture {...props}/>}</Dialog>;
}
