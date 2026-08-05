import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import WarehouseReceivingScm from '../components/WarehouseReceivingScm';

const actorState = vi.hoisted(() => ({ capabilities: new Set() }));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => actorState.capabilities.has(capability),
  }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/scmWarehouseApi', () => ({
  abrirSesionRecepcionScm: vi.fn(),
  cerrarSesionRecepcionScm: vi.fn(),
  confirmarRecepcionMangaScm: vi.fn(),
  decidirCalidadMangaScm: vi.fn(),
  listarRecepcionMangasScm: vi.fn(),
  rechazarRecepcionMangaScm: vi.fn(),
  resolverCodigoRecepcionScm: vi.fn(),
  resolverEtiquetaRecepcionScm: vi.fn(),
}));

import {
  confirmarRecepcionMangaScm,
  decidirCalidadMangaScm,
  listarRecepcionMangasScm,
} from '../services/scmWarehouseApi';

const candidate = {
  manga_id: 'manga-1',
  manga_codigo: 'OF000001-OT000001-M001',
  etiqueta_id: '11111111-1111-4111-8111-111111111111',
  resuelta_por: 'QR_FINAL',
  cantidad_confirmada: '10.000',
  peso_bruto_kg: '6.100',
  tara_kg: '0.100',
  peso_neto_kg: '6.000',
  pesada_at: '2026-08-03T08:00:00Z',
  color: 'AMARILLO',
  articulo: {
    codigo: 'PC-000013',
    nombre: 'Cuerpo Balde Amarillo',
    clase: 'PIEZA_COLOR',
    unidad: 'UN',
  },
  ot: { codigo: 'OT-000001', fecha_operativa: '2026-08-03' },
};

const emptyPayload = {
  pendientes: [],
  existencias: [],
  rechazos: [],
  ubicaciones: [{
    codigo: 'RECEPCION_PIEZAS_WIP',
    nombre: 'Recepción de piezas y WIP',
    clases_articulo: ['PIEZA_COLOR', 'SUBENSAMBLE_WIP'],
  }],
};

const renderView = () => render(
  <ThemeProvider theme={createTheme()}>
    <WarehouseReceivingScm />
  </ThemeProvider>,
);

describe('Recepción de mangas SCM por actor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.capabilities = new Set();
    listarRecepcionMangasScm.mockResolvedValue(emptyPayload);
    confirmarRecepcionMangaScm.mockResolvedValue({});
    decidirCalidadMangaScm.mockResolvedValue({});
  });

  it('permite a Almacén verificar y recibir una manga sin redigitar cantidades', async () => {
    actorState.capabilities = new Set([
      'RECEPCION_MANGA_CONFIRMAR',
      'RECEPCION_MANGA_RECHAZAR',
      'RECEPCION_MANGA_BUSCAR_MANUAL',
    ]);
    listarRecepcionMangasScm.mockResolvedValue({
      ...emptyPayload,
      pendientes: [candidate],
    });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('OF000001-OT000001-M001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(screen.getByText('Cantidad confirmada')).toBeInTheDocument();
    expect(screen.getAllByText('10.000 UN')).toHaveLength(2);

    await user.click(screen.getByRole('checkbox', { name: 'La manga física está presente' }));
    await user.click(screen.getByRole('checkbox', { name: 'La bolsa está cerrada y sin daño visible' }));
    await user.click(screen.getByRole('checkbox', { name: 'Preetiqueta y etiqueta final corresponden a la misma manga' }));
    await user.click(screen.getByRole('button', { name: 'Aceptar custodia' }));

    await waitFor(() => expect(confirmarRecepcionMangaScm).toHaveBeenCalledWith({
      label_id: candidate.etiqueta_id,
      ubicacion_codigo: 'RECEPCION_PIEZAS_WIP',
      presencia_confirmada: true,
      bolsa_cerrada: true,
      coincidencia_etiquetas: true,
    }));
  });

  it('muestra a Calidad solo la custodia y registra una decisión auditada', async () => {
    actorState.capabilities = new Set([
      'CALIDAD_MANGA_VER',
      'CALIDAD_MANGA_LIBERAR',
    ]);
    listarRecepcionMangasScm.mockResolvedValue({
      ...emptyPayload,
      existencias: [{
        id: 'existencia-1',
        manga_codigo: candidate.manga_codigo,
        articulo: candidate.articulo,
        ubicacion: { nombre: 'Recepción de piezas y WIP' },
        cantidad_fisica: '10.000',
        estado_calidad: 'PENDIENTE',
        recibida_at: '2026-08-03T09:00:00Z',
        version: 1,
      }],
    });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByRole('button', { name: 'Liberar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Escanear QR de manga')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Liberar' }));
    await user.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Inspección conforme');
    await user.click(screen.getByRole('button', { name: 'Confirmar decisión' }));

    await waitFor(() => expect(decidirCalidadMangaScm).toHaveBeenCalledWith(
      'existencia-1',
      {
        decision: 'LIBERADA',
        motivo: 'Inspección conforme',
        version: 1,
      },
    ));
  });
});
