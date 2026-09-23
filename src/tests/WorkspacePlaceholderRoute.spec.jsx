import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkspacePlaceholderRoute from '../components/WorkspacePlaceholderRoute';
import LockedFeaturePage from '../components/LockedFeaturePage';

let actorState;

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => actorState,
}));

const renderRoute = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={['/control/auditoria-hojas']}>
      <WorkspacePlaceholderRoute featureKey="control.sheetAudit">
        <div>Vista OCR montada</div>
      </WorkspacePlaceholderRoute>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('CTRL-OCR-02: placeholder de Auditoría de hojas', () => {
  it('muestra la frontera informativa sin montar OCR ni mutaciones', () => {
    actorState = {
      actor: { nombre_corto: 'Supervisor' },
      canAny: (required) => required.includes('OT_VER'),
      error: '',
      loading: false,
      refreshActors: vi.fn(),
    };

    renderRoute();

    expect(screen.queryByText('Vista OCR montada')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Auditoría de hojas' })).toBeVisible();
    expect(screen.getByText('Fuera del piloto')).toBeVisible();
    expect(screen.getByText(/OCR futuro/i)).toBeVisible();
    expect(screen.getByText(/códigos visibles/i)).toBeVisible();
    expect(screen.getByText(/conciliación por OT/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a Supervisión de producción' }))
      .toHaveAttribute('href', '/control/supervision-produccion');
    expect(screen.getByRole('link', { name: 'Consultar la guía del piloto' }))
      .toHaveAttribute('href', '/guia/scm');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /procesar|guardar|subir|cargar/i }))
      .not.toBeInTheDocument();
  });

  it('reutiliza el patrón con una metadata de placeholder que no es OCR', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <LockedFeaturePage
            feature={{
              label: 'Resumen de diferencias',
              placeholder: {
                areaLabel: 'Inventario',
                contextLabel: 'consulta informativa',
                summary: 'Esta consulta se reserva para una etapa posterior.',
                limitations: 'No consulta ni modifica registros en esta versión.',
                reason: 'La función aún no está habilitada.',
                returnPath: '/control',
                returnLabel: 'Volver a Control',
                guidePath: '/guia/scm',
                guideLabel: 'Abrir guía',
              },
            }}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText('Inventario · consulta informativa')).toBeVisible();
    expect(screen.getByText(/No consulta ni modifica registros/)).toBeVisible();
    expect(screen.queryByText(/OCR|fotos/i)).not.toBeInTheDocument();
  });

  it('conserva la guarda de capacidad antes de comunicar fuera del piloto', () => {
    actorState = {
      actor: { nombre_corto: 'Perfil sin OT' },
      canAny: () => false,
      error: '',
      loading: false,
      refreshActors: vi.fn(),
    };

    renderRoute();

    expect(screen.getByText('Esta vista no corresponde a tu función')).toBeVisible();
    expect(screen.queryByText('Fuera del piloto')).not.toBeInTheDocument();
    expect(screen.queryByText(/OCR futuro/i)).not.toBeInTheDocument();
  });
});
