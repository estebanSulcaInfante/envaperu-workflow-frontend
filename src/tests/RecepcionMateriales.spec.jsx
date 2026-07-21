import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import RecepcionMateriales from '../components/RecepcionMateriales';

const renderPage = (initialPath = '/materiales/recepciones') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/materiales/recepciones" element={<RecepcionMateriales />} />
        <Route path="/materiales/recepciones/nueva" element={<RecepcionMateriales />} />
        <Route path="/materiales/recepciones/:recepcionId" element={<RecepcionMateriales />} />
        <Route path="/materiales/recepciones/:recepcionId/editar" element={<RecepcionMateriales />} />
        <Route path="/materiales/compras" element={<RecepcionMateriales />} />
        <Route path="/materiales/inventario" element={<RecepcionMateriales />} />
        <Route path="/materiales/documentos" element={<RecepcionMateriales />} />
        <Route path="/materiales/catalogos" element={<RecepcionMateriales />} />
        <Route path="/materiales/configuracion" element={<RecepcionMateriales />} />
        <Route path="/materiales/cobertura" element={<RecepcionMateriales />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('US-010A: prototipo local de recepción trazable', () => {
  it('declara que opera solo con mocks y representa virgen sin pesaje interno', async () => {
    renderPage('/materiales/recepciones/REC-000184');

    expect(await screen.findByRole('heading', { name: /Recepción trazable de materiales/i })).toBeInTheDocument();
    expect(screen.getByTestId('data-source')).toHaveTextContent('MOCK LOCAL');
    expect(screen.getByText(/No realiza llamadas HTTP ni toca una base de datos/i)).toBeInTheDocument();
    expect(screen.getByTestId('physical-total')).toHaveTextContent('5,000.000 kg');
    expect(screen.getByTestId('internal-weight')).toHaveTextContent('No medido');
    expect(screen.getByText(/no afirma haber pesado esta entrega/i)).toBeInTheDocument();
  });

  it('explica la modalidad virgen y bloquea una discrepancia de conteo', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/nueva');

    expect(await screen.findByRole('heading', { name: /Nueva recepción de materia prima/i })).toBeInTheDocument();
    expect(screen.getByTestId('draft-internal-weight')).toHaveTextContent('NO MEDIDO');
    expect(screen.getByTestId('accepted-weight')).toHaveTextContent('5,000.000 kg');
    expect(screen.getByTestId('weight-difference')).toHaveTextContent('No aplica sin pesaje');

    const receivedPackages = screen.getByLabelText('Bolsas recibidas');
    await user.clear(receivedPackages);
    await user.type(receivedPackages, '199');

    expect(screen.getAllByText(/Gerencia debe decidir antes de confirmar/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Confirmar y crear lote mock' })).toBeDisabled();
  });

  it('cambia a segunda, suma pesos bolsa por bolsa y conserva la diferencia', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/nueva');
    await screen.findByRole('heading', { name: /Nueva recepción de materia prima/i });

    await user.click(screen.getByLabelText('Regla que gobierna el inventario'));
    await user.click(await screen.findByRole('option', { name: /Segunda · sumar peso manual/i }));

    expect(screen.getByRole('table', { name: 'Editar pesos por bolsa' })).toBeInTheDocument();
    expect(screen.getByTestId('draft-internal-weight')).toHaveTextContent('89.850 kg');
    expect(screen.getByTestId('accepted-weight')).toHaveTextContent('89.850 kg');
    expect(screen.getByTestId('weight-difference')).toHaveTextContent('-0.150 kg');

    await user.click(screen.getByRole('button', { name: 'Agregar bolsa' }));
    expect(screen.getByLabelText('Peso bolsa 4')).toBeInTheDocument();
  });

  it('crea, edita líneas y descarta un borrador de orden en memoria', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/compras');

    expect(await screen.findByRole('heading', { name: 'Órdenes de compra' })).toBeInTheDocument();
    expect(screen.getByText(/La guía del proveedor no sustituye esta autorización interna/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nueva orden' }));
    expect(screen.getByRole('heading', { name: 'Crear orden de compra' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Cantidad autorizada línea 1'));
    await user.type(screen.getByLabelText('Cantidad autorizada línea 1'), '3500');
    await user.click(screen.getByRole('button', { name: 'Agregar línea' }));
    expect(screen.getByLabelText('Material línea 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar línea 2' }));
    await user.click(screen.getByRole('button', { name: 'Crear borrador local' }));

    expect(screen.getAllByText('OCM-DEMO-004')).toHaveLength(2);
    expect(within(screen.getByTestId('purchase-order-detail')).getAllByText('3,500.000 kg')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Editar borrador' }));
    await user.clear(screen.getByLabelText('Cantidad autorizada línea 1'));
    await user.type(screen.getByLabelText('Cantidad autorizada línea 1'), '3750');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios locales' }));
    expect(within(screen.getByTestId('purchase-order-detail')).getAllByText('3,750.000 kg')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Descartar borrador' }));
    expect(screen.queryByTestId('purchase-order-row-OCM-DEMO-004')).not.toBeInTheDocument();
  });

  it('simula aprobación, cancelación y nueva revisión sin persistencia', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/compras');

    await screen.findByRole('heading', { name: 'Órdenes de compra' });
    await user.click(screen.getByTestId('purchase-order-row-OCM-000139'));
    await user.click(screen.getByRole('button', { name: 'Aprobar como Gerencia' }));
    expect(within(screen.getByTestId('purchase-order-detail')).getByText('APROBADA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar orden' }));
    expect(within(screen.getByTestId('purchase-order-detail')).getByText('CANCELADA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear nueva revisión' }));
    expect(within(screen.getByTestId('purchase-order-detail')).getByText('Revisión 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar borrador' })).toBeInTheDocument();
    expect(screen.getByText(/1 revisión anterior conservada/i)).toBeInTheDocument();
  });

  it('presenta participantes y evidencias como configuración CRUD lógica', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/configuracion');

    expect(await screen.findByRole('heading', { name: 'Configuración operativa' })).toBeInTheDocument();
    const participants = screen.getByRole('table', { name: 'Participantes configurables' });
    expect(within(participants).getByText('Gerencia de planta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agregar participante mock' }));
    expect(screen.getByText('Nuevo participante mock')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Evidencias' }));
    const evidence = screen.getByRole('table', { name: 'Tipos de evidencia configurables' });
    expect(within(evidence).getByText('Hoja manual de pesaje')).toBeInTheDocument();
    expect(screen.getByText(/Un archivo ya usado no se edita/i)).toBeInTheDocument();
  });

  it('mantiene separadas existencia física, disponibilidad y Calidad', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/REC-000185');

    expect(await screen.findByTestId('physical-total')).toHaveTextContent('89.850 kg');
    expect(screen.getByTestId('available-total')).toHaveTextContent('60.000 kg');
    await user.click(screen.getByRole('tab', { name: 'Calidad' }));
    expect(screen.getByText(/no cambia la procedencia ni el total físico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar decisión/i })).toBeDisabled();
  });

  it('guarda un borrador editable y confirma una recepción creando inventario local', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/recepciones/nueva');

    await screen.findByRole('heading', { name: /Nueva recepción de materia prima/i });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }));
    expect(await screen.findAllByText('REC-DEMO-003')).toHaveLength(2);
    expect(screen.getByTestId('physical-total')).toHaveTextContent('0.000 kg');
    expect(screen.getByRole('button', { name: 'Editar borrador' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar borrador' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y crear lote mock' }));
    expect(await screen.findByTestId('physical-total')).toHaveTextContent('5,000.000 kg');
    expect(screen.queryByRole('button', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });

  it('administra el catálogo de materias primas con alta, edición y baja lógica', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/catalogos');

    expect(await screen.findByRole('heading', { name: 'Catálogos maestros de recepción' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    await user.type(screen.getByLabelText('Código'), 'MP-DEMO');
    await user.type(screen.getByLabelText('Nombre'), 'Materia prima demo');
    await user.click(screen.getByRole('button', { name: 'Guardar localmente' }));
    expect(screen.getByText('MP-DEMO')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Catálogo materials' });
    const row = within(table).getByText('MP-DEMO').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));
    expect(within(row).getByText('INACTIVO')).toBeInTheDocument();
  });

  it('opera Calidad, movimientos, retención, corrección y devolución sobre lotes mock', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/inventario');

    expect(await screen.findByRole('heading', { name: 'Lotes e inventario' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Calidad y movimientos' }));
    await user.type(screen.getByLabelText('Cantidad a resolver (kg)'), '100');
    await user.click(screen.getByRole('button', { name: 'Aplicar decisión mock' }));
    expect(screen.getByText(/Decisión parcial de Calidad aplicada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Saldos' }));
    await user.click(screen.getByRole('button', { name: 'Registrar retención documental' }));
    expect(screen.getByText(/Retención documental activa/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Correcciones y devolución' }));
    await user.click(screen.getByRole('button', { name: 'Solicitar corrección' }));
    expect(screen.getByText(/Corrección solicitada/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aprobar Gerencia' }));
    expect(screen.getByText(/Corrección aplicada por Gerencia/i)).toBeInTheDocument();
  });

  it('gestiona documentos y reemplaza evidencia sin borrar el adjunto anterior', async () => {
    const user = userEvent.setup();
    renderPage('/materiales/documentos');

    expect(await screen.findByRole('heading', { name: 'Documentos externos' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    expect(screen.getByText(/todavía no autoriza una compra/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adjuntar mock' }));
    const currentAttachment = screen.getByText(/evidencia-DOC-DEMO/i).closest('div');
    await user.click(within(currentAttachment.parentElement).getByRole('button', { name: 'Reemplazar' }));
    expect(screen.getByText(/Evidencia reemplazada sin borrar/i)).toBeInTheDocument();
    expect(screen.getByText(/REEMPLAZADO/)).toBeInTheDocument();
  });

  it('mapea los 46 escenarios de aceptación a superficies visuales', async () => {
    renderPage('/materiales/cobertura');
    expect(await screen.findByRole('heading', { name: 'Cobertura visual REC-01 a REC-46' })).toBeInTheDocument();
    expect(screen.getByText('REC-01')).toBeInTheDocument();
    expect(screen.getByText('REC-46')).toBeInTheDocument();
    expect(screen.getAllByText(/^REC-\d{2}$/)).toHaveLength(46);
    expect(screen.getByText(/REPETIDA_RESUELTA/)).toBeInTheDocument();
  });
});
