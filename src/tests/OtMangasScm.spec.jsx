import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import OtMangasScm from '../components/OtMangasScm';

const scmMocks = vi.hoisted(() => ({
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  listarOtScm: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
  obtenerPesajeMangaScm: vi.fn(),
  anularPesajeScm: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getTrabajadores: vi.fn().mockResolvedValue([{ id: 8, activo: true, roles: [{ codigo: 'MAQUINISTA' }] }]),
  obtenerMaquinas: vi.fn().mockResolvedValue([{ id: 4, codigo: 'INY-01', nombre: 'Inyectora' }]),
}));

vi.mock('../services/scmOtApi', () => ({
  agregarMangasNormalesScm: vi.fn(),
  anularMangaScm: vi.fn(),
  anularPesajeScm: scmMocks.anularPesajeScm,
  aprobarMangaExtraScm: vi.fn(),
  aprobarCorreccionPesajeScm: vi.fn(),
  cambiarEstadoOtScm: vi.fn(),
  crearOtScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarOtScm: scmMocks.listarOtScm,
  listarSolicitudesMangaExtraScm: scmMocks.listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm: scmMocks.listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm: scmMocks.obtenerPesajeMangaScm,
  obtenerPlanMangas: scmMocks.obtenerPlanMangas,
  recalcularPlanMangas: vi.fn(),
  reemplazarEtiquetaScm: vi.fn(),
  solicitarCorreccionPesajeScm: vi.fn(),
  solicitarMangaExtraScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (_error, fallback) => fallback,
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Jefe de Producci??n' },
  }),
}));

const weighingDetail = {
  original: {
    public_id: 'weigh-1',
    peso_bruto_kg: '10.100',
    tara_kg: '0.100',
    peso_fisico_neto_kg: '10.000',
    cantidad_confirmada: '100.000',
    kg_produccion_ot: '10.000',
  },
  vigente: {
    peso_bruto_kg: '10.100',
    tara_kg: '0.100',
    peso_fisico_neto_kg: '10.000',
    cantidad_confirmada: '100.000',
    kg_produccion_ot: '10.000',
  },
  anulacion: null,
  correcciones: [],
};

describe('OT y mangas SCM: anulaci??n controlada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-1', codigo: 'OF-001', estado: 'LIBERADA',
        maquina_prevista_id: 4,
        corridas: [{ id: 'run-1', codigo: 'COR-1', estado: 'LIBERADA', ciclos_objetivo: 100 }],
      }],
    });
    scmMocks.obtenerPlanMangas.mockResolvedValue({
      plan: {
        revision: 1,
        lineas: [{
          id: 11,
          corrida_fabricacion_id: 'run-1',
          articulo: { nombre: 'Asa roja' },
          tipo_manga: { nombre: 'Manga 100' },
          cantidad_objetivo_un: 100,
          capacidad_efectiva_un: 100,
          mangas_propuestas: 1,
          saldo_un: 0,
        }],
      },
    });
    scmMocks.listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'ot-1', codigo_ot: 'OT-001', fecha_operativa: '2026-08-03',
        estado: 'EN_EJECUCION', version: 2,
        mangas: [{
          public_id: 'manga-1', codigo: 'MNG-001', articulo_nombre: 'Asa roja',
          color: 'ROJO', tipo: 'NORMAL', cantidad_asignada_un: 100,
          estado: 'PENDIENTE_RECEPCION_ALMACEN',
          etiqueta_vigente: { public_id: 'label-1', estado: 'IMPRESA' },
        }],
      }],
    });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({ items: [] });
    scmMocks.obtenerPesajeMangaScm.mockResolvedValue(weighingDetail);
    scmMocks.anularPesajeScm.mockResolvedValue({
      manga: { estado: 'ANULADA' },
      plan: { cantidad_devuelta_un: '100.000' },
    });
  });

  it('permite a JP anular el pesaje con motivo desde el detalle SCM', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OtMangasScm />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Ver pesaje' }));
    const annulButton = await screen.findByRole('button', {
      name: 'Anular pesaje definitivamente',
    });
    expect(annulButton).toBeDisabled();

    await user.type(screen.getByLabelText('Motivo de anulaci??n'), 'Manga descartada por identificaci??n incorrecta');
    await user.type(screen.getByLabelText('Evidencia opcional'), 'INC-2026-08-03');
    await user.click(annulButton);

    await waitFor(() => expect(scmMocks.anularPesajeScm).toHaveBeenCalledWith(
      'weigh-1',
      {
        motivo: 'Manga descartada por identificaci??n incorrecta',
        evidencia: 'INC-2026-08-03',
      },
    ));
    expect(await screen.findByText(/los QR quedaron invalidados/i)).toBeVisible();
  });
});
