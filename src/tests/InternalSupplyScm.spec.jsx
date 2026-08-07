import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import InternalSupplyScm from '../components/InternalSupplyScm';

const actorState = vi.hoisted(() => {
  const state = { capabilities: new Set() };
  state.can = (capability) => state.capabilities.has(capability);
  state.canAny = (required) => required.some((capability) => state.capabilities.has(capability));
  return state;
});

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: actorState.can,
    canAny: actorState.canAny,
    experience: { label: 'Almacén' },
  }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/scmInternalSupplyApi', () => ({
  asignarMangaAbastecimientoScm: vi.fn(),
  despacharRetornoAbastecimientoScm: vi.fn(),
  despacharSolicitudScm: vi.fn(),
  listarSolicitudesAbastecimientoScm: vi.fn(),
  marcarSolicitudListaScm: vi.fn(),
  recibirRetornoAbastecimientoScm: vi.fn(),
  recibirSolicitudScm: vi.fn(),
  solicitarRetornoAbastecimientoScm: vi.fn(),
}));

import {
  asignarMangaAbastecimientoScm,
  listarSolicitudesAbastecimientoScm,
} from '../services/scmInternalSupplyApi';

const request = {
  id: 'solicitud-1',
  codigo: 'SA-000001',
  estado: 'SOLICITADA',
  version: 1,
  orden_armado: { id: 'oa-1', codigo: 'OA-000001' },
  orden_trabajo: {
    public_id: 'ot-1',
    codigo_ot: 'OT-000002',
    fecha_operativa: '2026-08-04',
    turno: 'DIA',
    responsable: 'Ana Armado',
    centro_trabajo: { codigo: 'MESA-01', nombre: 'Mesa de Armado 1' },
  },
  lineas: [{
    id: 'linea-1',
    articulo: {
      id: 10,
      codigo: 'PC-000013',
      nombre: 'Cuerpo de balde amarillo',
      clase: 'PIEZA_COLOR',
      unidad: 'UN',
    },
    cantidad_requerida: '10.000',
    cantidad_asignada: '0.000',
    cantidad_por_salida: '1.000',
    merma_tecnica_pct: '0.000',
    asignaciones: [],
  }],
};

const renderView = () => render(
  <MemoryRouter initialEntries={['/produccion/abastecimiento?solicitud=solicitud-1']}>
    <ThemeProvider theme={createTheme()}>
      <InternalSupplyScm />
    </ThemeProvider>
  </MemoryRouter>,
);

describe('Abastecimiento interno por QR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.capabilities = new Set(['PICKING_PREPARAR']);
    listarSolicitudesAbastecimientoScm.mockResolvedValue({ items: [request] });
    asignarMangaAbastecimientoScm.mockResolvedValue({ solicitud: request });
  });

  it('convierte el QR impreso en label_id y reserva la manga sin digitación adicional', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText(/SA-000001 · OA-000001/)).toBeInTheDocument();
    const scanner = screen.getByRole('textbox', {
      name: 'Escanea QR o escribe el código de manga',
    });
    await user.type(scanner, '11111111-1111-4111-8111-111111111111');
    await user.click(screen.getByRole('button', { name: 'Reservar manga' }));

    await waitFor(() => expect(asignarMangaAbastecimientoScm).toHaveBeenCalledWith(
      request,
      {
        linea_id: 'linea-1',
        label_id: '11111111-1111-4111-8111-111111111111',
      },
    ));
  });
});
