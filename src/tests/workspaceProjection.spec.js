import { describe, expect, it } from 'vitest';
import {
  buildActorWorkspace,
  WORKSPACE_WARNING,
} from '../services/workspaceProjection';
import { workspaceAreas, workspaceFeatures } from '../config/workspaceRegistry';

const runtimeFlags = {
  showLegacy: false,
  allowPrototype: false,
  allowOutOfPilot: false,
};

const project = (actor, registry = workspaceFeatures) => buildActorWorkspace({
  actor,
  registry,
  areas: workspaceAreas,
  runtimeFlags,
});

describe('TS-010N2: proyección única del workspace', () => {
  it('proyecta un rol nuevo sin constantes frontend y respeta su acceso principal', () => {
    const actor = {
      capacidades_efectivas: ['INVENTARIO_VER'],
      roles: [{ id: 77, codigo: 'AUDITOR_INVENTARIO', nombre: 'Auditor de inventario' }],
      rol_principal: {
        id: 77,
        codigo: 'AUDITOR_INVENTARIO',
        nombre: 'Auditor de inventario',
        workspace_focus: 'Revisar existencias y movimientos trazables.',
        workspace_start_feature: 'warehouse.kardex',
        workspace_preferencias: [
          { feature_key: 'warehouse.kardex', prioridad: 5, fijada: true },
        ],
      },
      rol_principal_pendiente: false,
    };

    const workspace = project(actor);

    expect(workspace.primaryRole.codigo).toBe('AUDITOR_INVENTARIO');
    expect(workspace.experience).toEqual({
      label: 'Auditor de inventario',
      focus: 'Revisar existencias y movimientos trazables.',
    });
    expect(workspace.startFeature.key).toBe('warehouse.kardex');
    expect(workspace.startFeature.pinned).toBe(true);
    expect(workspace.features.map((item) => item.key)).toContain('warehouse.kardex');
    expect(workspace.features.map((item) => item.key)).not.toContain('production.fabrication');
  });

  it('ignora preferencias sin capacidad y nunca las convierte en autorización', () => {
    const actor = {
      capacidades_efectivas: ['INVENTARIO_VER'],
      rol_principal: {
        id: 8,
        codigo: 'AUDITOR',
        nombre: 'Auditor',
        workspace_start_feature: 'production.fabrication',
        workspace_preferencias: [
          { feature_key: 'production.fabrication', prioridad: 1, fijada: true },
          { feature_key: 'feature.retirada', prioridad: 2, fijada: true },
        ],
      },
    };

    const workspace = project(actor);

    expect(workspace.features.map((item) => item.key)).not.toContain('production.fabrication');
    expect(workspace.startFeature.key).toBe('warehouse.kardex');
    expect(workspace.configurationWarnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        WORKSPACE_WARNING.PREFERENCE_INELIGIBLE,
        WORKSPACE_WARNING.PREFERENCE_UNKNOWN,
        WORKSPACE_WARNING.START_FEATURE_INELIGIBLE,
      ]),
    );
  });

  it('usa la unión efectiva de capacidades y el principal explícito en un actor multirrol', () => {
    const actor = {
      capacidades_efectivas: ['OF_VER', 'INVENTARIO_VER'],
      roles: [
        { id: 1, codigo: 'PRODUCCION', nombre: 'Producción' },
        { id: 2, codigo: 'AUDITOR', nombre: 'Auditoría' },
      ],
      rol_principal: {
        id: 2,
        codigo: 'AUDITOR',
        nombre: 'Auditoría',
        workspace_start_feature: 'warehouse.kardex',
        workspace_preferencias: [],
      },
    };

    const workspace = project(actor);

    expect(workspace.primaryRole.id).toBe(2);
    expect(workspace.features.map((item) => item.key)).toEqual(
      expect.arrayContaining(['production.fabrication', 'warehouse.kardex']),
    );
  });

  it('no inventa un principal por código, orden o jerarquía de rol', () => {
    const workspace = project({
      capacidades_efectivas: ['OF_VER'],
      roles: [
        { id: 1, codigo: 'GERENCIA', nombre: 'Gerencia' },
        { id: 2, codigo: 'JEFE_PRODUCCION', nombre: 'Jefe de Producción' },
      ],
      rol_principal: null,
      rol_principal_pendiente: true,
    });

    expect(workspace.primaryRole).toBeNull();
    expect(workspace.experience.label).toBe('Perfil operativo');
    expect(workspace.configurationWarnings.map((item) => item.code))
      .toContain(WORKSPACE_WARNING.PRIMARY_ROLE_MISSING);
  });

  it('mantiene más de seis funciones de Inicio y excluye las no declaradas como tarea', () => {
    const registry = Array.from({ length: 8 }, (_, index) => ({
      key: `test.feature.${index}`,
      areaKey: 'production',
      label: `Función ${index}`,
      description: `Acceso ${index}`,
      path: `/test/${index}`,
      matches: [`/test/${index}`],
      aliases: [],
      requiredAny: ['TEST_VER'],
      maturity: 'PILOTO',
      navigation: true,
      task: index !== 7,
      defaultPriority: index,
    }));
    registry.push({
      key: 'home.workspace',
      areaKey: 'home',
      label: 'Inicio',
      description: 'Inicio',
      path: '/',
      matches: ['/'],
      aliases: [],
      requiredAny: [],
      maturity: 'PILOTO',
      navigation: true,
      task: true,
      defaultPriority: 0,
    });

    const workspace = project({
      capacidades_efectivas: ['TEST_VER'],
      rol_principal: {
        id: 10,
        codigo: 'ROL_NUEVO',
        nombre: 'Rol nuevo',
        workspace_preferencias: [],
      },
    }, registry);

    expect(workspace.homeFeatures).toHaveLength(7);
    expect(workspace.homeFeatures.map((item) => item.key)).not.toContain('test.feature.7');
    expect(workspace.homeFeatures.map((item) => item.key)).not.toContain('home.workspace');
  });

  it('proyecta hojas reales de maestros sin convertir su hub en tarea', () => {
    const workspace = project({
      capacidades_efectivas: ['ARTICULO_VER', 'ARTICULO_ADMINISTRAR'],
      rol_principal: {
        id: 12,
        codigo: 'GESTOR_MAESTROS_NUEVO',
        nombre: 'Gestor de maestros',
        workspace_start_feature: 'masters.products',
        workspace_preferencias: [],
      },
    });

    expect(workspace.homeFeatures.map((item) => item.key)).toEqual(
      expect.arrayContaining(['masters.products', 'masters.pieces', 'masters.molds']),
    );
    expect(workspace.homeFeatures.map((item) => item.key)).not.toContain('masters.hub');
    expect(workspace.startFeature.key).toBe('masters.products');
    expect(workspace.areas.find((area) => area.key === 'masters')?.path)
      .toBe('/datos-maestros');
  });

  it('ordena fijadas, prioridad del rol, prioridad predeterminada y título', () => {
    const registry = [
      ['default.z', 'Zeta', 50],
      ['preferred', 'Preferida', 90],
      ['pinned', 'Fijada', 100],
      ['default.a', 'Alfa', 50],
    ].map(([key, label, defaultPriority]) => ({
      key,
      areaKey: 'production',
      label,
      description: label,
      path: `/test/${key}`,
      matches: [`/test/${key}`],
      aliases: [],
      requiredAny: ['TEST_VER'],
      maturity: 'PILOTO',
      navigation: true,
      task: true,
      defaultPriority,
    }));

    const workspace = project({
      capacidades_efectivas: ['TEST_VER'],
      rol_principal: {
        id: 20,
        codigo: 'ORDENADO',
        nombre: 'Ordenado',
        workspace_preferencias: [
          { feature_key: 'preferred', prioridad: 1, fijada: false },
          { feature_key: 'pinned', prioridad: 999, fijada: true },
        ],
      },
    }, registry);

    expect(workspace.homeFeatures.map((item) => item.key)).toEqual([
      'pinned',
      'preferred',
      'default.a',
      'default.z',
    ]);
  });

  it('rechaza Inicio como acceso de sí mismo y usa la Guía sin trabajo elegible', () => {
    const workspace = project({
      capacidades_efectivas: [],
      rol_principal: {
        id: 21,
        codigo: 'SIN_TAREAS',
        nombre: 'Sin tareas',
        workspace_start_feature: 'home.workspace',
        workspace_preferencias: [],
      },
    });

    expect(workspace.homeFeatures).toEqual([]);
    expect(workspace.startFeature.key).toBe('guide.scm');
    expect(workspace.configurationWarnings.map((item) => item.code))
      .toContain(WORKSPACE_WARNING.START_FEATURE_INELIGIBLE);
  });
});
