import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdenForm from '../components/OrdenForm';
import { ThemeProvider, createTheme } from '@mui/material';

// Mocks the API services
vi.mock('../services/api', () => ({
  crearOrden: vi.fn(),
  buscarProductos: vi.fn(),
  obtenerPiezasProducibles: vi.fn(),
  obtenerMoldes: vi.fn(),
  obtenerRecetaColor: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  crearColor: vi.fn(),
  obtenerMaquinas: vi.fn(),
  validarOrdenPrereq: vi.fn(),
  obtenerProducto: vi.fn(),
}));

vi.mock('../services/scmCatalogApi', () => ({
  listarMaterialesScm: vi.fn(),
}));

import {
  crearOrden,
  obtenerColores, 
  obtenerFamiliasColor,
  crearColor,
  obtenerMaquinas,
  obtenerMoldes,
  obtenerRecetaColor,
  validarOrdenPrereq,
} from '../services/api';
import { listarMaterialesScm } from '../services/scmCatalogApi';

const mockPiezas = [
  { sku: 'MZ-BLD', nombre: 'Pieza Balde', cavidades: 1, peso_unitario_gr: 145, tipo: 'SIMPLE',
    molde: { codigo: 'MLB01', nombre: 'Molde Balde Playero', peso_tiro_gr: 150, formas: [{ nombre: 'Pieza Balde', cavidades: 1, peso_unitario_gr: 145 }] }
  },
  { sku: 'MZ-JBASE', nombre: 'Base Jarra', cavidades: 1, peso_unitario_gr: 100, tipo: 'COMPUESTO',
    molde: { 
      codigo: 'MLJ01', 
      nombre: 'Molde Jarra Regadera', 
      peso_tiro_gr: 150,
      formas: [
        { nombre: 'Base Jarra', cavidades: 1, peso_unitario_gr: 100 },
        { nombre: 'Tapa Jarra', cavidades: 1, peso_unitario_gr: 20 },
        { nombre: 'Roseta', cavidades: 2, peso_unitario_gr: 5 }
      ]
    } 
  }
];

const mockMaquinas = [{ id: '1', nombre: 'INJ-01', tipo: 'Inyectoras' }];
const mockColores = [{ id: '1', nombre: 'ROJO', hex_referencia: '#E53935' }];
const mockMoldes = mockPiezas.map((item, moldIndex) => ({
  ...item.molde,
  activo: true,
  tiempo_ciclo_std: moldIndex === 0 ? 30 : 40,
  formas: item.molde.formas.map((forma, pieceIndex) => ({
    ...forma,
    id: moldIndex * 10 + pieceIndex + 1,
    pieza_id: moldIndex * 10 + pieceIndex + 1,
    activo: true,
  })),
}));

const TestWrapper = ({ children }) => (
  <ThemeProvider theme={createTheme({})}>{children}</ThemeProvider>
);

