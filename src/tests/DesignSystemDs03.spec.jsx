import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchableCatalogAutocomplete from '../components/ui/SearchableCatalogAutocomplete';
import WeightInput from '../components/ui/WeightInput';

const renderWithTheme = (children) => render(
  <ThemeProvider theme={createTheme()}>{children}</ThemeProvider>,
);

describe('DS03 controles de campos', () => {
  it('busca por código y mantiene nombre primario con código secundario', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      { id: 'm-1', nombre: 'Molde Asa', codigo: 'ML-ASA' },
      { id: 'm-2', nombre: 'Molde Tapa', codigo: 'ML-TAPA' },
    ];

    renderWithTheme(
      <SearchableCatalogAutocomplete
        label="Molde"
        options={options}
        value={options[0]}
        onChange={onChange}
        getOptionKey={(option) => option.id}
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Molde' });
    await user.click(input);
    await user.clear(input);
    await user.type(input, 'ML-TAPA');
    expect(screen.getByRole('option', { name: /Molde Tapa.*ML-TAPA/ })).toBeVisible();
    await user.click(screen.getByRole('option', { name: /Molde Tapa.*ML-TAPA/ }));
    expect(onChange).toHaveBeenCalledWith(options[1]);
  });

  it('muestra kg2 y gramos1 en reposo, conserva precisión al foco y no ensucia por foco/blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithTheme(<WeightInput label="Objetivo neto" unit="kg" value="12.3456" onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: 'Objetivo neto' });
    expect(input).toHaveValue(12.35);
    await user.click(input);
    expect(input).toHaveValue(12.3456);
    await user.tab();
    expect(input).toHaveValue(12.35);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('buscar y Escape no descartan una identidad seleccionada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const selected = { id: 1, nombre: 'Molde de prueba', codigo: 'ML-1' };
    renderWithTheme(<SearchableCatalogAutocomplete label="Molde" options={[selected]} value={selected} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Molde' });
    await user.clear(input);
    await user.type(input, 'inexistente');
    expect(screen.getByText('Sin coincidencias')).toBeVisible();
    await user.keyboard('{Escape}{Escape}');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('Molde de prueba');
  });

  it('un peso pequeño sigue visible y numérico; no se convierte en vacío o cero', () => {
    renderWithTheme(<WeightInput label="Peso pequeño" unit="kg" value="0.001" onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Peso pequeño' })).toHaveValue(0.001);
    expect(screen.getByText(/Menor que 0.01 kg/)).toBeVisible();
  });

  it('una selección histórica ausente puede verse sin habilitarse para elegirla', async () => {
    const user = userEvent.setup();
    const frozen = { id: 1, nombre: 'Receta histórica', codigo: 'RP-1', vigente: false };
    renderWithTheme(<SearchableCatalogAutocomplete label="Receta" options={[frozen]} value={frozen} getOptionDisabled={(item) => !item.vigente} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: 'Receta' }));
    expect(screen.getByRole('option', { name: /Receta histórica/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('permite limpiar expresamente la máquina con teclado sin confundirlo con buscar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const selected = { id: 1, nombre: 'Inyectora', codigo: 'MAQ-1' };
    renderWithTheme(<SearchableCatalogAutocomplete label="Máquina" options={[selected]} value={selected} onChange={onChange} />);
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Máquina' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Limpiar selección' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('re-elegir la misma identidad no modifica el formulario', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const selected = { id: 1, nombre: 'Molde', codigo: 'M1' };
    renderWithTheme(<SearchableCatalogAutocomplete label="Molde" options={[{ ...selected }]} value={selected} onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde.*M1/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([['kg', '0'], ['g', '0'], ['g', '-1']])('explica por qué %s=%s no cumple un peso positivo', (unit, value) => {
    renderWithTheme(<WeightInput label="Peso" unit={unit} value={value} positive required />);
    expect(screen.getByRole('spinbutton', { name: 'Peso' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(new RegExp(`mayor que 0 ${unit}`))).toBeVisible();
  });
});
