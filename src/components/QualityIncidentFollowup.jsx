import {useState} from 'react';
import {Box,Button,Chip,Dialog,DialogTitle,DialogContent,DialogActions,Stack,Typography,TextField} from '@mui/material';
export default function QualityIncidentFollowup({items,onCloseIssue}){
 const [id,setId]=useState(null),[verification,setVerification]=useState('');
 const incident=items.find(i=>i.id===id);
 if(!items.length)return null;
 return <Box sx={{mt:2}}><Typography variant="subtitle2" fontWeight={750}>Incidencias de la OT</Typography>
 {items.map(i=><Stack key={i.id} direction="row" spacing={1} alignItems="center" sx={{py:1,borderBottom:1,borderColor:'divider'}}>
 <Box sx={{flex:1,minWidth:0}}><Typography fontWeight={700}>{i.type}</Typography><Typography variant="body2" sx={{overflowWrap:'anywhere'}}>{i.description}</Typography></Box>
 <Chip size="small" label={i.status==='CERRADA'?'Cerrada':'Abierta'} color={i.status==='CERRADA'?'default':'warning'}/>
 <Button size="small" onClick={()=>{setId(i.id);setVerification('')}}>Ver detalle</Button></Stack>)}
 <Dialog open={!!incident} onClose={()=>setId(null)} fullWidth maxWidth="sm" aria-labelledby="qc-inc-detail">
 <DialogTitle id="qc-inc-detail">{incident?.type}</DialogTitle><DialogContent dividers><Stack spacing={1.5}>
 {incident && [['Hallazgo',incident.description],['Evidencia',incident.evidence],['Responsable',incident.owner],['Acción propuesta',incident.action],['Verificación',incident.verification],['Cierre',incident.closedAt?new Date(incident.closedAt).toLocaleString('es-PE'):null]].filter(([,v])=>v).map(([k,v])=><Box key={k}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography sx={{overflowWrap:'anywhere'}}>{v}</Typography></Box>)}
 {incident?.status!=='CERRADA'&&<TextField size="small" multiline minRows={2} label="Resultado de la verificación para cerrar" value={verification} onChange={e=>setVerification(e.target.value)}/>}
 </Stack></DialogContent><DialogActions><Button onClick={()=>setId(null)}>Volver</Button>{incident?.status!=='CERRADA'&&<Button variant="contained" disabled={!verification.trim()} onClick={()=>{onCloseIssue(id,verification.trim());setId(null)}}>Cerrar incidencia</Button>}</DialogActions></Dialog></Box>;
}
