import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import WarehouseReceivingScm from '../components/WarehouseReceivingScm';

const actorState = vi.hoisted(() => ({ capabilities: new Set(), actorId: 'actor-1' }));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => actorState.capabilities.has(capability),
    actorId: actorState.actorId,
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
  abrirSesionRecepcionScm,
  cerrarSesionRecepcionScm,
  confirmarRecepcionMangaScm,
  decidirCalidadMangaScm,
  listarRecepcionMangasScm,
  resolverEtiquetaRecepcionScm,
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
    actorState.actorId = 'actor-1';
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

  it('hace dominante el NET KG, conserva la estimación separada y envía la fuente de pesaje', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    const kgCandidate = {
      ...candidate,
      cantidad_confirmada: '120.000',
      peso_neto_kg: '12.000',
      estimacion: { unidades: '120', fuente: 'peso unitario v1', fecha: '2026-09-18' },
      expected_weighing_source: {
        pesaje_public_id: 'pesaje-1',
        correccion_aplicada_public_id: null,
        projection_sha256: 'hash-12',
      },
      articulo: {
        ...candidate.articulo,
        unidad: 'UN',
        unidad_inventario: 'KG',
      },
    };
    listarRecepcionMangasScm.mockResolvedValue({
      ...emptyPayload,
      pendientes: [kgCandidate],
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Verificar' }));
    expect(screen.getByText(/12\.000 kg NET/i)).toBeVisible();
    expect(screen.getByText(/≈120 UN/i)).toBeVisible();
    expect(screen.getByText(/estimación; no es conteo ni saldo/i)).toBeVisible();
    expect(screen.getByText(/Calidad PENDIENTE/i)).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'La manga física está presente' }));
    await user.click(screen.getByRole('checkbox', { name: 'La bolsa está cerrada y sin daño visible' }));
    await user.click(screen.getByRole('checkbox', { name: 'Preetiqueta y etiqueta final corresponden a la misma manga' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar recepción KG' }));

    await waitFor(() => expect(confirmarRecepcionMangaScm).toHaveBeenCalledWith(
      expect.objectContaining({
        label_id: kgCandidate.etiqueta_id,
        expected_weighing_source: kgCandidate.expected_weighing_source,
      }),
      expect.any(String),
    ));
    expect(confirmarRecepcionMangaScm.mock.calls[0][0]).not.toHaveProperty('cantidad');
  });

  it('reintenta una recepción KG con la misma intención y clave tras un error de red', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    const kgCandidate = {
      ...candidate,
      cantidad_confirmada: '120.000',
      peso_neto_kg: '12.000',
      estimacion: { unidades: '120', fuente: 'peso unitario v1', fecha: '2026-09-18' },
      expected_weighing_source: {
        pesaje_public_id: 'pesaje-1',
        correccion_aplicada_public_id: null,
        projection_sha256: 'hash-12',
      },
      articulo: { ...candidate.articulo, unidad_inventario: 'KG' },
    };
    listarRecepcionMangasScm.mockResolvedValue({ ...emptyPayload, pendientes: [kgCandidate] });
    confirmarRecepcionMangaScm
      .mockRejectedValueOnce(new Error('Central no disponible'))
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Verificar' }));
    for (const label of [
      'La manga física está presente',
      'La bolsa está cerrada y sin daño visible',
      'Preetiqueta y etiqueta final corresponden a la misma manga',
    ]) await user.click(screen.getByRole('checkbox', { name: label }));
    await user.click(screen.getByRole('button', { name: 'Confirmar recepción KG' }));
    expect(await screen.findByText(/Central no disponible/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar recepción KG' }));

    await waitFor(() => expect(confirmarRecepcionMangaScm).toHaveBeenCalledTimes(2));
    expect(confirmarRecepcionMangaScm.mock.calls[1][1])
      .toBe(confirmarRecepcionMangaScm.mock.calls[0][1]);
  });

  it('congela la sesión y verificaciones mientras una recepción KG queda incierta', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    const kgCandidate = {
      ...candidate,
      cantidad_confirmada: '120.000',
      peso_neto_kg: '12.000',
      expected_weighing_source: { pesaje_public_id: 'pesaje-1', projection_sha256: 'hash-12' },
      articulo: { ...candidate.articulo, unidad_inventario: 'KG' },
    };
    listarRecepcionMangasScm.mockResolvedValue({ ...emptyPayload, pendientes: [kgCandidate] });
    abrirSesionRecepcionScm.mockResolvedValue({ sesion: { id: 'session-1', codigo: 'S-1', punto_ingreso: 'PUERTA_ALMACEN' } });
    confirmarRecepcionMangaScm
      .mockRejectedValueOnce(new Error('Central no disponible'))
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Verificar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir sesión' }));
    for (const label of [
      'La manga física está presente',
      'La bolsa está cerrada y sin daño visible',
      'Preetiqueta y etiqueta final corresponden a la misma manga',
    ]) await user.click(screen.getByRole('checkbox', { name: label }));
    await user.click(screen.getByRole('button', { name: 'Confirmar recepción KG' }));

    expect(await screen.findByText(/Central no disponible/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDisabled();
    expect(cerrarSesionRecepcionScm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reintentar recepción KG' }));

    await waitFor(() => expect(confirmarRecepcionMangaScm).toHaveBeenCalledTimes(2));
    expect(confirmarRecepcionMangaScm.mock.calls[1][0])
      .toEqual(confirmarRecepcionMangaScm.mock.calls[0][0]);
  });

  it('descarta el candidato y la intención al cambiar de actor y no aplica una carga tardía', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    listarRecepcionMangasScm.mockResolvedValue({ ...emptyPayload, pendientes: [candidate] });
    const user = userEvent.setup();
    const view = renderView();

    await user.click(await screen.findByRole('button', { name: 'Verificar' }));
    expect(screen.getByText('Cantidad confirmada')).toBeInTheDocument();
    actorState.actorId = 'actor-2';
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <WarehouseReceivingScm />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.queryByText('Cantidad confirmada')).not.toBeInTheDocument());
    expect(listarRecepcionMangasScm.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignora un resolve QR tardío del actor anterior', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    listarRecepcionMangasScm.mockResolvedValue(emptyPayload);
    let finishResolve;
    resolverEtiquetaRecepcionScm.mockImplementation(() => new Promise((resolve) => {
      finishResolve = resolve;
    }));
    const user = userEvent.setup();
    const view = renderView();

    const scanner = await screen.findByLabelText('Escanear QR de manga');
    await waitFor(() => expect(scanner).not.toBeDisabled());
    await user.type(scanner, candidate.etiqueta_id);
    await user.click(screen.getByRole('button', { name: 'Identificar' }));
    actorState.actorId = 'actor-2';
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <WarehouseReceivingScm />
      </ThemeProvider>,
    );
    finishResolve(candidate);

    await waitFor(() => expect(screen.queryByText('Cantidad confirmada')).not.toBeInTheDocument());
    expect(screen.queryByText('Manga identificada')).not.toBeInTheDocument();
  });

  it('muestra una manga KG ya recibida como resultado autorizado en solo lectura', async () => {
    actorState.capabilities = new Set(['RECEPCION_MANGA_CONFIRMAR']);
    const received = {
      ...candidate,
      peso_neto_kg: '12.000',
      articulo: { ...candidate.articulo, unidad_inventario: 'KG' },
      expected_weighing_source: { pesaje_public_id: 'pesaje-1', projection_sha256: 'hash-12' },
      received: true,
      existencia: {
        unidad_inventario: 'KG',
        peso_neto_snapshot_kg: '12.000',
        ubicacion: { codigo: 'RECEPCION_PIEZAS_WIP', nombre: 'Recepción de piezas y WIP' },
        estado_calidad: 'PENDIENTE',
      },
    };
    listarRecepcionMangasScm.mockResolvedValue(emptyPayload);
    resolverEtiquetaRecepcionScm.mockResolvedValue(received);
    const user = userEvent.setup();
    renderView();

    const scanner = await screen.findByLabelText('Escanear QR de manga');
    await waitFor(() => expect(scanner).not.toBeDisabled());
    await user.type(scanner, candidate.etiqueta_id);
    await user.click(screen.getByRole('button', { name: 'Identificar' }));

    expect(await screen.findByText('Manga ya recibida')).toBeVisible();
    expect(screen.getByText('12.000 kg NET')).toBeVisible();
    expect(screen.getByText('Recepción de piezas y WIP')).toBeVisible();
    expect(screen.getByText('PENDIENTE')).toBeVisible();
    expect(screen.queryByText('Peso neto a recibir')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar recepción KG/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rechazar recepción/i })).not.toBeInTheDocument();

    resolverEtiquetaRecepcionScm.mockRejectedValueOnce(new Error('QR no existe'));
    await user.clear(scanner);
    await user.type(scanner, '22222222-2222-4222-8222-222222222222');
    await user.click(screen.getByRole('button', { name: 'Identificar' }));
    expect(await screen.findByText('QR no existe')).toBeVisible();
    expect(screen.queryByText('Esta manga ya fue recibida. Se muestra el resultado autorizado en solo lectura.'))
      .not.toBeInTheDocument();
  });
});