describe('Specs: OrdenForm (Spec-Driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    obtenerMoldes.mockResolvedValue(mockMoldes);
    obtenerMaquinas.mockResolvedValue(mockMaquinas.map((machine) => ({
      ...machine,
      activo: true,
      estado: 'OPERATIVA',
    })));
    obtenerColores.mockResolvedValue(mockColores);
    validarOrdenPrereq.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      issues: [],
      molde: { nombre: 'Molde', piezas_count: 1 },
      variantes_por_crear: [],
    });
    crearOrden.mockResolvedValue({ numero_op: 'OP-EX-001' });
    obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO' }]);
    crearColor.mockResolvedValue({ id: '2', nombre: 'VERDE SOLIDO', existed: false });
    listarMaterialesScm.mockResolvedValue([
      { id: 101, codigo: 'MP-VIRGEN', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: true, categoria_recepcion: { modalidad_default: 'VIRGEN_CONFIANZA_PROVEEDOR' } },
      { id: 102, codigo: 'MP-SEGUNDA', nombre: 'PP SEGUNDA', clase: 'MATERIA_PRIMA', activo: true, categoria_recepcion: { modalidad_default: 'SEGUNDA_PESAJE_BOLSA' } },
      { id: 103, codigo: 'COL-AMARILLO', nombre: 'AMARILLO', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
    ]);
    obtenerRecetaColor.mockResolvedValue({ tiene_receta: false, pigmentos: [] });
  });

  it('Escenario 1: Molde Simple - 1 Pieza', async () => {
    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const user = userEvent.setup();
    
    // Select the mold; its forms are rendered from the normalized catalog.
    const moldeInput = await screen.findByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Balde');
    
    // Select option
    const option = await screen.findByRole('option', { name: /Molde Balde Playero/i });
    await user.click(option);

    // Wait for the composition to appear
    expect(await screen.findByText('Snapshot automático')).toBeInTheDocument();
  });

  it('Escenario 2: Molde Compuesto - Jarra Regadera despliega 3 piezas', async () => {
    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const user = userEvent.setup();

    // Select the mold and verify its three normalized forms.
    const moldeInput = await screen.findByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Jarra');
    
    const option = await screen.findByRole('option', { name: /Molde Jarra Regadera/i });
    await user.click(option);

    // Assert: Debe mostrar las piezas cargadas desde el mockup, no ocultarlas
    const inputs = await screen.findAllByRole('textbox');
    const values = inputs.map(i => i.value);
    expect(values).toContain('Base Jarra');
    expect(values).toContain('Tapa Jarra');
    expect(values).toContain('Roseta');
  });

  it('crea un color normalizado desde la última opción, refresca y lo selecciona', async () => {
    obtenerColores
      .mockResolvedValueOnce(mockColores)
      .mockResolvedValue([
        ...mockColores,
        { id: '2', nombre: 'VERDE SOLIDO' },
      ]);

    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Agregar Lote/i }));
    await user.click(await screen.findByText('Lote #1'));

    const colorInput = await screen.findByLabelText(/Color de producción/);
    await user.click(colorInput);
    await user.click(await screen.findByRole('option', { name: /Crear nuevo color/i }));

    await user.type(screen.getByLabelText(/Color base/), 'verde');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Acabado/ })).toHaveTextContent('SOLIDO'));
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));

    await waitFor(() => {
      expect(crearColor).toHaveBeenCalledWith({ nombre: 'VERDE', familia_color_id: 3 });
      expect(colorInput).toHaveValue('VERDE SOLIDO');
    });
    expect(obtenerColores).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Color "VERDE SOLIDO" creado y seleccionado')).toBeInTheDocument();
  });

  it('calcula el golpe multipieza con toda la composición MoldePieza', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><OrdenForm /></TestWrapper>);

    const moldeInput = await screen.findByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Jarra');
    await user.click(await screen.findByRole('option', { name: /Molde Jarra Regadera/i }));

    expect(screen.getByLabelText(/Peso neto\/golpe/i)).toHaveValue(130);
    expect(screen.getByLabelText(/Cavidades totales/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Peso Colada/i)).toHaveValue(20);
    expect(obtenerMoldes).toHaveBeenCalledTimes(1);
  });

  it('acepta horas de turno enteras sin desfase en la validación HTML', async () => {
    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const hoursInput = screen.getByLabelText(/Horas Turno/i);

    fireEvent.change(hoursInput, { target: { value: '23' } });

    expect(hoursInput).toHaveValue(23);
    expect(hoursInput).toBeValid();
  });

  it('permite una OP excepcional sin ProductoTerminado y envía snapshot automático', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><OrdenForm /></TestWrapper>);

    await user.type(screen.getByLabelText(/Número OP/i), 'OP-EX-001');
    await user.click(screen.getByLabelText(/^Máquina$/i));
    await user.click(await screen.findByRole('option', { name: /INJ-01/i }));
    const moldeInput = screen.getByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Balde');
    await user.click(await screen.findByRole('option', { name: /Molde Balde Playero/i }));

    await user.click(screen.getByRole('button', { name: /Agregar Lote/i }));
    await user.click(screen.getByText('Lote #1'));
    const colorInput = screen.getByLabelText(/Color de producción/i);
    await user.click(colorInput);
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    expect(screen.getByLabelText('Muestra de color #E53935')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Meta \(Kg\)/i), '25');

    const createButton = screen.getByRole('button', { name: /Crear Orden/i });
    await waitFor(() => expect(createButton).toBeEnabled(), { timeout: 2000 });
    fireEvent.submit(createButton.closest('form'));

    await waitFor(() => expect(crearOrden).toHaveBeenCalledTimes(1));
    expect(crearOrden.mock.calls[0][0]).toMatchObject({
      numero_op: 'OP-EX-001',
      producto_sku: null,
      molde_id: 'MLB01',
      auto_snapshot_molde: true,
      snapshot_composicion: [],
      lotes: [{ color_id: '1', meta_kg: 25, personas: 1 }],
    });
  }, 10000);

  it('bloquea el guardado cuando el preflight reporta una incompatibilidad', async () => {
    validarOrdenPrereq.mockResolvedValue({
      valid: false,
      errors: ['Producto y molde incompatibles'],
      warnings: [],
      issues: [{ codigo: 'PRODUCTO_MOLDE_INCOMPATIBLE', mensaje: 'Producto y molde incompatibles', status: 409 }],
      molde: null,
    });
    const user = userEvent.setup();
    render(<TestWrapper><OrdenForm /></TestWrapper>);

    const moldeInput = await screen.findByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Balde');
    await user.click(await screen.findByRole('option', { name: /Molde Balde Playero/i }));

    expect(await screen.findByText(/PRODUCTO_MOLDE_INCOMPATIBLE/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Orden/i })).toBeDisabled();
  });

  it('aplica una receta maestra usando solo la fracción virgen como base', async () => {
    obtenerRecetaColor.mockResolvedValue({
      tiene_receta: true,
      fuente: 'RECETA_MAESTRA',
      receta: { id: 40, revision: 2, nombre_variante: 'Fórmula amarilla' },
      materias_primas: [
        { material_id: 101, nombre: 'PP VIRGEN', fraccion: 0.7, modalidad_recepcion: 'VIRGEN_CONFIANZA_PROVEEDOR' },
        { material_id: 102, nombre: 'PP SEGUNDA', fraccion: 0.3, modalidad_recepcion: 'SEGUNDA_PESAJE_BOLSA' },
      ],
      pigmentos: [
        { material_id: 103, nombre: 'AMARILLO', tipo_componente: 'COLORANTE', dosis_gramos: 500, base_kg: 25 },
      ],
    });
    const user = userEvent.setup();
    render(<TestWrapper><OrdenForm /></TestWrapper>);

    await user.type(screen.getByLabelText(/Número OP/i), 'OP-REC-001');
    await user.click(screen.getByLabelText(/^Máquina$/i));
    await user.click(await screen.findByRole('option', { name: /INJ-01/i }));
    const moldeInput = screen.getByLabelText(/^Molde$/i);
    await user.type(moldeInput, 'Balde');
    await user.click(await screen.findByRole('option', { name: /Molde Balde Playero/i }));

    await user.click(screen.getByRole('button', { name: /Agregar Lote/i }));
    await user.click(screen.getByText('Lote #1'));
    await user.click(screen.getByLabelText(/Color de producción/i));
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    await user.type(screen.getByLabelText(/Meta \(Kg\)/i), '100');
    await user.click(screen.getByRole('button', { name: 'Aplicar receta maestra' }));

    await waitFor(() => expect(obtenerRecetaColor).toHaveBeenCalledWith('1', null, 100));
    expect(await screen.findByText(/Fórmula amarilla · revisión 2 aplicada/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Materia prima del catálogo')).toHaveLength(2);
    expect(screen.getByLabelText('Colorante o aditivo del catálogo')).toBeInTheDocument();
    expect(screen.getByLabelText('Gramos')).toHaveValue(1400);

    const createButton = screen.getByRole('button', { name: /Crear Orden/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.submit(createButton.closest('form'));
    await waitFor(() => expect(crearOrden).toHaveBeenCalledTimes(1));
    expect(crearOrden.mock.calls[0][0].lotes[0].receta_aplicada).toEqual({
      id: 40,
      revision: 2,
    });
  }, 10000);
});
