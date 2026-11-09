import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import Mn31DespachoScm from '../components/Mn31DespachoScm';

const api = vi.hoisted(() => ({
  clients: vi.fn(), resolve: vi.fn(), confirm: vi.fn(), get: vi.fn(), reverse: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: (capability) => capability === 'DESPACHO_MN31_CONFIRMAR' }) }));
vi.mock('../services/scmMn31DispatchApi', () => ({
  listarClientesDespachoMn31Scm: api.clients,
  resolverMangaDespachoMn31Scm: api.resolve,
  confirmarDespachoMn31Scm: api.confirm,
  obtenerOperacionDespachoMn31Scm: api.get,
  revertirDespachoMn31Scm: api.reverse,
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
  api.reverse.mockResolvedValue({ operation_id: 'rev-1', estado: 'REVERTIDO', comprobante_origen: 'op-1', items: [{ kg: '16.800' }] });
  api.get.mockResolvedValue({});
});

describe('despacho MN-31 integrado', () => {
  it('carga clientes reales y no presenta catálogo demo', async () => {
    renderPage();
    expect(await screen.findByText('Cliente Norte')).toBeVisible();
    expect(screen.queryByText(/demo|simulad|provisional/i)).not.toBeInTheDocument();
  });

  it('consulta un comprobante por ID desde la bandeja inicial', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ operation_id: 'op-other-device', estado: 'CONFIRMADO', cliente: { nombre: 'Cliente Norte' }, cantidad_mangas: 2, total_kg: '33.600' });
    renderPage();
    const input = await screen.findByRole('textbox', { name: 'ID del comprobante' });
    await user.type(input, 'op-other-device');
    await user.click(screen.getByRole('button', { name: 'Consultar comprobante', exact: true }));
    expect(await screen.findByRole('status')).toHaveTextContent(/op-other-device/);
    expect(screen.getByRole('button', { name: 'Ver comprobante' })).toBeVisible();
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

  it('conserva el token de una manga abierta sin unidad y usa la versión de manga', async () => {
    const user = userEvent.setup();
    api.resolve.mockResolvedValueOnce({
      sku: 'PC-000468',
      unidad: null,
      requiere_ingreso_kg004: true,
      version_token: { manga: 7, unidad: null, peso_fuente: 'peso-abc' },
      manga: {
        id: 'manga-open-1', codigo: 'MANGA-OPEN-001', id_humano: 'OF-000138-OT-352-M-002', version: 7,
        ot: { codigo: item.ot, fecha: item.fecha_ot, turno: item.turno },
        lote: { codigo: 'MN31-20261109-D-01' }, peso_autoritativo_kg: '16.500', cliente: { nombre: client.nombre },
      },
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    await user.type(await screen.findByLabelText('Escanear código de manga'), 'MANGA-OPEN-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Registra ingreso KG004, concilia el delta y registra salida/)).toBeVisible();
    expect(within(dialog).getByText('Hubo cambio productivo')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar despacho' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    expect(api.confirm.mock.calls[0][0].items[0]).toEqual(expect.objectContaining({
      codigo: 'MANGA-OPEN-001', version: 7, version_token: { manga: 7, unidad: null, peso_fuente: 'peso-abc' },
    }));
    expect(api.confirm.mock.calls[0][0].items[0].unit_id).toBeUndefined();
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
    expect(api.confirm).toHaveBeenCalledWith({ cliente_id: 1, documento: 'OC-2026-001', motivo: 'Despacho directo de mangas MN-31 a cliente', items: [{ codigo: 'MANGA-001', unit_id: 'unit-1', version: 1, lote_codigo: 'MN31-20261109-D-01', hubo_cambio_productivo: false }] }, expect.any(String));
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

  it('abre candidatos de lote y revalida con lote elegido y cambio productivo explícito', async () => {
    const user = userEvent.setup();
    api.resolve.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'MN31_LOT_SELECTION_REQUIRED', details: { candidatos: ['MN31-20261109-D-01'], candidato_sugerido: 'MN31-20261109-D-02' } } } } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    const input = await screen.findByLabelText('Escanear código de manga');
    await user.type(input, 'MANGA-001{enter}');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/no puede continuar sin una elección explícita/)).toBeVisible();
      await user.click(within(dialog).getByRole('radio', { name: /MN31-20261109-D-01/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Hubo cambio productivo/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Revalidar manga' }));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('MANGA-001', '1', { loteCodigo: 'MN31-20261109-D-01', huboCambioProductivo: true }));
    expect(await screen.findByTestId('mn31-manga-card')).toBeVisible();
  });

  it('revalida cambio productivo desde revisión y permite cambiar M013 de lote', async () => {
    const user = userEvent.setup();
    const resolvedM013 = {
      sku: 'PC-000468', unidad: { id: 'unit-013', version: 1 }, manga: {
        id: 'manga-013', codigo: 'MANGA-013', id_humano: 'OF-000138-OT-352-M-013', version: 8,
        ot: { codigo: item.ot, fecha: item.fecha_ot, turno: item.turno }, lote: { codigo: 'MN31-20261109-D-01' },
        peso_autoritativo_kg: '16.800', cliente: { nombre: client.nombre },
      },
      version_token: { manga: 8, unidad: 1, peso_fuente: 'peso-013' },
    };
    api.resolve.mockResolvedValueOnce(resolvedM013);
    api.resolve.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'MN31_LOT_SELECTION_REQUIRED', details: { candidatos: ['MN31-20261109-D-02'], candidato_sugerido: 'MN31-20261109-D-02' } } } } });
    api.resolve.mockResolvedValueOnce({ ...resolvedM013, manga: { ...resolvedM013.manga, lote: { codigo: 'MN31-20261109-D-02' } } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    await user.type(await screen.findByLabelText('Escanear código de manga'), 'MANGA-013{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    const review = screen.getByRole('dialog');
    await user.click(within(review).getByRole('checkbox'));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('MANGA-013', '1', { loteCodigo: 'MN31-20261109-D-01', huboCambioProductivo: true }));
    const lotDialog = screen.getAllByRole('dialog').find((candidate) => candidate.textContent.includes('Selecciona lote para esta manga'));
    expect(lotDialog).toBeTruthy();
    await user.click(within(lotDialog).getByRole('radio', { name: /MN31-20261109-D-02/ }));
    await user.click(within(lotDialog).getByRole('button', { name: 'Revalidar manga' }));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('MANGA-013', '1', { loteCodigo: 'MN31-20261109-D-02', huboCambioProductivo: true }));
    await waitFor(() => expect(screen.queryByText('Selecciona lote para esta manga')).not.toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByText('MN31-20261109-D-02')).toBeVisible();
  });

  it('abre comprobante desde éxito y revierte con motivo usando operación idempotente propia', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    await user.type(await screen.findByLabelText('Escanear código de manga'), 'MANGA-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }));
    const receipt = await screen.findByRole('dialog');
    await user.click(within(receipt).getByRole('button', { name: 'Revertir despacho' }));
    const reverseDialog = await screen.findByRole('dialog');
    await user.type(within(reverseDialog).getByRole('textbox', { name: 'Motivo de reversa' }), 'Cliente equivocado en la entrega');
    await user.click(within(reverseDialog).getByRole('button', { name: 'Confirmar reversa' }));
    await waitFor(() => expect(api.reverse).toHaveBeenCalledTimes(1));
    expect(api.reverse).toHaveBeenCalledWith('op-1', { motivo: 'Cliente equivocado en la entrega' }, expect.any(String));
      expect(await screen.findByText('Despacho revertido')).toBeVisible();
  });

  it('conserva una reversa incierta y bloquea nuevo despacho hasta recuperarla', async () => {
    const user = userEvent.setup();
    api.reverse.mockRejectedValueOnce(new Error('network timeout'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));
    await user.type(await screen.findByLabelText('Escanear código de manga'), 'MANGA-001{enter}');
    await user.click(await screen.findByRole('button', { name: 'Revisar y confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar despacho' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Ver comprobante' }));
    const receipt = await screen.findByRole('dialog');
    await user.click(within(receipt).getByRole('button', { name: 'Revertir despacho' }));
    const reverseDialog = await screen.findByRole('dialog');
    await user.type(within(reverseDialog).getByRole('textbox', { name: 'Motivo de reversa' }), 'Cliente equivocado en la entrega');
    await user.click(within(reverseDialog).getByRole('button', { name: 'Confirmar reversa' }));
    await waitFor(() => expect(sessionStorage.getItem('scm-mn31-dispatch:7:reverse-pending')).not.toBeNull());
    expect(await screen.findByRole('button', { name: 'Recuperar reversa' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Nuevo despacho' })).toBeDisabled();
    expect(JSON.parse(sessionStorage.getItem('scm-mn31-dispatch:7:reverse-pending')).payload).toEqual({ motivo: 'Cliente equivocado en la entrega' });
  });
});
