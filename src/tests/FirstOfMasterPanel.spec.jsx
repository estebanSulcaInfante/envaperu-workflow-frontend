import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FirstOfMasterPanel from '../components/firstOf/FirstOfMasterPanel';

const auth = vi.hoisted(() => ({ article: true, publish: true }));

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn(),
  crearColor: vi.fn(),
  actualizarColor: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerIngredientesRecetaColor: vi.fn(),
  obtenerRecetasColorMaestras: vi.fn(),
  crearRecetaColorMaestra: vi.fn(),
  actualizarRecetaColorMaestra: vi.fn(),
}));
vi.mock('../services/scmCatalogApi', () => ({
  crearMaterialScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability === 'ARTICULO_ADMINISTRAR'
      ? auth.article : capability === 'FORMULACION_PUBLICAR_DIRECTO' ? auth.publish : false,
    canAny: () => auth.article,
  }),
}));

import {
  actualizarRecetaColorMaestra,
  crearColor,
  crearRecetaColorMaestra,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerRecetasColorMaestras,
} from '../services/api';
import { crearMaterialScm, listarCategoriasRecepcionScm } from '../services/scmCatalogApi';

const color = {
  id: 7, nombre: 'AMARILLO SOLIDO', codigo: 'CP-000007', color_base_nombre: 'AMARILLO',
  familia_color_id: 3, familia_color_nombre: 'SOLIDO', hex_referencia: '#F2C94C', activo: true, version: 2,
};
const ingredient = { id: 11, codigo: 'MP-001', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: true };

beforeEach(() => {
  vi.clearAllMocks();
  auth.article = true;
  auth.publish = true;
  obtenerColores.mockResolvedValue([color]);
  obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO', activo: true }]);
  obtenerIngredientesRecetaColor.mockResolvedValue([ingredient]);
  obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
  listarCategoriasRecepcionScm.mockResolvedValue([{ id: 4, codigo: 'RESINA', nombre: 'Resina', activo: true }]);
  crearColor.mockResolvedValue({ ...color, id: 8, nombre: 'VERDE SOLIDO', codigo: 'CP-000008' });
  crearRecetaColorMaestra.mockResolvedValue({ id: 20, revision: 1, estado: 'BORRADOR' });
  actualizarRecetaColorMaestra.mockResolvedValue({ id: 20, revision: 1, estado: 'BORRADOR' });
  crearMaterialScm.mockResolvedValue({ id: 18, codigo: 'MP-018', nombre: 'PP NUEVO', clase: 'MATERIA_PRIMA', activo: true });
});

