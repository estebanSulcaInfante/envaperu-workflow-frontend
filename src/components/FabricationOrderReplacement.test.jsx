import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import FabricationOrderReplacement from './FabricationOrderReplacement';

const order = {
  id: 'of-old',
  codigo: 'OF-000024',
  estado: 'LIBERADA',
  version: 3,
  plan_produccion_id: 'plan-1',
  procedencia: { op_codigo: 'OP-000006' },
  corridas: [{
    color_nombre: 'Azul',
    salidas: [{
      articulo: { nombre: 'Pieza azul', codigo: 'PC-01' },
      cantidad_objetivo: '120.000',
      kg_estandar_objetivo: '18.000000',
    }],
  }],
};

it('reviews exact target and requires a reason before replacing', async () => {
  const submit = vi.fn().mockResolvedValue({ sucesora: { codigo: 'OF-000036' } });
  const success = vi.fn();
  render(<FabricationOrderReplacement order={order} allowed onSubmit={submit} onSuccess={success} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar OF' }));
  expect(screen.getByText(/Mismo objetivo; nueva OF en borrador/)).toBeInTheDocument();
  expect(screen.getByText(/kg teóricos 18.000000 · unidades objetivo \(referencia\): 120.000/)).toBeInTheDocument();
  expect(screen.getByText('OP de origen: OP-000006')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar reemplazo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo de reemplazo'), { target: { value: 'Corregir receta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(order, 'Corregir receta', expect.any(String)));
  await waitFor(() => expect(success).toHaveBeenCalled());
});

it('does not offer replacement outside a released order or without permission', () => {
  const { rerender } = render(<FabricationOrderReplacement order={order} allowed={false} />);
  expect(screen.queryByRole('button', { name: 'Reemplazar OF' })).not.toBeInTheDocument();
  rerender(<FabricationOrderReplacement order={{ ...order, estado: 'EN_EJECUCION' }} allowed />);
  expect(screen.queryByRole('button', { name: 'Reemplazar OF' })).not.toBeInTheDocument();
});

it('preserves reason when the server reports a conflict', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('conflict'));
  render(<FabricationOrderReplacement order={order} allowed onSubmit={submit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar OF' }));
  fireEvent.change(screen.getByLabelText('Motivo de reemplazo'), { target: { value: 'Receta incorrecta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Motivo de reemplazo')).toHaveValue('Receta incorrecta');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar reemplazo' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[0][2]).toBe(submit.mock.calls[1][2]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Volver' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reemplazar OF' }));
  expect(screen.getByLabelText('Motivo de reemplazo')).toHaveValue('Receta incorrecta');
});

it('shows the preflight blocker without a false confirm action', () => {
  render(<FabricationOrderReplacement order={{ ...order, reemplazo_disponibilidad: { permitido: false, motivo: 'Tiene trabajo de color' } }} allowed />);
  expect(screen.getByText(/Tiene trabajo de color/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reemplazar OF' })).not.toBeInTheDocument();
});
