import api from './api';

const configuredActorId = () => {
  const stored = globalThis.localStorage?.getItem('envaperu_scm_actor_id');
  return Number(import.meta.env.VITE_SCM_ACTOR_ID || stored || 1);
};

const scmConfig = () => ({
  headers: { 'X-Actor-Id': String(configuredActorId()) },
});

const list = async (path) => {
  const response = await api.get(path, scmConfig());
  return response.data?.items || [];
};

const create = async (path, data) => {
  const response = await api.post(path, data, scmConfig());
  return response.data;
};

const update = async (path, id, data) => {
  const response = await api.patch(`${path}/${id}`, data, scmConfig());
  return response.data;
};

export const listarMaterialesScm = () => list('/scm/v1/materiales');
export const crearMaterialScm = (data) => create('/scm/v1/materiales', data);
export const actualizarMaterialScm = (id, data) => update('/scm/v1/materiales', id, data);

export const listarProveedoresScm = () => list('/scm/v1/proveedores');
export const crearProveedorScm = (data) => create('/scm/v1/proveedores', data);
export const actualizarProveedorScm = (id, data) => update('/scm/v1/proveedores', id, data);

export const listarPresentacionesComercialesScm = async ({
  productoId,
  activo,
} = {}) => {
  const params = new URLSearchParams();
  if (productoId) params.set('producto_terminado_id', productoId);
  if (activo !== undefined) params.set('activo', String(activo));
  const suffix = params.size ? `?${params.toString()}` : '';
  return list(`/scm/v1/presentaciones-comerciales${suffix}`);
};
export const crearPresentacionComercialScm = (data) => (
  create('/scm/v1/presentaciones-comerciales', data)
);
export const actualizarPresentacionComercialScm = (id, data) => (
  update('/scm/v1/presentaciones-comerciales', id, data)
);

export const listarCategoriasRecepcionScm = () => list('/scm/v1/config/categorias-recepcion');
export const crearCategoriaRecepcionScm = (data) => create('/scm/v1/config/categorias-recepcion', data);
export const actualizarCategoriaRecepcionScm = (id, data) => update('/scm/v1/config/categorias-recepcion', id, data);

export const obtenerActorScmLocal = configuredActorId;