describe('FirstOfMasterPanel', () => {
  it('conserva el bloqueo de receta incierta al navegar y si falla su consulta de recuperación', async () => {
    const user = userEvent.setup();
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout receta'));
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} />);
    await user.type(await screen.findByLabelText(/Nombre de variante/), 'Receta conservada');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText(/No se confirmó la respuesta/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver al catálogo' }));
    expect(screen.getByRole('button', { name: 'Nueva receta' })).toBeDisabled();
    obtenerRecetasColorMaestras.mockRejectedValueOnce(new Error('consulta sin conexión'));
    await user.click(screen.getByRole('button', { name: 'Recargar catálogo' }));
    expect(await screen.findByText('consulta sin conexión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva receta' })).toBeDisabled();
    obtenerRecetasColorMaestras.mockResolvedValueOnce({ items: [{ id: 42, color_produccion_id: 7, nombre_variante: 'Receta conservada', estado: 'BORRADOR' }] });
    await user.click(screen.getByRole('button', { name: 'Recargar catálogo' }));
    expect(await screen.findByRole('row', { name: /Receta conservada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva receta' })).not.toBeDisabled();
    expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1);
  });

  it('recupera un material incierto consultando materiales, conservando la receta sin repetir su POST', async () => {
    const user = userEvent.setup();
    crearMaterialScm.mockRejectedValueOnce(new Error('timeout material'));
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} />);
    await user.type(await screen.findByLabelText(/Nombre de variante/), 'Receta intacta');
    await user.click(screen.getByRole('button', { name: 'Agregar componente' }));
    await user.click(screen.getAllByLabelText(/Material/)[0]);
    await user.click(screen.getByRole('option', { name: /Crear materia prima/ }));
    await user.type(screen.getByLabelText(/Nombre del material/), 'Material conservado');
    await user.click(screen.getByLabelText(/Categoría de recepción/));
    await user.click(screen.getByRole('option', { name: 'Resina · RESINA' }));
    await user.click(screen.getByRole('button', { name: 'Crear y volver' }));
    expect(await screen.findByText(/No se confirmó la respuesta/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver al catálogo' }));
    expect(screen.getByRole('button', { name: 'Nueva receta' })).toBeDisabled();
    obtenerIngredientesRecetaColor.mockRejectedValueOnce(new Error('materiales sin conexión'));
    await user.click(screen.getByRole('button', { name: 'Recargar catálogo' }));
    expect(await screen.findByText('materiales sin conexión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva receta' })).toBeDisabled();
    obtenerIngredientesRecetaColor.mockResolvedValueOnce([ingredient, { id: 43, clase: 'MATERIA_PRIMA', nombre: 'Material conservado', codigo: 'MP-043', activo: true }]);
    await user.click(screen.getByRole('button', { name: 'Recargar catálogo' }));
    expect(await screen.findByLabelText(/Nombre de variante/)).toHaveValue('Receta intacta');
    await user.click(screen.getAllByLabelText(/Material/)[0]);
    expect(screen.getByRole('option', { name: /Material conservado/ })).toBeInTheDocument();
    expect(crearMaterialScm).toHaveBeenCalledTimes(1);
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('crea color con familia y HEX usando la identidad devuelta por API', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<FirstOfMasterPanel kind="color" mode="create" onBack={vi.fn()} onSelect={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/Nombre del color/), 'Verde');
    await user.click(screen.getByLabelText(/Familia de color/));
    await user.click(screen.getByRole('option', { name: 'SOLIDO', exact: true }));
    await user.type(screen.getByLabelText('HEX de referencia (opcional)'), '#22AA44');
    await user.click(screen.getByRole('button', { name: 'Guardar y seleccionar' }));

    await waitFor(() => expect(crearColor).toHaveBeenCalledWith({
      nombre: 'Verde', familia_color_id: 3, hex_referencia: '#22AA44', activo: true,
    }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }), {
      kind: 'color', selectable: true, pending: false,
    });
  });

  it('filtra recetas por color exacto y solo permite seleccionar aprobadas', async () => {
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [
      { id: 20, color_produccion_id: 7, nombre_variante: 'Borrador', estado: 'BORRADOR', revision: 1, lineas: [] },
      { id: 21, color_produccion_id: 7, nombre_variante: 'Lista', estado: 'APROBADA', revision: 2, lineas: [] },
    ] });
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FirstOfMasterPanel kind="recipe" mode="catalog" colorId={7} onBack={vi.fn()} onSelect={onSelect} onSaved={vi.fn()} />);

    await waitFor(() => expect(obtenerRecetasColorMaestras).toHaveBeenCalledWith({
      color_produccion_id: 7, include_inactive: true,
    }));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
    const draft = screen.getByRole('row', { name: /Borrador/ });
    expect(within(draft).queryByRole('button', { name: /Seleccionar/ })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('row', { name: /Lista/ })).getByRole('button', { name: /Seleccionar/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 21, estado: 'APROBADA' }));
  });

  it('conserva la formulación al crear material y vuelve con el material seleccionado', async () => {
    const user = userEvent.setup();
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/Nombre de variante/), 'Piloto');
    await user.click(screen.getByRole('button', { name: 'Agregar componente' }));
    const materialSelect = screen.getAllByLabelText(/Material/)[0];
    await user.click(materialSelect);
    await user.click(screen.getByRole('option', { name: /Crear materia prima/ }));
    await user.type(screen.getByLabelText(/Nombre del material/), 'PP NUEVO');
    await user.click(screen.getByLabelText(/Categoría de recepción/));
    await user.click(screen.getByRole('option', { name: 'Resina · RESINA' }));
    await user.click(screen.getByRole('button', { name: 'Crear y volver' }));

    await waitFor(() => expect(crearMaterialScm).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'PP NUEVO', clase: 'MATERIA_PRIMA', categoria_recepcion_id: 4,
    })));
    expect(screen.getByLabelText(/Nombre de variante/)).toHaveValue('Piloto');
    expect(screen.getAllByLabelText(/Material/)[0]).toHaveTextContent('PP NUEVO');
  });

  it('oculta aprobación sin permiso y guarda borrador como pendiente no seleccionable', async () => {
    auth.publish = false;
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={onSaved} />);
    await user.type(screen.getByLabelText(/Nombre de variante/), 'Borrador');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({
      color_produccion_id: 7, estado: 'BORRADOR', nombre_variante: 'Borrador',
    })));
    expect(screen.queryByRole('button', { name: /Aprobar y seleccionar/ })).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }), {
      kind: 'recipe', selectable: false, pending: true, scope: null,
    });
  });

  it('edita un borrador con PUT lógico conservando id y versión', async () => {
    const user = userEvent.setup();
    obtenerRecetasColorMaestras.mockResolvedValueOnce({ items: [{
      id: 20, color_produccion_id: 7, nombre_variante: 'Borrador', estado: 'BORRADOR', revision: 1,
      version: 4, base_virgen_kg: 25, notas: '', es_default: false, lineas: [],
    }] });
    render(<FirstOfMasterPanel kind="recipe" mode="detail" colorId={7} selectedId={20} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Borrador')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Editar receta' }));
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(actualizarRecetaColorMaestra).toHaveBeenCalledWith(20, expect.objectContaining({ version: 4, estado: 'BORRADOR' })));
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('abre el color seleccionado directamente para editar sin solicitar el catálogo completo', async () => {
    render(<FirstOfMasterPanel kind="color" mode="edit" selectedId={7} initialEntity={color} />);
    expect(await screen.findByRole('heading', { name: 'Editar color de producción' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del color/)).toHaveValue('AMARILLO');
    expect(obtenerColores).not.toHaveBeenCalled();
    expect(obtenerFamiliasColor).toHaveBeenCalledTimes(1);
  });

  it('distingue rechazo HTTP confirmado de timeout y bloquea el segundo POST incierto', async () => {
    const user = userEvent.setup();
    const confirmed = { response: { status: 400, data: { error: 'Nombre inválido' } } };
    crearColor.mockRejectedValueOnce(confirmed);
    const { unmount } = render(<FirstOfMasterPanel kind="color" mode="create" onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.type(await screen.findByLabelText(/Nombre del color/), 'Verde');
    await user.click(screen.getByLabelText(/Familia de color/));
    await user.click(screen.getByRole('option', { name: 'SOLIDO', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar y seleccionar' }));
    expect(await screen.findByText('Nombre inválido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar y seleccionar' })).not.toBeDisabled();
    unmount();

    const timeout = new Error('timeout');
    crearColor.mockRejectedValueOnce(timeout);
    render(<FirstOfMasterPanel kind="color" mode="create" onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.type(await screen.findByLabelText(/Nombre del color/), 'Azul');
    await user.click(screen.getByLabelText(/Familia de color/));
    await user.click(screen.getByRole('option', { name: 'SOLIDO', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar y seleccionar' }));
    expect(await screen.findByText(/No se confirmó la respuesta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar y seleccionar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Volver al catálogo' }));
    expect(screen.getByRole('heading', { name: /Catálogo de colores/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo color' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Recargar catálogo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo color' })).not.toBeDisabled());
    expect(crearColor).toHaveBeenCalledTimes(2);
  });

  it('bloquea navegación mientras una mutación está pendiente', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    crearColor.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<FirstOfMasterPanel kind="color" mode="create" onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.type(await screen.findByLabelText(/Nombre del color/), 'Pendiente');
    await user.click(screen.getByLabelText(/Familia de color/));
    await user.click(screen.getByRole('option', { name: 'SOLIDO', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar y seleccionar' }));
    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    resolveRequest({ id: 9, nombre: 'Pendiente' });
  });

  it('no ofrece como seleccionable una receta aprobada con alcance de producto', async () => {
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [
      { id: 30, color_produccion_id: 7, nombre_variante: 'Genérica', estado: 'APROBADA', revision: 1, producto_sku: null, lineas: [] },
      { id: 31, color_produccion_id: 7, nombre_variante: 'SKU específico', estado: 'APROBADA', revision: 1, producto_sku: 'SKU-01', lineas: [] },
    ] });
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FirstOfMasterPanel kind="recipe" mode="catalog" colorId={7} onBack={vi.fn()} onSelect={onSelect} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('SKU específico')).toBeInTheDocument());
    expect(within(screen.getByRole('row', { name: /SKU específico/ })).queryByRole('button', { name: 'Seleccionar' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('row', { name: /Genérica/ })).getByRole('button', { name: 'Seleccionar' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }));
  });

  it('confirma descarte de cambios al salir de una receta', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.type(await screen.findByLabelText(/Nombre de variante/), 'Sin guardar');
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('heading', { name: /Crear receta/ })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('heading', { name: /Catálogo de recetas/ })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('no pide confirmación al volver desde un catálogo limpio', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    render(<FirstOfMasterPanel kind="recipe" mode="catalog" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('confirma el descarte del hijo material y conserva la receta', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Agregar componente' }));
    await user.click(screen.getAllByLabelText(/Material/)[0]);
    await user.click(screen.getByRole('option', { name: /Crear materia prima/ }));
    await user.type(screen.getByLabelText(/Nombre del material/), 'Sin guardar');
    await user.click(screen.getByRole('button', { name: 'Volver a receta' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Crear material' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Volver a receta' }));
    expect(screen.getByRole('heading', { name: 'Crear receta de color' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('emite busy false antes de un callback que desmonta el panel', async () => {
    const user = userEvent.setup();
    const busyStates = [];
    let panel;
    crearColor.mockResolvedValueOnce({ id: 9, nombre: 'Desmontaje' });
    panel = render(<FirstOfMasterPanel
      kind="color" mode="create" onBack={vi.fn()} onSelect={vi.fn()}
      onBusyChange={(value) => busyStates.push(value)}
      onSaved={() => panel.unmount()}
    />);
    await user.type(await screen.findByLabelText(/Nombre del color/), 'Desmontaje');
    await user.click(screen.getByLabelText(/Familia de color/));
    await user.click(screen.getByRole('option', { name: 'SOLIDO', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Guardar y seleccionar' }));
    await waitFor(() => expect(busyStates).toEqual([true, false]));
  });

  it('separa colorante y aditivo por tipo_colorante real', async () => {
    obtenerIngredientesRecetaColor.mockResolvedValue([
      ingredient,
      { id: 12, codigo: 'COL-01', nombre: 'Colorante amarillo', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
      { id: 13, codigo: 'ADI-01', nombre: 'Aditivo natural', clase: 'COLORANTE', tipo_colorante: 'ADITIVO', activo: true },
    ]);
    const user = userEvent.setup();
    render(<FirstOfMasterPanel kind="recipe" mode="create" colorId={7} onBack={vi.fn()} onSelect={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Agregar componente' }));
    const roles = screen.getAllByLabelText('Rol');
    await user.click(roles[0]);
    await user.click(screen.getByRole('option', { name: 'Aditivo' }));
    await user.click(screen.getAllByLabelText(/Material/)[0]);
    expect(screen.getByRole('option', { name: /Aditivo natural/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Colorante amarillo/ })).not.toBeInTheDocument();
  });

  it('abre edición directa desde la entidad recibida sin cargar el catálogo completo', async () => {
    const selectedRecipe = {
      id: 91, version: 4, revision: 2, estado: 'BORRADOR', color_produccion_id: 7,
      nombre_variante: 'Rojo base', producto_sku: '', base_virgen_kg: 25, notas: 'Notas', es_default: false,
      lineas: [{ id: 801, material_id: 11, material_nombre: 'PP VIRGEN', tipo_componente: 'MATERIA_PRIMA', cantidad: 1 }],
    };
    render(<FirstOfMasterPanel kind="recipe" mode="edit" colorId={7} selectedId={91} initialEntity={selectedRecipe} />);
    expect(await screen.findByRole('heading', { name: 'Editar receta de color' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre de variante/)).toHaveValue('Rojo base');
    expect(obtenerRecetasColorMaestras).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(actualizarRecetaColorMaestra).toHaveBeenCalledWith(91, expect.objectContaining({ version: 4 })));
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('duplica la entidad recibida como borrador sin identidad ni historial y no persiste al abrir', async () => {
    const selectedRecipe = {
      id: 92, version: 3, revision: 5, estado: 'APROBADA', color_produccion_id: 7,
      nombre_variante: 'Rojo aprobado', producto_sku: 'SKU-7', base_virgen_kg: 40, notas: 'Base de prueba', es_default: true,
      lineas: [{ id: 802, material_id: 11, material_nombre: 'PP VIRGEN', tipo_componente: 'MATERIA_PRIMA', cantidad: 1 }],
    };
    const user = userEvent.setup();
    render(<FirstOfMasterPanel kind="recipe" mode="duplicate" colorId={7} selectedId={92} initialEntity={selectedRecipe} />);
    expect(await screen.findByRole('heading', { name: 'Crear receta de color' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre de variante/)).toHaveValue('Rojo aprobado (copia)');
    expect(screen.getByLabelText(/Producto SKU/)).toHaveValue('SKU-7');
    expect(obtenerRecetasColorMaestras).not.toHaveBeenCalled();
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
    await user.dblClick(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1));
    const payload = crearRecetaColorMaestra.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'BORRADOR', es_default: false, producto_sku: 'SKU-7', base_virgen_kg: 40, notas: 'Base de prueba' });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('version');
    expect(payload).not.toHaveProperty('revision');
    expect(payload.lineas[0]).not.toHaveProperty('id');
  });

  it('conserva el borrador directo tras un error confirmado y permite reintentar sin cargar el catalogo', async () => {
    const user = userEvent.setup();
    crearRecetaColorMaestra.mockRejectedValueOnce({ response: { data: { message: 'Fallo confirmado al guardar' } } });
    render(<FirstOfMasterPanel kind="recipe" mode="create-direct" colorId={7} onBack={vi.fn()} onSaved={vi.fn()} />);

    await user.type(await screen.findByLabelText(/Nombre de variante/), 'Receta recuperable');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText('Fallo confirmado al guardar')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre de variante/)).toHaveValue('Receta recuperable');
    expect(obtenerRecetasColorMaestras).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(2));
  });

  it('advierte que editar una receta aprobada crea revisión nueva mediante PUT', async () => {
    const selectedRecipe = {
      id: 93, version: 8, revision: 4, estado: 'APROBADA', color_produccion_id: 7,
      nombre_variante: 'Rojo aprobado', producto_sku: '', base_virgen_kg: 25, notas: '', es_default: true,
      lineas: [{ id: 803, material_id: 11, tipo_componente: 'MATERIA_PRIMA', cantidad: 1 }],
    };
    render(<FirstOfMasterPanel kind="recipe" mode="edit" colorId={7} selectedId={93} initialEntity={selectedRecipe} />);
    expect(await screen.findByText(/crea una nueva revisión y retira la revisión de origen/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(actualizarRecetaColorMaestra).toHaveBeenCalledWith(93, expect.objectContaining({ version: 8 })));
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });
});
