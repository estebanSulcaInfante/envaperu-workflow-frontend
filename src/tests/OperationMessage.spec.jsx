import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import { FeedbackProvider, useOperationFeedback } from '../context/FeedbackContext';
import { useOperationMessage } from '../utils/operationFeedbackState';
import { it, expect } from 'vitest';
import { useLayoutEffect } from 'react';
import OperationNotice from '../components/ui/OperationNotice';

let oldClear;
function Fields() {
  const [error, setError] = useOperationMessage('example:load');
  const [, setOther] = useOperationMessage('example:other');
  useLayoutEffect(() => { oldClear = () => setError(''); });
  return <>
    <input aria-label="Borrador" defaultValue="Conservar" />
    <button onClick={() => setError('No se pudo cargar')}>Fallar</button>
    <button onClick={() => setOther('Otro resultado pendiente')}>Otro</button>
    <button onClick={() => setError('')}>Recuperar</button>
    <button onClick={() => setError((previous) => `${previous || 'Control'} corregido`)}>Actualizar</button>
    <output data-testid="local-error">{error}</output>
  </>;
}
function Rich() {
  const { notify } = useOperationFeedback('rich-test');
  return <>
    <button onClick={() => {
      notify(<strong>Primer informe</strong>, { action: <button>Revisar primero</button> });
      notify(<strong>Segundo informe</strong>, { action: <button>Revisar segundo</button> });
    }}>Informes</button>
    <button onClick={() => notify(<strong>Informe actualizado</strong>, { key: 'specific', severity: 'warning' })}>Específico</button>
  </>;
}
function App({ scope = 'a', children = <Fields /> }) {
  return <ThemeProvider theme={createTheme()}><FeedbackProvider scopeKey={scope}>{children}</FeedbackProvider></ThemeProvider>;
}

it('retira solo el fallo recuperado y conserva borrador y otro resultado pendiente', async () => {
  render(<App />);
  fireEvent.click(screen.getByText('Fallar'));
  fireEvent.click(screen.getByText('Otro'));
  expect(await screen.findByRole('alert', { name: 'No se pudo cargar' })).toBeVisible();
  fireEvent.click(screen.getByText('Recuperar'));
  await waitFor(() => expect(screen.queryByRole('alert', { name: 'No se pudo cargar' })).not.toBeInTheDocument());
  expect(screen.getByRole('alert', { name: 'Otro resultado pendiente' })).toBeVisible();
  expect(screen.getByLabelText('Borrador')).toHaveValue('Conservar');
});

it('permite cerrar y repetir el mismo error, y conserva actualizadores funcionales', async () => {
  render(<App />);
  fireEvent.click(screen.getByText('Fallar'));
  const alert = await screen.findByRole('alert', { name: 'No se pudo cargar' });
  fireEvent.click(within(alert).getByLabelText('Cerrar notificación'));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByTestId('local-error')).toHaveTextContent('No se pudo cargar');
  fireEvent.click(screen.getByText('Fallar'));
  expect(await screen.findByRole('alert', { name: 'No se pudo cargar' })).toBeVisible();
  fireEvent.click(screen.getByText('Actualizar'));
  expect(await screen.findByRole('alert', { name: 'No se pudo cargar corregido' })).toBeVisible();
});

it('mantiene canales independientes para dos instancias del mismo formulario', async () => {
  function Row({ name }) {
    const [, setError] = useOperationMessage('same-form');
    return <>
      <button onClick={() => setError(`Fallo ${name}`)}>Fallar {name}</button>
      <button onClick={() => setError('')}>Recuperar {name}</button>
    </>;
  }
  render(<App><Row name="A" /><Row name="B" /></App>);
  fireEvent.click(screen.getByText('Fallar A'));
  fireEvent.click(screen.getByText('Fallar B'));
  expect(await screen.findByRole('alert', { name: 'Fallo A' })).toBeVisible();
  expect(screen.getByRole('alert', { name: 'Fallo B' })).toBeVisible();
  fireEvent.click(screen.getByText('Recuperar A'));
  await waitFor(() => expect(screen.queryByRole('alert', { name: 'Fallo A' })).not.toBeInTheDocument());
  expect(screen.getByRole('alert', { name: 'Fallo B' })).toBeVisible();
});

it('retira avisos de resultados externos al recuperarse sin repetirlos al navegar', async () => {
  const { rerender } = render(<App scope="a"><OperationNotice message="Fallo externo" /></App>);
  expect(await screen.findByRole('alert', { name: 'Fallo externo' })).toBeVisible();
  rerender(<App scope="b"><OperationNotice message="Fallo externo" /></App>);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  rerender(<App scope="b"><OperationNotice message="Otro fallo" /></App>);
  expect(await screen.findByRole('alert', { name: 'Otro fallo' })).toBeVisible();
  rerender(<App scope="b"><OperationNotice message="" /></App>);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('no reemite al cambiar el contexto y un callback antiguo no borra el nuevo error', async () => {
  const { rerender } = render(<App scope="a" />);
  fireEvent.click(screen.getByText('Fallar'));
  await screen.findByRole('alert', { name: 'No se pudo cargar' });
  const clearPrevious = oldClear;
  rerender(<App scope="b" />);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  fireEvent.click(screen.getByText('Fallar'));
  expect(await screen.findByRole('alert', { name: 'No se pudo cargar' })).toBeVisible();
  act(() => clearPrevious());
  expect(screen.getByRole('alert', { name: 'No se pudo cargar' })).toBeVisible();
  fireEvent.click(screen.getByText('Recuperar'));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('retiene dos mensajes JSX y sus acciones, y deduplica solo una clave explícita', async () => {
  render(<App><Rich /></App>);
  fireEvent.click(screen.getByText('Informes'));
  expect(await screen.findByRole('alert', { name: 'Primer informe' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Revisar primero' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Revisar segundo' })).toBeVisible();
  fireEvent.click(screen.getByText('Específico'));
  fireEvent.click(screen.getByText('Específico'));
  expect(screen.getAllByRole('alert', { name: 'Informe actualizado' })).toHaveLength(1);
  expect(screen.getByRole('alert', { name: 'Segundo informe' })).toBeVisible();
});
