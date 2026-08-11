import { describe, expect, it } from 'vitest';
import {
  getWorkspaceNavigation,
  navigationItemIsActive,
  primaryNavigation,
  visibleByCapabilities,
  workspaceNavigation,
  workspaceTabIsActive,
} from '../config/navigation';

describe('US-010N1: navegación SCM por áreas', () => {
  it('expone las seis áreas de trabajo aprobadas', () => {
    expect(primaryNavigation.map((item) => item.id)).toEqual([
      'home',
      'planning',
      'production',
      'materials',
      'warehouse',
      'control',
    ]);
  });

  it('asigna el enlace legacy de preparación a Materiales', () => {
    expect(getWorkspaceNavigation('/ordenes/OP-0041/materiales')?.id).toBe('materials');
  });

  it('clasifica rutas por función sin depender del prefijo', () => {
    const control = primaryNavigation.find((item) => item.id === 'control');
    const warehouse = primaryNavigation.find((item) => item.id === 'warehouse');
    const masters = workspaceNavigation.find((item) => item.id === 'masters');
    const overview = masters.tabs.find((item) => item.key === 'masters.hub');

    expect(getWorkspaceNavigation('/produccion/avance')?.id).toBe(control.id);
    expect(getWorkspaceNavigation('/produccion/kardex')?.id).toBe(warehouse.id);
    expect(navigationItemIsActive('/planificacion', control)).toBe(false);
    expect(workspaceTabIsActive('/datos-maestros', overview)).toBe(true);
    expect(workspaceTabIsActive('/datos-maestros/productos', overview)).toBe(false);
  });

  it('mantiene líneas/familias y el alta integral en el hub canónico', () => {
    const masters = workspaceNavigation.find((item) => item.id === 'masters');
    const classification = masters.tabs.find(
      (tab) => tab.path === '/datos-maestros/clasificacion',
    );
    const onboarding = masters.tabs.find(
      (tab) => tab.path === '/datos-maestros/alta-producto',
    );
    const legacyWizard = masters.tabs.find(
      (tab) => tab.path === '/datos-maestros/configuracion-guiada',
    );

    expect(classification?.label).toBe('Líneas y familias');
    expect(onboarding?.label).toBe('Alta integral de producto');
    expect(legacyWizard).toBeUndefined();
    expect(workspaceTabIsActive('/datos-maestros/clasificacion', classification)).toBe(true);
    expect(getWorkspaceNavigation('/catalogo/configurar')?.id).toBe('masters');
  });

  it('no convierte OP de consulta en acceso a Producción', () => {
    const capabilities = new Set(['OP_VER', 'OP_APROBAR']);
    const canAny = (required) => !required.length
      || required.some((item) => capabilities.has(item));
    const visible = visibleByCapabilities(primaryNavigation, canAny);
    const production = workspaceNavigation.find((item) => item.id === 'production');
    const visibleProduction = visibleByCapabilities(production.tabs, canAny);

    expect(visible.map((item) => item.id)).toEqual(['home', 'planning']);
    expect(visibleProduction).toEqual([]);
  });

  it('limita al gestor de maestros a catálogos compatibles', () => {
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
    const masters = workspaceNavigation.find((item) => item.id === 'masters');
    const visibleMasterTabs = visibleByCapabilities(masters.tabs, canAny);

    expect(visiblePrimary.map((item) => item.id)).toEqual(['home']);
    expect(visibleMasterTabs.map((item) => item.label)).toEqual(expect.arrayContaining([
      'Resumen de maestros',
      'Alta integral de producto',
      'Productos',
      'Piezas y SKU',
      'Moldes',
      'Ingeniería SCM',
      'Líneas y familias',
      'Colores y recetas',
      'Materiales y proveedores',
      'Máquinas',
    ]));
    expect(visibleMasterTabs.map((item) => item.label))
      .not.toContain('Configuración técnica de molde y piezas');
    expect(visibleMasterTabs.map((item) => item.label)).not.toContain('Trabajadores');
  });
});
