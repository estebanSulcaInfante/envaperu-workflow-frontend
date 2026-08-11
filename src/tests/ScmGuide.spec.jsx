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
    expect(container.textContent).not.toMatch(/ensambl/i);
  });

  it('documenta la planificación y enlaza la pantalla operativa', async () => {
    const user = userEvent.setup();
    renderGuide();

    await user.click(screen.getByTestId('guide-stage-planificacion'));

    expect(screen.getByRole('heading', { name: 'OP, cobertura y planificación' })).toBeInTheDocument();
    expect(screen.getByText(/Calcular no reserva ni consume inventario/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: 'Antes de crear una OP: fuente, datos y derivados',
    })).toBeInTheDocument();
    expect(screen.getByText(/no se crea una OP sin cantidad autorizada/i)).toBeInTheDocument();
    expect(screen.getByText(/la fecha de necesidad no es una fecha de inicio prometida/i))
      .toBeInTheDocument();
    expect(screen.getByText(/El sistema deriva las unidades equivalentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Responsable cuando falta un dato/i)).toBeInTheDocument();
    expect(screen.getAllByText(/corregir maestro → actualizar ingeniería de la OP → recalcular/i))
      .not.toHaveLength(0);
    expect(screen.getAllByText(/Recalcular por sí solo nunca adopta revisiones nuevas/i))
      .not.toHaveLength(0);
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
    expect(screen.getByText(/Pieza-color y un producto terminado.*misma estructura física.*compartir el perfil/i))
      .toBeInTheDocument();
    expect(screen.getByText(/supervisor debe validar físicamente.*antes de publicar/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Jornadas informa que falta el perfil.*código exacto del artículo/i))
      .toBeInTheDocument();
    expect(screen.getByText(/unidades por paquete y por bulto no forman parte/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Presentación comercial' })).toBeInTheDocument();
    expect(screen.getByText(/10 Pack x6 se planifican como 60 UN/i)).toBeInTheDocument();
  });

  it('ofrece accesos directos para completar el recorrido de alta hasta mangas', () => {
    renderGuide('/guia/scm?etapa=catalogos');

    expect(screen.getByRole('heading', {
      name: 'Recorrido canónico: alta integral del PT y luego operación',
    })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alta integral de producto' })).toHaveAttribute(
      'href',
      '/datos-maestros/alta-producto',
    );
    expect(screen.getByRole('link', { name: 'Mantenimiento especializado de BOM' })).toHaveAttribute(
      'href',
      '/datos-maestros/ingenieria-scm?tab=estructuras',
    );
    expect(screen.getByRole('link', { name: 'Mantenimiento especializado de ruta' })).toHaveAttribute(
      'href',
      '/datos-maestros/ingenieria-scm?tab=rutas',
    );
    expect(screen.getByRole('heading', {
      name: 'Alta integral: interfaz principal para un producto nuevo',
    })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planificar OP' })).toHaveAttribute(
      'href',
      '/planificacion',
    );
    expect(screen.getByRole('link', { name: 'Crear OT y mangas' })).toHaveAttribute(
      'href',
      '/produccion/ots-planta',
    );
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

  it('explica OT de máquina, Trabajos de color, relevos y frontera del piloto', () => {
    const { container } = renderGuide('/guia/scm?etapa=produccion');

    expect(screen.getByRole('heading', {
      name: 'OTs de planta: Fabricación y Armado',
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tres niveles de la ejecución' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cambio y retorno de color: A → B → A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asignación de mangas y relevo supervisado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frontera del piloto' })).toBeInTheDocument();
    expect(screen.getByText(/no digita OF, color, cantidad, fecha ni su nombre/i)).toBeInTheDocument();
    expect(screen.getByText(/manga abierta o incompleta se transfiere individualmente/i)).toBeInTheDocument();
    expect(screen.getByText(/conteo de frontera documenta el traspaso físico: no es un pesaje intermedio/i)).toBeInTheDocument();
    expect(screen.getByText(/manga ya cerrada del Trabajo A puede pesarse mientras A está pausado/i)).toBeInTheDocument();
    expect(screen.getByText(/No se transfiere una manga de una OT diaria/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Fabricación mediante OP\s*\/\s*OT/i);
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
