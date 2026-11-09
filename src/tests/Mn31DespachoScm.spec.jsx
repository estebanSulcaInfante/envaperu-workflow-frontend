import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import Mn31DespachoScm from '../components/Mn31DespachoScm';

const api = vi.hoisted(() => ({
  clients: vi.fn(), resolve: vi.fn(), confirm: vi.fn(), get: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: (capability) => capability === 'DESPACHO_MN31_CONFIRMAR' }) }));
vi.mock('../services/scmMn31DispatchApi', () => ({
  listarClientesDespachoMn31Scm: api.clients,
  resolverMangaDespachoMn31Scm: api.resolve,
  confirmarDespachoMn31Scm: api.confirm,
  obtenerOperacionDespachoMn31Scm: api.get,
}));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const client = { id: 1, nombre: 'Cliente Norte', ruc: '20123456789' };
const item = {
  id: 'item-1', codigo: 'MANGA-001', of: 'OF-000138', ot: 'OT-352', m: 'M-001',
  fecha_ot: '2026-11-09', turno: 'DÍA', net_kg: '16.800',
  efecto_confirmacion: 'Cierra manga y registra ingreso/delta y salida',
};

const renderPage = () => render(<ThemeProvider theme={createTheme()}><Mn31DespachoScm /></ThemeProvider>);

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  api.clients.mockResolvedValue({ items: [client] });
  api.resolve.mockResolvedValue({ sku: 'PC-000468', unidad: { id: 'unit-1', version: 1 }, manga: { id: 'manga-1', codigo: 'MANGA-001', id_humano: 'OF-000138-OT-352-M-001', ot: { codigo: item.ot, fecha: item.fecha_ot, turno: item.turno }, lote: { codigo: 'MN31-20261109-D-01' }, peso_autoritativo_kg: item.net_kg, cliente: { nombre: client.nombre }, efecto_confirmacion: item.efecto_confirmacion } });
  api.confirm.mockResolvedValue({ operation_id: 'op-1', cliente: { nombre: 'Cliente Norte' }, cantidad_mangas: 1, total_kg: '16.800' });
  api.get.mockResolvedValue({});
});

describe('despacho MN-31 integrado', () => {
  it('carga clientes reales y no presenta catálogo demo', async () => {
    renderPage();
    expect(await screen.findByText('Cliente Norte')).toBeVisible();
    expect(screen.queryByText(/demo|simulad|provisional/i)).not.toBeInTheDocument();
  });

  it('selecciona cliente, escanea con Enter y limita la tarjeta a identidad, cliente, fecha y turno', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-001{enter}');
    const card = await screen.findByTestId('mn31-manga-card');
    expect(within(card).getByText('OF-000138-OT-352-M-001')).toBeVisible();
    expect(within(card).getByText('Cliente Norte')).toBeVisible();
    expect(within(card).getByText(/OT 9\/11\/2026 · Turno DÍA/)).toBeVisible();
    expect(within(card).queryByText(/kg|lote|badge|válida/i)).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Retirar OF-000138-OT-352-M-001' })).toBeEnabled();
    expect(document.body.textContent).toMatch(/1 manga.*kg/);
  });

  it('muestra rechazo recuperable de anulada/sin peso sin crear tarjeta', async () => {
    api.resolve.mockRejectedValueOnce({ response: { status: 409 }, message: 'La manga anulada no tiene peso elegible.' });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-ANULADA{enter}');
    expect((await screen.findAllByRole('alert')).some((alert) => alert.textContent.includes('La manga anulada no tiene peso elegible.'))).toBe(true);
    expect(screen.queryByTestId('mn31-manga-card')).not.toBeInTheDocument();
    expect(input).toBeEnabled();
  });

  it('retira antes de confirmar y expone el efecto de una manga abierta con avance en revisión', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('OF-000138-OT-352-M-001')).toBeVisible();
    expect(within(dialog).getByText(/Cierra manga y registra ingreso\/delta y salida/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Seguir revisando' }));
    await user.click(await screen.findByRole('button', { name: 'Retirar OF-000138-OT-352-M-001' }));
    expect(api.resolve).toHaveBeenCalledWith('MANGA-001', '1');
    expect(screen.queryByTestId('mn31-manga-card')).not.toBeInTheDocument();
  });

  it('confirma con una sola clave idempotente y muestra resultado fuera de tarjetas', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    await user.type(screen.getByRole('textbox', { name: 'Referencia comercial (opcional)' }), 'OC-2026-001');
    await user.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    expect(api.confirm).toHaveBeenCalledWith({ cliente_id: 1, documento: 'OC-2026-001', motivo: 'Despacho directo de mangas MN-31 a cliente', items: [{ codigo: 'MANGA-001', unit_id: 'unit-1', version: 1 }] }, expect.any(String));
    expect(await screen.findByRole('status')).toHaveTextContent(/Despacho confirmado/);
    expect(screen.queryByTestId('mn31-manga-card')).not.toBeInTheDocument();
  });

  it('conserva y recupera la misma operación ante respuesta incierta', async () => {
    const user = userEvent.setup();
    api.confirm.mockRejectedValueOnce(new Error('network timeout'));
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    await user.type(screen.getByRole('textbox', { name: 'Referencia comercial (opcional)' }), 'OC-2026-001');
    await user.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    expect(await screen.findByRole('button', { name: 'Recuperar' })).toBeEnabled();
    const pending = JSON.parse(sessionStorage.getItem('scm-mn31-dispatch:7:pending'));
    expect(pending.operationId).toEqual(expect.any(String));
    api.confirm.mockResolvedValueOnce({ operation_id: pending.operationId, cliente: { nombre: 'Cliente Norte' }, cantidad_mangas: 1, total_kg: '16.800' });
    await user.click(screen.getByRole('button', { name: 'Recuperar' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(2));
    expect(api.confirm.mock.calls[1][1]).toBe(pending.operationId);
    expect(await screen.findByRole('status')).toHaveTextContent(/Despacho confirmado/);
    expect(sessionStorage.getItem('scm-mn31-dispatch:7:pending')).toBeNull();
  });

  it('al recargar muestra la operación confirmada y limpia la alerta pendiente', async () => {
    sessionStorage.setItem('scm-mn31-dispatch:7:pending', JSON.stringify({ operationId: 'op-reload', payload: { cliente_id: 1, motivo: 'Despacho directo de mangas MN-31 a cliente', items: [] } }));
    api.get.mockResolvedValueOnce({ operation_id: 'op-reload', estado: 'CONFIRMADO', cliente: { nombre: 'Cliente Norte' }, cantidad_mangas: 2, total_kg: '33.600' });
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/op-reload/);
    expect(screen.queryByRole('button', { name: 'Recuperar' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('scm-mn31-dispatch:7:pending')).toBeNull();
  });
});
