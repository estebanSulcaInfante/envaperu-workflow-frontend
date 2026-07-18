import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import ScmGuide from '../components/ScmGuide';

const renderGuide = (path = '/guia/scm') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guia/scm" element={<ScmGuide />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('Guía operativa SCM', () => {
  it('explica cómo interpretar mocks, candados, estados y eventos', () => {
    renderGuide();

    expect(screen.getByRole('heading', { name: 'Guía operativa SCM' })).toBeInTheDocument();
    expect(screen.getByText('Datos mock', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Candado', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('Recepción')).toBeInTheDocument();
    expect(screen.getByText('Entradas independientes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anatomía de la pantalla' })).toBeInTheDocument();
  });

  it('abre la etapa de planificación y enlaza el escenario demostrable', async () => {
    const user = userEvent.setup();
    renderGuide();

    await user.click(screen.getByTestId('guide-stage-planificacion'));

    expect(screen.getByRole('heading', { name: 'Planificación de demanda' })).toBeInTheDocument();
    expect(screen.getByText(/Crear o calcular una planificación no reserva materia prima/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir escenario SP-00041' })).toHaveAttribute('href', '/planificacion/SP-00041');
  });

  it('documenta la liberación parcial de recepción', async () => {
    const user = userEvent.setup();
    renderGuide('/guia/scm?etapa=recepcion');

    expect(screen.getByRole('heading', { name: 'Recepción y calidad' })).toBeInTheDocument();
    expect(screen.getByText(/625 kg recibidos, 400 kg liberados y 225 kg aún en cuarentena/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir liberación parcial REC-000183' })).toHaveAttribute(
      'href',
      '/materiales/recepciones/REC-000183',
    );

    await user.click(screen.getByTestId('guide-stage-preparacion'));
    expect(screen.getByRole('heading', { name: 'Reserva y preparación de materiales' })).toBeInTheDocument();
  });

  it('abre el monitor temporal de pesaje y mantiene bloqueadas las fases futuras', async () => {
    const user = userEvent.setup();
    renderGuide('/guia/scm?etapa=pesaje');

    expect(screen.getByRole('heading', { name: 'Pesaje, empaque y material recuperado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir avance por pesajes' })).toHaveAttribute(
      'href',
      '/pesaje/avance',
    );
    expect(screen.getByText(/Fuente autoritativa de OC, proveedores, inventario/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Armado' }));
    expect(screen.getByRole('heading', { name: 'Armado, despacho y consulta trazable' })).toBeInTheDocument();
  });
});
