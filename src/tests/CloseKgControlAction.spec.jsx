import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import CloseKgControlAction from '../components/CloseKgControlAction';
import { cerrarMangaDesdeControlScm } from '../services/scmOtApi';
vi.mock('../services/scmOtApi', () => ({ cerrarMangaDesdeControlScm: vi.fn() }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 'actor1' }) }));

const manga = { public_id: 'm1', codigo: 'M-1', version: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

it('cierra con versión y motivo, sin pesos ni unidades, y conserva la clave al recuperar', async () => {
  cerrarMangaDesdeControlScm.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({});
  const refreshed = vi.fn();
  render(<CloseKgControlAction manga={manga} onClosed={refreshed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar desde último control' }));
  expect(cerrarMangaDesdeControlScm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Motivo del cierre/), { target: { value: 'Terminar manga al fin del lote' } });
  const confirm = screen.getByRole('button', { name: 'Confirmar cierre' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('No se pudo confirmar el resultado. Reintenta con la misma solicitud.');
  expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(1);
  const first = cerrarMangaDesdeControlScm.mock.calls[0];
  expect(first[1]).toEqual({ version: 4, motivo: 'Terminar manga al fin del lote' });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar cierre' }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
  expect(cerrarMangaDesdeControlScm.mock.calls[1]).toEqual(first);
});

it('recupera tras unmount/remount el payload y la clave de una respuesta incierta', async () => {
  cerrarMangaDesdeControlScm.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({});
  const refreshed = vi.fn();
  const firstRender = render(<CloseKgControlAction manga={manga} onClosed={refreshed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar desde último control' }));
  fireEvent.change(screen.getByLabelText(/Motivo del cierre/), { target: { value: 'Cierre persistente del lote' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
  await screen.findByText('No se pudo confirmar el resultado. Reintenta con la misma solicitud.');

  const key = 'scm-kg-close:actor1:m1';
  const pending = JSON.parse(sessionStorage.getItem(key));
  expect(pending.payload).toEqual({ version: 4, motivo: 'Cierre persistente del lote' });
  expect(pending.key).toBeTruthy();
  firstRender.unmount();

  render(<CloseKgControlAction manga={manga} onClosed={refreshed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar cierre' }));
  await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(1));
  expect(cerrarMangaDesdeControlScm.mock.calls[1]).toEqual([
    'm1', pending.payload, pending.key,
  ]);
  expect(sessionStorage.getItem(key)).toBeNull();
});

it('conserva el intento ante 409 de operación idempotente incompleta', async () => {
  cerrarMangaDesdeControlScm.mockRejectedValueOnce({
    response: {
      status: 409,
      data: { error: { code: 'IDEMPOTENCY_OPERATION_INCOMPLETE', message: 'Operación pendiente' } },
    },
  });
  render(<CloseKgControlAction manga={manga} onClosed={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar desde último control' }));
  fireEvent.change(screen.getByLabelText(/Motivo del cierre/), { target: { value: 'Esperar confirmación remota' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
  await screen.findByText('Operación pendiente');

  expect(sessionStorage.getItem('scm-kg-close:actor1:m1')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Reintentar cierre' })).toBeEnabled();
  expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(1);
});

it('muestra cierre confirmado si el POST terminó pero falla la actualización posterior', async () => {
  cerrarMangaDesdeControlScm.mockResolvedValueOnce({});
  const refreshed = vi.fn().mockRejectedValueOnce(new Error('refresh failed'));
  render(<CloseKgControlAction manga={manga} onClosed={refreshed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar desde último control' }));
  fireEvent.change(screen.getByLabelText(/Motivo del cierre/), { target: { value: 'Cierre confirmado en servidor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

  await screen.findByText('Cierre confirmado. Actualiza la consulta para ver el estado nuevo; no repitas el cierre.');
  expect(cerrarMangaDesdeControlScm).toHaveBeenCalledTimes(1);
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Reintentar cierre' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cerrar desde último control' })).toBeNull();
  expect(sessionStorage.getItem('scm-kg-close:actor1:m1')).toBeNull();
});
