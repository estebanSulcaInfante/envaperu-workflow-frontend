import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectKgBatchWithdrawals from '../components/DirectKgBatchWithdrawals';

const api = vi.hoisted(() => ({
  resolve: vi.fn(),
  create: vi.fn(),
  recover: vi.fn(),
  workers: vi.fn(),
}));
const actor = vi.hoisted(() => ({ id: 7, can: () => true }));

vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: actor.id, can: actor.can }) }));
vi.mock('../services/scmKgCustodyApi', () => ({
  resolveKgUnit: api.resolve,
  resolveKgOutgoingUnit: api.resolve,
  crearRetiroArmadoKgLote: api.create,
  obtenerOperacionRetiroArmadoKgLote: api.recover,
}));
vi.mock('../services/workspaceAdminApi', () => ({ listarTrabajadoresWorkspace: api.workers }));
vi.mock('../services/scmEngineeringApi', () => ({ mensajeErrorScm: (error) => error.message }));

const unit = (id, code, version = 3) => ({
  id, codigo: code, version, estado: 'ACTIVA', estado_logistico: 'DISPONIBLE_PRODUCCION',
  estado_calidad: 'LIBERADA', kg_verificados: '12.500', articulo: { codigo: 'PIEZA' },
});

const scan = async (value) => {
  const input = screen.getByLabelText('Escanear QR de manga KG');
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.getAllByText(value).length).toBeGreaterThan(0));
};

