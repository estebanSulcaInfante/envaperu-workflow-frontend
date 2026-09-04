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
  creado_por: { id: 1, codigo: 'TRB-008', nombre: 'Luis Pinedo' },
  total_lineas: 2,
  lineas: [],
};

const renderView = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <InventoryOpeningScm articles={[]} materials={[]} {...props} />
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
    expect(screen.getByText('Luis Pinedo')).toBeInTheDocument();
  });

  it('recarga el contenido cuando Actualizar cambia la versión de refresco', async () => {
    actorState.capabilities = new Set(['INVENTARIO_APERTURA_PREPARAR']);
    listarAperturasInventarioScm
      .mockResolvedValueOnce({ items: [{ ...pending, total_unidades_logisticas: 0 }] })
      .mockResolvedValueOnce({ items: [{ ...pending, total_unidades_logisticas: 2, version: 3 }] });

    const view = renderView({ refreshVersion: 0 });
    expect(await screen.findByText(/2 líneas · 0 bultos QR/)).toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <InventoryOpeningScm articles={[]} materials={[]} refreshVersion={1} />
      </ThemeProvider>,
    );

    expect(await screen.findByText(/2 líneas · 2 bultos QR/)).toBeInTheDocument();
    expect(listarAperturasInventarioScm).toHaveBeenCalledTimes(2);
  });

  it('carga el catálogo solo cuando se abre un lote', async () => {
    actorState.capabilities = new Set(['INVENTARIO_APERTURA_PREPARAR']);
    const onRequestCatalog = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    renderView({ onRequestCatalog });

    expect(await screen.findByText(pending.codigo)).toBeInTheDocument();
    expect(onRequestCatalog).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Nuevo lote de conteo' }));
    expect(await screen.findByRole('dialog', { name: 'Nuevo lote de apertura' })).toBeVisible();
    expect(onRequestCatalog).toHaveBeenCalledTimes(1);
  });

  it('muestra la unidad junto a la cantidad y conserva visible el estado de Calidad', async () => {
    actorState.capabilities = new Set([
      'INVENTARIO_APERTURA_PREPARAR',
      'INVENTARIO_APERTURA_CONTINGENCIA',
    ]);
    const user = userEvent.setup();
    renderView({
      materials: [{ id: 7, codigo: 'MP-PP-CLARIFICADO', nombre: 'PP clarificado', unidad_base: 'KG' }],
      onRequestCatalog: vi.fn().mockResolvedValue(),
    });

    await user.click(await screen.findByRole('button', { name: 'Nuevo lote de conteo' }));
    await user.click(screen.getByRole('combobox', { name: 'Método de apertura' }));
    await user.click(screen.getByRole('option', { name: 'Carga tabular · solo Gerencia General' }));
    await user.click(screen.getByRole('combobox', { name: 'Artículo o material' }));
    await user.click(screen.getByRole('option', { name: 'MP-PP-CLARIFICADO · PP clarificado · KG' }));

    expect(screen.getByRole('spinbutton', { name: 'Cantidad (KG)' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Calidad' })).toHaveTextContent('Liberado');
  });

  it('oculta la carga tabular al almacenero', async () => {
    actorState.capabilities = new Set(['INVENTARIO_APERTURA_PREPARAR']);
    const user = userEvent.setup();
    renderView({ onRequestCatalog: vi.fn().mockResolvedValue() });

    await user.click(await screen.findByRole('button', { name: 'Nuevo lote de conteo' }));
    await user.click(screen.getByRole('combobox', { name: 'Método de apertura' }));

    expect(screen.queryByRole('option', { name: /Carga tabular/ })).not.toBeInTheDocument();
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
