import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

const auth = vi.hoisted(() => ({ article: true }));

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn().mockResolvedValue([]),
  obtenerFamiliasColor: vi.fn().mockResolvedValue([]),
  obtenerIngredientesRecetaColor: vi.fn().mockResolvedValue([]),
  obtenerMaquinas: vi.fn().mockResolvedValue([]),
  obtenerMolde: vi.fn(),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
  obtenerRecetasColorMaestras: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('../services/scmCatalogApi', () => ({
  crearMaterialScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  anularOrdenFabricacionScm: vi.fn(),
  reemplazarOrdenFabricacionScm: vi.fn(),
  obtenerOrdenFabricacionScm: vi.fn(),
  cerrarOrdenFabricacionScm: vi.fn(),
  configurarOrdenFabricacionScm: vi.fn(),
  crearOrdenFabricacionExcepcionalScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 1,
  listarArticulosScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability !== 'ARTICULO_ADMINISTRAR' || auth.article,
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

import {
  obtenerColores, obtenerMaquinas, obtenerMolde, obtenerMoldes,
  obtenerRecetasColorMaestras,
} from '../services/api';
import { listarArticulosScm } from '../services/scmEngineeringApi';
import {
  cerrarOrdenFabricacionScm,
  anularOrdenFabricacionScm,
  configurarOrdenFabricacionScm, crearOrdenFabricacionExcepcionalScm,
  listarOrdenesFabricacionScm,
} from '../services/scmOtApi';

describe('Órdenes de fabricación', () => {
  it('abre la formulación en un panel sin abandonar la OF', async () => {
    const user = userEvent.setup();
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-contexto', codigo: 'OF-CONTEXTO', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-1', codigo: 'OF-CONTEXTO-C01', color_produccion_id: 7, salidas: [] }],
    }] });
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Crear o editar aquí' }));
    expect(await screen.findByText('OF-CONTEXTO · OF-CONTEXTO-C01 · formulación')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a la OF' })).toBeVisible();
  });
  it('advierte antes de descartar una formulación sin guardar', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-dirty', codigo: 'OF-DIRTY', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-dirty', codigo: 'OF-DIRTY-C01', color_produccion_id: 7, salidas: [] }],
    }] });
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Crear o editar aquí' }));
    await user.type(screen.getByLabelText('Nombre de variante'), 'Rojo piloto');
    await user.click(screen.getByRole('button', { name: 'Volver a la OF' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Nombre de variante')).toHaveValue('Rojo piloto');
    await user.click(screen.getByRole('button', { name: 'Volver a la OF' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Nombre de variante')).not.toBeInTheDocument();
    confirm.mockRestore();
  });
  it('distingue fabricación concurrente estimada de pesajes directos de la OF', async () => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{ id: 'of-source', codigo: 'OF-FUENTE', estado: 'CERRADA', version: 3, corridas: [], cierre_kg: { kg_medido: '0.000', kg_fabricacion_estimado: '10.000' } }] });
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    expect(await screen.findByText(/Cierre documental: 0.000 kg pesados directamente/)).toHaveTextContent('Aporte de fabricación estimado: 10.000 kg');
    expect(screen.getByText(/medición y estimación no se suman como stock/)).toBeVisible();
  });
  it('presenta cierre KG con el contrato real sin código ni estado en la respuesta', async () => {
    const kgOrder = { id: 'of-kg', codigo: 'OF-KG-01', estado: 'EN_EJECUCION', version: 2, corridas: [] };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [kgOrder] });
    cerrarOrdenFabricacionScm.mockResolvedValue({ kg_medido: '12.000', un_confirmadas: false, cierre: { kg_medido: '12.000' } });
    const user = userEvent.setup();
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Cerrar OF' }));
    expect(await screen.findByText('OF-KG-01 cerrada: 12.000 kg medidos, sin movimiento de stock por el cierre.')).toBeVisible();
    expect(cerrarOrdenFabricacionScm).toHaveBeenCalledWith('of-kg', { version: 2 });
  });
  it('anula el borrador con motivo y permite volver a ocultar las anuladas', async () => {
    const user = userEvent.setup();
    const draft = { id: 'of-annul', codigo: 'OF-000099', estado: 'BORRADOR', version: 1, corridas: [] };
    const annulled = { ...draft, estado: 'ANULADA', version: 2, anulacion: { motivo: 'Duplicada' } };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [draft] });
    anularOrdenFabricacionScm.mockImplementation(async () => {
      listarOrdenesFabricacionScm.mockResolvedValue({ items: [annulled] });
      return annulled;
    });
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Anular borrador' }));
    await user.type(screen.getByLabelText('Motivo de anulación'), 'Duplicada');
    await user.click(screen.getByText('Confirmar anulación'));
    expect(await screen.findByText(/Anulada · Duplicada/)).toBeVisible();
    expect(anularOrdenFabricacionScm).toHaveBeenCalledWith(draft, 'Duplicada');
    expect(screen.getByLabelText('Mostrar anuladas')).toBeChecked();
    await user.click(screen.getByLabelText('Mostrar anuladas'));
    expect(await screen.findByText(/Aún no hay/)).toBeVisible();
  });
  beforeEach(() => {
    auth.article = true;
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [] });
    obtenerColores.mockResolvedValue([]);
    obtenerMaquinas.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
    obtenerMolde.mockReset();
    listarArticulosScm.mockResolvedValue([]);
    crearOrdenFabricacionExcepcionalScm.mockReset();
    configurarOrdenFabricacionScm.mockReset();
    cerrarOrdenFabricacionScm.mockReset();
  });

  it('explica el permiso faltante sin ofrecer alta contextual falsa', async () => {
    auth.article = false;
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-limited', codigo: 'OF-LIMITED', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-limited', codigo: 'OF-LIMITED-C01', color_produccion_id: 7, salidas: [] }],
    }] });
    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);
    expect(await screen.findByText(/solicita administración de artículos/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear o editar aquí' })).not.toBeInTheDocument();
  });

  it('muestra la formulacion del color y permite elegir otra variante aprobada en borrador', async () => {
    const user = userEvent.setup();
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-recipe', codigo: 'OF-000021', estado: 'BORRADOR', version: 3,
      molde_id: 'ML-RECETA', maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8',
      snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-recipe', codigo: 'OF-000021-C01', color_produccion_id: 5,
        objetivo_neto_kg: '1.000',
        receta_revision_id: 31,
        salidas: [{
          id: 'out-recipe', cantidad_objetivo: '100.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '4.0000', peso_unitario_snapshot_g: '12.0000',
          articulo: { codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR', pieza_id: 31 },
        }],
      }],
    }] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-RECETA', nombre: 'Molde Asa', activo: true,
      formas: [{ pieza_id: 31, activo: true, cavidades: 4, peso_unitario_gr: 12 }],
    }]);
    obtenerMaquinas.mockResolvedValue([{
      id: 8, codigo: 'INY-01', nombre: 'Inyectora', activo: true, estado: 'OPERATIVA',
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [
      {
        id: 31, color_produccion_id: 5, nombre_variante: 'Rojo estándar', revision: 1,
        estado: 'APROBADA', es_default: true, producto_sku: null, base_virgen_kg: 25,
        lineas: [
          { id: 1, material_nombre: 'PP Virgen', tipo_componente: 'MATERIA_PRIMA', cantidad: 0.8, unidad: 'FRACCION' },
          { id: 2, material_nombre: 'PP Molido', tipo_componente: 'MATERIA_PRIMA', cantidad: 0.2, unidad: 'FRACCION' },
          { id: 3, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE', cantidad: 120, unidad: 'GRAMOS', base_kg: 25 },
        ],
      },
      {
        id: 32, color_produccion_id: 5, nombre_variante: 'Rojo intenso', revision: 2,
        estado: 'APROBADA', es_default: false, producto_sku: null, base_virgen_kg: 25,
        lineas: [
          { id: 4, material_nombre: 'PP Virgen', tipo_componente: 'MATERIA_PRIMA', cantidad: 1, unidad: 'FRACCION' },
          { id: 5, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE', cantidad: 150, unidad: 'GRAMOS', base_kg: 25 },
        ],
      },
      {
        id: 33, color_produccion_id: 5, nombre_variante: 'Borrador inseguro', revision: 1,
        estado: 'BORRADOR', es_default: false, producto_sku: null, base_virgen_kg: 25, lineas: [],
      },
      {
        id: 34, color_produccion_id: 5, nombre_variante: 'Solo otro producto', revision: 1,
        estado: 'APROBADA', es_default: false, producto_sku: 'PT-AJENO', base_virgen_kg: 25, lineas: [],
      },
    ] });
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: 'OF-000021' });

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    const recipeSelect = await screen.findByRole('combobox', { name: /Formulación de material/ });
    expect(recipeSelect).toHaveTextContent(/Rojo estándar.*Rev. 1.*Predeterminada/);
    expect(screen.getByText('PP Virgen')).toBeVisible();
    expect(screen.getByText('80% de la mezcla')).toBeVisible();
    expect(screen.getByText('120 g / 25 kg virgen')).toBeVisible();

    await user.click(recipeSelect);
    expect(screen.getByRole('option', { name: /Rojo intenso.*Rev. 2/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Borrador inseguro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Solo otro producto/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Rojo intenso.*Rev. 2/ }));
    expect(screen.getByText('100% de la mezcla')).toBeVisible();
    expect(screen.getByText('150 g / 25 kg virgen')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(
      'of-recipe',
      expect.objectContaining({
        corridas: [expect.objectContaining({ receta_revision_id: 32 })],
      }),
    );
  });

  it('mantiene visible y bloqueada la formulacion congelada de una OF liberada', async () => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-frozen', codigo: 'OF-000022', estado: 'LIBERADA', version: 4,
      corridas: [{
        id: 'run-frozen', codigo: 'OF-000022-C01', color_produccion_id: 5,
        receta_revision_id: 41, receta_hash: 'a'.repeat(64),
        receta: {
          id: 41, nombre: 'Rojo congelado', nombre_variante: 'Rojo congelado',
          revision: 3, estado: 'APROBADA', base_virgen_kg: 25,
          lineas: [{
            id: 6, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE',
            cantidad: 140, unidad: 'GRAMOS', base_kg: 25,
          }],
        },
        salidas: [],
      }],
    }] });
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    const recipeSelect = await screen.findByRole('combobox', { name: /Formulación de material/ });
    expect(recipeSelect).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Congelada al liberar')).toBeVisible();
    expect(screen.getByText('140 g / 25 kg virgen')).toBeVisible();
  });

  it('crea una OF normalizada de reposicion para una PiezaColor del molde', async () => {
    const user = userEvent.setup();
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
    }]);
    obtenerMolde.mockResolvedValue({
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
      tiempo_ciclo_std: 20, peso_colada_gr: 2,
      formas: [{
        pieza_id: 31, pieza_codigo: 'PZ-ASA', nombre: 'Asa de balde',
        activo: true, cavidades: 4, peso_unitario_gr: 12,
        variantes: [{ sku: 'PC-ASA-ROJO', color_produccion_id: 5 }],
      }],
    });
    obtenerMaquinas.mockResolvedValue([{
      id: 8, codigo: 'INY-01', nombre: 'Inyectora 1', activo: true, estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'INYECCION' },
    }, {
      id: 9, codigo: 'SOP-01', nombre: 'Sopladora 1', activo: true, estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'SOPLADO' },
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [{
      id: 51, color_produccion_id: 5, nombre_variante: 'Rojo reposición', revision: 1,
      estado: 'APROBADA', es_default: true, producto_sku: null, base_virgen_kg: 25,
      lineas: [{
        id: 501, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE',
        cantidad: 110, unidad: 'GRAMOS', base_kg: 25,
      }],
    }] });
    listarArticulosScm.mockResolvedValue([{
      id: 91, codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR',
      subtipo: { pieza_color_sku: 'PC-ASA-ROJO' },
    }]);
    crearOrdenFabricacionExcepcionalScm.mockResolvedValue({
      id: 'of-ex-1', codigo: 'OF-000010', estado: 'BORRADOR', corridas: [],
    });
    listarOrdenesFabricacionScm
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [{
        id: 'of-ex-1', codigo: 'OF-000010', estado: 'BORRADOR', version: 1, corridas: [],
      }] });

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Nueva OF de reposición' }));
    await user.type(screen.getByLabelText(/Motivo de reposición/), 'Stock de asas para prearmado');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(await screen.findByRole('option', { name: /Molde Asa.*ML-ASA/ }));
    await screen.findByDisplayValue('20');
    await user.click(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' }));
    expect(screen.queryByRole('option', { name: /SOP-01/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /INY-01/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    await user.type(screen.getByLabelText(/Objetivo 1 \(kg netos\)/), '12');

    expect(screen.getByRole('combobox', { name: /Formulación de material/ }))
      .toHaveTextContent(/Rojo reposición.*Predeterminada/);
    expect(screen.getByText('110 g / 25 kg virgen')).toBeVisible();
    expect(screen.getByText(/PC-ASA-ROJO - 4 un\/ciclo - 12 g/)).toBeVisible();
    expect(screen.getAllByText(/250 ciclos calculados/)[0]).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));

    expect(crearOrdenFabricacionExcepcionalScm).toHaveBeenCalledWith({
      motivo: 'Stock de asas para prearmado',
      molde_id: 'ML-ASA',
      maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: 20,
      snapshot_horas_turno: 8,
      snapshot_peso_colada_gr: 2,
      corridas: [{
        color_produccion_id: 5,
        receta_revision_id: 51,
        objetivo_neto_kg: 12,
        salidas: [{
          articulo_scm_id: 91,
          cantidad_por_ciclo: 4,
          peso_unitario_g: 12,
        }],
      }],
    });
    expect(await screen.findByText(/OF-000010 creada como reposición/)).toBeVisible();
  });

  it('explica el siguiente paso cuando Planificación todavía no generó OF', async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Aún no hay órdenes de fabricación')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Planificación' }))
      .toHaveAttribute('href', '/planificacion');
  });

  it('no confunde un fallo de carga con una colección vacía', async () => {
    listarOrdenesFabricacionScm.mockRejectedValueOnce(new Error('Servicio no disponible'));

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Servicio no disponible')).toBeVisible();
    expect(screen.queryByText('Aún no hay órdenes de fabricación')).not.toBeInTheDocument();
  });

  it('filtra el recurso y mantiene opcional la sugerencia de máquina', async () => {
    const user = userEvent.setup();
    listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-1',
        codigo: 'OF-000001',
        estado: 'BORRADOR',
        version: 1,
        proceso_requerido: 'SOPLADO',
        corridas: [{
          id: 'run-1',
          codigo: 'OF-000001-C01',
          color_produccion_id: 1,
          salidas: [{
            id: 'out-1',
            articulo: {
              codigo: 'PC-000005',
              nombre: 'Alcancía verde',
              clase: 'PIEZA_COLOR',
              pieza_id: 5,
            },
            cantidad_objetivo: '2400.000',
            excedente_objetivo: '0.000',
          }],
        }],
      }],
    });
    obtenerMoldes.mockResolvedValue([
      {
        codigo: 'ML-CORRECTO',
        nombre: 'Molde Alcancía',
        activo: true,
        tiempo_ciclo_std: 45,
        peso_colada_gr: 5,
        formas: [{ pieza_id: 5, activo: true }],
      },
      {
        codigo: 'ML-AJENO',
        nombre: 'Molde Jarra',
        activo: true,
        formas: [{ pieza_id: 1, activo: true }],
      },
    ]);
    obtenerMaquinas.mockResolvedValue([
      {
        id: 10,
        codigo: 'MAQ-SOP',
        nombre: 'Sopladora',
        activo: true,
        estado: 'OPERATIVA',
        tipo_maquina: { proceso: 'SOPLADO' },
      },
      {
        id: 11,
        codigo: 'MAQ-INY',
        nombre: 'Haitian',
        activo: true,
        estado: 'OPERATIVA',
        tipo_maquina: { proceso: 'INYECCION' },
      },
    ]);
    obtenerColores.mockResolvedValue([{ id: 1, nombre: 'VERDE', activo: true }]);

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await screen.findByText('Configuración del recurso');
    const mold = screen.getByRole('combobox', { name: 'Molde' });
    const machine = screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' });
    expect(mold).toHaveTextContent('ML-CORRECTO');
    expect(machine).toHaveTextContent('Sin sugerencia');
    expect(screen.getByText('Máquina sugerida (opcional)', { selector: 'label' }))
      .toHaveAttribute('data-shrink', 'true');
    expect(screen.getByText(/Se muestran moldes compatibles con SOPLADO/))
      .toBeVisible();

    await user.click(mold);
    expect(screen.getByRole('option', { name: /ML-CORRECTO/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /ML-AJENO/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(machine);
    expect(screen.getByRole('option', { name: /Sopladora.*MAQ-SOP/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /MAQ-INY/ })).not.toBeInTheDocument();
  });

  it('prioriza kg netos, calcula ciclos con techo y conserva el mínimo de demanda', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-kg-target', codigo: 'OF-KG-TARGET', estado: 'BORRADOR', version: 4,
      molde_id: 'ML-ASA', maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-kg-target', codigo: 'OF-KG-TARGET-C01', color_produccion_id: 5,
        ciclos_objetivo: 3, salidas: [{
          id: 'out-kg-target', cantidad_objetivo: '10.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '4.0000', peso_unitario_snapshot_g: '12.0000',
          articulo: { codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR', pieza_id: 31 },
        }, {
          id: 'out-kg-target-2', cantidad_objetivo: '5.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '2.0000', peso_unitario_snapshot_g: '30.0000',
          articulo: { codigo: 'PC-TAPA-ROJO', nombre: 'Tapa ROJO', clase: 'PIEZA_COLOR', pieza_id: 32 },
        }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
      formas: [
        { pieza_id: 31, activo: true, cavidades: 4, peso_unitario_gr: 12 },
        { pieza_id: 32, activo: true, cavidades: 2, peso_unitario_gr: 30 },
      ],
    }]);
    obtenerMaquinas.mockResolvedValue([{ id: 8, codigo: 'INY-01', nombre: 'Inyectora 1', activo: true, estado: 'OPERATIVA' }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: order.codigo });

    render(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationOrdersScm /></MemoryRouter></ThemeProvider>);

    await screen.findByText('Configuración del recurso');
    const mold = screen.getByRole('combobox', { name: 'Molde' });
    expect(mold).toHaveTextContent('Molde Asa');
    expect(mold).toHaveTextContent('ML-ASA');
    await user.click(mold);
    expect(screen.getByRole('option', { name: /Molde Asa.*ML-ASA/ })).toBeVisible();
    await user.keyboard('{Escape}');

    const target = screen.getByLabelText(/Objetivo neto \(kg\)/);
    await user.type(target, '0.05');
    expect(screen.getAllByText(/3 ciclos calculados/)[0]).toBeVisible();
    expect(screen.getByText(/0\.324 kg alcanzables/)).toBeVisible();
    expect(screen.getByText(/redondeo de 0\.274 kg/)).toBeVisible();
    expect(screen.queryByLabelText(/Ciclos del objetivo 1/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(order.id, expect.objectContaining({
      corridas: [expect.objectContaining({
        objetivo_neto_kg: 0.05,
        salidas: expect.arrayContaining([expect.objectContaining({ id: 'out-kg-target' })]),
      })],
    }));
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).not.toHaveProperty('ciclos_objetivo');
  });

  it('calcula 7 ciclos para 0.07 kg con 0.01 kg netos por ciclo', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-decimal-target', codigo: 'OF-DECIMAL-TARGET', estado: 'BORRADOR', version: 1,
      molde_id: 'ML-DECIMAL',
      corridas: [{
        id: 'run-decimal-target', codigo: 'OF-DECIMAL-TARGET-C01', color_produccion_id: 5,
        salidas: [{
          id: 'out-decimal-target', cantidad_objetivo: '1.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '1.0000', peso_unitario_snapshot_g: '10.0000',
          articulo: { codigo: 'PC-DECIMAL', nombre: 'Pieza decimal', clase: 'PIEZA_COLOR', pieza_id: 99 },
        }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-DECIMAL', nombre: 'Molde decimal', activo: true,
      formas: [{ pieza_id: 99, activo: true, cavidades: 1, peso_unitario_gr: 10 }],
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);

    render(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationOrdersScm /></MemoryRouter></ThemeProvider>);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    await user.type(target, '0.07');
    expect(screen.getByText('7 ciclos calculados')).toBeVisible();
    expect(screen.getByText(/0\.07 kg alcanzables/)).toBeVisible();
  });

  it('exige objetivo kg en una corrida nueva', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-required-target', codigo: 'OF-REQUIRED-TARGET', estado: 'BORRADOR', version: 1,
      molde_id: 'ML-REQUIRED',
      corridas: [{
        id: 'run-required', codigo: 'OF-REQUIRED-TARGET-C01', ciclos_objetivo: 4, salidas: [],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'ML-REQUIRED', nombre: 'Molde requerido', activo: true, formas: [] }]);

    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    expect(target).toBeRequired();
    expect(screen.getByText(/Obligatorio para esta corrida nueva/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(await screen.findByText(/Completa el objetivo neto en kg de cada corrida nueva/)).toBeVisible();
    expect(configurarOrdenFabricacionScm).not.toHaveBeenCalled();
  });

  it('conserva una orden legacy cargada sin objetivo kg y envía sus ciclos de referencia', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-legacy', codigo: 'OF-LEGACY', estado: 'BORRADOR', version: 2,
      molde_id: 'ML-LEGACY',
      corridas: [{
        id: 'run-legacy', codigo: 'OF-LEGACY-C01', ciclos_objetivo: 4,
        lote_color_legacy_id: 44, meta_kg_legacy: '12.000', salidas: [],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'ML-LEGACY', nombre: 'Molde legacy', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: order.codigo });

    render(<MemoryRouter><FabricationOrdersScm /></MemoryRouter>);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    expect(target).not.toBeRequired();
    expect(screen.getByText('4 ciclos calculados')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(order.id, expect.objectContaining({
      corridas: [expect.objectContaining({ ciclos_objetivo: 4 })],
    }));
  });

  it('deriva cavidades y peso neto para un PT monopieza sin pedir datos manuales', async () => {
    listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-jarra',
        codigo: 'OF-000001',
        estado: 'BORRADOR',
        version: 1,
        proceso_requerido: 'INYECCION',
        corridas: [{
          id: 'run-jarra',
          codigo: 'OF-000001-C01',
          color_produccion_id: 1,
          salidas: [{
            id: 'out-jarra',
            articulo: {
              codigo: 'PT-JARRA-REAL-6L-TRANSPARENTE',
              nombre: 'Jarra Real 6 L Transparente',
              clase: 'PRODUCTO_TERMINADO',
              pieza_id: 5,
              derivacion_molde: 'PT_MONOPIEZA',
            },
            cantidad_objetivo: '100.000',
            excedente_objetivo: '0.000',
          }],
        }],
      }],
    });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-JARRA-REAL-6L',
      nombre: 'Molde Jarra Real 6 L',
      activo: true,
      tiempo_ciclo_std: 30,
      peso_colada_gr: 10,
      peso_tiro_gr: 250,
      peso_neto_gr: 240,
      cavidades_totales: 1,
      formas: [{
        pieza_id: 5,
        activo: true,
        cavidades: 1,
        peso_unitario_gr: 240,
      }],
    }]);
    obtenerMaquinas.mockResolvedValue([{
      id: 10,
      codigo: 'INY-01',
      nombre: 'Inyectora 1',
      activo: true,
      estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'INYECCION' },
    }]);
    obtenerColores.mockResolvedValue([{ id: 1, nombre: 'TRANSPARENTE', activo: true }]);

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    const row = await screen.findByRole('row', { name: /Jarra Real 6 L Transparente/ });
    expect(within(row).getByText('PT monopieza · derivado')).toBeVisible();
    expect(within(row).getByText('Componente único del PT')).toBeVisible();
    expect(within(row).getByText('Neto de una unidad')).toBeVisible();
    expect(within(row).getByText('1')).toBeVisible();
    expect(within(row).getByText('240')).toBeVisible();
    expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/240\.0 g netos\/ciclo y 250\.0 g totales\/ciclo/)).toBeVisible();
    expect(screen.getByText(/10\.0 g es material no neto/)).toBeVisible();
    expect(screen.getByText(/La OPM todavía no debe existir/)).toBeVisible();
  });

  it('prefiere el contexto temporal canónico y muestra un rango de necesidad', async () => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-date', codigo: 'OF-000010', estado: 'LIBERADA', version: 1,
      fecha_necesidad: '2026-08-15',
      fecha_necesidad_fuente: { tipo: 'OP', id: 'op-1', codigo: 'OP-000001' },
      rango_fechas_ot: { desde: null, hasta: null, cantidad: 0 },
      programacion_estado: 'SIN_JORNADA',
      contexto_temporal: {
        fecha_necesidad_min: '2026-08-15',
        fecha_necesidad_max: '2026-08-17',
        fecha_ot_primera: '2026-08-10',
        fecha_ot_ultima: '2026-08-11',
        programacion_estado: 'EN_EJECUCION',
        cantidad_ot: 2,
      },
      corridas: [{ id: 'run-date', codigo: 'C01', salidas: [] }],
    }] });

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    const strip = await screen.findByTestId('order-schedule-strip');
    expect(strip).toHaveTextContent(/Necesidad.*15\/08\/2026.*17\/08\/2026/);
    expect(strip).toHaveTextContent(/Jornadas OT.*10\/08\/2026.*11\/08\/2026/);
    expect(within(strip).getByText('En ejecución')).toBeVisible();
    expect(within(strip).getByText('2 OT')).toBeVisible();
    expect(within(strip).queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('cierra una OF desde pesajes efectivos y muestra la proyección de la OP', async () => {
    const user = userEvent.setup();
    const running = {
      id: 'of-running', codigo: 'OF-000020', estado: 'EN_EJECUCION', version: 7,
      corridas: [{ id: 'run-1', codigo: 'C01', salidas: [] }],
    };
    listarOrdenesFabricacionScm
      .mockResolvedValueOnce({ items: [running] })
      .mockResolvedValueOnce({ items: [{ ...running, estado: 'CERRADA', version: 8 }] });
    cerrarOrdenFabricacionScm.mockResolvedValue({
      ...running,
      estado: 'CERRADA',
      cierre: {
        ordenes_produccion: [{ codigo: 'OP-000010', estado: 'COMPLETADA' }],
      },
    });

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    await user.type(
      await screen.findByLabelText(/Motivo de diferencia/),
      'Cierre conciliado del turno',
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar OF' }));

    expect(cerrarOrdenFabricacionScm).toHaveBeenCalledWith('of-running', {
      version: 7,
      motivo: 'Cierre conciliado del turno',
    });
    expect(await screen.findByText(/OP: OP-000010 COMPLETADA/)).toBeVisible();
  });
});
