import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import PreparacionMateriales from '../components/PreparacionMateriales';

const renderPage = (path = '/materiales/preparaciones/OP-B-TEST-001') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/materiales/preparaciones" element={<PreparacionMateriales />} />
        <Route path="/materiales/preparaciones/:numeroOp" element={<PreparacionMateriales />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('US-010B: Preparación trazable de materiales', () => {
  it('presenta una bandeja buscable antes de abrir una OP', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/preparaciones');

    expect(await screen.findByRole('heading', { name: 'Reservas y entregas a producción' })).toBeInTheDocument();
    const search = screen.getByLabelText('Omnibúsqueda');
    await user.type(search, 'OP-B-TEST-001');
    expect(screen.getAllByRole('button', { name: 'Atender OP-B-TEST-001' }).length).toBeGreaterThan(0);
  });

  it('MAT-02 calcula el colorante solo sobre los kg de material virgen', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /Preparación de materiales/i })).toBeInTheDocument();
    expect(screen.getByTestId('data-source')).toHaveTextContent('Datos mock');
    expect(screen.getByText('500 g / 25 kg virgen')).toBeInTheDocument();
    expect(screen.getByTestId('colorant-plan-kg')).toHaveTextContent('1.400 kg');
    expect(screen.getByText(/70.000 kg virgen × 500 g/i)).toBeInTheDocument();
  });

  it('mantiene bloqueados los comandos sin API y permite inspeccionar el WIP mock', async () => {
    const user = userEvent.setup();
    renderPage();

    const reserveButton = await screen.findByRole('button', {
      name: 'Confirmar reserva (API pendiente)',
    });
    expect(reserveButton).toBeDisabled();

    await user.click(screen.getByRole('tab', { name: 'Premezcla' }));

    expect(screen.getByTestId('premix-lot-id')).toHaveTextContent('LMP-B-ROJO-001');
    expect(screen.getByText('99.400 kg')).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Confirmar premezcla (API pendiente)',
    })).toBeDisabled();
  });
});
