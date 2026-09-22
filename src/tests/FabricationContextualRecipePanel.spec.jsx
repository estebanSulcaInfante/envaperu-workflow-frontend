import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FabricationContextualRecipePanel from '../components/FabricationContextualRecipePanel';
import { crearFormulacionContextualScm } from '../services/scmOtApi';

const auth = vi.hoisted(() => ({ publish: true }));

vi.mock('../services/api', () => ({
  obtenerFamiliasColor: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Sólido', activo: true }]),
  obtenerIngredientesRecetaColor: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/scmCatalogApi', () => ({
  listarCategoriasRecepcionScm: vi.fn().mockResolvedValue([{
    id: 3, codigo: 'MP', nombre: 'Materias primas', activo: true,
  }]),
}));
vi.mock('../services/scmOtApi', () => ({
  crearFormulacionContextualScm: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability !== 'FORMULACION_PUBLICAR_DIRECTO' || auth.publish,
    canAny: () => true,
  }),
}));

const order = { id: 'of-1', version: 4 };
const run = { id: 'run-1', codigo: 'OF-1-C01', salidas: [] };

describe('Formulación contextual de OF', () => {
  beforeEach(() => {
    crearFormulacionContextualScm.mockReset();
    auth.publish = true;
  });

  it('manda material nuevo, porcentajes y aprobación en una sola operación', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    crearFormulacionContextualScm.mockResolvedValue({ receta: { estado: 'APROBADA' } });
    render(<FabricationContextualRecipePanel
      order={order} run={run} colorId={7} colors={[{ id: 7, nombre: 'Rojo', activo: true }]}
      onSaved={onSaved}
    />);

    await waitFor(() => expect(screen.queryByText(/Cargando colores/)).not.toBeInTheDocument());
    await user.type(screen.getByLabelText('Nombre de variante'), 'Rojo piloto');
    await user.click(screen.getByLabelText('Material 1'));
    await user.click(screen.getByRole('option', { name: '+ Crear materia prima' }));
    await user.type(screen.getByLabelText('Porcentaje (%)'), '100');
    await user.type(screen.getByLabelText('Nombre del material nuevo'), 'PP prueba');
    await user.click(screen.getByLabelText('Categoría de recepción'));
    await user.click(screen.getByRole('option', { name: 'MP · Materias primas' }));
    await user.click(screen.getByRole('button', { name: 'Aprobar y seleccionar' }));

    expect(crearFormulacionContextualScm).toHaveBeenCalledTimes(1);
    const [ofId, runId, payload, key] = crearFormulacionContextualScm.mock.calls[0];
    expect([ofId, runId, payload.version, payload.accion]).toEqual([
      'of-1', 'run-1', 4, 'APROBAR_SELECCIONAR',
    ]);
    expect(key).toBeTruthy();
    expect(payload.materiales_nuevos).toEqual([expect.objectContaining({
      nombre: 'PP prueba', clase: 'MATERIA_PRIMA', categoria_recepcion_id: 3,
    })]);
    expect(payload.receta.lineas).toEqual([expect.objectContaining({
      tipo_componente: 'MATERIA_PRIMA', cantidad: 1,
      material_client_id: payload.materiales_nuevos[0].client_id,
    })]);
    expect(onSaved).toHaveBeenCalledWith({ receta: { estado: 'APROBADA' } });
  });

  it('permite guardar un borrador parcial sin mostrar publicación a un actor sin permiso', async () => {
    auth.publish = false;
    const user = userEvent.setup();
    crearFormulacionContextualScm.mockResolvedValue({ receta: { estado: 'BORRADOR' } });
    render(<FabricationContextualRecipePanel
      order={order} run={run} colorId={7} colors={[{ id: 7, nombre: 'Rojo', activo: true }]}
      onSaved={vi.fn()}
    />);

    await waitFor(() => expect(screen.queryByText(/Cargando colores/)).not.toBeInTheDocument());
    await user.type(screen.getByLabelText('Nombre de variante'), 'Borrador parcial');
    await user.click(screen.getByLabelText('Material 1'));
    await user.click(screen.getByRole('option', { name: '+ Crear materia prima' }));
    await user.type(screen.getByLabelText('Porcentaje (%)'), '70');
    await user.type(screen.getByLabelText('Nombre del material nuevo'), 'PP piloto');
    await user.click(screen.getByLabelText('Categoría de recepción'));
    await user.click(screen.getByRole('option', { name: 'MP · Materias primas' }));
    expect(screen.queryByRole('button', { name: 'Aprobar y seleccionar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(crearFormulacionContextualScm).toHaveBeenCalledWith(
      'of-1', 'run-1', expect.objectContaining({
        accion: 'GUARDAR_BORRADOR',
        receta: expect.objectContaining({
          lineas: [expect.objectContaining({ cantidad: 0.7 })],
        }),
      }), expect.any(String),
    );
  });
});
