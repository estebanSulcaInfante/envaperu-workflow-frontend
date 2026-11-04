import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider, useFeedback } from '../context/FeedbackContext';

function Trigger() {
  const { notify } = useFeedback();
  return (
    <>
      <button type="button" onClick={() => notify({ message: 'Fallo persistente', severity: 'error', key: 'same' })}>Error</button>
      <button type="button" onClick={() => notify({ message: 'Guardado', severity: 'success', key: 'success' })}>Éxito</button>
      <button type="button" onClick={() => notify({ message: 'Reintenta actualizar', severity: 'warning', persistent: true, key: 'recovery' })}>Recuperación</button>
      <button type="button" onClick={() => notify({ message: 'Guardado breve', severity: 'success', autoHideDuration: 50, key: 'brief-success' })}>Éxito breve</button>
      <button type="button" onClick={() => notify({ message: 'Segundo error', severity: 'error', key: 'other' })}>Otro error</button>
      <button type="button" onClick={() => [1, 2, 3, 4].forEach((value) => notify({ message: `Error ${value}`, severity: 'error', key: `many-${value}` }))}>Cuatro errores</button>
    </>
  );
}

const renderFeedback = () => render(
  <ThemeProvider theme={createTheme()}>
    <FeedbackProvider><Trigger /></FeedbackProvider>
  </ThemeProvider>,
);

describe('FeedbackProvider', () => {
  it('keeps operational failures persistent and dismissible', async () => {
    const user = userEvent.setup();
    renderFeedback();
    await user.click(screen.getByRole('button', { name: 'Error' }));
    const alert = await screen.findByRole('alert', { name: /Fallo persistente/ });
    expect(alert).toBeVisible();
    expect(within(alert).getByRole('button', { name: 'Cerrar notificación' })).toBeVisible();
    await user.click(within(alert).getByRole('button', { name: 'Cerrar notificación' }));
    expect(screen.queryByText('Fallo persistente')).not.toBeInTheDocument();
  });

  it('does not overlap duplicate errors and preserves competing messages', async () => {
    const user = userEvent.setup();
    renderFeedback();
    await user.click(screen.getByRole('button', { name: 'Error' }));
    await user.click(screen.getByRole('button', { name: 'Error' }));
    await user.click(screen.getByRole('button', { name: 'Otro error' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('Fallo persistente')).toBeVisible();
    expect(screen.getByText('Segundo error')).toBeVisible();
  });

  it('uses temporal polite feedback for routine success', async () => {
    const user = userEvent.setup();
    renderFeedback();
    await user.click(screen.getByRole('button', { name: 'Éxito' }));
    const status = await screen.findByRole('status', { name: /Guardado/ });
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.closest('[data-testid="feedback-notification-area"]')).toHaveStyle({ zIndex: '1301' });
  });

  it('keeps explicit recovery warnings persistent while routine success expires', async () => {
    const user = userEvent.setup();
    renderFeedback();
    await user.click(screen.getByRole('button', { name: 'Recuperación' }));
    expect(await screen.findByRole('alert', { name: /Reintenta actualizar/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Éxito breve' }));
    expect(await screen.findByRole('status', { name: /Guardado breve/ })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('status', { name: /Guardado breve/ })).not.toBeInTheDocument(), { timeout: 500 });
    expect(screen.getByRole('alert', { name: /Reintenta actualizar/ })).toBeVisible();
  });

  it('retains competing recoverable items within the bounded notification area', async () => {
    const user = userEvent.setup();
    renderFeedback();
    await user.click(screen.getByRole('button', { name: 'Cuatro errores' }));
    expect(await screen.findAllByRole('alert')).toHaveLength(4);
    expect(screen.getByTestId('feedback-notification-area')).toHaveStyle({ maxHeight: 'calc(100dvh - 24px)' });
  });

  it('uses the visible topmost dialog host for accessible announcements', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={createTheme()}>
        <FeedbackProvider>
          <Dialog open><DialogContent><Trigger /></DialogContent></Dialog>
        </FeedbackProvider>
      </ThemeProvider>,
    );
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('[data-testid="feedback-notification-area"]')).not.toBeNull());
    await user.click(within(dialog).getByRole('button', { name: 'Error' }));
    expect(within(dialog).getByRole('alert', { name: /Fallo persistente/ })).toBeVisible();
  });

  it('clears notifications on scope changes without remounting the stateful child', async () => {
    const user = userEvent.setup();
    let mounts = 0;
    function StatefulTrigger() {
      useEffect(() => { mounts += 1; }, []);
      return <Trigger />;
    }
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <FeedbackProvider scopeKey="actor-1:/ot?gq=a"><StatefulTrigger /></FeedbackProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(mounts).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Error' }));
    expect(screen.getByText('Fallo persistente')).toBeVisible();
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <FeedbackProvider scopeKey="actor-2:/ot?gq=b"><StatefulTrigger /></FeedbackProvider>
      </ThemeProvider>,
    );
    expect(mounts).toBe(1);
    await waitFor(() => expect(screen.queryByText('Fallo persistente')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Error' }));
    expect(screen.getByText('Fallo persistente')).toBeVisible();
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <FeedbackProvider scopeKey="actor-1:/ot?gq=a"><StatefulTrigger /></FeedbackProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Fallo persistente')).not.toBeInTheDocument());
  });
});
