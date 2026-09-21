import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WarehouseKgCustodyScm from '../components/WarehouseKgCustodyScm';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), command: vi.fn(), list: vi.fn(), can: () => true }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: mocks.can }) }));
vi.mock('../services/scmKgCustodyApi', () => ({ resolveKgUnit: mocks.resolve, commandKgCustody: mocks.command, listKgWithdrawals: mocks.list }));
vi.mock('../services/scmWarehouseApi', () => ({ listarRecepcionMangasScm: async () => ({ ubicaciones: [{ codigo: 'PIEZAS', nombre: 'Almacén de piezas' }] }) }));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (e) => e.message }));
const unit = { id: 'unit1', codigo: 'KG-1', articulo: { codigo: 'PIEZA' }, estado_logistico: 'RECIBIDA_ALMACEN', estado_calidad: 'LIBERADA', version: 3, kg_verificados: '12.000' };
const scan = async () => {
  fireEvent.change(screen.getByLabelText('QR o código de pieza / parte'), { target: { value: 'KG-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar identidad KG' }));
  await screen.findByText('KG-1 · PIEZA');
};
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.list.mockResolvedValue({ items: [] });
  mocks.resolve.mockResolvedValue({ unit });
  mocks.command.mockResolvedValue({});
});

describe('Custodia KG', () => {
  it('prepara el retorno posterior de una parte retenida sin inventar su peso', async () => {
    mocks.resolve.mockResolvedValue({ unit: { ...unit, estado_logistico: 'PENDIENTE_VERIFICACION', estado: 'ACTIVA', intencion: 'PERMANECE', kg_verificados: null } });
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.change(screen.getByLabelText('Motivo del retorno de esta parte'), { target: { value: 'Remanente disponible tras armado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar retorno para pesaje' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
    expect(mocks.command.mock.calls[0][0].path).toBe('unidades-kg/unit1/retorno/preparar');
    expect(mocks.command.mock.calls[0][0].data).toEqual({ version: 3, motivo: 'Remanente disponible tras armado' });
  });
  it('mantiene confirmación si falla solo el refresco posterior', async () => {
    mocks.list.mockResolvedValueOnce({ items: [] }).mockRejectedValueOnce(new Error('Sin conexión'));
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.change(screen.getByLabelText('Motivo y destino de uso en Armado'), { target: { value: 'Mesa A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar para Armado' }));
    await screen.findByText('La operación quedó confirmada. No se pudo actualizar la vista; consulte de nuevo la identidad.');
    expect(screen.getByText('Reserva registrada. El material sigue en Almacén.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recuperar operación' })).toBeNull();
    expect(sessionStorage.getItem('scm-kg-custody-intent:7')).toBeNull();
  });

  it('otro QR no hereda motivo ni configuración de la identidad anterior', async () => {
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.change(screen.getByLabelText('Motivo y destino de uso en Armado'), { target: { value: 'Mesa anterior' } });
    mocks.resolve.mockResolvedValue({ unit: { ...unit, id: 'unit2', codigo: 'KG-2' } });
    fireEvent.change(screen.getByLabelText('QR o código de pieza / parte'), { target: { value: 'KG-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar identidad KG' }));
    await screen.findByText('KG-2 · PIEZA');
    expect(screen.getByLabelText('Motivo y destino de uso en Armado')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Reservar para Armado' })).toBeDisabled();
  });
  it('reserva el peso de la identidad sin pedir ni estimar cantidades', async () => {
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.change(screen.getByLabelText('Motivo y destino de uso en Armado'), { target: { value: 'Mesa A, turno tarde' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar para Armado' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
    expect(mocks.command.mock.calls[0][0].data).toEqual({ version: 3, motivo_operativo: 'Mesa A, turno tarde' });
  });

  it('permite reservar para Armado una manga disponible desde el pesaje', async () => {
    mocks.resolve.mockResolvedValue({ unit: { ...unit, estado_logistico: 'DISPONIBLE_PRODUCCION', estado_calidad: 'SIN_CONTROL' } });
    render(<WarehouseKgCustodyScm />);
    await scan();
    expect(screen.getByLabelText('Motivo y destino de uso en Armado')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Motivo y destino de uso en Armado'), { target: { value: 'Armado, mesa principal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar para Armado' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
  });

  it('tras perder respuesta reintenta exactamente la operación guardada', async () => {
    mocks.command.mockRejectedValueOnce(new Error('Sin respuesta')).mockResolvedValue({});
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.change(screen.getByLabelText('Motivo y destino de uso en Armado'), { target: { value: 'Mesa A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar para Armado' }));
    await screen.findByText('Sin respuesta');
    expect(screen.getByLabelText('QR o código de pieza / parte')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar operación' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command.mock.calls[1][0]).toEqual(mocks.command.mock.calls[0][0]);
  });

  it('divide un retorno parcial sin enviar kg calculados para las partes', async () => {
    mocks.resolve.mockResolvedValue({ unit: { ...unit, estado_logistico: 'RETIRADA_ARMADO' }, retiro: { id: 'ret1' } });
    mocks.command.mockResolvedValue({ division: { partes: [{ unidad: { id: 'child1', codigo: 'KG-HIJA-1', intencion: 'RETORNO', kg_verificados: null } }] } });
    render(<WarehouseKgCustodyScm />);
    await scan();
    fireEvent.click(screen.getByRole('button', { name: 'Separar retorno y parte que permanece' }));
    await screen.findByText(/KG-HIJA-1/);
    expect(mocks.command.mock.calls[0][0].data.partes).toEqual([{ client_ref: 'RETORNO', intencion: 'RETORNO' }, { client_ref: 'PERMANECE', intencion: 'PERMANECE' }]);
    expect(screen.getByText(/sin pesar/)).toBeTruthy();
  });

  it('control mantiene lectura aunque el actor tenga capacidades de escritura', async () => {
    render(<WarehouseKgCustodyScm readOnly />);
    await scan();
    expect(screen.queryByRole('button', { name: 'Reservar para Armado' })).toBeNull();
    expect(screen.queryByText('Configuración de lectura de esta identidad')).toBeNull();
  });

  it('calcula junto a Armado con lo retenido y sin verificar, no con el entregado histórico', async () => {
    mocks.list.mockResolvedValue({ items: [{
      id: 'retiro-1', codigo: 'KG-RETIRO-1', kg_entregado: '12.000',
      kg_retornado_recibido: '3.000', kg_retorno_verificado_pendiente: '2.000',
      kg_retenido_verificado: '4.000', kg_sin_verificar_clasificar: '3.000',
    }, {
      id: 'retiro-2', codigo: 'KG-RETIRO-2', kg_entregado: '5.000',
      kg_retornado_recibido: '5.000', kg_retorno_verificado_pendiente: '0.000',
      kg_retenido_verificado: '0.000', kg_sin_verificar_clasificar: '0.000',
    }] });
    render(<WarehouseKgCustodyScm />);

    expect(await screen.findByText('1 · 7.000 KG')).toBeVisible();
    expect(screen.getByText('1 · 2.000 KG')).toBeVisible();
    expect(screen.getByText('8.000 KG')).toBeVisible();
    expect(screen.getByText('3.000 KG')).toBeVisible();
  });
});
