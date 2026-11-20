import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MangaFichaScm from '../components/MangaFichaScm';
import {
  cerrarMangaDesdeControlScm,
  reabrirMangaScm,
  resolverFichaMangaScm,
} from '../services/scmOtApi';

const actor = { actorId: 'actor1', can: (capability) => [
  'MANGA_PESAJE_VER', 'MANGA_REABRIR', 'MANGA_FINALIZAR_PARCIAL',
].includes(capability) };

vi.mock('../services/scmOtApi', () => ({
  cerrarMangaDesdeControlScm: vi.fn(),
  reabrirMangaScm: vi.fn(),
  resolverFichaMangaScm: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => actor }));

const code = 'OF000001-OT002-M001';
const reopenedFicha = () => ({
  entrada: { tipo: 'QR_JSON', label_id: 'label-1', codigo: code },
  manga: {
    id: 'manga-1', codigo: code, estado: 'PESADA', version: 7,
    articulo_nombre: 'Pieza crema', pieza_color_sku: 'PC-01', color: 'Rojo',
  },
  pesaje: {
    estado: 'PESADA', final_vigente: true, peso_neto_kg: '4.790', ultimo_control_neto_kg: '4.790',
  },
  estado_produccion: { cerrada: true, estado_manga: 'PESADA', dominio: 'KG' },
  inventario_kg: { estado_logistico: 'DISPONIBLE_PRODUCCION', unidad_estado_logistico: 'DISPONIBLE_PRODUCCION' },
  acciones: {
    reabrir: {
      permitida_por_capacidad: true, elegible: true, version: 7,
      tipos: ['CIERRE_ACCIDENTAL', 'CONTINUAR_LLENADO'],
      por_tipo: [
        { tipo: 'CIERRE_ACCIDENTAL', elegible: true, razon: 'Disponible en el flujo histórico.' },
        { tipo: 'CONTINUAR_LLENADO', elegible: true, razon: 'Agrega peso en la misma manga.' },
      ],
    },
    cerrar_desde_control: { elegible: false, razon: 'No aplica mientras la manga está cerrada.' },
    pesaje: { derivar_a: 'PESAJE_1', identidad: code, requiere_lectura_estable: true },
  },
});

const openFicha = async (fixture = reopenedFicha()) => {
  resolverFichaMangaScm.mockResolvedValue(fixture);
  render(<MangaFichaScm />);
  const input = screen.getByRole('textbox', { name: /Etiqueta o código/i });
  fireEvent.change(input, { target: { value: JSON.stringify({ label_id: 'label-1', manga_codigo: code }) } });
  fireEvent.submit(input.closest('form'));
  await screen.findByText('Pieza crema');
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  reabrirMangaScm.mockResolvedValue({});
  cerrarMangaDesdeControlScm.mockResolvedValue({});
});

