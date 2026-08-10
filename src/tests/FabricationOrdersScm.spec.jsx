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
  obtenerMoldes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  configurarOrdenFabricacionScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

import { obtenerColores, obtenerMaquinas, obtenerMoldes } from '../services/api';
import { listarOrdenesFabricacionScm } from '../services/scmOtApi';

describe('Órdenes de fabricación', () => {
  beforeEach(() => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [] });
    obtenerColores.mockResolvedValue([]);
    obtenerMaquinas.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
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
