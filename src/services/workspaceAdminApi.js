import api from './api';
import { SCM_AUTH_MODE } from '../config/runtime';
import { obtenerActorScm } from './scmEngineeringApi';

export const workspaceAdminConfig = () => (
  SCM_AUTH_MODE === 'supabase'
    ? {}
    : { headers: { 'X-Actor-Id': String(obtenerActorScm()) } }
);

const list = (payload) => payload?.items || payload || [];

export const listarCapacidadesWorkspace = async () => {
  const response = await api.get('/catalogo/capacidades', workspaceAdminConfig());
  return list(response.data);
};

export const listarRolesWorkspace = async () => {
  const response = await api.get('/catalogo/roles-operativos', workspaceAdminConfig());
  return list(response.data);
};

export const listarTrabajadoresWorkspace = async () => {
  const response = await api.get('/catalogo/trabajadores', {
    ...workspaceAdminConfig(),
    params: { incluir_inactivos: true },
  });
  return list(response.data);
};

export const crearTrabajadorWorkspace = async (payload) => {
  const response = await api.post('/catalogo/trabajadores', payload, workspaceAdminConfig());
  return response.data;
};

export const actualizarTrabajadorWorkspace = async (workerId, payload) => {
  const response = await api.put(
    `/catalogo/trabajadores/${workerId}`,
    payload,
    workspaceAdminConfig(),
  );
  return response.data;
};

export const cambiarEstadoTrabajadorWorkspace = async (workerId, activo) => {
  const response = await api.patch(
    `/catalogo/trabajadores/${workerId}/estado`,
    { activo },
    workspaceAdminConfig(),
  );
  return response.data;
};

export const crearRolWorkspace = async (payload) => {
  const response = await api.post('/catalogo/roles-operativos', payload, workspaceAdminConfig());
  return response.data;
};

export const actualizarRolWorkspace = async (roleId, payload) => {
  const response = await api.put(
    `/catalogo/roles-operativos/${roleId}`,
    payload,
    workspaceAdminConfig(),
  );
  return response.data;
};

export const definirRolPrincipalWorkspace = async (workerId, roleId) => {
  const response = await api.patch(
    `/catalogo/trabajadores/${workerId}/rol-principal`,
    { rol_operativo_id: roleId },
    workspaceAdminConfig(),
  );
  return response.data;
};
