import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import CreateOptionAutocomplete from '../components/ui/CreateOptionAutocomplete';
import ColorQuickCreateDialog from '../components/ui/ColorQuickCreateDialog';

vi.mock('../services/api', () => ({
  crearColor: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
}));

import { crearColor, obtenerFamiliasColor } from '../services/api';

const Wrapper = ({ children }) => (
  <ThemeProvider theme={createTheme({})}>{children}</ThemeProvider>
);

describe('CreateOptionAutocomplete', () => {
  it('mantiene Crear nuevo como última opción y delega el texto buscado', async () => {
    const user = userEvent.setup();
    const onCreateOption = vi.fn();

    render(
      <Wrapper>
        <CreateOptionAutocomplete
          label="Color"
          options={[
            { id: 1, nombre: 'AZUL SÓLIDO' },
            { id: 2, nombre: 'ROJO SÓLIDO' },
          ]}
          getOptionLabel={(option) => option.nombre}
          onCreateOption={onCreateOption}
          createLabel={(input) => input ? `Crear "${input.toUpperCase()}"…` : 'Crear nuevo color…'}
        />
      </Wrapper>
    );

    const input = screen.getByLabelText('Color');
    await user.click(input);
    let options = await screen.findAllByRole('option');
    expect(options.at(-1)).toHaveTextContent('Crear nuevo color…');

    await user.type(input, 'verde');
    options = await screen.findAllByRole('option');
    expect(options.at(-1)).toHaveTextContent('Crear "VERDE"…');
    await user.click(options.at(-1));

    expect(onCreateOption).toHaveBeenCalledWith('verde');
  });
});

describe('ColorQuickCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerFamiliasColor.mockResolvedValue([
      { id: 7, nombre: 'TRANSPARENTE' },
      { id: 3, nombre: 'SOLIDO' },
    ]);
    crearColor.mockResolvedValue({ id: 22, nombre: 'VERDE SOLIDO', existed: false });
  });

  it('crea ColorProduccion con color base y acabado explícitos', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <ColorQuickCreateDialog
          open
          initialName="verde"
          onCreated={onCreated}
          onClose={onClose}
        />
      </Wrapper>
    );

    expect(await screen.findByDisplayValue('VERDE')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Acabado/ })).toHaveTextContent('SOLIDO'));
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));

    await waitFor(() => {
      expect(crearColor).toHaveBeenCalledWith({ nombre: 'VERDE', familia_color_id: 3 });
    });
    expect(onCreated).toHaveBeenCalledWith({ id: 22, nombre: 'VERDE SOLIDO', existed: false });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancelar conserva el formulario padre y no crea registros', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <ColorQuickCreateDialog
          open
          initialName="verde"
          onCreated={onCreated}
          onClose={onClose}
        />
      </Wrapper>
    );

    await screen.findByDisplayValue('VERDE');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(crearColor).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
