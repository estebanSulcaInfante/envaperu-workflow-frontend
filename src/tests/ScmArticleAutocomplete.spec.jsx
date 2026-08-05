import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ScmArticleAutocomplete from '../components/ui/ScmArticleAutocomplete';

const articles = [
  {
    id: 1,
    codigo: 'PC-000001',
    nombre: 'Asa sólida azul',
    clase: 'PIEZA_COLOR',
    subtipo: { pieza_color_sku: 'ASA-AZ-01', color: 'Azul sólido' },
  },
  {
    id: 2,
    codigo: 'WIP-000001',
    nombre: 'Jarra con asa prearmada',
    clase: 'SUBENSAMBLE_WIP',
  },
  {
    id: 3,
    codigo: 'PT-000001',
    nombre: 'Jarra terminada',
    clase: 'PRODUCTO_TERMINADO',
  },
];

const renderSelector = (onChange = vi.fn()) => render(
  <ThemeProvider theme={createTheme()}>
    <ScmArticleAutocomplete
      label="Artículo"
      articles={articles}
      value=""
      onChange={onChange}
    />
  </ThemeProvider>,
);

describe('ScmArticleAutocomplete', () => {
  it('busca sin distinguir tildes y devuelve la identidad seleccionada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(onChange);

    const search = screen.getByRole('combobox', { name: 'Artículo' });
    await user.type(search, 'solida azul');

    const option = await screen.findByRole('option', { name: /PC-000001.*Asa sólida azul.*PiezaColor/ });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith('1', articles[0]);
  });

  it('permite buscar por clase operativa', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.type(screen.getByRole('combobox', { name: 'Artículo' }), 'WIP');

    expect(await screen.findByRole('option', { name: /WIP-000001.*Jarra con asa prearmada.*WIP/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /PT-000001/ })).not.toBeInTheDocument();
  });
});
