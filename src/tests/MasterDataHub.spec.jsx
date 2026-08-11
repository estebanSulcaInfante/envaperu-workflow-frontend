import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
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

  it('presenta el alta integral como CTA canónica y el configurador heredado como compatibilidad', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MasterDataHub />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole('link', { name: /Iniciar alta integral/i })).toHaveAttribute(
      'href', '/datos-maestros/alta-producto',
    );
    const legacyRow = screen.getByRole('row', {
      name: /Configuración técnica de molde y piezas/i,
    });
    expect(within(legacyRow).getByText(/Compatibilidad · marcha blanca/i)).toBeVisible();
    expect(within(legacyRow).getByText(/el alta integral es el recorrido canónico/i)).toBeVisible();
  });

  it('prioriza un único recorrido integral y colapsa el mantenimiento especializado', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MasterDataHub />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const primaryHeading = screen.getByRole('heading', { name: 'Alta integral de producto' });
    const maintenanceHeading = screen.getByText('Mantenimiento especializado');
    expect(primaryHeading.compareDocumentPosition(maintenanceHeading))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText(/Orquesta identidad, molde, piezas, colores, BOM, ruta y empaque/i))
      .toBeVisible();
    expect(screen.getByRole('button', { name: /Ver catálogos/i })).toHaveAttribute(
      'aria-expanded', 'false',
    );
    expect(screen.queryByText(/Al final crea el producto/i)).not.toBeInTheDocument();
  });
});
