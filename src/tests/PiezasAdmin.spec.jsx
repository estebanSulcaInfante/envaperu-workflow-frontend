import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import PiezasAdmin from '../components/PiezasAdmin';

vi.mock('../services/api', () => ({
  asociarFamiliaALinea: vi.fn(),
  actualizarPiezaGlobal: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  cambiarEstadoPiezaColor: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  crearPiezaGlobal: vi.fn(),
  eliminarImagenPiezaColor: vi.fn(),
  guardarImagenPiezaColor: vi.fn(),
  habilitarColorMolde: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerLineas: vi.fn(),
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Administrador de prueba', focus: 'Administración de prueba.' },
  }),
}));

import {
  actualizarPiezaGlobal,
  buscarPiezasGlobales,
  cambiarEstadoPiezaColor,
  crearFamiliaEnLinea,
  crearLinea,
  crearPiezaGlobal,
  habilitarColorMolde,
  obtenerColores,
  obtenerFamilias,
  obtenerLineas,
} from '../services/api';

const pieces = [{
  id: 10,
  codigo: 'PZ-000010',
  nombre: 'Tapa universal',
  peso_nominal_gr: 18.5,
  linea_id: 1,
  familia_id: 2,
  activo: true,
  version: 3,
  variantes_count: 4,
  moldes: [
    { composicion_id: 81, molde_id: 'MOL-A', molde_nombre: 'Molde A' },
    { composicion_id: 82, molde_id: 'MOL-B', molde_nombre: 'Molde B' },
  ],
  variantes: [{
    sku: 'PC-000010',
    nombre: 'Tapa universal Azul Sólido',
    color: 'Azul Sólido',
    color_hex: '#1756A9',
    peso: 18.5,
    estado_revision: 'VERIFICADO',
    imagen_url: '/api/piezas-color/PC-000010/imagen',
    activo: true,
    version: 4,
  }],
}];

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <PiezasAdmin />
  </ThemeProvider>,
);

