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

  it('debouncea la búsqueda remota desde la última pulsación', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup({ delay: 10 });
    render(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          onSearch={onSearch}
        />
      </ThemeProvider>,
    );
    const search = screen.getByRole('combobox', { name: 'Artículo remoto' });
    await user.type(search, 'CANDY');
    expect(onSearch).not.toHaveBeenCalled();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    expect(onSearch).not.toHaveBeenCalled();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith('CANDY');
  });

  it('cancela la búsqueda remota pendiente al limpiar', async () => {
    const onSearch = vi.fn();
    render(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          onSearch={onSearch}
        />
      </ThemeProvider>,
    );
    const search = screen.getByRole('combobox', { name: 'Artículo remoto' });
    const user = userEvent.setup();
    await user.type(search, 'CANDY');
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    await user.clear(search);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('cancela la búsqueda pendiente al cambiar el ámbito del selector', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          resetKey="actor-1:tab-1"
          onSearch={onSearch}
        />
      </ThemeProvider>,
    );
    const search = screen.getByRole('combobox', { name: 'Artículo remoto' });
    await user.type(search, 'CANDY');
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          resetKey="actor-2:tab-3"
          onSearch={onSearch}
        />
      </ThemeProvider>,
    );
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('cancela la búsqueda pendiente al seleccionar o desmontar', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          onSearch={onSearch}
          onChange={vi.fn()}
        />
      </ThemeProvider>,
    );
    const search = screen.getByRole('combobox', { name: 'Artículo remoto' });
    await user.type(search, 'WIP');
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    expect(onSearch).not.toHaveBeenCalled();

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ScmArticleAutocomplete
          label="Artículo remoto"
          articles={articles}
          value=""
          remote
          onSearch={onSearch}
        />
      </ThemeProvider>,
    );
    const secondSearch = screen.getByRole('combobox', { name: 'Artículo remoto' });
    await user.type(secondSearch, 'CANDY');
    view.unmount();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    expect(onSearch).not.toHaveBeenCalled();
  });
});