const chooseContext = async () => {
  const holder = screen.getByLabelText('Quién recibe en Armado');
  fireEvent.mouseDown(holder);
  await screen.findByText('Almacenera');
  fireEvent.click(screen.getByText('Almacenera'));
  fireEvent.change(screen.getByLabelText('Motivo operativo'), { target: { value: 'Armado turno mañana' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  actor.id = 7;
  actor.can = () => true;
  api.workers.mockResolvedValue([{ id: 9, nombre_corto: 'Almacenera', activo: true }]);
  api.resolve.mockImplementation(async (code) => ({ unit: unit(code, code) }));
  api.create.mockResolvedValue({ operation_id: 'op-1', cantidad_unidades: 1, total_kg: '12.500', retiros: [] });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const draftKey = 'scm-kg-direct-batch:/api:7:draft';
const pendingKey = 'scm-kg-direct-batch:/api:7:pending';
const confirmButton = () => screen.getByRole('button', { name: /revisar y confirmar salida|confirmar salida/i });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const sendScan = (value) => {
  const input = screen.getByLabelText('Escanear QR de manga KG');
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
};
const pendingFixture = () => {
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const intent = { key, operation_id: key, actorId: 7, body: {
    items: [{ unit_id: 'QR-1', version: 3 }], motivo_operativo: 'Armado', tenedor_fisico_id: 9,
  } };
  localStorage.setItem(pendingKey, JSON.stringify(intent));
  return intent;
};

describe('salida directa KG a Armado', () => {
  it('resuelve una manga sin enviar POST y deduplica por identidad aunque cambie el QR', async () => {
    render(<DirectKgBatchWithdrawals />);
    await scan('QR-1');
    api.resolve.mockResolvedValue({ unit: unit('QR-1', 'QR-1-alias') });
    const input = screen.getByLabelText('Escanear QR de manga KG');
    fireEvent.change(input, { target: { value: 'QR-1-alias' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.resolve).toHaveBeenCalledTimes(2));
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByText(/1 v/)).toBeVisible();
  });

  it('envía un único payload atómico después de revalidar la selección', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext();
    await scan('QR-1');
    fireEvent.click(screen.getByRole('button', { name: /revisar y confirmar salida/i }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0]).toEqual({
      items: [{ unit_id: 'QR-1', version: 3 }],
      motivo_operativo: 'Armado turno mañana',
      tenedor_fisico_id: 9,
    });
    expect(api.create.mock.calls[0][1]).toMatch(/[0-9a-f-]{36}/);
  });

  it('mantiene el conflicto visible y no confirma cuando una identidad deja de ser elegible', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext();
    await scan('QR-1');
    api.resolve.mockResolvedValueOnce({ unit: { ...unit('QR-1', 'QR-1'), estado_logistico: 'RETIRADA_ARMADO' } });
    fireEvent.click(screen.getByRole('button', { name: /revisar y confirmar salida/i }));
    await screen.findAllByText(/ya no está disponible para salida/i);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('recupera el borrador y la solicitud pendiente por actor', async () => {
    localStorage.setItem('scm-kg-direct-batch:/api:7:draft', JSON.stringify({
      context: 'ARMADO', reason: 'Guardado', holderId: 9, candidates: [{ code: 'QR-1', unit: unit('u-1', 'QR-1'), resolvedAt: '2026-10-05T00:00:00Z' }],
    }));
    localStorage.setItem('scm-kg-direct-batch:/api:7:pending', JSON.stringify({
      key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', body: { items: [] },
    }));
    render(<DirectKgBatchWithdrawals />);
    expect((await screen.findAllByText('QR-1')).length).toBeGreaterThan(0);
    expect(screen.getByText(/solicitud sin resultado confirmado/i)).toBeVisible();
    expect(screen.getByLabelText('Motivo operativo')).toHaveValue('Guardado');
  });

  it('restaura un borrador, revalida y confirma sin segundo escaneo físico', async () => {
    localStorage.setItem(draftKey, JSON.stringify({ reason: 'Guardado', holderId: 9,
      candidates: [{ code: 'QR-1', unit: unit('QR-1', 'QR-1'), status: 'ready' }] }));
    render(<DirectKgBatchWithdrawals />);
    await screen.findAllByText(/revalidar antes de confirmar/i);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.resolve).toHaveBeenCalledWith('QR-1');
  });

  it('no pierde la segunda lectura mientras se resuelve la primera', async () => {
    const first = deferred();
    api.resolve.mockImplementation((code) => code === 'QR-1' ? first.promise : Promise.resolve({ unit: unit(code, code) }));
    render(<DirectKgBatchWithdrawals />);
    sendScan('QR-1');
    expect(screen.getByLabelText('Escanear QR de manga KG')).toBeEnabled();
    sendScan('QR-2');
    await act(async () => first.resolve({ unit: unit('QR-1', 'QR-1') }));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('QR-2'));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(2));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('serializa el doble toque mientras revalida antes del POST', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    const validation = deferred();
    api.resolve.mockReturnValueOnce(validation.promise);
    const confirmElement = confirmButton();
    fireEvent.click(confirmElement); fireEvent.click(confirmElement);
    await act(async () => validation.resolve({ unit: unit('QR-1', 'QR-1') }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  });

  it('no envía ni confirma automáticamente sin red', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    fireEvent.click(confirmButton());
    await screen.findByText(/sin conexión/i);
    expect(api.create).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    fireEvent(window, new Event('online'));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('bloquea el POST si no puede persistir el intento antes de enviarlo', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    fireEvent.click(confirmButton());
    await screen.findByText(/no se pudo guardar la solicitud pendiente/i);
    expect(api.create).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'IDEMPOTENCY_OPERATION_INCOMPLETE'],
    [403, 'CAPABILITY_REQUIRED'],
    [404, 'KG_UNIT_NOT_FOUND'],
  ])('conserva la misma intención ante error ambiguo %s %s', async (status, code) => {
    api.create.mockRejectedValue({ message: 'Resultado incierto', response: { status, data: { error: { code } } } });
    render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    fireEvent.click(confirmButton());
    await screen.findByRole('button', { name: 'Recuperar' });
    await screen.findByText('Resultado incierto');
    const saved = JSON.parse(localStorage.getItem(pendingKey));
    expect(saved.key).toBe(api.create.mock.calls[0][1]);
    expect(saved.body).toEqual(api.create.mock.calls[0][0]);
    expect(confirmButton()).toBeDisabled();
  });

  it('recupera el resultado por GET tras reapertura sin repetir el POST', async () => {
    const intent = pendingFixture();
    api.recover.mockResolvedValue({ operation_id: intent.key, cantidad_unidades: 1, total_kg: '12.500', retiros: [] });
    render(<DirectKgBatchWithdrawals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recuperar' }));
    await screen.findByRole('button', { name: 'Nueva salida' });
    expect(api.recover).toHaveBeenCalledWith(intent.key);
    expect(api.create).not.toHaveBeenCalled();
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('mantiene intención si GET y POST devuelven 404 por alcance', async () => {
    const intent = pendingFixture();
    const denied = { message: 'Fuera de alcance', response: { status: 404, data: { error: { code: 'KG_UNIT_NOT_FOUND' } } } };
    api.recover.mockRejectedValue(denied); api.create.mockRejectedValue(denied);
    render(<DirectKgBatchWithdrawals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recuperar' }));
    await screen.findByText('Fuera de alcance');
    expect(JSON.parse(localStorage.getItem(pendingKey))).toEqual(intent);
    expect(api.create).toHaveBeenCalledWith(intent.body, intent.key);
  });

  it('persiste un rechazo de lectura y no lo borra silenciosamente al recargar', async () => {
    api.resolve.mockRejectedValue(new Error('Etiqueta inválida'));
    const first = render(<DirectKgBatchWithdrawals />);
    sendScan('MALA');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0].error).toBe('Etiqueta inválida'));
    first.unmount();
    render(<DirectKgBatchWithdrawals />);
    expect((await screen.findAllByRole('button', { name: 'Retirar MALA' })).length).toBeGreaterThan(0);
    expect(confirmButton()).toBeDisabled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('ignora respuesta vieja incluso tras cambiar A→B→A', async () => {
    const old = deferred(); api.resolve.mockReturnValueOnce(old.promise);
    const view = render(<DirectKgBatchWithdrawals />);
    sendScan('ANTIGUA');
    actor.id = 8; view.rerender(<DirectKgBatchWithdrawals />);
    actor.id = 7; view.rerender(<DirectKgBatchWithdrawals />);
    await act(async () => old.resolve({ unit: unit('old', 'ANTIGUA') }));
    expect(screen.queryAllByText('ANTIGUA')).toHaveLength(0);
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Motivo operativo')).toBeEnabled();
  });

  it('ignora una confirmación pendiente al cambiar A→B→A', async () => {
    const view = render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    const old = deferred(); api.resolve.mockReturnValueOnce(old.promise);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(api.resolve).toHaveBeenCalledTimes(2));
    actor.id = 8; view.rerender(<DirectKgBatchWithdrawals />);
    actor.id = 7; view.rerender(<DirectKgBatchWithdrawals />);
    await act(async () => old.resolve({ unit: unit('QR-1', 'QR-1') }));
    expect(api.create).not.toHaveBeenCalled();
    expect(localStorage.getItem(pendingKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0].status).toBe('ready');
    expect(screen.queryByText(/identidad activa cambió/i)).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it('conserva conflicto de una sola manga y permite excluirla explícitamente tras recarga', async () => {
    const view = render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1'); await scan('QR-2');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    api.resolve.mockImplementation(async (code) => ({ unit: unit(code, code, code === 'QR-2' ? 4 : 3) }));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates.some(c => c.status === 'conflict')).toBe(true));
    const saved = JSON.parse(localStorage.getItem(draftKey));
    expect(saved.candidates.find(c => c.code === 'QR-1').status).toBe('ready');
    expect(saved.candidates.find(c => c.code === 'QR-2').status).toBe('conflict');
    expect(api.create).not.toHaveBeenCalled();
    view.unmount(); render(<DirectKgBatchWithdrawals />);
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirar QR-2' })[0]);
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    fireEvent.click(confirmButton());
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0].items).toEqual([{ unit_id: 'QR-1', version: 3 }]);
  });

  it('no envía recuperación desde vista de solo lectura', async () => {
    pendingFixture(); render(<DirectKgBatchWithdrawals readOnly />);
    const recover = await screen.findByRole('button', { name: 'Recuperar' });
    fireEvent.click(recover);
    expect(api.recover).not.toHaveBeenCalled(); expect(api.create).not.toHaveBeenCalled();
  });

  it('Nueva salida limpia el comprobante anterior antes de un lote distinto', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext(); await scan('QR-1');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    fireEvent.click(confirmButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva salida' }));
    expect(screen.queryByText(/salida confirmada/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Escanear QR de manga KG')).toBeEnabled();
  });
});
