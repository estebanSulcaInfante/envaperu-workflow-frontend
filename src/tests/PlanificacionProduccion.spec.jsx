import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import PlanificacionProduccion from '../components/PlanificacionProduccion';

const renderPage = (path = '/planificacion/SP-00041') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/planificacion" element={<PlanificacionProduccion />} />
        <Route path="/planificacion/:solicitudId" element={<PlanificacionProduccion />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('US-010P: Planificación de demanda y generación de OP', () => {
  it('PLN-03 calcula 920 ciclos, 138 kg y 20 cuerpos excedentes', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: /Planificación de producción/i })).toBeInTheDocument();
    expect(screen.getByTestId('planning-data-source')).toHaveTextContent('Datos mock');

    await user.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(screen.getByTestId('planned-cycles')).toHaveTextContent('920');
    expect(screen.getByTestId('planned-net-kg')).toHaveTextContent('138.000 kg');

    const bodyRow = screen.getByText('Cuerpo regadera').closest('tr');
    expect(bodyRow).not.toBeNull();
    expect(within(bodyRow).getByText('20')).toBeInTheDocument();
  });

  it('PLN-02 muestra cobertura total sin crear una OP', async () => {
    const user = userEvent.setup();
    renderPage('/planificacion/SP-00042');

    expect(await screen.findByText('La demanda está cubierta y no necesita una nueva OP.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Propuestas de OP' }));
    expect(screen.getByText('Cobertura completa: no se genera ninguna propuesta de OP.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva demanda (API pendiente)' })).toBeDisabled();
  });

  it('PLN-17 no interpreta una fuente de inventario desconocida como stock cero', async () => {
    renderPage('/planificacion/SP-00044');

    expect(await screen.findByText(/stock desconocido, no se interpreta como cero/i)).toBeInTheDocument();
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No calculable').length).toBeGreaterThan(0);
  });

  it('entrega una OP liberada a la preparación de materiales sin fingir otra reserva', async () => {
    renderPage('/planificacion/SP-00045');

    const preparationLink = await screen.findByRole('link', { name: 'Preparar materiales' });
    expect(preparationLink).toHaveAttribute('href', '/ordenes/OP-B-TEST-001/materiales');
    expect(screen.getByText('OP: LIBERADA')).toBeInTheDocument();
    expect(screen.getByText('Materiales: RESERVADO')).toBeInTheDocument();
  });
});
