import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QualityOtContextRedirect } from '../components/quality/QualityOtContextRedirect';
import { obtenerOtScm } from '../services/scmOtApi';

vi.mock('../services/scmOtApi', () => ({ obtenerOtScm: vi.fn() }));

function Sheet() {
  const location = useLocation();
  if (new URLSearchParams(location.search).has('fecha')) return <output>{location.search}</output>;
  return <QualityOtContextRedirect otId="ot-275" location={location} />;
}

function open(search) {
  render(<MemoryRouter initialEntries={['/ots/ot-275' + search]}>
    <Routes><Route path="/ots/:id" element={<Sheet />} /></Routes>
  </MemoryRouter>);
}

const ot = { public_id: 'ot-275', fecha_operativa: '2026-10-27', turno: 'DIA' };

describe('Enlaces a una jornada de Calidad', () => {
  beforeEach(() => obtenerOtScm.mockReset());

  it('recupera la fecha de la OT y conserva el filtro y el destino explícitos', async () => {
    obtenerOtScm.mockResolvedValue({ ot });
    open('?turno=NOCHE&config=visitas');
    const result = await screen.findByText(/fecha=2026-10-27/);
    expect(result).toHaveTextContent('turno=NOCHE');
    expect(result).toHaveTextContent('config=visitas');
    expect(obtenerOtScm).toHaveBeenCalledWith('ot-275', expect.objectContaining({ vista: 'calidad', signal: expect.anything() }));
  });

  it('rechaza otra OT y permite recuperar tras un error', async () => {
    obtenerOtScm.mockResolvedValueOnce({ ...ot, public_id: 'otra' }).mockResolvedValueOnce(ot);
    open('');
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/fecha=2026-10-27/)).toHaveTextContent('turno=DIA');
  });
});
