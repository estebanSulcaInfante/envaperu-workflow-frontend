import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  confirm: vi.fn(),
  status: vi.fn(),
  stations: vi.fn(),
}));

vi.mock('../services/scmPostWeighingReprintApi', () => ({
  previewPostWeighingReprint: mocks.preview,
  confirmPostWeighingReprint: mocks.confirm,
  getPostWeighingReprintRequest: mocks.status,
  listWeighingStations: mocks.stations,
}));

import PostWeighingLabelVisualization from '../components/ui/PostWeighingLabelVisualization';

const label = { public_id: '11111111-1111-4111-8111-111111111111', tipo: 'POSTPESAJE', estado: 'IMPRESA', printed_at: '2026-10-07T15:00:00Z' };
const pesaje = { public_id: '22222222-2222-4222-8222-222222222222', estado: 'VIGENTE' };

async function preparePreview(user) {
  await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Estación destino' })).not.toHaveAttribute('aria-disabled', 'true'));
  await user.click(screen.getByRole('combobox', { name: 'Estación destino' }));
  await user.click(screen.getByRole('option', { name: 'Balanza 1' }));
  await user.type(screen.getByLabelText('Motivo obligatorio'), 'Pegado en otra hoja');
  await user.click(screen.getByRole('button', { name: 'Validar vista previa' }));
  return screen.findByRole('button', { name: 'Confirmar reimpresión' });
}

