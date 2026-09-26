import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

const api = vi.hoisted(() => ({
  list: vi.fn(), detail: vi.fn(), progress: vi.fn(), configure: vi.fn(),
}));

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn().mockResolvedValue([]),
  obtenerMaquinas: vi.fn().mockResolvedValue([]),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
  obtenerRecetasColorMaestras: vi.fn().mockResolvedValue({ items: [] }),
  obtenerMolde: vi.fn(),
}));
vi.mock('../services/scmOtApi', () => ({
  listarOrdenesFabricacionScm: api.list,
  obtenerOrdenFabricacionScm: api.detail,
  anularOrdenFabricacionScm: vi.fn(),
  reemplazarOrdenFabricacionScm: vi.fn(),
  cerrarOrdenFabricacionScm: vi.fn(),
  configurarOrdenFabricacionScm: api.configure,
  crearOrdenFabricacionExcepcionalScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
}));
vi.mock('../services/scmProductionObservabilityApi', () => ({ listarAvanceOfScm: api.progress }));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
  obtenerActorScm: () => 1,
  listarArticulosScm: vi.fn().mockResolvedValue([]),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability !== 'MANGA_PESAJE_VER',
    canAny: () => true,
    experience: { label: 'Revisión local' },
  }),
}));

const order = {
  id: 'of-1',
  codigo: 'OF-000001',
  estado: 'BORRADOR',
  version: 1,
  fuente_proceso: 'EXPLICITO',
  snapshot_proceso: 'INYECCION',
  molde_id: 'M-1',
  snapshot_peso_colada_gr: '0',
  corridas: [{
    id: 'r1',
    codigo: 'C01',
    objetivo_neto_kg: '10',
    salidas: [],
  }],
};

const renderBrowser = () => render(
  <ThemeProvider theme={createTheme()}>
    <BrowserRouter>
      <FabricationOrdersScm />
    </BrowserRouter>
  </ThemeProvider>,
);

const setAppLocation = () => {
  window.history.replaceState({}, '', '/produccion/ordenes-fabricacion');
};

describe('navegación real de OF con BrowserRouter', () => {
  beforeEach(() => {
    setAppLocation();
    api.list.mockReset();
    api.detail.mockReset();
    api.progress.mockReset();
    api.configure.mockReset();
    api.list.mockResolvedValue({ items: [order] });
    api.detail.mockResolvedValue(order);
    api.progress.mockResolvedValue({ items: [] });
  });

  it('cancela Back con cambios mediante diálogo controlado, conserva URL y 26 kg', async () => {
    const user = userEvent.setup();
    renderBrowser();

    await user.click(await screen.findByRole('link', { name: 'Abrir OF-000001' }));
    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '26');
    expect(window.location.search).toBe('?of=of-1');

    window.history.back();

    await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    expect(window.location.search).toBe('?of=of-1');
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: /Objetivo neto/ })).toHaveValue(26));
  });

  it('permite Back al confirmar el descarte y vuelve a la bandeja', async () => {
    const user = userEvent.setup();
    renderBrowser();

    await user.click(await screen.findByRole('link', { name: 'Abrir OF-000001' }));
    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '26');

    window.history.back();

    await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(await screen.findByTestId('of-inbox')).toBeVisible();
    expect(screen.queryByRole('spinbutton', { name: /Objetivo neto/ })).not.toBeInTheDocument();
  });

  it('cancela Actualizar con cambios y conserva el formulario de 26 kg', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/produccion/ordenes-fabricacion?of=of-1');
    renderBrowser();

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '26');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    expect(window.location.search).toBe('?of=of-1');
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: /Objetivo neto/ })).toHaveValue(26));
  });

  it('protege de nuevo tras descartar, reabrir y repetir Back rápidamente', async () => {
    const user = userEvent.setup();
    renderBrowser();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.click(await screen.findByRole('link', { name: 'Abrir OF-000001' }));
      const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
      await user.clear(target);
      await user.type(target, '26');
      window.history.back();
      window.history.back();
      await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
      expect(window.location.search).toBe('?of=of-1');
      expect(target).toHaveValue(26);
      await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
      await waitFor(() => expect(window.location.search).toBe(''));
      expect(await screen.findByTestId('of-inbox')).toBeVisible();
    }
  });

  it('bloquea Back durante un guardado pendiente sin ofrecer descartar el comando', async () => {
    const user = userEvent.setup();
    let finishSave;
    api.configure.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    const backObserved = new Promise((resolve) => window.addEventListener('popstate', resolve, { capture: true, once: true }));
    renderBrowser();
    await user.click(await screen.findByRole('link', { name: 'Abrir OF-000001' }));
    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '26');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(api.configure).toHaveBeenCalledOnce();
    window.history.back();
    window.history.back();
    await backObserved;
    await waitFor(() => expect(window.location.search).toBe('?of=of-1'));
    expect(screen.queryByRole('dialog', { name: 'Cambios sin guardar' })).not.toBeInTheDocument();
    expect(api.configure).toHaveBeenCalledWith('of-1', expect.objectContaining({
      corridas: [expect.objectContaining({ objetivo_neto_kg: 26 })],
    }));
    finishSave(order);
    expect(await screen.findByRole('spinbutton', { name: /Objetivo neto/ })).toBeVisible();
    expect(window.location.search).toBe('?of=of-1');
  });
});