describe('PiezasAdmin: maestro global Pieza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buscarPiezasGlobales.mockResolvedValue(pieces);
    obtenerLineas.mockResolvedValue([{ id: 1, nombre: 'Inyección' }]);
    obtenerFamilias.mockResolvedValue([{ id: 2, nombre: 'Tapas' }]);
    obtenerColores.mockResolvedValue([{ id: 7, nombre: 'Azul Sólido', activo: true }]);
    crearPiezaGlobal.mockResolvedValue({ id: 11 });
    crearLinea.mockResolvedValue({ id: 3, codigo: 30, nombre: 'SOPLADO' });
    crearFamiliaEnLinea.mockResolvedValue({
      familia: { id: 4, codigo: 40, nombre: 'BOTELLAS' },
    });
    actualizarPiezaGlobal.mockResolvedValue({ id: 10 });
    cambiarEstadoPiezaColor.mockResolvedValue({ sku: 'PC-000010', activo: false, version: 5 });
    habilitarColorMolde.mockResolvedValue({ variantes_creadas: [] });
  });

  it('muestra una pieza reutilizada por varios moldes sin atribuirle cavidades', async () => {
    renderPage();

    expect(await screen.findByText('Tapa universal')).toBeInTheDocument();
    expect(screen.getByText('MOL-A')).toBeInTheDocument();
    expect(screen.getByText('MOL-B')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /cavidades/i })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /peso nominal/i })).toBeInTheDocument();
  });

  it('despliega los SKU PiezaColor con color, imagen y estado', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: 'Mostrar SKU de PZ-000010' }));

    expect(screen.getByText('PC-000010')).toBeInTheDocument();
    expect(screen.getByText('Azul Sólido')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagen PC-000010' })).toHaveAttribute(
      'src',
      '/api/piezas-color/PC-000010/imagen',
    );
    expect(screen.getByText('VERIFICADO')).toBeInTheDocument();
  });

  it('habilita el color en el molde completo, no en una salida aislada', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: 'Habilitar color desde PZ-000010' }));
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: 'MOL-A · Molde A' }));
    await user.click(screen.getByRole('combobox', { name: 'Color de producción' }));
    await user.click(screen.getByRole('option', { name: 'Azul Sólido' }));
    await user.click(screen.getByRole('button', { name: 'Habilitar para todo el molde' }));

    await waitFor(() => expect(habilitarColorMolde).toHaveBeenCalledWith('MOL-A', 7));
  });

  it('crea el maestro sin enviar cavidades ni datos de color', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: /nueva pieza/i }));
    const identifier = screen.getByLabelText(/código estable/i);
    expect(identifier).toHaveValue('Se asignará automáticamente al guardar');
    expect(identifier).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText(/^nombre/i), 'Base compartida');
    await user.type(screen.getByLabelText(/peso nominal/i), '42.25');
    await user.click(screen.getByRole('button', { name: /crear pieza/i }));

    await waitFor(() => expect(crearPiezaGlobal).toHaveBeenCalledTimes(1));
    const payload = crearPiezaGlobal.mock.calls[0][0];
    expect(payload).toMatchObject({ nombre: 'Base compartida', peso_nominal_gr: 42.25, activo: true });
    expect(payload).not.toHaveProperty('cavidades');
    expect(payload).not.toHaveProperty('cavidad');
    expect(payload).not.toHaveProperty('color');
    expect(payload).not.toHaveProperty('codigo');
  });

  it('muestra el código existente como identificador inmutable y no intenta actualizarlo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: /editar PZ-000010/i }));
    const identifier = screen.getByLabelText(/código estable/i);
    expect(identifier).toHaveValue('PZ-000010');
    expect(identifier).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(actualizarPiezaGlobal).toHaveBeenCalledTimes(1));
    expect(actualizarPiezaGlobal.mock.calls[0][1]).not.toHaveProperty('codigo');
  });

  it('desactiva de forma lógica conservando el id global', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: /desactivar PZ-000010/i }));

    await waitFor(() => expect(actualizarPiezaGlobal).toHaveBeenCalledWith(10, {
      activo: false,
      version: 3,
    }));
  });

  it('desactiva una PiezaColor individual y confirma que conserva el historial', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Tapa universal');
    await user.click(screen.getByRole('button', { name: 'Mostrar SKU de PZ-000010' }));

    await user.click(screen.getByRole('button', {
      name: 'Desactivar PiezaColor PC-000010',
    }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('conservará todo su historial'));
    await waitFor(() => expect(cambiarEstadoPiezaColor).toHaveBeenCalledWith(
      'PC-000010',
      false,
      4,
    ));
  });

  it('filtra familias por línea y limpia una familia al cambiar a otra línea', async () => {
    const user = userEvent.setup();
    obtenerLineas.mockResolvedValue([
      { id: 1, nombre: 'Inyección' },
      { id: 3, nombre: 'Soplado' },
    ]);
    obtenerFamilias.mockImplementation((params = {}) => {
      if (params.linea_id === 1) return Promise.resolve([{ id: 2, nombre: 'Tapas' }]);
      if (params.linea_id === 3) return Promise.resolve([{ id: 4, nombre: 'Botellas' }]);
      return Promise.resolve([
        { id: 2, nombre: 'Tapas' },
        { id: 4, nombre: 'Botellas' },
      ]);
    });
    renderPage();
    await screen.findByText('Tapa universal');

    await user.click(screen.getByRole('button', { name: /nueva pieza/i }));
    await user.click(screen.getByRole('combobox', { name: 'Línea' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));

    await user.click(screen.getByRole('combobox', { name: 'Familia' }));
    await user.click(screen.getByRole('option', { name: 'Tapas' }));
    expect(screen.getByRole('combobox', { name: 'Familia' })).toHaveValue('Tapas');

    await user.click(screen.getByRole('combobox', { name: 'Línea' }));
    await user.click(screen.getByRole('option', { name: 'Soplado' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 3 }));
    expect(screen.getByRole('combobox', { name: 'Familia' })).not.toHaveValue('Tapas');
  });

  it('permite crear la Línea y luego su primera Familia desde la pieza', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tapa universal');
    await user.click(screen.getByRole('button', { name: /nueva pieza/i }));

    const lineInput = screen.getByRole('combobox', { name: 'Línea' });
    await user.type(lineInput, 'soplado');
    await user.click(await screen.findByRole('option', { name: /Crear Línea “soplado”/i }));
    expect(screen.getByLabelText('Código automático')).toHaveValue('LIN-######');
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearLinea).toHaveBeenCalledWith({ nombre: 'SOPLADO' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Nueva Línea/i }))
      .not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Línea' })).toHaveValue('SOPLADO');

    const familyInput = screen.getByRole('combobox', { name: 'Familia' });
    await user.type(familyInput, 'botellas');
    await user.click(await screen.findByRole('option', { name: /Crear Familia “botellas”/i }));
    expect(screen.getByLabelText('Código automático')).toHaveValue('FAM-######');
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearFamiliaEnLinea).toHaveBeenCalledWith(3, {
      nombre: 'BOTELLAS',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Nueva Familia/i }))
      .not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Familia' })).toHaveValue('BOTELLAS');
  });
});
