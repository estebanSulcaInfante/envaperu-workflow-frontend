import { describe, expect, it } from 'vitest';
import {
  normalizeRoutePackagingStepData,
  serializeRoutePackagingStepData,
} from '../components/productOnboarding/engineeringStepModel';

const routePackagingDraft = () => ({
  target_product_ref: 'PT-000024',
  target_article_ref: 30,
  ruta: {
    payload: {
      operaciones: [{ articulo_salida_id: 30 }],
      precedencias: [],
    },
  },
  empaques: [{
    client_id: 'empaque-30',
    articulo_ref: 30,
    perfil_empacable: { payload: { nombre: 'Perfil florero italiano' } },
    regla_empaque: { payload: { cantidad_objetivo_un: 10 } },
  }],
});

const resolvedReferences = ({ includeProfileVersion = true } = {}) => ({
  ruta_revision_ref: 55,
  ruta_revision_version: 3,
  empaques: [{
    client_id: 'empaque-30',
    articulo_ref: 30,
    perfil_empacable_ref: 8,
    ...(includeProfileVersion ? { perfil_empacable_version: 4 } : {}),
    regla_empaque_revision_ref: 9,
    regla_empaque_revision_version: 2,
  }],
});

describe('versiones al reabrir Ruta y empaque', () => {
  it('rehidrata y serializa la versión resuelta del perfil empacable', () => {
    const normalized = normalizeRoutePackagingStepData(
      routePackagingDraft(),
      resolvedReferences(),
    );

    expect(normalized.empaques[0].perfil_empacable).toMatchObject({
      modo: 'EDITAR',
      ref: 8,
      expected_version: 4,
    });
    expect(serializeRoutePackagingStepData(normalized)
      .empaques[0].perfil_empacable.expected_version).toBe(4);
  });

  it('recupera la versión del catálogo para sesiones históricas sin snapshot', () => {
    const normalized = normalizeRoutePackagingStepData(
      routePackagingDraft(),
      resolvedReferences({ includeProfileVersion: false }),
      { profileVersionsById: new Map([[8, 7]]) },
    );

    expect(normalized.empaques[0].perfil_empacable.expected_version).toBe(7);
  });
});
