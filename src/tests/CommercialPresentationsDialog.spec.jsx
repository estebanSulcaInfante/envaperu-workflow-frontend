import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommercialPresentationsDialog from '../components/CommercialPresentationsDialog';
import {
  crearPresentacionComercialScm,
  listarPresentacionesComercialesScm,
} from '../services/scmCatalogApi';

vi.mock('../services/scmCatalogApi', () => ({
  actualizarPresentacionComercialScm: vi.fn(),
  crearPresentacionComercialScm: vi.fn(),
  listarPresentacionesComercialesScm: vi.fn(),
}));

const renderDialog = () => render(
  <ThemeProvider theme={createTheme()}>
    <CommercialPresentationsDialog
      open
      product={{ cod_sku_pt: 'PT-000001', producto: 'Alcancia Pablo Grande' }}
      onClose={vi.fn()}
    />
  </ThemeProvider>,
);

describe('Presentaciones comerciales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarPresentacionesComercialesScm.mockResolvedValue([{
      id: 1,
      codigo: 'PRE-000001',
      producto_terminado_id: 'PT-000001',
      nombre: 'Unidad',
      unidades_base: 1,
      codigo_barra: null,
      predeterminada: true,
      activo: true,
      version: 1,
    }]);
    crearPresentacionComercialScm.mockResolvedValue({ id: 2 });
  });

  it('muestra la conversión y permite agregar un Pack x6', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(await screen.findByText('1 Unidad = 1 UN')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre de presentación'), 'Pack x6');
    await user.type(screen.getByLabelText('Unidades del PT'), '6');
    await user.type(screen.getByLabelText('Código de barras (opcional)'), '7750000000006');
    await user.click(screen.getByRole('button', { name: 'Agregar presentación' }));

    await waitFor(() => expect(crearPresentacionComercialScm).toHaveBeenCalledWith({
      producto_terminado_id: 'PT-000001',
      nombre: 'Pack x6',
      unidades_base: 6,
      codigo_barra: '7750000000006',
      predeterminada: false,
    }));
  });
});
