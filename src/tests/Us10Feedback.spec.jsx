import { act, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import { expect, it, vi } from 'vitest';
import { InventoryOperationsPanel } from '../components/Us10aOperations';
import { FeedbackProvider } from '../context/FeedbackContext';

const workspace = {
  lots: [{ id: 'LOT-1', materialName: 'Resina', materialCode: 'MAT-1', events: [],
    balances: [
      { id: 'PENDING-1', status: 'PENDIENTE', quantityKg: 10, locationId: 'ALM-MP-01' },
      { id: 'BLOCKED-1', status: 'BLOQUEADO', quantityKg: 5, locationId: 'MP-BLOQUEADOS' },
    ],
  }],
  locations: [{ id: 'ALM-MP-01', active: true, scope: 'MATERIA_PRIMA', name: 'Materia prima' }],
  corrections: [], supplierReturns: [], receptions: [],
};

it.each([
  [1, 'Cantidad a resolver (kg)', 'Aplicar decisión mock', 'La cantidad debe ser positiva y no superar el saldo PENDIENTE.'],
  [1, 'Cantidad (kg)', 'Mover', 'Movimiento inválido: revisa saldo, cantidad y destino compatible.'],
  [2, 'Cantidad a devolver (kg)', 'Registrar devolución', 'Solo puede devolverse saldo BLOQUEADO o RECHAZADO y sin exceder su existencia.'],
])('rechaza cantidad inválida en la hoja %s con error persistente y campo vinculado', async (tab, field, action, message) => {
  const change = vi.fn();
  render(<ThemeProvider theme={createTheme()}><FeedbackProvider>
    <InventoryOperationsPanel workspace={workspace} onWorkspaceChange={change} initialTab={tab} />
  </FeedbackProvider></ThemeProvider>);
  fireEvent.change(screen.getByLabelText(field), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: action }));
  expect(screen.getByRole('alert', { name: message })).toHaveClass('MuiAlert-colorError');
  expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message);
  vi.useFakeTimers();
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(screen.getByRole('alert', { name: message })).toBeVisible();
    expect(screen.getByLabelText(field)).toHaveValue(20);
    expect(change).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it('conserva la severidad de error en el fallback aislado', () => {
  render(<InventoryOperationsPanel workspace={workspace} onWorkspaceChange={vi.fn()} initialTab={1} />);
  fireEvent.change(screen.getByLabelText('Cantidad a resolver (kg)'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar decisión mock' }));
  const error = screen.getAllByRole('alert').find((node) => node.textContent === 'La cantidad debe ser positiva y no superar el saldo PENDIENTE.');
  expect(error).toHaveClass('MuiAlert-colorError');
});
