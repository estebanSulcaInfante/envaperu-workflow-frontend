import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryOpeningScm from '../components/InventoryOpeningScm';

const actorState = vi.hoisted(() => ({ actorId: 1, capabilities: new Set() }));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actorId: actorState.actorId,
    can: (capability) => actorState.capabilities.has(capability),
  }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/scmInventoryApi', () => ({
  actualizarAperturaInventarioScm: vi.fn(),
  crearAperturaInventarioScm: vi.fn(),
  enviarAperturaInventarioScm: vi.fn(),
  listarAperturasInventarioScm: vi.fn(),
  resolverAperturaInventarioScm: vi.fn(),
}));

import {
  listarAperturasInventarioScm,
  resolverAperturaInventarioScm,
} from '../services/scmInventoryApi';

const pending = {
  id: '11111111-1111-4111-8111-111111111111',
  codigo: 'AI-20260803-UAT00001',
  fecha_corte: '2026-08-03',
  motivo: 'Conteo físico inicial',
  estado: 'PENDIENTE_APROBACION',
  version: 2,
  creado_por_id: 1,
  total_lineas: 2,
  lineas: [],
};

const renderView = () => render(
  <ThemeProvider theme={createTheme()}>
    <InventoryOpeningScm articles={[]} materials={[]} />
  </ThemeProvider>,
);

describe('Apertura inicial controlada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.actorId = 1;
    actorState.capabilities = new Set();
    listarAperturasInventarioScm.mockResolvedValue({ items: [pending] });
    resolverAperturaInventarioScm.mockResolvedValue({
      ...pending,
      estado: 'APLICADO',
      version: 3,
    });
  });

  it('separa la preparación de la aprobación', async () => {
    actorState.capabilities = new Set(['INVENTARIO_APERTURA_PREPARAR']);
    renderView();

    expect(await screen.findByText(pending.codigo)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo lote de conteo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument();
  });

  it('permite al segundo actor aprobar el lote completo con evidencia', async () => {
    actorState.actorId = 2;
    actorState.capabilities = new Set(['INVENTARIO_APERTURA_APROBAR']);
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Revisar' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Evidencia o motivo de resolución' }),
      'Conteo y hoja física verificados',
    );
    await user.click(screen.getByRole('button', { name: 'Aprobar y aplicar' }));

    await waitFor(() => expect(resolverAperturaInventarioScm).toHaveBeenCalledWith(
      pending.id,
      {
        version: 2,
        decision: 'APROBAR',
        motivo_resolucion: 'Conteo y hoja física verificados',
      },
    ));
  });
});
