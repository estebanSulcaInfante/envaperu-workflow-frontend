import { describe, expect, it } from 'vitest';
import {
  compatibleProcessMachines,
  resolveFabricationProcess,
  routeOptionsForRun,
  routeOperationsForArticle,
} from '../components/fabricationRoutes';

const routes = [
  {
    id: 20,
    numero_revision: 3,
    estado: 'APROBADA',
    content_hash: 'hash-20',
    operaciones: [
      { id: 201, executor_kind: 'OP_OT', tipo: 'SOPLADO', nombre: 'Soplar cuerpo', articulo_salida: { id: 5, codigo: 'PC-BODY' } },
      { id: 202, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Inyectar tapa', articulo_salida: { id: 6, codigo: 'PC-CAP' } },
      { id: 203, executor_kind: 'ORDEN_OPERACION', tipo: 'SOPLADO', articulo_salida: { id: 5, codigo: 'PC-BODY' } },
    ],
  },
  {
    id: 21,
    numero_revision: 4,
    estado: 'BORRADOR',
    operaciones: [{ id: 211, executor_kind: 'OP_OT', tipo: 'SOPLADO', articulo_salida: { id: 5 } }],
  },
];

describe('selector de rutas de fabricación', () => {
  it('conserva únicamente operación aprobada OP_OT de salida exacta', () => {
    expect(routeOperationsForArticle(routes, { id: 5 })).toEqual([expect.objectContaining({
      id: 201,
      operacion_ruta_revision_id: 201,
      ruta_revision_id: 20,
      proceso: 'SOPLADO',
    })]);
    expect(routeOperationsForArticle(routes, { id: 99 })).toEqual([]);
  });

  it('resuelve proceso explícito cuando las referencias son parciales', () => {
    const run = { salidas: [{ articulo: { id: 5 } }] };
    expect(resolveFabricationProcess('', [run], { 5: routes })).toMatchObject({
      process: '', requiresExplicit: true, valid: false,
    });
    expect(resolveFabricationProcess('SOPLADO', [run], { 5: routes })).toMatchObject({
      process: 'SOPLADO', valid: true,
    });
  });

  it('limita máquina sugerida al proceso resuelto', () => {
    const machines = [
      { id: 1, estado: 'OPERATIVA', tipo_maquina: { proceso: 'SOPLADO' } },
      { id: 2, estado: 'OPERATIVA', tipo_maquina: { proceso: 'INYECCION' } },
    ];
    expect(compatibleProcessMachines(machines, 'SOPLADO').map((item) => item.id)).toEqual([1]);
  });

  it('no acepta una referencia de otra salida como ruta del objetivo', () => {
    const run = { salidas: [{ articulo: { id: 5 } }], operacion_ruta_revision_id: 202 };
    expect(resolveFabricationProcess('SOPLADO', [run], { 5: routes })).toMatchObject({
      valid: false,
      complete: false,
    });
  });

  it('normaliza salidas del detalle que traen solo articulo_scm_id', () => {
    expect(routeOptionsForRun({ salidas: [{ articulo: { nombre: 'Pieza 5', clase: 'PIEZA_COLOR' }, articulo_scm_id: 5 }] }, { 5: routes }))
      .toEqual([expect.objectContaining({ operacion_ruta_revision_id: 201, proceso: 'SOPLADO' })]);
  });
});
