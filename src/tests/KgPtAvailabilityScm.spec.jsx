import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KgPtAvailabilityScm from '../components/KgPtAvailabilityScm';

const mocks = vi.hoisted(() => ({ pieces: vi.fn(), pt: vi.fn(), balances: vi.fn(), post: vi.fn(), history: vi.fn(), warehouses: vi.fn() }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: () => true }) }));
vi.mock('../services/scmKgPtAvailabilityApi', () => ({ consultarDisponibilidadPiezasKg: mocks.pieces, consultarDisponibilidadPt: mocks.pt, listarKardexPtManual: mocks.balances, registrarMovimientoPtManual: mocks.post, listarMovimientosPtManual: mocks.history }));
vi.mock('../services/scmWarehouseOperationsApi', () => ({ listarAlmacenesScm: mocks.warehouses }));
const product = { id: 11, codigo: 'PT-11', nombre: 'Balde completo' };
const location = { id: 8, codigo: 'PT-GEN', nombre: 'Almacén PT', activo: true, clases_articulo: ['PRODUCTO_TERMINADO'] };
const balance = (version = 2) => ({ id: 'saldo-pt', articulo: product, ubicacion: location, saldo_un: '5.000', version });
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.pieces.mockResolvedValue({ items: [], fuente_vigente: [] });
  mocks.pt.mockResolvedValue({ items: [{ pt: product, revision_bom: { numero: 2 }, componentes: [], potencial_estado: 'NO_CALCULABLE', potencial_motivo: 'SIN_BOM_APROBADA', saldo_manual_un: '5.000' }] });
  mocks.balances.mockResolvedValue({ items: [balance()] });
  mocks.warehouses.mockResolvedValue({ items: [{ ubicaciones: [location] }] });
  mocks.history.mockResolvedValue({ items: [] });
  mocks.post.mockResolvedValue({ saldo: balance(3) });
});
async function fillEntry() {
  await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
  fireEvent.click(screen.getByRole('tab', { name: 'Kardex PT manual' }));
  fireEvent.change(screen.getByLabelText(/Producto terminado/), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText(/Ubicación autorizada/), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText(/Cantidad UN/), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/Referencia/), { target: { value: 'ACTA-PT-01' } });
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Producción recibida' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar movimiento' }));
}
describe('Kardex PT operativo', () => {
  it('exige referencia antes de abrir la revisión del movimiento', async () => {
    render(<KgPtAvailabilityScm />);
    await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
    fireEvent.click(screen.getByRole('tab', { name: 'Kardex PT manual' }));
    fireEvent.change(screen.getByLabelText(/Producto terminado/), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText(/Ubicación autorizada/), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Cantidad UN/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Producción recibida' } });
    expect(screen.getByLabelText(/Referencia/)).toBeRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar movimiento' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mantiene visibles las etiquetas de los selectores cuando todavía están vacíos', async () => {
    render(<KgPtAvailabilityScm />);
    await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
    fireEvent.click(screen.getByRole('tab', { name: 'Kardex PT manual' }));
    expect(screen.getByLabelText(/Producto terminado/).labels[0]).toHaveAttribute('data-shrink', 'true');
    expect(screen.getByLabelText(/Ubicación autorizada/).labels[0]).toHaveAttribute('data-shrink', 'true');
  });

  it('confirma datos antes de enviar y recupera exactamente el intento tras perder respuesta', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Sin respuesta')).mockResolvedValue({ saldo: balance(3) });
    render(<KgPtAvailabilityScm />);
    await fillEntry();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Balde completo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
    const recover = await screen.findByRole('button', { name: 'Recuperar movimiento' });
    const first = mocks.post.mock.calls[0];
    expect(first[0]).toMatchObject({ cantidad: '3', version: 2, tipo: 'ENTRADA' });
    expect(screen.getByLabelText(/Cantidad UN/)).toBeDisabled();
    fireEvent.click(recover);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1]).toEqual(first);
    await screen.findByText('Movimiento PT registrado.');
    expect(sessionStorage.getItem('scm-pt-manual-intent:7')).toBeNull();
  });
  it('bloquea doble confirmación y usa la versión nueva para la siguiente entrada', async () => {
    let finish;
    mocks.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<KgPtAvailabilityScm />);
    await fillEntry();
    const confirm = screen.getByRole('button', { name: 'Confirmar movimiento' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.balances.mockResolvedValue({ items: [balance(3)] });
    finish({ saldo: balance(3) });
    await screen.findByText('Movimiento PT registrado.');
    await waitFor(() => expect(screen.getByLabelText(/Cantidad UN/)).not.toBeDisabled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByLabelText(/Cantidad UN/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Segunda entrega' } });
    fireEvent.change(screen.getByLabelText(/Referencia/), { target: { value: 'ACTA-PT-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar movimiento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1][0].version).toBe(3);
    expect(mocks.post.mock.calls[1][1]).not.toBe(mocks.post.mock.calls[0][1]);
  });

  it('muestra el resumen PT y expande componentes con nombre, color y causa', async () => {
    const component = {
      articulo: { id: 31, codigo: 'PC-31', nombre: 'Artículo legado' },
      identidad_pieza: { pieza_id: 9, nombre: 'Tapa redonda', color_id: 4, color_nombre: 'Rojo', color_hex: '#AA1122' },
      kg_disponibles: '1.000', kg_requeridos_por_un_pt: '2.000', cobertura_un: '0.000', estado: 'CALCULABLE',
      faltante_kg: '1.000', es_limitante: true,
    };
    mocks.pt.mockResolvedValue({ items: [{ pt: product, revision_bom: { numero: 3 }, componentes: [component], potencial_estado: 'CALCULABLE', potencial_un_estimado: '0.000', saldo_manual_un: '5.000' }] });
    render(<KgPtAvailabilityScm />);
    await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
    fireEvent.click(screen.getByRole('tab', { name: 'Por PT' }));
    expect(screen.getByText('Balde completo')).toBeInTheDocument();
    expect(screen.getByText('Saldo PT: 5.000 UN')).toBeInTheDocument();
    expect(screen.getByText('Tapa redonda · Rojo')).toBeInTheDocument();
    expect(screen.getByText('Limitante')).toBeInTheDocument();
    expect(screen.getByText('Faltante para 1 PT: 1.000 KG')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Ver componentes de Balde completo' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('row', { name: /Tapa redonda/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Requerido por 1 PT: 2.000 KG')).toBeInTheDocument();
    expect(screen.getByText('Cobertura estimada: 0.000 UN')).toBeInTheDocument();
    expect(screen.getAllByText('Limitante').length).toBeGreaterThan(1);
    expect(screen.getByText('Stock compartido: las alternativas PT compiten por el mismo saldo; los potenciales no se suman.')).toBeInTheDocument();
  });

  it('mantiene potencial y restricción visibles como tarjeta en ancho estrecho', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const component = {
      articulo: { id: 41, codigo: 'WIP-41', nombre: 'Cuerpo armado' },
      identidad_pieza: null, naturaleza: 'SUBENSAMBLE_WIP',
      kg_disponibles: '0.000', kg_requeridos_por_un_pt: null, cobertura_un: null,
      estado: 'NO_CALCULABLE', faltante_kg: null, es_limitante: false,
    };
    mocks.pt.mockResolvedValue({ items: [{
      pt: product, revision_bom: { numero: 4 }, componentes: [component],
      potencial_estado: 'NO_CALCULABLE', potencial_motivo: 'SIN_REFERENCIA_PESO',
      potencial_un_estimado: null, saldo_manual_un: '5.000',
    }] });
    try {
      render(<KgPtAvailabilityScm />);
      await screen.findByText('No hay piezas medidas en las ubicaciones consultables.');
      fireEvent.click(screen.getByRole('tab', { name: 'Por PT' }));
      expect(screen.queryByRole('table', { name: 'Disponibilidad por producto terminado' })).toBeNull();
      expect(screen.getByText('Potencial estimado')).toBeInTheDocument();
      expect(screen.getAllByText('Sin referencia de peso').length).toBeGreaterThan(0);
      expect(screen.getByText('Restricción principal')).toBeInTheDocument();
      expect(screen.getByText('Cuerpo armado')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Ver componentes de Balde completo' }));
      expect(screen.getByText(/WIP-41 · WIP/)).toBeInTheDocument();
      expect(screen.getByText('Requerido por 1 PT')).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

it('conserva un envío incierto si posteriormente se revoca el permiso', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Sin respuesta')).mockRejectedValueOnce({ response: { status: 403, data: { error: { code: 'FORBIDDEN' } } } });
  render(<KgPtAvailabilityScm />);
  await fillEntry();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Recuperar movimiento' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
  expect(JSON.parse(sessionStorage.getItem('scm-pt-manual-intent:7')).sent).toBe(true);
  expect(screen.getByLabelText(/Cantidad UN/)).toBeDisabled();
});
it('muestra la fecha del servidor para la consulta', async () => {
  const asOf = '2026-09-10T15:00:00Z';
  mocks.pieces.mockResolvedValue({ items: [], as_of: asOf });
  render(<KgPtAvailabilityScm />);
  const formatted = new Date(asOf).toLocaleString('es-PE', { timeZone: 'America/Lima' });
  expect(await screen.findByText((text) => text.includes('Consultado:') && text.includes(formatted))).toBeInTheDocument();
});
