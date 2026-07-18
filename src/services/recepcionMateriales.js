import { recepcionMaterialesMock } from '../mocks/recepcionMateriales';

export const RECEPCION_MATERIALES_SOURCE = 'MOCK';

export const obtenerRecepcionMateriales = async () => {
  return structuredClone(recepcionMaterialesMock);
};
