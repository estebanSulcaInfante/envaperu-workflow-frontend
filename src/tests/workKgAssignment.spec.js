import { describe, expect, it } from 'vitest';
import { buildKgAssignment } from '../utils/workKgAssignment';

const line = { orden_operacion_salida_id: 'out-1', saldo_un: '100', capacidad_efectiva_un: 50 };
const run = { salidas: [{ id: 'out-1', peso_unitario_snapshot_g: '240.0000' }] };
const model = (edit, override = {}) => buildKgAssignment({ line: { ...line, ...override }, run, initialUnits: 100, edit });

describe('asignación discreta desde kg teóricos', () => {
  it('muestra 24 kg pendientes y 12 kg por manga desde el snapshot exacto', () => {
    expect(model()).toMatchObject({ valid: true, units: 100, pendingKg: '24', capacityKg: '12', appliedKg: '24', fullBags: 2, partialUnits: 0 });
  });
  it('no redondea 13 kg sin decisión humana', () => {
    expect(model({ text: '13' })).toMatchObject({ valid: false, needsChoice: true,
      options: [{ units: 54, kg: '12.96' }, { units: 55, kg: '13.2' }] });
  });
  it('expone la diferencia exacta de la alternativa elegida', () => {
    expect(model({ text: '13', choice: 'lower' }).differenceKg).toBe('-0.04');
    expect(model({ text: '13', choice: 'upper' }).differenceKg).toBe('+0.2');
  });
  it.each([['lower', 54, '12.96', '0.96'], ['upper', 55, '13.2', '1.2']])('resuelve elección %s y advierte el remanente sin bloquear', (choice, units, kg, partial) => {
    expect(model({ text: '13', choice })).toMatchObject({ valid: true, units, appliedKg: kg, fullBags: 1, partialKg: partial });
  });
  it('acepta coma y cero sin producir falsas fracciones binarias', () => {
    expect(model({ text: '12,96' })).toMatchObject({ valid: true, units: 54 });
    expect(model({ text: '0' })).toMatchObject({ valid: true, units: 0, partialUnits: 0 });
    expect(buildKgAssignment({ line, run: { salidas: [{ id: 'out-1', peso_unitario_snapshot_g: '0.1' }] }, edit: { text: '0.003' } })).toMatchObject({ valid: true, units: 30 });
  });
  it.each(['', '-1', 'abc', 'Infinity', '1e3', '25'])('no acepta kg inválidos o fuera de saldo: %s', (text) => {
    expect(model({ text }).valid).toBe(false);
  });
  it('no permite alternativa superior fuera de saldo', () => {
    const result = model({ text: '13', choice: 'upper' }, { saldo_un: '54' });
    expect(result.valid).toBe(false);
  });
  it('13 kg exactos pueden distribuirse en 12 kg + 1 kg sin bloquear', () => {
    expect(buildKgAssignment({ line: { ...line, capacidad_efectiva_un: 48 },
      run: { salidas: [{ id: 'out-1', peso_unitario_snapshot_g: '250' }] },
      edit: { text: '13' },
    })).toMatchObject({ valid: true, units: 52, fullBags: 1, capacityKg: '12', partialKg: '1' });
  });
  it('cada salida multipieza usa únicamente su peso congelado', () => {
    const multi = { salidas: [
      { id: 'pala', peso_unitario_snapshot_g: '67' },
      { id: 'rastrillo', peso_unitario_snapshot_g: '68' },
    ] };
    expect(buildKgAssignment({ line: { ...line, orden_operacion_salida_id: 'rastrillo' }, run: multi, edit: { text: '5.44' } })).toMatchObject({ valid: true, units: 80 });
  });
  it('no infiere peso de otra salida o de un maestro vivo', () => {
    expect(buildKgAssignment({ line, run: { salidas: [{ id: 'out-other', peso_unitario_snapshot_g: 240 }] }, initialUnits: 100 }).valid).toBe(false);
    expect(buildKgAssignment({ line, run: { salidas: [{ id: 'out-1', peso_unitario_snapshot_g: null }] }, initialUnits: 100 }).valid).toBe(false);
  });
});
