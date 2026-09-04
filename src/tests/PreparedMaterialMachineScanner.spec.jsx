import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PreparedMaterialMachineScanner from '../components/PreparedMaterialMachineScanner';
import {
  confirmarRecepcionMaterialPreparadoQr,
  resolverRecepcionMaterialPreparadoQr,
} from '../services/opmPreparationApi';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: () => true }),
}));
vi.mock('../services/opmPreparationApi', () => ({
  resolverRecepcionMaterialPreparadoQr: vi.fn(),
  confirmarRecepcionMaterialPreparadoQr: vi.fn(),
}));

const resolved = {
  maquina: { id: 1, codigo: 'INY-01', nombre: 'Inyectora 1' },
  punto: { id: 91, codigo: 'P-ENVA-INY-01', nombre: 'Punto inyectora 1' },
  bolsa: { id: 'bag-1', codigo: 'BMP-000001-001', peso_neto_kg: '25.000' },
  entrega: { id: 'delivery-1', estado: 'EN_TRANSITO', version: 4 },
  trabajo_color: { id: 'work-1', codigo: 'TC-000001', estado: 'EN_EJECUCION' },
  acciones_permitidas: { recibir: true, recibir_y_consumir: true },
};

const renderScreen = () => render(
  <ThemeProvider theme={createTheme()}><PreparedMaterialMachineScanner /></ThemeProvider>,
);

describe('lector compartido de material preparado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolverRecepcionMaterialPreparadoQr.mockResolvedValue(resolved);
    confirmarRecepcionMaterialPreparadoQr.mockResolvedValue({
      accion: 'RECIBIR_Y_CONSUMIR',
      reserva: { estado: 'CONSUMIDA', bolsa: resolved.bolsa },
      entrega: { ...resolved.entrega, estado: 'CERRADA' },
    });
  });

  it('recorre máquina, bolsa y consumo solo con teclado y conserva el contexto', async () => {
    const user = userEvent.setup();
    renderScreen();

    const machine = screen.getByLabelText('1. QR de máquina');
    expect(machine).toHaveFocus();
    await user.type(machine, 'SCM:MAQUINA:INY-01:V1{enter}');
    const bag = screen.getByLabelText('2. QR o código de bolsa');
    expect(bag).toHaveFocus();
    await user.type(bag, 'BMP-000001-001{enter}');

    expect(await screen.findByText('TC-000001')).toBeInTheDocument();
    expect(resolverRecepcionMaterialPreparadoQr).toHaveBeenCalledWith({
      maquina_qr: 'SCM:MAQUINA:INY-01:V1',
      bolsa_qr: 'BMP-000001-001',
    });
    await user.click(screen.getByRole('button', { name: 'Recibir y consumir' }));
    await waitFor(() => expect(confirmarRecepcionMaterialPreparadoQr).toHaveBeenCalledWith(
      expect.objectContaining({
        entrega_id: 'delivery-1', expected_version: 4,
        accion: 'RECIBIR_Y_CONSUMIR',
      }),
    ));
    expect(await screen.findByText(/recibida y consumida en INY-01/)).toBeInTheDocument();
    expect(machine).toBeDisabled();
    expect(bag).toHaveFocus();
  });

  it('rechaza localmente un texto que no sea placa de máquina', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(screen.getByLabelText('1. QR de máquina'), 'INY-01{enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('no tiene el formato');
    expect(resolverRecepcionMaterialPreparadoQr).not.toHaveBeenCalled();
  });
});