describe('ficha de manga SCM', () => {
  it('resuelve el JSON completo del QR al pulsar Enter y muestra identidad operativa', async () => {
    await openFicha();

    expect(resolverFichaMangaScm).toHaveBeenCalledWith(expect.stringContaining('label-1'));
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByText('Pieza crema')).toBeInTheDocument();
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
    expect(screen.getByText('Disponible en Producción')).toBeInTheDocument();
    expect(screen.getAllByText('4.790 kg')).toHaveLength(2);
  });

  it('conserva la clave de intención al reintentar la reapertura tras respuesta incierta', async () => {
    reabrirMangaScm.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({});
    await openFicha();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir manga' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo' }), { target: { value: 'Continuar llenado solicitado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reapertura' }));
    await waitFor(() => expect(reabrirMangaScm).toHaveBeenCalledTimes(1));

    const firstCall = reabrirMangaScm.mock.calls[0];
    expect(firstCall[0]).toBe('manga-1');
    expect(firstCall[1]).toEqual(expect.objectContaining({ version: 7, tipo_reapertura: 'CONTINUAR_LLENADO', motivo: 'Continuar llenado solicitado' }));
    expect(firstCall[2]).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar reapertura' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar reapertura' }));
    await waitFor(() => expect(reabrirMangaScm).toHaveBeenCalledTimes(2));
    expect(reabrirMangaScm.mock.calls[1]).toEqual(firstCall);
    expect(await screen.findByText(/Manga reabierta/)).toBeInTheDocument();
  });

  it('ofrece Cerrar pesaje solo con control elegible y usa el comando canónico', async () => {
    const fixture = reopenedFicha();
    fixture.manga.estado = 'EN_LLENADO';
    fixture.estado_produccion.estado_manga = 'EN_LLENADO';
    fixture.pesaje.estado = 'EN_LLENADO';
    fixture.acciones.reabrir.elegible = false;
    fixture.acciones.cerrar_desde_control = { elegible: true };
    await openFicha(fixture);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar manga desde control' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo del cierre' }), { target: { value: 'Fin de llenado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    await waitFor(() => expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(1));
    expect(cerrarMangaDesdeControlScm.mock.calls[0]).toEqual([
      'manga-1', { version: 7, motivo: 'Fin de llenado' }, expect.any(String),
    ]);
  });

  it('limpia la ficha anterior si el segundo código no existe y permite reintentar ese código', async () => {
    resolverFichaMangaScm
      .mockResolvedValueOnce(reopenedFicha())
      .mockRejectedValueOnce({ response: { status: 404, data: { message: 'Manga no encontrada' } } })
      .mockResolvedValueOnce(reopenedFicha());
    render(<MangaFichaScm />);
    const input = screen.getByRole('textbox', { name: /Etiqueta o código/i });
    fireEvent.change(input, { target: { value: code } });
    fireEvent.submit(input.closest('form'));
    await screen.findByText('Pieza crema');
    fireEvent.change(input, { target: { value: 'OF000001-OT002-M999' } });
    fireEvent.submit(input.closest('form'));
    await screen.findByText('Manga no encontrada');
    expect(screen.queryByText('Pieza crema')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(resolverFichaMangaScm).toHaveBeenCalledTimes(3));
    expect(resolverFichaMangaScm.mock.calls[2][0]).toBe('OF000001-OT002-M999');
  });

  it('separa salida a Armado y bloquea reapertura cuando el API informa custodia posterior', async () => {
    const fixture = reopenedFicha();
    fixture.inventario_kg.unidad_estado_logistico = 'RETIRADA_ARMADO';
    fixture.acciones.reabrir.elegible = false;
    fixture.acciones.reabrir.por_tipo = [];
    fixture.acciones.reabrir.razon = 'KG_REOPEN_DOWNSTREAM_REQUIRED';
    await openFicha(fixture);

    expect(screen.getByText('Salida a Armado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir manga' })).not.toBeInTheDocument();
    expect(screen.getByText(/Hay un movimiento o una reserva posterior/)).toBeInTheDocument();
  });

  it('reutiliza la clave al reintentar Cerrar pesaje tras timeout', async () => {
    const fixture = reopenedFicha();
    fixture.manga.estado = 'EN_LLENADO';
    fixture.estado_produccion.estado_manga = 'EN_LLENADO';
    fixture.pesaje.estado = 'EN_LLENADO';
    fixture.acciones.reabrir.elegible = false;
    fixture.acciones.cerrar_desde_control = { elegible: true };
    cerrarMangaDesdeControlScm.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({});
    await openFicha(fixture);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar manga desde control' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo del cierre' }), { target: { value: 'Fin de llenado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    await waitFor(() => expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(1));
    const firstCall = cerrarMangaDesdeControlScm.mock.calls[0];
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar cierre' }));
    await waitFor(() => expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(2));
    expect(cerrarMangaDesdeControlScm.mock.calls[1]).toEqual(firstCall);
    expect(await screen.findByText(/Manga cerrada desde el último control/)).toBeInTheDocument();
  });
});
