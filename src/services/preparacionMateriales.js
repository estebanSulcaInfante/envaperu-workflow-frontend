import { preparacionMaterialesMock } from '../mocks/preparacionMateriales';

export const PREPARACION_MATERIALES_SOURCE = 'MOCK';

export const obtenerPreparacionMateriales = async () => {
  return structuredClone(preparacionMaterialesMock);
};
