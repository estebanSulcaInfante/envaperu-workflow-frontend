import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { useScmActor } = vi.hoisted(() => ({ useScmActor: vi.fn() }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor }));

import QualityPieceStation from '../components/QualityPieceStation';
import { emptyPieceQualityState } from '../components/qualityPieceModel';

const ot = {
  public_id: 'ot-254', codigo_ot: 'OT-000254', fecha_operativa: '2099-10-15', turno: 'DIA', maquina_nombre: 'HT-250 C',
  trabajos_color: [{ id: 'work-red', color: 'ROJO', estado: 'EN_EJECUCION', molde: { codigo: 'M-1' }, salidas: [{ pieza_id: 'pieza-a', nombre: 'Base' }] }],
};

describe('QualityPieceStation · permisos de registro', () => {
  it('mantiene historial/consulta y bloquea registrar sin CALIDAD_CONTROL_REGISTRAR', () => {
    useScmActor.mockReturnValue({ actor: { id: 7 }, loading: false, error: '', can: () => false });
    render(<MemoryRouter initialEntries={['/calidad/estacion/ots/ot-254/registrar?pieza=ot-254%3Awork-red%3Apieza-a&modo=PERIODICA']}>
      <Routes><Route path="/calidad/estacion/ots/:otId/*" element={<QualityPieceStation ot={ot} localState={{ pieceQuality: emptyPieceQualityState() }} setLocalState={() => {}} />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByTestId('quality-station-read-only')).toHaveTextContent('CALIDAD_CONTROL_REGISTRAR');
    expect(screen.getByRole('button', { name: 'Ver historial de visitas' })).toBeVisible();
    expect(screen.queryByTestId('quality-registration')).not.toBeInTheDocument();
  });
});
