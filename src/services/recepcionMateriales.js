import { recepcionMaterialesMock } from '../mocks/recepcionMateriales';

export const RECEPCION_MATERIALES_SOURCE = 'MOCK_LOCAL';

export const obtenerRecepcionMateriales = async () => {
  // Prototipo deliberadamente aislado: no usa axios, fetch, localStorage ni backend.
  return structuredClone(recepcionMaterialesMock);
};
