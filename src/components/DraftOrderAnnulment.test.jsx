import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DraftOrderAnnulment from './DraftOrderAnnulment';

const order = { id: 'test', codigo: 'OF-000001', estado: 'BORRADOR', version: 1 };

it('requires a reason and confirms the exact draft; cancel has no effect', async () => {
  const submit = vi.fn().mockResolvedValue({ estado: 'ANULADA' });
  const refresh = vi.fn();
  render(<DraftOrderAnnulment order={order} allowed onSubmit={submit} onSuccess={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Anular borrador' }));
  expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Anular borrador' }));
  fireEvent.change(screen.getByLabelText('Motivo de anulación'), { target: { value: 'Duplicada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(order, 'Duplicada'));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

it('hides the action without permission or outside draft', () => {
  const { rerender } = render(<DraftOrderAnnulment order={order} allowed={false} />);
  expect(screen.queryByText('Anular borrador')).not.toBeInTheDocument();
  rerender(<DraftOrderAnnulment order={{ ...order, estado: 'LIBERADA' }} allowed />);
  expect(screen.queryByText('Anular borrador')).not.toBeInTheDocument();
});

it('preserves the reason after a failed request', async () => {
  render(<DraftOrderAnnulment order={order} allowed onSubmit={vi.fn().mockRejectedValue(new Error('conflict'))} />);
  fireEvent.click(screen.getByText('Anular borrador'));
  fireEvent.change(screen.getByLabelText('Motivo de anulación'), { target: { value: 'Error de creación' } });
  fireEvent.click(screen.getByText('Confirmar anulación'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Motivo de anulación')).toHaveValue('Error de creación');
});

it('submits the version reviewed when the dialog opened', async () => {
  const submit = vi.fn().mockResolvedValue({});
  const { rerender } = render(<DraftOrderAnnulment order={order} allowed onSubmit={submit} />);
  fireEvent.click(screen.getByText('Anular borrador'));
  rerender(<DraftOrderAnnulment order={{ ...order, version: 2 }} allowed onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Motivo de anulación'), { target: { value: 'Duplicada' } });
  fireEvent.click(screen.getByText('Confirmar anulación'));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(order, 'Duplicada'));
});
