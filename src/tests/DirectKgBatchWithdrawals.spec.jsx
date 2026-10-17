import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectKgBatchWithdrawals from '../components/DirectKgBatchWithdrawals';

const api = vi.hoisted(() => ({
  resolve: vi.fn(),
  create: vi.fn(),
  recover: vi.fn(),
  workers: vi.fn(),
}));
const actor = vi.hoisted(() => ({ id: 7, can: () => true }));
const audio = vi.hoisted(() => ({ status: 'ready', play: vi.fn(), activate: vi.fn() }));
vi.mock('../services/scmScanAudio', () => ({
  activateScanAudio: audio.activate,
  getScanAudioStatus: () => audio.status,
  subscribeScanAudio: (listener) => { listener(audio.status); return () => {}; },
  playScanFeedback: audio.play,
}));

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
  identidad: { m: `OF-${code}-OT-${code}-M-${code}` },
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
  audio.status = 'ready'; audio.activate.mockResolvedValue(true);
  audio.play.mockReturnValue(true);
  api.workers.mockResolvedValue([{ id: 9, nombre_corto: 'Almacenera', activo: true }]);
  api.resolve.mockImplementation(async (code) => ({ unit: unit(code, code) }));
  api.create.mockResolvedValue({ operation_id: 'op-1', cantidad_unidades: 1, total_kg: '12.500', retiros: [] });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const draftKey = 'scm-kg-direct-batch:/api:7:draft';
