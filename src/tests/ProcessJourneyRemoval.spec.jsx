import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard all former consumers against reintroducing the retired guide.
describe('Retiro global del recorrido operativo', () => {
  it.each([
    'AssemblyOrdersScm', 'FabricationOrdersScm', 'InternalSupplyScm',
    'OtMangasScm', 'ProductionPlanningScm',
  ])('%s no importa ni reserva espacio para el recorrido', (component) => {
    const source = readFileSync(resolve('src/components', `${component}.jsx`), 'utf8');
    expect(/ProcessJourney|Recorrido operativo|process-journey-steps/.test(source)).toBe(false);
  });
});
