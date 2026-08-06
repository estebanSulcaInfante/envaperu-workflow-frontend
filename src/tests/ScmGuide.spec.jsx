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
  it('se presenta como manual de consulta para el usuario final', () => {
    const { container } = renderGuide();

    expect(screen.getByRole('heading', { name: 'Documentación oficial SCM' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cómo utilizar esta guía' })).toBeInTheDocument();
    expect(screen.getByText('Disponible en piloto', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Permiso requerido', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conceptos y elementos' })).toBeInTheDocument();
    expect(screen.getByText('Procedimiento recomendado')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/mock|demostración|modo reunión/i);
  });

  it('documenta la planificación y enlaza la pantalla operativa', async () => {
    const user = userEvent.setup();
    renderGuide();

    await user.click(screen.getByTestId('guide-stage-planificacion'));

    expect(screen.getByRole('heading', { name: 'OP, cobertura y planificación' })).toBeInTheDocument();
    expect(screen.getByText(/Calcular no reserva ni consume inventario/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir planificación' })).toHaveAttribute('href', '/planificacion');
  });

  it('explica perfiles, reglas de empaque y tolerancia de tara', () => {
    renderGuide('/guia/scm?etapa=catalogos');

    expect(screen.getByRole('heading', { name: 'Perfil empacable' })).toBeInTheDocument();
    expect(screen.getByText(/cómo se acomoda físicamente el artículo/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regla de empaque' })).toBeInTheDocument();
    expect(screen.getByText(/combina un perfil empacable con un tipo de manga/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tolerancia de tara' })).toBeInTheDocument();
    expect(screen.getByText(/tara real distinta requiere autorización y motivo/i)).toBeInTheDocument();
    expect(screen.getByText(/peso controla tolerancias, pero nunca determina/i)).toBeInTheDocument();
    expect(screen.getByText(/cantidad por empaque no se registra en el producto terminado/i)).toBeInTheDocument();
    expect(screen.getByText(/unidades por paquete y por bulto no forman parte/i)).toBeInTheDocument();
  });

  it('ofrece búsqueda y referencia oficial para Artículos SCM y BOM multinivel', async () => {
    const user = userEvent.setup();
    renderGuide();

    const search = screen.getByRole('textbox', { name: 'Buscar en la documentación' });
    await user.type(search, 'ciclos indirectos');
    expect(screen.getByRole('button', { name: /Maestros e imágenes/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Maestros e imágenes/i }));

    expect(screen.getByRole('heading', { name: 'Mindset de Artículo SCM' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cómo usar una BOM multinivel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Protecciones contra inconsistencias' })).toBeInTheDocument();
    expect(screen.getByText(/si el estado intermedio puede recibirse/i)).toBeInTheDocument();
  });

  it('documenta los roles y diferencia pesaje de mangas de molienda', () => {
    renderGuide('/guia/scm?etapa=participantes');

    expect(screen.getByRole('heading', { name: 'Participantes, roles y permisos' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Roles y permisos del piloto' })).toBeInTheDocument();
    expect(screen.getByText('OPERADOR_PESAJE')).toBeInTheDocument();
    expect(screen.getByText(/Pesaje de mangas de fabricación y PT/i)).toBeInTheDocument();
    expect(screen.getByText('OPERADOR_MOLINO')).toBeInTheDocument();
  });

  it('separa recepción, Calidad y preparación de materias primas', async () => {
    const user = userEvent.setup();
    renderGuide('/guia/scm?etapa=recepcion');

    expect(screen.getByRole('heading', { name: 'Recepción y Calidad de materias primas' })).toBeInTheDocument();
    expect(screen.getByText(/Recibir físicamente no vuelve disponible el material/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir recepciones' })).toHaveAttribute(
      'href',
      '/materiales/recepciones',
    );

    await user.click(screen.getByTestId('guide-stage-preparacion'));
    expect(screen.getByRole('heading', { name: 'Reserva, emisión y premezcla' })).toBeInTheDocument();
  });

  it('distingue pesaje, armado, corrección y merma', async () => {
    const user = userEvent.setup();
    renderGuide('/guia/scm?etapa=pesaje');

    expect(screen.getByRole('heading', { name: 'Pesaje y postetiqueta' })).toBeInTheDocument();
    expect(screen.getByText(/cubre mangas de fabricación y PT/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir histórico de pesajes' })).toHaveAttribute(
      'href',
      '/produccion/pesajes',
    );

    await user.click(screen.getByRole('button', { name: 'Armado' }));
    expect(screen.getByRole('heading', { name: 'Prearmado, armado y cierre de mangas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modalidad diaria' })).toBeInTheDocument();

    await user.click(screen.getByTestId('guide-stage-correcciones'));
    expect(screen.getByText(/primero debe ejecutarse la reversa de recepción/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('guide-stage-reproceso'));
    expect(screen.getByText(/no utiliza el rol OPERADOR_PESAJE/i)).toBeInTheDocument();
  });
});
