import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MangaExplorerScm, { MangaExplorerDetailRoute } from '../components/MangaExplorerScm';
import {
  listarExploradorMangasScm,
  exportarExploradorMangasScm,
  obtenerDetalleMangaScm,
} from '../services/scmProductionObservabilityApi';

vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarExploradorMangasScm: vi.fn(), exportarExploradorMangasScm: vi.fn(), obtenerDetalleMangaScm: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 7, can: () => true }) }));

const item = {
  manga: { public_id: 'manga-1', codigo: 'M-0001', articulo: { nombre: 'Pieza crema', codigo: 'PC-01' }, color: 'Azul', color_hex: '#aBc123', estado_operativo: 'PESADA', pesaje: { estado: 'VIGENTE', peso_fisico_neto_kg: 12.5 } },
  ot: { public_id: 'ot-public-1', codigo: 'OT-01', fecha_operativa: '2026-08-10', turno: 'DIA' },
  recurso: { codigo: 'MQ-01', nombre: 'Máquina 1' },
  upstream: { orden: { id: 'of-public-1', codigo: 'OF-01' } },
  visibilidad: { pesaje: true },
};

function open() {
  const router = createMemoryRouter([{ path: '*', element: <MangaExplorerScm /> }], { initialEntries: ['/control/mangas'] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('explorador simple de mangas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarExploradorMangasScm.mockResolvedValue({ items: [item], page: { next_cursor: null, has_more: false, limit: 25 } });
    exportarExploradorMangasScm.mockResolvedValue({ data: new Blob(['xlsx']) });
    obtenerDetalleMangaScm.mockResolvedValue({
      secciones: { identidad: { item: { codigo: 'M-0001', estado: 'PESADA', articulo: { nombre: 'Pieza crema', codigo: 'PC-01' }, color: 'Azul' } } },
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('prioriza pieza, color y manga en una tabla operativa compacta', async () => {
    open();
    expect(await screen.findByText('Mangas de producción')).toBeInTheDocument();
    expect(screen.getByText('Pieza crema')).toBeInTheDocument();
    expect(screen.getByText('M-0001')).toBeInTheDocument();
    expect(screen.getByText('OF-01')).toBeInTheDocument();
    expect(screen.getByTitle('Muestra de referencia: #ABC123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OF-01' })).toHaveAttribute('href', '/produccion/ordenes-fabricacion?of=of-public-1');
    expect(screen.getByRole('link', { name: 'OT-01' })).toHaveAttribute('href', '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-public-1');
    expect(screen.getByText(/12.*kg/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Tabla de mangas/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(screen.queryByText('Agrupar')).not.toBeInTheDocument();
  });

  it('ofrece los dos criterios de fecha con nomenclatura operativa exacta', async () => {
    open();
    await screen.findByText('Pieza crema');
    expect(screen.getByLabelText('Fecha del pesaje final')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de OT')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fecha del pesaje final'));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listarExploradorMangasScm).toHaveBeenLastCalledWith(expect.objectContaining({ fechaTipo: 'PESAJE_FINAL', cursor: '' })));
  });

  it('conserva fecha_tipo al volver del detalle y muestra recuperación explícita de permiso', async () => {
    const router = createMemoryRouter([{ path: '*', element: <MangaExplorerScm /> }], { initialEntries: ['/control/mangas?fecha_tipo=PESAJE_FINAL'] });
    listarExploradorMangasScm.mockRejectedValueOnce({ response: { status: 403, data: { error: { message: 'Se requiere MANGA_PESAJE_VER para consultar por Fecha del pesaje final.' } } } });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText(/Se requiere MANGA_PESAJE_VER/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Fecha del pesaje final' })).toBeChecked();
  });

  it('reinicia el cursor final cuando el backend detecta datos mutados', async () => {
    listarExploradorMangasScm
      .mockResolvedValueOnce({ items: [item], page: { next_cursor: 'cursor-final', has_more: true, limit: 25 } })
      .mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'STALE_MANGA_EXPLORER_CURSOR', message: 'Los datos cambiaron; actualiza la consulta antes de continuar.' } } } })
      .mockResolvedValueOnce({ items: [item], page: { next_cursor: null, has_more: false, limit: 25 } });
    open();
    await screen.findByText('Pieza crema');
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText(/Los datos cambiaron/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar consulta' }));
    await waitFor(() => expect(listarExploradorMangasScm).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '', page: 0 })));
  });

  it('conserva criterios al buscar y permite escoger Excel detallado', async () => {
    open();
    await screen.findByText('Pieza crema');
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar manga/i }), { target: { value: 'M-0001' } });
    expect(screen.getByRole('button', { name: /Exportar Excel/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listarExploradorMangasScm).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'M-0001', cursor: '' })));
    expect(screen.getByRole('button', { name: /Exportar Excel/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Detallado' }));
    await waitFor(() => expect(exportarExploradorMangasScm).toHaveBeenCalledWith(expect.objectContaining({ q: 'M-0001' }), 'DETALLADO'));
  });

  it('carga el detalle directo desde la ruta física y no deja la ficha vacía', async () => {
    const router = createMemoryRouter(
      [{ path: '/control/mangas/:publicId', element: <MangaExplorerDetailRoute /> }],
      { initialEntries: ['/control/mangas/manga-1'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Pieza crema')).toBeInTheDocument();
    expect(obtenerDetalleMangaScm).toHaveBeenCalledWith('manga-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('devuelve el detalle a la ruta del explorador conservando los filtros compatibles', async () => {
    const router = createMemoryRouter(
      [{ path: '/control/mangas/:publicId', element: <MangaExplorerDetailRoute /> }],
      {
        initialEntries: [{
          pathname: '/control/mangas/manga-1',
          state: { returnFilters: { q: 'M-0001', desde: '2026-08-01', page: 2 } },
        }],
      },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText('Pieza crema');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(router.state.location.pathname).toBe('/control/mangas');
    expect(router.state.location.search).toBe('?q=M-0001&desde=2026-08-01&pagina=2');
  });

  it('serializa fechaTipo como fecha_tipo al volver del detalle final', async () => {
    const router = createMemoryRouter(
      [{ path: '/control/mangas/:publicId', element: <MangaExplorerDetailRoute /> }],
      {
        initialEntries: [{
          pathname: '/control/mangas/manga-1',
          state: { returnFilters: { fechaTipo: 'PESAJE_FINAL', page: 1 } },
        }],
      },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText('Pieza crema');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(router.state.location.search).toBe('?fecha_tipo=PESAJE_FINAL&pagina=1');
  });

  it('muestra el rango visible real y bloquea el siguiente cursor cuando termina', async () => {
    const firstPage = Array.from({ length: 4 }, (_, index) => ({
      ...item,
      manga: { ...item.manga, public_id: `manga-${index}`, codigo: `M-000${index + 1}` },
    }));
    listarExploradorMangasScm
      .mockResolvedValueOnce({ items: firstPage, page: { next_cursor: 'cursor-2', has_more: true, limit: 25 } })
      .mockResolvedValueOnce({ items: [item], page: { next_cursor: null, has_more: false, limit: 25 } });
    open();
    expect(await screen.findByText('1–4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('26–26 · última página')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
});
