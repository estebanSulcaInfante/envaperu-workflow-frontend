import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OnboardingImagePanel from '../components/productOnboarding/OnboardingImagePanel';

const renderPanel = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <OnboardingImagePanel
      title="Imagen del Producto Terminado"
      targets={[{
        key: 'PRODUCTO_TERMINADO:PT',
        entityType: 'PRODUCTO_TERMINADO',
        entityId: null,
        label: 'COLADOR #3',
      }]}
      entries={{}}
      onSelect={vi.fn()}
      onRetry={vi.fn()}
      {...props}
    />
  </ThemeProvider>,
);

describe('imágenes de la alta integral', () => {
  it('conserva el archivo sólo en la pestaña hasta resolver la entidad', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onSelect });
    const file = new File(['webp'], 'colador.webp', { type: 'image/webp' });

    await user.upload(screen.getByLabelText(/Seleccionar imagen de COLADOR #3/i), file);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'PRODUCTO_TERMINADO:PT' }),
      file,
    );
    expect(screen.getByText(/solo en esta pestaña hasta aplicar/i)).toBeVisible();
  });

  it('rechaza tipo o peso fuera de contrato antes de llamar a la API', async () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });

    fireEvent.change(screen.getByLabelText(/Seleccionar imagen de COLADOR #3/i), {
      target: { files: [new File(['texto'], 'notas.txt', { type: 'text/plain' })] },
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/JPEG, PNG o WEBP/i);
  });

  it('muestra error retryable y una imagen ya persistida sin base64', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderPanel({
      targets: [{
        key: 'PIEZA_COLOR:41:12', entityType: 'PIEZA_COLOR', entityId: 11,
        label: 'CUERPO COLADOR · AZUL',
        existingImage: { imagen_url: 'https://cdn.example/pieza-color.webp' },
      }],
      entries: {
        'PIEZA_COLOR:41:12': {
          status: 'ERROR', error: 'La red se interrumpió.',
          file: new File(['webp'], 'pieza.webp', { type: 'image/webp' }),
        },
      },
      onRetry,
    });

    expect(screen.getByRole('img', { name: /CUERPO COLADOR.*AZUL/i }))
      .toHaveAttribute('src', 'https://cdn.example/pieza-color.webp');
    expect(screen.getByText(/La red se interrumpió/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Reintentar subida/i }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ entityId: 11 }));
  });
});
