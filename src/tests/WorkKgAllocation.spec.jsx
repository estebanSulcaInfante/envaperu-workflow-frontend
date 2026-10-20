import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WorkKgAllocation from '../components/WorkKgAllocation';

const line = {
  articulo: { nombre: 'Artículo de prueba' },
  color: 'VERDE',
  tipo_manga: { nombre: 'Manga 100' },
  saldo_un: 0,
  capacidad_efectiva_un: 100,
  mangas_propuestas: 0,
};

const zeroModel = {
  valid: true,
  units: 0,
  input: '0',
  pendingKg: '0',
  capacityKg: '1',
  unitWeightG: '10',
  appliedKg: '0',
  fullBags: 0,
  partialUnits: 0,
  partialKg: '0',
  totalBags: 0,
};

describe('WorkKgAllocation', () => {
  it('mantiene el resumen cero en la variante completa y lo oculta en compacta', () => {
    const { rerender } = render(
      <WorkKgAllocation line={line} model={zeroModel} onEdit={vi.fn()} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Se asignarán 0,00 kg teóricos · 0 un planificadas');

    rerender(
      <WorkKgAllocation line={line} model={zeroModel} onEdit={vi.fn()} compact />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
