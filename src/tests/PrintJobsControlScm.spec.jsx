import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrintJobsControlScm from '../components/PrintJobsControlScm';
import { listarTrabajosImpresionControlScm } from '../services/scmPrintJobsControlApi';

vi.mock('../services/scmPrintJobsControlApi', () => ({
  listarTrabajosImpresionControlScm: vi.fn(),
}));
vi.mock('../utils/scmPrintPreview', () => ({
  buildScmPrelabelPreviewUrl: (id) => 'http://127.0.0.1:5050/?job=' + id,
}));

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}><PrintJobsControlScm /></ThemeProvider>,
);

describe('Control de impresión y etiquetas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarTrabajosImpresionControlScm.mockResolvedValue({
      as_of: '2026-08-10T15:00:00Z',
      items: [{
        print_job_id: 'job-1',
        status: 'PENDING',
        created_at: '2026-08-10T14:00:00Z',
        station_id: null,
        labels: [{
          public_id: 'label-1', manga_codigo: 'MANGA-001',
          tipo: 'PREPESAJE', estado: 'GENERADA',
        }],
      }],
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('distingue supervisi?n central de impresión física', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'MANGA-001' })).toBeVisible();
    expect(screen.getByText(/Vista de solo lectura/i)).toBeVisible();
    expect(screen.getByText(/Sin estación 1/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Abrir vista previa/i }));
    expect(window.open).toHaveBeenCalledWith(
      'http://127.0.0.1:5050/?job=job-1', '_blank', 'noopener,noreferrer',
    );
  });

  it('carga pendientes de la central por defecto', async () => {
    renderPage();
    await waitFor(() => expect(listarTrabajosImpresionControlScm)
      .toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' })));
  });
});
