import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import QualityVisitDialog from '../components/QualityVisitDialog';
describe('Muestras de calidad',()=>{it('guarda dos pesajes independientes en una sola visita histórica',()=>{
 const done=vi.fn();render(<QualityVisitDialog open kind="PERIODICA" ot={{codigo_ot:'OT-254',fecha_operativa:'2026-10-24'}} work={{color:'Lila'}} outputs={[{id:12,nombre:'Base'},{id:13,nombre:'Tapa'}]} onSave={done} onClose={()=>{}}/>);
 fireEvent.change(screen.getByLabelText(/Fecha y hora observada/),{target:{value:'2026-10-24T10:50'}});
 ['Base','Tapa'].forEach(name=>fireEvent.click(screen.getByRole('checkbox',{name})));
 const qty=screen.getAllByLabelText(/Cantidad contada/), net=screen.getAllByLabelText(/Gramos netos/);
 [5,3].forEach((v,i)=>fireEvent.change(qty[i],{target:{value:String(v)}}));
 fireEvent.change(net[0],{target:{value:'1395'}}); fireEvent.click(screen.getByRole('button',{name:'Guardar visita'})); expect(done).not.toHaveBeenCalled();
 fireEvent.change(net[1],{target:{value:'15,6'}});fireEvent.click(screen.getByRole('button',{name:'Guardar visita'}));
 expect(done).toHaveBeenCalledTimes(1);expect(done.mock.calls[0][0].samples.map(s=>[s.outputId,s.result])).toEqual([[12,279],[13,5.2]]);
});});
