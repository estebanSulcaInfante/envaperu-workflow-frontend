import { describe, expect, it } from 'vitest';

import { scmGlossary, scmGuideStages } from '../data/scmGuide';

const stage = (id) => scmGuideStages.find((item) => item.id === id);
const textOf = (value) => JSON.stringify(value);

describe('guía oficial de OT de máquina y Trabajo de color', () => {
  it('explica los tres niveles, la cola de colores y el retorno A-B-A', () => {
    const production = textOf(stage('produccion'));

    expect(production).toContain('máquina, fecha y turno');
    expect(production).toContain('OF + corrida + color');
    expect(production).toContain('solamente uno puede permanecer En ejecución');
    expect(production).toContain('A → B → A');
    expect(production).toContain('reanuda el mismo Trabajo de color');
  });

  it('documenta asignación, relevo por subconjunto y pesaje por QR', () => {
    const production = textOf(stage('produccion'));
    const weighing = textOf(stage('pesaje'));

    expect(production).toContain('mangas pendientes');
    expect(production).toContain('relevo supervisado');
    expect(production).toContain('conteo acumulado en la frontera del relevo');
    expect(production).toContain('no es un pesaje intermedio');
    expect(production).toContain('conserva su identidad, color y Trabajo de color');
    expect(production).toContain('se invalida y se imprime su reemplazo');
    expect(production).toContain('no digita OF, color, cantidad, fecha ni su nombre');
    expect(weighing).toContain('no se digitan manualmente en la estación');
    expect(weighing).toContain('Trabajo de color esté pausado');
  });

  it('declara anulación, reversa y las fronteras del piloto', () => {
    const production = textOf(stage('produccion'));
    const corrections = textOf(stage('correcciones'));

    expect(production).toContain('No se transfiere una manga de una OT diaria a la OT del día siguiente');
    expect(production).toContain('No se acumulan varios pesajes parciales o intermedios');
    expect(production).toContain('No se modela aquí material preparado');
    expect(corrections).toContain('reversa de recepción');
    expect(corrections).toContain('devuelve su cupo al Trabajo de color');
  });

  it('elimina la nomenclatura operativa obsoleta del contenido visible', () => {
    const visibleGuide = textOf({ scmGuideStages, scmGlossary });

    expect(visibleGuide).not.toContain('Fabricación mediante OP / OT');
    expect(visibleGuide).not.toContain('Fabricación mediante OP/OT');
    expect(visibleGuide).not.toContain('Una manga pertenece a una sola OT');
    expect(visibleGuide).toContain('OT de máquina');
    expect(visibleGuide).toContain('Trabajo de color');
  });
});
