import { describe, expect, it } from 'vitest';
import {
  getWorkspaceNavigation,
  navigationItemIsActive,
  primaryNavigation,
  visibleByCapabilities,
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

  it('presenta solamente los espacios que corresponden a las capacidades del actor', () => {
    const capabilities = new Set(['OP_VER', 'OP_APROBAR']);
    const visible = visibleByCapabilities(
      primaryNavigation,
      (required) => !required.length || required.some((item) => capabilities.has(item)),
    );
    const production = workspaceNavigation.find((item) => item.id === 'produccion');
    const visibleProductionTabs = visibleByCapabilities(
      production.tabs,
      (required) => !required.length || required.some((item) => capabilities.has(item)),
    );

    expect(visible.map((item) => item.id)).toEqual(['inicio', 'planificacion', 'produccion']);
    expect(visibleProductionTabs.map((item) => item.label)).toEqual(['Órdenes de producción']);
  });

  it('limita al gestor de maestros a catálogos y oculta participantes y producción', () => {
    const capabilities = new Set([
      'ARTICULO_VER',
      'ARTICULO_ADMINISTRAR',
      'ESTRUCTURA_VER',
      'RUTA_VER',
      'EMPAQUE_VER',
      'CATALOGO_PROVEEDOR_ADMINISTRAR',
      'CATALOGO_MATERIAL_ADMINISTRAR',
      'CATALOGO_PLANTA_ADMINISTRAR',
    ]);
    const canAny = (required) => !required.length
      || required.some((item) => capabilities.has(item));
    const visiblePrimary = visibleByCapabilities(primaryNavigation, canAny);
    const masters = workspaceNavigation.find((item) => item.id === 'maestros');
    const visibleMasterTabs = visibleByCapabilities(masters.tabs, canAny);

    expect(visiblePrimary.map((item) => item.id)).toEqual(['inicio']);
    expect(visibleMasterTabs.map((item) => item.label)).toEqual([
      'Resumen',
      'Productos',
      'Piezas y SKU',
      'Moldes',
      'Configuración guiada',
      'Ingeniería SCM',
      'Líneas y familias',
      'Colores y recetas',
      'Materias primas',
      'Máquinas',
    ]);
    expect(visibleMasterTabs.map((item) => item.label)).not.toContain('Trabajadores');
  });
});
