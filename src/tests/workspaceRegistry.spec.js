import { describe, expect, it } from 'vitest';
import {
  buildAreaNavigation,
  featureIsAvailable,
  featureIsDiscoverable,
  featureIsExecutable,
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
    expect(getWorkspaceFeature('/produccion/ots-planta')?.areaKey).toBe('production');
  });

  it('registra el árbol plano de Almacén y sus aliases históricos', () => {
    const warehouse = buildAreaNavigation({
      canAny: () => true,
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).find((item) => item.key === 'warehouse');

    expect(warehouse?.features.map((item) => item.label)).toEqual([
      'Kardex y existencias',
      'Disponibilidad por PT',
      'Recibir desde Producción',
      'Salidas y retornos de Armado',
      'Transferencias entre ubicaciones',
    ]);
    expect(warehouse?.features.map((item) => item.sectionHeading)).toEqual([
      'EXISTENCIAS', 'EXISTENCIAS', 'OPERACIONES FÍSICAS', 'OPERACIONES FÍSICAS', 'OPERACIONES FÍSICAS',
    ]);
    expect(getWorkspaceFeature('/almacen/operaciones')?.key).toBe('warehouse.operations');
    expect(getWorkspaceFeature('/almacen/reservas-staging')?.key).toBe('materials.internalSupply');
    expect(getWorkspaceFeature('/almacen/transferencias')?.key).toBe('warehouse.transfers');
    expect(getFeatureByKey('warehouse.operations')?.requiredAny).toEqual(['ABASTECIMIENTO_VER']);
  });

  it('no fabrica encabezados para secciones sin funciones autorizadas', () => {
    const warehouse = buildAreaNavigation({
      canAny: (required) => required.includes('INVENTARIO_VER'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).find((item) => item.key === 'warehouse');

    expect(warehouse?.features.map((item) => item.label)).toEqual([
      'Kardex y existencias', 'Disponibilidad por PT', 'Transferencias entre ubicaciones',
    ]);
    expect([...new Set(warehouse?.features.map((item) => item.sectionHeading))]).toEqual([
      'EXISTENCIAS', 'OPERACIONES FÍSICAS',
    ]);
  });

  it('no fabrica EXISTENCIAS cuando el perfil parcial solo puede operar retornos', () => {
    const warehouse = buildAreaNavigation({
      canAny: (required) => required.includes('ABASTECIMIENTO_VER'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).find((item) => item.key === 'warehouse');

    expect(warehouse?.features.map((item) => item.label)).toEqual(['Salidas y retornos de Armado']);
    expect(warehouse?.features.map((item) => item.sectionHeading)).toEqual(['OPERACIONES FÍSICAS']);
  });

  it('mantiene claves y rutas primarias únicas', () => {
    expect(new Set(workspaceFeatures.map((item) => item.key)).size).toBe(workspaceFeatures.length);
    expect(new Set(workspaceFeatures.map((item) => item.path)).size).toBe(workspaceFeatures.length);
  });

  it('reserva OTs de planta para quien puede consultar OT', () => {
    expect(getFeatureByKey('production.machineWork')?.requiredAny).toEqual(['OT_VER']);
  });

  it('ubica la supervisión de producción como primera función de Control', () => {
    const feature = getFeatureByKey('control.productionSupervision');
    expect(feature).toMatchObject({
      path: '/control/supervision-produccion',
      requiredAny: ['OT_VER'],
      areaKey: 'control',
    });
    expect(getWorkspaceFeature('/produccion/supervision')?.key)
      .toBe('control.productionSupervision');

    const control = buildAreaNavigation({
      canAny: (required) => !required.length || required.includes('OT_VER'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).find((item) => item.key === 'control');
    expect(control?.features[0].key).toBe('control.productionSupervision');
    expect(control?.path).toBe('/control/supervision-produccion');
  });

  it('registra Auditoría de hojas como placeholder fuera del piloto opt-in', () => {
    const feature = getFeatureByKey('control.sheetAudit');

    expect(feature).toMatchObject({
      areaKey: 'control',
      path: '/control/auditoria-hojas',
      requiredAny: ['OT_VER'],
      maturity: 'FUERA_PILOTO',
      task: false,
      placeholder: expect.objectContaining({
        summary: expect.stringContaining('OCR futuro'),
        reason: expect.stringContaining('madurez'),
        returnPath: '/control/supervision-produccion',
        returnLabel: 'Volver a Supervisión de producción',
      }),
    });
    expect(featureIsAvailable(feature, {
      showLegacy: false,
      allowPrototype: false,
      allowOutOfPilot: true,
    })).toBe(false);
    expect(featureIsDiscoverable(feature, {
      showLegacy: false,
      allowPrototype: false,
      allowOutOfPilot: false,
    })).toBe(true);
    expect(featureIsExecutable(feature, {
      showLegacy: false,
      allowPrototype: false,
      allowOutOfPilot: false,
    })).toBe(false);
    expect(getWorkspaceFeature('/control/auditoria-hojas')?.key).toBe('control.sheetAudit');
  });

  it('mantiene ocultas las funciones externas aunque el placeholder esté opt-in', () => {
    const control = buildAreaNavigation({
      canAny: (required) => required.includes('OT_VER'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).find((item) => item.key === 'control');

    expect(control?.features.map((item) => item.key)).toContain('control.sheetAudit');
    expect(buildAreaNavigation({
      canAny: (required) => required.includes('OC_CREAR'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    }).some((item) => item.features.some((feature) => feature.key === 'external.purchases')))
      .toBe(false);
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

  it('conserva el hub de Datos maestros como entrada a todos sus catalogos', () => {
    const areas = buildAreaNavigation({
      canAny: (required) => !required.length || required.includes('ARTICULO_VER'),
      runtimeFlags: { showLegacy: false, allowPrototype: false, allowOutOfPilot: false },
    });
    const masters = areas.find((item) => item.key === 'masters');

    expect(masters?.path).toBe('/datos-maestros');
    expect(masters?.features.map((item) => item.key)).toEqual(expect.arrayContaining([
      'masters.hub',
      'masters.products',
      'masters.pieces',
      'masters.molds',
    ]));
  });

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
