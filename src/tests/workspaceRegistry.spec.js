import { describe, expect, it } from 'vitest';
import {
  buildAreaNavigation,
  featureIsAvailable,
  getFeatureByKey,
  getWorkspaceFeature,
  visibleWorkspaceFeatures,
  workspaceFeatures,
} from '../config/workspaceRegistry';

describe('US-010N1: registro único del workspace', () => {
  it('clasifica rutas físicas por función y no por prefijo', () => {
    expect(getWorkspaceFeature('/produccion/kardex')?.key).toBe('warehouse.kardex');
    expect(getWorkspaceFeature('/produccion/recepcion-mangas')?.areaKey).toBe('warehouse');
    expect(getWorkspaceFeature('/produccion/reproceso')?.areaKey).toBe('materials');
    expect(getWorkspaceFeature('/produccion/alertas')?.areaKey).toBe('control');
    expect(getWorkspaceFeature('/produccion/ots-mangas')?.areaKey).toBe('production');
  });

  it('mantiene claves y rutas primarias únicas', () => {
    expect(new Set(workspaceFeatures.map((item) => item.key)).size).toBe(workspaceFeatures.length);
    expect(new Set(workspaceFeatures.map((item) => item.path)).size).toBe(workspaceFeatures.length);
  });

  it('separa el catálogo de moldes de su detalle editable', () => {
    expect(getWorkspaceFeature('/datos-maestros/moldes')?.key).toBe('masters.molds');
    expect(getWorkspaceFeature('/datos-maestros/moldes/ML-000001')?.key)
      .toBe('masters.moldDetail');
    expect(getFeatureByKey('masters.moldDetail')?.requiredAny)
      .toEqual(['ARTICULO_ADMINISTRAR', 'RUTA_ADMINISTRAR']);

    const visible = visibleWorkspaceFeatures({
      canAny: () => true,
      areaKey: 'masters',
    });
    expect(visible.map((item) => item.key)).not.toContain('masters.moldDetail');
  });

  it('construye las áreas de trabajo aprobadas', () => {
    const capabilities = new Set([
      'OP_VER', 'OF_VER', 'OA_VER', 'OT_VER', 'OPERACION_PLANIFICAR',
      'ABASTECIMIENTO_VER', 'INVENTARIO_VER', 'ALERTA_VER', 'WIP_VER',
    ]);
    const areas = buildAreaNavigation({
      canAny: (required) => !required.length || required.some((code) => capabilities.has(code)),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    });

    expect(areas.filter((item) => !item.support).map((item) => item.key)).toEqual([
      'home', 'planning', 'production', 'materials', 'warehouse', 'control',
    ]);
  });

  it.each([
    ['OA_VER', 'production', '/produccion/ordenes-armado'],
    ['CALIDAD_MANGA_VER', 'warehouse', '/produccion/recepcion-mangas'],
    ['MOLIENDA_VER', 'materials', '/produccion/reproceso'],
  ])(
    'dirige %s a la primera función accesible de %s',
    (capability, areaKey, expectedPath) => {
      const areas = buildAreaNavigation({
        canAny: (required) => !required.length || required.includes(capability),
        runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
      });

      expect(areas.find((item) => item.key === areaKey)?.path).toBe(expectedPath);
    },
  );

  it('gobierna legacy, prototipo y fuera del piloto por madurez', () => {
    expect(featureIsAvailable(
      { maturity: 'LEGACY_MARCHA_BLANCA' },
      { showLegacy: false },
    )).toBe(false);
    expect(featureIsAvailable(
      { maturity: 'LEGACY_MARCHA_BLANCA' },
      { showLegacy: true },
    )).toBe(true);
    expect(featureIsAvailable(
      { maturity: 'PROTOTIPO' },
      { allowPrototype: false },
    )).toBe(false);
    expect(featureIsAvailable(
      { maturity: 'FUERA_PILOTO' },
      { allowOutOfPilot: false },
    )).toBe(false);
  });
});
