import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MasterDataHub from '../components/MasterDataHub';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

describe('hub de Datos maestros', () => {
  it('presenta áreas comprensibles y nunca códigos internos', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MasterDataHub />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.queryAllByText('PRODUCT_ENGINEERING')).toHaveLength(0);
    expect(screen.queryAllByText('MATERIALS_SUPPLIERS')).toHaveLength(0);
    expect(screen.getAllByText('Producto e ingeniería').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Materiales y proveedores').length).toBeGreaterThan(0);
  });
});
