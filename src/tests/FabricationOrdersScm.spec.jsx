import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn().mockResolvedValue([]),
  obtenerMaquinas: vi.fn().mockResolvedValue([]),
  obtenerMolde: vi.fn(),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  configurarOrdenFabricacionScm: vi.fn(),
  crearOrdenFabricacionExcepcionalScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarArticulosScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

import {
  obtenerColores, obtenerMaquinas, obtenerMolde, obtenerMoldes,
} from '../services/api';
import { listarArticulosScm } from '../services/scmEngineeringApi';
import {
  crearOrdenFabricacionExcepcionalScm, listarOrdenesFabricacionScm,
} from '../services/scmOtApi';

describe('Órdenes de fabricación', () => {
  beforeEach(() => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [] });
    obtenerColores.mockResolvedValue([]);
    obtenerMaquinas.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
    obtenerMolde.mockReset();
    listarArticulosScm.mockResolvedValue([]);
    crearOrdenFabricacionExcepcionalScm.mockReset();
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
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
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
    await user.click(screen.getByLabelText(/^Molde/));
    await user.click(await screen.findByRole('option', { name: /ML-ASA/ }));
    await screen.findByDisplayValue('20');
    await user.click(screen.getByLabelText(/Máquina prevista/));
    await user.click(await screen.findByRole('option', { name: /INY-01/ }));
    await user.click(screen.getByLabelText(/Color corrida 1/));
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    await user.type(screen.getByLabelText(/Ciclos objetivo corrida 1/), '250');

    expect(screen.getByText(/PC-ASA-ROJO - 4 un\/ciclo - 12 g/)).toBeVisible();
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
        ciclos_objetivo: 250,
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

  it('filtra y propone el único molde y máquina compatibles con el proceso', async () => {
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
    const [, mold, machine] = screen.getAllByRole('combobox');
    expect(mold).toHaveTextContent('ML-CORRECTO');
    expect(machine).toHaveTextContent('MAQ-SOP');
    expect(screen.getByText(/Solo se muestran recursos operativos compatibles con SOPLADO/))
      .toBeVisible();

    await user.click(mold);
    expect(screen.getByRole('option', { name: /ML-CORRECTO/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /ML-AJENO/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(machine);
    expect(screen.getByRole('option', { name: /MAQ-SOP/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /MAQ-INY/ })).not.toBeInTheDocument();
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
});