describe('visualización compartida de etiqueta POSTPESAJE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.stations.mockResolvedValue({ items: [{ station_id: 'station-1', codigo: 'Balanza 1' }] });
    mocks.preview.mockResolvedValue({
      preview_digest: 'digest-1',
      total_copias: 2,
      renderer_version: 'POSTPESAJE_COPY_TSPL_1',
      items: [{ source_label_id: '11111111-1111-4111-8111-111111111111', weighing_id: '22222222-2222-4222-8222-222222222222', manga_codigo: 'M-001', copias: 2, source_payload: { peso_neto_kg: 12.4 } }],
    });
    mocks.confirm.mockResolvedValue({
      request_id: 'request-1',
      estado: 'QUEUED',
      jobs: [{ id: 'job-1', estado: 'QUEUED' }],
    });
  });

  it('valida destino/motivo, confirma una sola vez y distingue cola de entrega física', async () => {
    const user = userEvent.setup();
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint stationId="station-1" />);

    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    await waitFor(() => expect(mocks.stations).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Estación destino' })).not.toHaveAttribute('aria-disabled', 'true'));
    await user.click(screen.getByRole('combobox', { name: 'Estación destino' }));
    await user.click(screen.getByRole('option', { name: 'Balanza 1' }));
    await user.clear(screen.getByLabelText('Copias'));
    await user.type(screen.getByLabelText('Copias'), '2');
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Etiqueta dañada');
    expect(screen.getByRole('button', { name: 'Validar vista previa' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Validar vista previa' }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      items: [{ pesaje_id: '22222222-2222-4222-8222-222222222222', source_label_id: '11111111-1111-4111-8111-111111111111', copias: 2 }],
      station_id: 'station-1',
    }));

    const confirm = await screen.findByRole('button', { name: 'Confirmar reimpresión' });
    await user.dblClick(confirm);
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ pesaje_id: '22222222-2222-4222-8222-222222222222', source_label_id: '11111111-1111-4111-8111-111111111111', copias: 2 }],
      station_id: 'station-1',
      motivo: 'Etiqueta dañada',
      preview_digest: 'digest-1',
      operation_id: expect.any(String),
    }), expect.any(String));
    expect(await screen.findByText(/no confirma que el papel haya sido entregado/i)).toBeVisible();
  });

  it('cerrar antes de validar no crea preview ni confirmación', async () => {
    const user = userEvent.setup();
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint />);
    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('timeout y remontaje recuperan exactamente la misma operación y cuerpo', async () => {
    const user = userEvent.setup();
    mocks.confirm.mockRejectedValueOnce(new Error('timeout'));
    const first = render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint actorId={5} />);
    await user.click(await preparePreview(user));
    await screen.findByRole('button', { name: 'Recuperar solicitud' });
    const originalCall = mocks.confirm.mock.calls[0];
    first.unmount();
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint actorId={5} />);
    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    expect(screen.getByLabelText('Motivo obligatorio')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Recuperar solicitud' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(2));
    expect(mocks.confirm.mock.calls[1]).toEqual(originalCall);
  });

  it('cambio de cantidad invalida la vista previa', async () => {
    const user = userEvent.setup();
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint />);
    await preparePreview(user);
    await user.clear(screen.getByLabelText('Copias'));
    await user.type(screen.getByLabelText('Copias'), '3');
    expect(screen.queryByRole('button', { name: 'Confirmar reimpresión' })).not.toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('fuente cambiada ignora respuesta vieja y no hereda operación', async () => {
    const user = userEvent.setup();
    let resolve;
    mocks.preview.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint actorId={5} />);
    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Estación destino' })).not.toHaveAttribute('aria-disabled', 'true'));
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Fuente anterior');
    await user.click(screen.getByRole('combobox', { name: 'Estación destino' }));
    await user.click(screen.getByRole('option', { name: 'Balanza 1' }));
    await user.click(screen.getByRole('button', { name: 'Validar vista previa' }));
    view.rerender(<PostWeighingLabelVisualization label={{ ...label, public_id: '33333333-3333-4333-8333-333333333333' }} pesaje={pesaje} canReprint actorId={5} />);
    await act(async () => resolve({ preview_digest: 'old', items: [] }));
    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    expect(screen.getByLabelText('Motivo obligatorio')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Confirmar reimpresión' })).not.toBeInTheDocument();
  });

  it('un actor diferente no hereda una operación incierta', async () => {
    const user = userEvent.setup();
    mocks.confirm.mockRejectedValueOnce(new Error('timeout'));
    const view = render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint actorId={5} />);
    await user.click(await preparePreview(user));
    await screen.findByRole('button', { name: 'Recuperar solicitud' });
    view.rerender(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint actorId={2} />);
    await user.click(screen.getByRole('button', { name: 'Solicitar reimpresión' }));
    expect(screen.getByLabelText('Motivo obligatorio')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Recuperar solicitud' })).not.toBeInTheDocument();
  });

  it('sin permiso y fuente anulada no permiten solicitar', () => {
    const view = render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} />);
    expect(screen.queryByRole('button', { name: 'Solicitar reimpresión' })).not.toBeInTheDocument();
    view.rerender(<PostWeighingLabelVisualization label={{ ...label, estado: 'INVALIDADA' }} pesaje={pesaje} canReprint />);
    expect(screen.getByRole('button', { name: 'Solicitar reimpresión' })).toBeDisabled();
  });
  it('no ofrece nueva solicitud si confirmar no devuelve una cola conocida', async () => {
    const user = userEvent.setup();
    mocks.confirm.mockResolvedValueOnce({ request_id: 'request-unknown', estado: 'RECIBIDO_SIN_COLA' });
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint />);
    await user.click(await preparePreview(user));
    await waitFor(() => expect(screen.getByText(/no confirm/i)).toBeVisible());
    expect(screen.queryByRole('button', { name: 'Nueva solicitud' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeVisible();
  });

  it('no usa una estación implícita si el destino recibido ya no está en catálogo', async () => {
    const user = userEvent.setup();
    render(<PostWeighingLabelVisualization label={label} pesaje={pesaje} canReprint stationId="station-retirada" />);
    await user.click(screen.getByRole('button', { name: /Solicitar reimpresi/ }));
    await waitFor(() => expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByRole('button', { name: 'Validar vista previa' })).toBeDisabled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