const pendingKey = 'scm-kg-direct-batch:/api:7:pending';
const confirmButton = () => screen.getByRole('button', { name: /revisar y confirmar salida|confirmar salida|validando y confirmando|validando lecturas/i });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
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
  it('deduplica lecturas repetidas del mismo código rechazado y conserva recuperación', async () => {
    api.resolve.mockRejectedValue(new Error('Etiqueta no encontrada'));
    render(<DirectKgBatchWithdrawals />);

    await scan('QR-RECHAZADO');
    const list = screen.getByRole('list', { name: 'Lecturas pendientes' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(api.resolve).toHaveBeenCalledTimes(1);

    sendScan('QR-RECHAZADO');
    sendScan('QR-RECHAZADO');

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ya tiene un error pendiente/i)).toBeVisible();
    expect(within(list).getByRole('button', { name: 'Reintentar QR-RECHAZADO' })).toBeVisible();
    expect(audio.play.mock.calls.filter(([kind]) => kind === 'duplicate')).toHaveLength(2);
  });

  it('reintenta una identidad conocida que recupera su elegibilidad', async () => {
    api.resolve.mockResolvedValueOnce({ unit: { ...unit('A', 'A'), estado_calidad: 'BLOQUEADA' } });
    render(<DirectKgBatchWithdrawals />);
    sendScan('A');
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar A', exact: true }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0]?.status).toBe('ready'));
    expect(audio.play.mock.calls.map(([kind]) => kind)).toEqual(['rejected', 'accepted']);
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(1);
  });

  it('un alias de una manga restaurada solo señala duplicado', async () => {
    localStorage.setItem(draftKey, JSON.stringify({ reason: 'Guardado', holderId: 9,
      candidates: [{ code: 'A', unit: unit('A', 'A'), status: 'ready' }] }));
    api.resolve.mockResolvedValue({ unit: unit('A', 'A') });
    render(<DirectKgBatchWithdrawals />);
    sendScan('ALIAS-A');
    await waitFor(() => expect(audio.play).toHaveBeenCalledWith('duplicate'));
    expect(audio.play).not.toHaveBeenCalledWith('accepted');
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(1);
  });

  it('permite excluir una lectura válida equivocada antes de confirmar', async () => {
    render(<DirectKgBatchWithdrawals />);
    await scan('A');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retirar OF-A-OT-A-M-A', exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Retirar OF-A-OT-A-M-A', exact: true }));
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(0);
    expect(confirmButton()).toBeDisabled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('vacía las tarjetas al iniciar otro lote después de confirmar', async () => {
    render(<DirectKgBatchWithdrawals />);
    await chooseContext();
    await scan('A');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    fireEvent.click(confirmButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva salida' }));
    expect(screen.queryByRole('list', { name: 'Lecturas pendientes' })).not.toBeInTheDocument();
    expect(screen.queryByText('A', { exact: true })).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it('activa y prueba audio suspendido en el mismo gesto sin bloquear nuevas lecturas', async () => {
    audio.status = 'suspended';
    render(<DirectKgBatchWithdrawals />);
    expect(screen.getByLabelText('Escanear QR de manga KG')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Activar y probar sonido' }));
    await waitFor(() => expect(audio.activate).toHaveBeenCalledTimes(1));
    expect(audio.play).toHaveBeenCalledWith('accepted');
    await scan('A');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0].status).toBe('ready'));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('intenta reanudar el audio al recibir Enter con estado suspendido', async () => {
    audio.status = 'suspended';
    render(<DirectKgBatchWithdrawals />);

    await scan('A');

    expect(audio.activate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0].status).toBe('ready');
  });

  it('reanuda por foco y desmonta sus listeners sin conservar efectos', async () => {
    audio.status = 'suspended';
    const { unmount } = render(<DirectKgBatchWithdrawals />);

    fireEvent.focus(window);
    await waitFor(() => expect(audio.activate).toHaveBeenCalledTimes(1));
    unmount();
    fireEvent.focus(window);
    expect(audio.activate).toHaveBeenCalledTimes(1);
  });

  it('hace visible cuando el feedback de audio devuelve false', async () => {
    audio.play.mockReturnValue(false);
    render(<DirectKgBatchWithdrawals />);

    await scan('A');

    expect(await screen.findByText(/no se pudo reproducir el feedback sonoro/i)).toBeVisible();
  });

  it('muestra identidad OF OT M y pieza-color en tarjetas aceptadas', async () => {
    api.resolve.mockResolvedValue({ unit: {
      ...unit('A', 'A'),
      identidad: {
        of: 'OF-001', ot: 'OT-001', m: 'OF-001-OT-001-M-001',
        pieza: { codigo: 'PC-001', nombre: 'Tapa' },
        color: { nombre: 'Azul', hex: '#112233' },
      },
    } });
    render(<DirectKgBatchWithdrawals />);

    await scan('A');

    const list = screen.getByRole('list', { name: 'Lecturas pendientes' });
    expect(list).toHaveStyle({ gridTemplateColumns: '1fr' });
    expect(within(list).getByText('OF-001-OT-001-M-001')).toBeVisible();
    expect(within(list).queryByText('OF-001 · OT-001 · OF-001-OT-001-M-001')).not.toBeInTheDocument();
    expect(within(list).getByText('Tapa')).toBeVisible();
    expect(within(list).queryByText('PC-001')).not.toBeInTheDocument();
    expect(within(list).getByText('Azul')).toBeVisible();
    expect(within(list).getByLabelText('Color Azul')).toHaveStyle({ backgroundColor: '#112233' });
  });

  it('mantiene la misma ficha humana al restaurar una manga y oculta el código técnico del artículo', async () => {
    localStorage.setItem(draftKey, JSON.stringify({ reason: 'Guardado', holderId: 9,
      candidates: [{
        code: 'QR-RESTORED',
        unit: {
          ...unit('u-restored', 'QR-RESTORED'),
          identidad: {
            m: 'OF-009-OT-010-M-002',
            pieza: { codigo: 'PC-RESTORED', nombre: 'Manga restaurada' },
            color: { nombre: 'Verde', hex: '#008000' },
          },
        },
        status: 'ready',
      }] }));
    render(<DirectKgBatchWithdrawals />);

    const list = await screen.findByRole('list', { name: 'Mangas seleccionadas para salida directa' });
    expect(within(list).getByText('OF-009-OT-010-M-002')).toBeVisible();
    expect(within(list).getByText('Manga restaurada')).toBeVisible();
    expect(within(list).queryByText('PC-RESTORED')).not.toBeInTheDocument();
    expect(within(list).getByText('Verde')).toBeVisible();
    expect(within(list).getByLabelText('Color Verde')).toBeVisible();
    expect(within(list).getByText('12.500 KG')).toBeVisible();
    expect(within(list).getByRole('button', { name: 'Retirar OF-009-OT-010-M-002' })).toBeVisible();
  });

  it('rechaza una unidad sin identidad.m y conserva el código leído en conflicto', async () => {
    api.resolve.mockResolvedValue({ unit: {
      ...unit('A', 'QR-LEIDO'),
      identidad: { of: 'OF-001', ot: 'OT-001', pieza: { codigo: 'PC-001', nombre: 'Tapa' }, color: { nombre: 'Azul' } },
    } });
    render(<DirectKgBatchWithdrawals />);
    await scan('QR-LEIDO');

    const list = screen.getByRole('list', { name: 'Lecturas pendientes' });
    expect(within(list).getByText(/no tiene una identidad humana OF-OT-M/i)).toBeVisible();
    expect(within(list).getByRole('button', { name: 'Reintentar QR-LEIDO' })).toBeVisible();
    expect(within(list).queryByText('Aceptada')).not.toBeInTheDocument();
    expect(within(list).queryByText(/OF-001.*OT-001/)).not.toBeInTheDocument();

    api.resolve.mockRejectedValueOnce(new Error('Identidad no encontrada'));
    sendScan('QR-CONFLICTO');
    await waitFor(() => expect(within(list).getByText('QR-CONFLICTO')).toBeVisible());
    expect(within(list).getByRole('button', { name: 'Reintentar QR-CONFLICTO' })).toBeVisible();
  });

  it('normaliza solo transparente exacto y conserva nombres parecidos con HEX neutral', async () => {
    api.resolve.mockImplementation(async (code) => ({ unit: {
      ...unit(code, code), identidad: {
        of: `OF-${code}`, ot: `OT-${code}`, m: `M-${code}`,
        pieza: { codigo: `PC-${code}`, nombre: 'Tapa' },
        color: code === 'A'
          ? { nombre: 'TRANSPARENTE TRANSPARENTE', hex: '' }
          : code === 'B'
            ? { nombre: 'Azul transparente', hex: '#12345' }
            : { nombre: 'No transparente', hex: '#ZZZZZZ' },
      },
    } }));
    render(<DirectKgBatchWithdrawals />);

    await scan('A');
    await scan('B');
    await scan('C');

    const list = screen.getByRole('list', { name: 'Lecturas pendientes' });
    expect(within(list).getAllByText('Transparente')).toHaveLength(1);
    expect(within(list).getByText('Azul transparente')).toBeVisible();
    expect(within(list).getByText('No transparente')).toBeVisible();
    expect(within(list).getByLabelText('Color Transparente')).toBeVisible();
    expect(within(list).getByLabelText('Color Azul transparente')).toBeVisible();
    expect(within(list).getByLabelText('Color No transparente')).toBeVisible();
  });

  it('mantiene visible la recuperación de un QR largo en conflicto sin desbordar acciones', async () => {
    const longCode = 'QR-' + 'X'.repeat(120);
    api.resolve.mockRejectedValueOnce(new Error('Identidad no encontrada'));
    render(<DirectKgBatchWithdrawals />);

    await scan(longCode);

    expect(screen.getByText(longCode)).toBeVisible();
    expect(screen.getByRole('button', { name: `Reintentar ${longCode}` })).toBeVisible();
  });

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
    expect((await screen.findAllByText('OF-QR-1-OT-QR-1-M-QR-1')).length).toBeGreaterThan(0);
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

  it('muestra A y B pendientes con foco y confirmación bloqueada, y resuelve FIFO', async () => {
    const first = deferred(); const second = deferred();
    api.resolve.mockImplementation(code => code === 'A' ? first.promise : second.promise);
    render(<DirectKgBatchWithdrawals />); await chooseContext();
    const input = screen.getByLabelText('Escanear QR de manga KG'); input.focus();
    sendScan('A'); sendScan('B');
    const queue = screen.getByRole('list', { name: 'Lecturas pendientes' });
    expect(within(queue).getAllByRole('listitem')).toHaveLength(2);
    expect(within(queue).getByText('A')).toBeVisible();
    expect(within(queue).getByText('B')).toBeVisible();
    expect(input).toBeEnabled(); expect(input).toHaveFocus(); expect(input).toHaveValue('');
    expect(confirmButton()).toBeDisabled(); expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(api.resolve).toHaveBeenNthCalledWith(1, 'A');
    expect(audio.play).not.toHaveBeenCalled();
    fireEvent.click(confirmButton()); expect(api.create).not.toHaveBeenCalled();
    await act(async () => first.resolve({ unit: unit('A', 'A') }));
    await waitFor(() => expect(api.resolve).toHaveBeenNthCalledWith(2, 'B'));
    expect(confirmButton()).toBeDisabled();
    await act(async () => second.resolve({ unit: unit('B', 'B') }));
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates.map(c => c.unit.id)).toEqual(['A', 'B']);
    expect(audio.play.mock.calls.map(c => c[0])).toEqual(['accepted', 'accepted']);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('deduplica A mientras está pendiente y un alias posterior por identidad canónica', async () => {
    const first = deferred();
    api.resolve.mockImplementation(code => code === 'A' ? first.promise : Promise.resolve({ unit: unit('A', 'A') }));
    render(<DirectKgBatchWithdrawals />);
    sendScan('A'); sendScan('A'); sendScan('ALIAS-A');
    expect(within(screen.getByRole('list', { name: 'Lecturas pendientes' })).getAllByRole('listitem')).toHaveLength(2);
    expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(audio.play.mock.calls.some(c => c[0] === 'accepted')).toBe(false);
    await act(async () => first.resolve({ unit: unit('A', 'A') }));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(audio.play.mock.calls.filter(c => c[0] === 'duplicate')).toHaveLength(2));
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(1);
    expect(audio.play.mock.calls.filter(c => c[0] === 'accepted')).toHaveLength(1);
  });

  it('error de A conserva B y permite reintentar A sin repetir el escaneo físico', async () => {
    const first = deferred();
    api.resolve.mockImplementation(code => code === 'A' ? first.promise : Promise.resolve({ unit: unit('B', 'B') }));
    render(<DirectKgBatchWithdrawals />); await chooseContext();
    sendScan('A'); sendScan('B');
    await act(async () => first.reject(new Error('Etiqueta A no disponible')));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(2));
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates.find(c => c.code === 'B').status).toBe('ready');
    expect(confirmButton()).toBeDisabled(); expect(api.create).not.toHaveBeenCalled();
    api.resolve.mockResolvedValue({ unit: unit('A', 'A') });
    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar A' })[0]);
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    const saved = JSON.parse(localStorage.getItem(draftKey)).candidates;
    expect(saved).toHaveLength(2); expect(saved.every(c => c.status === 'ready')).toBe(true);
    expect(audio.play.mock.calls.map(c => c[0])).toEqual(['rejected', 'accepted', 'accepted']);
  });

  it('aplica límite visible de 32 pendientes sin perder el código que excede la cola', async () => {
    const first = deferred();
    api.resolve.mockImplementation(code => code === 'Q0' ? first.promise : Promise.resolve({ unit: unit(code, code) }));
    render(<DirectKgBatchWithdrawals />);
    for (let index = 0; index < 32; index += 1) sendScan(`Q${index}`);
    sendScan('EXTRA');
    expect(within(screen.getByRole('list', { name: 'Lecturas pendientes' })).getAllByRole('listitem')).toHaveLength(32);
    expect(screen.getByLabelText('Escanear QR de manga KG')).toHaveValue('EXTRA');
    expect(screen.getByText(/cola.*llena|límite.*32/i)).toBeVisible();
    expect(api.resolve).toHaveBeenCalledTimes(1); expect(api.create).not.toHaveBeenCalled();
    await act(async () => first.resolve({ unit: unit('Q0', 'Q0') }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(32));
    expect(api.resolve).not.toHaveBeenCalledWith('EXTRA');
    sendScan('EXTRA');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).candidates).toHaveLength(33));
  });

  it('no emite acierto al resolver una identidad bloqueada', async () => {
    api.resolve.mockResolvedValue({ unit: { ...unit('A', 'A'), estado_calidad: 'BLOQUEADA' } });
    render(<DirectKgBatchWithdrawals />); sendScan('A');
    await waitFor(() => expect(audio.play).toHaveBeenCalledWith('rejected'));
    expect(audio.play).not.toHaveBeenCalledWith('accepted');
    expect(JSON.parse(localStorage.getItem(draftKey)).candidates[0].status).toBe('conflict');
  });

  it('emite confirmación distinta solo después del resultado del POST', async () => {
    const response = deferred(); api.create.mockReturnValue(response.promise);
    render(<DirectKgBatchWithdrawals />); await chooseContext(); await scan('A');
    await waitFor(() => expect(confirmButton()).toBeEnabled()); fireEvent.click(confirmButton());
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
      expect(audio.play).not.toHaveBeenCalledWith('confirmed');
      expect(screen.getByRole('button', { name: 'Retirar OF-A-OT-A-M-A', exact: true })).toBeDisabled();
    await act(async () => response.resolve({ operation_id: 'op', cantidad_unidades: 1, total_kg: '12.500', retiros: [] }));
    await waitFor(() => expect(audio.play).toHaveBeenCalledWith('confirmed'));
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirar OF-QR-2-OT-QR-2-M-QR-2' })[0]);
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
