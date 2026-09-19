import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KgPtAvailabilityScm from '../components/KgPtAvailabilityScm';

const mocks = vi.hoisted(() => ({ pieces: vi.fn(), pt: vi.fn(), balances: vi.fn(), post: vi.fn(), history: vi.fn(), warehouses: vi.fn() }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: () => true }) }));
vi.mock('../services/scmKgPtAvailabilityApi', () => ({ consultarDisponibilidadPiezasKg: mocks.pieces, consultarDisponibilidadPt: mocks.pt, listarKardexPtManual: mocks.balances, registrarMovimientoPtManual: mocks.post, listarMovimientosPtManual: mocks.history }));
vi.mock('../services/scmWarehouseOperationsApi', () => ({ listarAlmacenesScm: mocks.warehouses }));
const product = { id: 11, codigo: 'PT-11', nombre: 'Balde completo' };
const location = { id: 8, codigo: 'PT-GEN', nombre: 'Almacén PT', activo: true, clases_articulo: ['PRODUCTO_TERMINADO'] };
const balance = (version = 2) => ({ id: 'saldo-pt', articulo: product, ubicacion: location, saldo_un: '5.000', version });
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.pieces.mockResolvedValue({ items: [], fuente_vigente: [] });
  mocks.pt.mockResolvedValue({ items: [{ pt: product, componentes: [], potencial_estado: 'NO_CALCULABLE', saldo_manual_un: '5.000' }] });
  mocks.balances.mockResolvedValue({ items: [balance()] });
  mocks.warehouses.mockResolvedValue({ items: [{ ubicaciones: [location] }] });
  mocks.history.mockResolvedValue({ items: [] });
  mocks.post.mockResolvedValue({ saldo: balance(3) });
});
async function fillEntry() {
  await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
  fireEvent.click(screen.getByRole('tab', { name: 'Kardex PT manual' }));
  fireEvent.change(screen.getByLabelText(/Producto terminado/), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText(/Ubicación autorizada/), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText(/Cantidad UN/), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Producción recibida' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar movimiento' }));
}
describe('Kardex PT operativo', () => {
  it('confirma datos antes de enviar y recupera exactamente el intento tras perder respuesta', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Sin respuesta')).mockResolvedValue({ saldo: balance(3) });
    render(<KgPtAvailabilityScm />);
    await fillEntry();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Balde completo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
    const recover = await screen.findByRole('button', { name: 'Recuperar movimiento' });
    const first = mocks.post.mock.calls[0];
    expect(first[0]).toMatchObject({ cantidad: '3', version: 2, tipo: 'ENTRADA' });
    expect(screen.getByLabelText(/Cantidad UN/)).toBeDisabled();
    fireEvent.click(recover);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1]).toEqual(first);
    await screen.findByText('Movimiento PT registrado.');
    expect(sessionStorage.getItem('scm-pt-manual-intent:7')).toBeNull();
  });
  it('bloquea doble confirmación y usa la versión nueva para la siguiente entrada', async () => {
    let finish;
    mocks.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<KgPtAvailabilityScm />);
    await fillEntry();
    const confirm = screen.getByRole('button', { name: 'Confirmar movimiento' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.balances.mockResolvedValue({ items: [balance(3)] });
    finish({ saldo: balance(3) });
    await screen.findByText('Movimiento PT registrado.');
    await waitFor(() => expect(screen.getByLabelText(/Cantidad UN/)).not.toBeDisabled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByLabelText(/Cantidad UN/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Segunda entrega' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar movimiento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1][0].version).toBe(3);
    expect(mocks.post.mock.calls[1][1]).not.toBe(mocks.post.mock.calls[0][1]);
  });
});
