import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ControlConsolidationRedirect from '../components/ControlConsolidationRedirect';
import WorkspaceFeatureRoute from '../components/WorkspaceFeatureRoute';

let capabilities = [];
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ actor: { nombre_corto: 'Lector' }, loading: false, error: '',
    canAny: (required) => !required.length || required.some((code) => capabilities.includes(code)) }),
}));

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname}{location.search}{location.hash}</output>;
}

describe('CTL-02 enlaces compatibles', () => {
  it.each([
    ['/control/avance-of?q=azul&of=of-12#objetivos', '/produccion/ordenes-fabricacion?q=azul&of=of-12#objetivos'],
    ['/control/inventario?q=pieza&ubicacion=ALM-1', '/almacen/kardex?q=pieza&ubicacion=ALM-1&vista=almacenes'],
    ['/CONTROL/INVENTARIO/?q=pieza', '/almacen/kardex?q=pieza&vista=almacenes'],
    ['/control/avance-of/?q=azul', '/produccion/ordenes-fabricacion?q=azul'],
  ])('conserva parámetros y fragmento de %s', (from, expected) => {
    render(<MemoryRouter initialEntries={[from]}><Routes>
      <Route path="/control/*" element={<ControlConsolidationRedirect />} />
      <Route path="/produccion/*" element={<Destination />} />
      <Route path="/almacen/*" element={<Destination />} />
    </Routes></MemoryRouter>);
    expect(screen.getByTestId('destination')).toHaveTextContent(expected);
  });

  it.each([false, true])('alias de inventario respeta permiso de lectura además del transversal: %s', (readable) => {
    capabilities = ['INVENTARIO_CONTROL_TRANSVERSAL', ...(readable ? ['INVENTARIO_VER'] : [])];
    render(<MemoryRouter initialEntries={['/control/inventario']}><Routes>
      <Route path="/control/inventario" element={<WorkspaceFeatureRoute featureKey="control.inventory"><ControlConsolidationRedirect /></WorkspaceFeatureRoute>} />
      <Route path="/almacen/kardex" element={<WorkspaceFeatureRoute featureKey="warehouse.kardex"><Destination /></WorkspaceFeatureRoute>} />
    </Routes></MemoryRouter>);
    if (readable) expect(screen.getByTestId('destination')).toHaveTextContent('/almacen/kardex?vista=almacenes');
    else {
      expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Esta vista no corresponde a tu función' })).toBeVisible();
    }
  });
});
