import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import RecepcionMateriales from '../components/RecepcionMateriales';

const renderPage = (initialPath = '/materiales/recepciones') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/materiales/recepciones" element={<RecepcionMateriales />} />
        <Route path="/materiales/recepciones/nueva" element={<RecepcionMateriales />} />
        <Route path="/materiales/recepciones/:recepcionId" element={<RecepcionMateriales />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('US-010A: Recepción trazable de materias primas', () => {
  it('muestra una bandeja mock sin convertir borradores en inventario', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /Recepción de materias primas/i })).toBeInTheDocument();
    expect(screen.getByTestId('data-source')).toHaveTextContent('Datos mock');
    expect(screen.getByText('REC-BOR-0021')).toBeInTheDocument();

    const draftRow = screen.getByTestId('reception-row-REC-BOR-0021');
    expect(within(draftRow).getByText('Borrador')).toBeInTheDocument();
    expect(within(draftRow).getByText('Sin inventario')).toBeInTheDocument();
  });

  it('separa estado de Calidad, ubicación y disponibilidad en una recepción confirmada', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/REC-000184');

    expect(await screen.findByText('PP-260701-A')).toBeInTheDocument();
    expect(screen.getByTestId('physical-total')).toHaveTextContent('625.000 kg');
    expect(screen.getByTestId('available-total')).toHaveTextContent('0.000 kg');
    expect(screen.getByTestId('current-location')).toHaveTextContent('REC-CUARENTENA');

    await user.click(screen.getByRole('tab', { name: 'Calidad' }));

    expect(screen.getByTestId('quality-pending-total')).toHaveTextContent('625.000 kg');
    expect(screen.getByRole('button', {
      name: 'Registrar decisión de Calidad (API pendiente)',
    })).toBeDisabled();
  });

  it('representa una liberación parcial conservando la existencia física total', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/REC-000183');

    expect(await screen.findByText('Liberación parcial')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Calidad' }));

    expect(screen.getByTestId('quality-released-total')).toHaveTextContent('400.000 kg');
    expect(screen.getByTestId('quality-pending-total')).toHaveTextContent('225.000 kg');
    expect(screen.getByTestId('quality-physical-total')).toHaveTextContent('625.000 kg');
  });

  it('permite revisar el borrador canónico y solo ofrece ubicaciones de materia prima', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/nueva');

    expect(await screen.findByRole('heading', { name: /Nueva recepción de materia prima/i })).toBeInTheDocument();
    expect(screen.getByText(/El borrador no afecta inventario/i)).toBeInTheDocument();
    expect(screen.getByTestId('expected-weight')).toHaveTextContent('625.000 kg');
    expect(screen.getByTestId('measured-weight')).toHaveTextContent('624.850 kg');
    expect(screen.getByTestId('weight-difference')).toHaveTextContent('-0.150 kg');

    await user.click(screen.getByLabelText('Ubicación inicial'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Recepción / Cuarentena')).toBeInTheDocument();
    expect(within(listbox).queryByText(/Piezas/i)).not.toBeInTheDocument();
    expect(within(listbox).queryByText(/Producto terminado/i)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', {
      name: 'Confirmar recepción (API pendiente)',
    })).toBeDisabled();
  });
});
