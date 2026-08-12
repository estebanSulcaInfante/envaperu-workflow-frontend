import { describe, expect, it } from 'vitest';

import { scmGlossary, scmGuideStages } from '../data/scmGuide';

const stage = (id) => scmGuideStages.find((item) => item.id === id);
const textOf = (value) => JSON.stringify(value);

describe('guía oficial de OT de máquina y Trabajo de color', () => {
  it('distingue la demanda autorizada de los cálculos del sistema al crear una OP', () => {
    const planning = textOf(stage('planificacion'));

    expect(planning).toContain('Antes de crear una OP: fuente, datos y derivados');
    expect(planning).toContain('cantidad autorizada');
    expect(planning).toContain('fecha de necesidad no es una fecha de inicio prometida');
    expect(planning).toContain('unidades equivalentes');
    expect(planning).toContain('cobertura');
    expect(planning).toContain('Responsable cuando falta un dato');
  });

  it('explica el bloqueo de componentes sin operación sin inventar la ruta', () => {
    const planning = textOf(stage('planificacion'));

    expect(planning).toContain('La OA terminal del producto terminado no fabrica por sí sola');
    expect(planning).toContain('Pieza-color o WIP');
    expect(planning).toContain('Recalcular');
    expect(planning).toContain('No elija un proceso, centro, BOM ni forma de ejecución sólo para quitar el bloqueo');
    expect(planning).toContain('Actualizar ingeniería de la OP');
    expect(planning).toContain('snapshots técnicos congelados');
    expect(planning).toContain('Recalcular por sí solo nunca adopta revisiones nuevas');
    expect(planning).toContain('corregir maestro → actualizar ingeniería de la OP → recalcular');
  });

  it('incluye un recorrido accionable desde el PT hasta la creación de mangas', () => {
    const catalogs = textOf(stage('catalogos'));

    expect(catalogs).toContain('Alta integral: interfaz principal');
    expect(catalogs).toContain('/datos-maestros/alta-producto');
    expect(catalogs).toContain('Nombre del producto, Línea y Familia');
    expect(catalogs).toContain('1 UN');
    expect(catalogs).toContain('Pérdida esperada');
    expect(catalogs).toContain('Publicar (queda aprobada)');
    expect(catalogs).toContain('Ir a Estructuras BOM');
    expect(catalogs).toContain('/datos-maestros/ingenieria-scm?tab=estructuras');
    expect(catalogs).toContain('/datos-maestros/ingenieria-scm?tab=rutas');
    expect(catalogs).toContain('/planificacion');
    expect(catalogs).toContain('/produccion/ots-planta');
  });

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

  it('documenta el Kardex multi-almacén, custodia, QR, pickup y diferencias', () => {
    const warehouse = textOf(stage('almacen'));

    expect(warehouse).toContain('Kardex único');
    expect(warehouse).toContain('Cantidad física');
    expect(warehouse).toContain('Cantidad libre');
    expect(warehouse).toContain('Cantidad reservada');
    expect(warehouse).toContain('Cantidad no disponible');
    expect(warehouse).toContain('sesión multi-QR');
    expect(warehouse).toContain('Escanear, reservar o preparar picking no mueve el Kardex');
    expect(warehouse).toContain('Pickup habitual de Armado');
    expect(warehouse).toContain('Mesa de Armado');
    expect(warehouse).toContain('TRANSFERENCIA_DIFERENCIA');
    expect(warehouse).toContain('MANGA_PESADA_SIN_RECEPCION');
    expect(warehouse).toContain('/almacen/operaciones');
    expect(warehouse).toContain('Control > Control de inventario');
  });

  it('elimina la nomenclatura operativa obsoleta del contenido visible', () => {
    const visibleGuide = textOf({ scmGuideStages, scmGlossary });

    expect(visibleGuide).not.toContain('Fabricación mediante OP / OT');
    expect(visibleGuide).not.toContain('Fabricación mediante OP/OT');
    expect(visibleGuide).not.toContain('Una manga pertenece a una sola OT');
    expect(visibleGuide).not.toContain('ProductoTerminado');
    expect(visibleGuide).toContain('OT de máquina');
    expect(visibleGuide).toContain('Trabajo de color');
  });

  it('documenta el tablero dual, sus fechas y el contexto concurrente exacto', () => {
    const production = textOf(stage('produccion'));
    const assembly = textOf(stage('armado'));

    expect(production).toContain('Fabricación · Máquinas');
    expect(production).toContain('Armado · Centros');
    expect(production).toContain('Sin jornada');
    expect(production).toContain('Volver a Jornadas');
    expect(production).toContain('Sin demanda fechada');
    expect(production).toContain('primera y última fecha operativa');
    expect(assembly).toContain('Trabajo de color activo');
  });
});
