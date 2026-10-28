import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantAgentPanel from './AssistantAgentPanel';
import { AgentOrb } from './AgentOrb';
import { buildScmAgentChatPayload } from '../../services/scmAgentApi';

const getState = vi.fn();
const sendChat = vi.fn();

vi.mock('../../services/scmAgentApi', async () => {
  const actual = await vi.importActual('../../services/scmAgentApi');
  return { ...actual, getScmAgentState: (...args) => getState(...args), sendScmAgentChat: (...args) => sendChat(...args) };
});

const ready = () => ({ available: true, status: 'READY', message: 'Disponible', provider: 'openclaw', read_only: true, attachments_supported: false });

beforeEach(() => {
  getState.mockResolvedValue(ready());
  sendChat.mockImplementation(({ clientRequestId }) => Promise.resolve({ status: 'answered', answer: 'Lectura confirmada por el agente.', trace_id: 'trace-1', client_request_id: clientRequestId, read_only: true, provider: { status: 'READY', usage: {} }, sources: [], limitations: [] }));
});

afterEach(() => vi.clearAllMocks());

describe('AssistantAgentPanel', () => {
  it('keeps the orb wrapper dimensioned and circular around the canvas fallback', () => {
    const { container } = render(<AgentOrb />);
    const orb = screen.getByRole('img', { name: 'Agente listo' });
    expect(orb).toHaveClass('assistant-agent-orb');
    expect(orb).toHaveStyle({ width: '40px', height: '40px' });
    expect(container.querySelector('.assistant-agent-orb .strands-container')).toBeInTheDocument();
  });

  it('muestra estado real, header de solo lectura y adjuntos deshabilitados', async () => {
    render(<AssistantAgentPanel open onClose={vi.fn()} />);
    expect(screen.getByText('Comprobando disponibilidad…')).toBeInTheDocument();
    expect(await screen.findByText('Agente SCM')).toBeInTheDocument();
    expect(screen.getByText('Solo lectura · datos de producción')).toBeInTheDocument();
    expect(screen.getByText('Consulta la información empresarial disponible para este agente de solo lectura.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adjuntos aún no disponibles/i })).toBeDisabled();
    expect(screen.queryByText(/DEMO|fuentes|pensamiento/i)).not.toBeInTheDocument();
  });

  it('envía una consulta y conserva la respuesta del backend sin inventar metadatos', async () => {
    const onStateChange = vi.fn();
    render(<AssistantAgentPanel open onClose={vi.fn()} onStateChange={onStateChange} />);
    const input = await screen.findByRole('textbox', { name: 'Pregunta al agente SCM' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: '¿Qué estado tiene la producción?' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: false });
    expect(await screen.findByText('¿Qué estado tiene la producción?')).toBeInTheDocument();
    expect(await screen.findByText('Lectura confirmada por el agente.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tú' })).toHaveTextContent('¿Qué estado tiene la producción?');
    expect(screen.getByRole('group', { name: 'Agente SCM' })).toHaveTextContent('Lectura confirmada por el agente.');
    expect(onStateChange).toHaveBeenCalledWith('success');
    expect(sendChat).toHaveBeenCalledWith(expect.objectContaining({ query: '¿Qué estado tiene la producción?', history: [], signal: expect.any(AbortSignal) }));
    expect(screen.queryByText(/trace-1|Fuente|Descargar|Reporte/i)).not.toBeInTheDocument();
  });

  it('preserva la consulta tras error y solo reintenta al pulsar el control explícito', async () => {
    sendChat.mockRejectedValueOnce(Object.assign(new Error('backend down'), { response: { data: { error: { code: 'TEMPORARY', message: 'Servicio temporalmente no disponible' } } } }));
    render(<AssistantAgentPanel open onClose={vi.fn()} />);
    const input = await screen.findByRole('textbox', { name: 'Pregunta al agente SCM' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: 'Consulta persistente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    expect(await screen.findByText('Servicio temporalmente no disponible')).toBeInTheDocument();
    expect(input).toHaveValue('Consulta persistente');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2));
  });

  it('explica que detener la espera no cancela la ejecución remota', async () => {
    let resolveRequest;
    sendChat.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<AssistantAgentPanel open onClose={vi.fn()} />);
    const input = await screen.findByRole('textbox', { name: 'Pregunta al agente SCM' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: 'Espera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dejar de esperar' }));
    expect(await screen.findByText(/La ejecución remota puede continuar/)).toBeInTheDocument();
    resolveRequest?.({ answer: 'respuesta tardía' });
  });

  it('ignora la respuesta de una espera anterior cuando comienza una nueva consulta', async () => {
    const resolvers = [];
    sendChat.mockImplementation((request) => new Promise((resolve) => resolvers.push({ resolve, request })));
    render(<AssistantAgentPanel open onClose={vi.fn()} />);
    const input = await screen.findByRole('textbox', { name: 'Pregunta al agente SCM' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: 'primera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dejar de esperar' }));
    fireEvent.change(input, { target: { value: 'segunda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[0].resolve({ status: 'answered', answer: 'respuesta vieja', client_request_id: resolvers[0].request.clientRequestId });
    resolvers[1].resolve({ status: 'answered', answer: 'respuesta nueva', client_request_id: resolvers[1].request.clientRequestId });
    expect(await screen.findByText('respuesta nueva')).toBeInTheDocument();
    expect(screen.queryByText('respuesta vieja')).not.toBeInTheDocument();
  });

  it('rechaza disponibilidad del propietario sin fallback local', async () => {
    getState.mockResolvedValueOnce({ ...ready(), available: false, status: 'UNAVAILABLE', message: 'Propietario no vinculado' });
    render(<AssistantAgentPanel open onClose={vi.fn()} />);
    expect(await screen.findByText('Propietario no vinculado')).toBeInTheDocument();
    expect(screen.queryByText(/Avance de producción|Respuesta de ejemplo/)).not.toBeInTheDocument();
  });
});

describe('SCM agent payload bounds', () => {
  it('sends previous complete pairs, without duplicating the current query', () => {
    const result = buildScmAgentChatPayload({ query: 'actual', history: [
      { role: 'user', content: 'anterior' }, { role: 'assistant', content: 'respuesta anterior' },
      { role: 'user', content: 'actual' },
    ], clientRequestId: 'request-id' });
    expect(result.payload.history).toEqual([{ role: 'user', content: 'anterior' }, { role: 'assistant', content: 'respuesta anterior' }]);
    expect(result.payload.query).toBe('actual');
    expect(JSON.stringify(result.payload)).not.toContain('model');
  });

  it('omits oldest complete pairs when the UTF-8 history budget is exceeded', () => {
    const history = Array.from({ length: 12 }, (_, index) => [
      { role: 'user', content: `${index}-${'á'.repeat(2200)}` },
      { role: 'assistant', content: `${index}-${'é'.repeat(2200)}` },
    ]).flat();
    const result = buildScmAgentChatPayload({ query: 'actual', history, clientRequestId: 'request-id' });
    expect(result.historyOmitted).toBe(true);
    expect(result.payload.history.length % 2).toBe(0);
    expect(new TextEncoder().encode(JSON.stringify(result.payload.history)).length).toBeLessThanOrEqual(16000);
    expect(new TextEncoder().encode(JSON.stringify(result.payload)).length).toBeLessThanOrEqual(24000);
  });

  it('omits a complete pair whose response exceeds the per-message limit', () => {
    const result = buildScmAgentChatPayload({ query: 'actual', history: [
      { role: 'user', content: 'pregunta larga' }, { role: 'assistant', content: 'x'.repeat(4001) },
      { role: 'user', content: 'conservada' }, { role: 'assistant', content: 'respuesta breve' },
    ], clientRequestId: 'request-id' });
    expect(result.historyOmitted).toBe(true);
    expect(result.payload.history).toEqual([{ role: 'user', content: 'conservada' }, { role: 'assistant', content: 'respuesta breve' }]);
  });
});
