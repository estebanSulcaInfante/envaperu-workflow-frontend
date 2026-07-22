import { describe, expect, it } from 'vitest';
import {
  getWorkspaceNavigation,
  navigationItemIsActive,
  primaryNavigation,
  workspaceNavigation,
  workspaceTabIsActive,
} from '../config/navigation';

describe('navegación SCM por procesos', () => {
  it('mantiene una navegación principal breve y orientada al flujo', () => {
    expect(primaryNavigation.map((item) => item.id)).toEqual([
      'inicio',
      'planificacion',
      'materiales',
      'produccion',
    ]);
  });

  it('asigna el enlace legacy de preparación al módulo de materias primas', () => {
    expect(getWorkspaceNavigation('/ordenes/OP-0041/materiales')?.id).toBe('materiales');
  });

  it('activa rutas canónicas sin marcar prefijos parecidos', () => {
    const production = primaryNavigation.find((item) => item.id === 'produccion');
    const masterWorkspace = workspaceNavigation.find((item) => item.id === 'maestros');
    const overview = masterWorkspace.tabs[0];

    expect(getWorkspaceNavigation('/produccion/avance')?.id).toBe(production.id);
    expect(navigationItemIsActive('/planificacion', production)).toBe(false);
    expect(workspaceTabIsActive('/datos-maestros', overview)).toBe(true);
    expect(workspaceTabIsActive('/datos-maestros/productos', overview)).toBe(false);
  });

  it('expone el catálogo de líneas y familias dentro de datos maestros', () => {
    const masterWorkspace = workspaceNavigation.find((item) => item.id === 'maestros');
    const classification = masterWorkspace.tabs.find((tab) => tab.path === '/datos-maestros/clasificacion');

    expect(classification?.label).toBe('Líneas y familias');
    expect(workspaceTabIsActive('/datos-maestros/clasificacion', classification)).toBe(true);
  });

  it('ubica la configuración guiada junto a moldes y piezas', () => {
    const masterWorkspace = workspaceNavigation.find((item) => item.id === 'maestros');
    const wizard = masterWorkspace.tabs.find((tab) => tab.path === '/datos-maestros/configuracion-guiada');

    expect(wizard?.label).toBe('Configuración guiada');
    expect(workspaceTabIsActive('/datos-maestros/configuracion-guiada', wizard)).toBe(true);
    expect(getWorkspaceNavigation('/catalogo/configurar')?.id).toBe('maestros');
  });
});
