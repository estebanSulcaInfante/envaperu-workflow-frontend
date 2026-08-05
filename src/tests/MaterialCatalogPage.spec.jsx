import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MaterialCatalogPage from '../components/MaterialCatalogPage';

vi.mock('../services/scmCatalogApi', () => ({
  actualizarCategoriaRecepcionScm: vi.fn(),
  actualizarMaterialScm: vi.fn(),
  actualizarProveedorScm: vi.fn(),
  crearCategoriaRecepcionScm: vi.fn(),
  crearMaterialScm: vi.fn(),
  crearProveedorScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn(),
  listarMaterialesScm: vi.fn(),
  listarProveedoresScm: vi.fn(),
  obtenerActorScmLocal: vi.fn(() => 1),
}));

import {
  crearMaterialScm,
  listarCategoriasRecepcionScm,
  listarMaterialesScm,
  listarProveedoresScm,
} from '../services/scmCatalogApi';

const category = {
  id: 10,
  codigo: 'RESINA_VIRGEN',
  nombre: 'Resina virgen',
  modalidad_default: 'VIRGEN_CONFIANZA_PROVEEDOR',
  lote_externo_obligatorio: false,
  recepcion_habilitada: true,
  activo: true,
  version: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  listarMaterialesScm.mockResolvedValue([]);
  listarProveedoresScm.mockResolvedValue([]);
  listarCategoriasRecepcionScm.mockResolvedValue([category]);
  crearMaterialScm.mockResolvedValue({ id: 20, version: 1 });
});

const renderPage = (entry = '/datos-maestros/materiales?catalogo=materials') => render(
  <MemoryRouter initialEntries={[entry]}><MaterialCatalogPage /></MemoryRouter>,
);

describe('MaterialCatalogPage conectado a SCM API', () => {
  it('crea una materia prima persistente sin mensajes de mock', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Catálogos maestros de materiales')).toBeInTheDocument();
    expect(screen.queryByText(/mock|prototipo|en memoria/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nuevo material' }));
    const form = screen.getByText('Crear Material').closest('.MuiPaper-root');
    expect(within(form).getByLabelText('Código automático')).toHaveValue('MP-######');
    await user.type(within(form).getByLabelText(/Nombre/), 'PP virgen local');
    await user.click(within(form).getByRole('combobox', { name: 'Categoría de recepción' }));
    await user.click(screen.getByRole('option', { name: /RESINA_VIRGEN/ }));
    await user.click(within(form).getByRole('button', { name: 'Guardar material' }));

    await waitFor(() => expect(crearMaterialScm).toHaveBeenCalledWith({
      nombre: 'PP virgen local',
      clase: 'MATERIA_PRIMA',
      categoria_recepcion_id: 10,
      unidad_base: 'KG',
      activo: true,
    }));
  });

  it('advierte un nombre duplicado antes de llamar a la API', async () => {
    listarMaterialesScm.mockResolvedValue([{
      id: 33,
      codigo: 'MP-000033',
      nombre: 'PP Virgen',
      clase: 'MATERIA_PRIMA',
      categoria_recepcion_id: 10,
      categoria_recepcion_codigo: 'RESINA_VIRGEN',
      unidad_base: 'KG',
      activo: true,
    }]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('PP Virgen');
    await user.click(screen.getByRole('button', { name: 'Nuevo material' }));
    const form = screen.getByText('Crear Material').closest('.MuiPaper-root');
    await user.type(within(form).getByLabelText(/Nombre/), 'pp virgen');
    await user.click(within(form).getByRole('combobox', { name: 'Categoría de recepción' }));
    await user.click(screen.getByRole('option', { name: /RESINA_VIRGEN/ }));
    await user.click(within(form).getByRole('button', { name: 'Guardar material' }));

    expect(await screen.findByText(/Ya existe MP-000033/i)).toBeInTheDocument();
    expect(crearMaterialScm).not.toHaveBeenCalled();
  });

  it('no presenta datos simulados para un catálogo sin API', async () => {
    renderPage('/datos-maestros/materiales?catalogo=locations');
    expect(await screen.findByText(/todavía no tiene contrato CRUD en la API/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
