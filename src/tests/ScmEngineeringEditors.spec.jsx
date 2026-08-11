import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ApprovalActionPanel,
  PackagingProfileEditor,
  PackagingRuleEditor,
  ReadinessReviewPanel,
  RouteRevisionEditor,
  StructureRevisionEditor,
  buildPackagingRulePayload,
  buildRoutePayload,
  buildStructurePayload,
} from '../components/scmEngineering/editors';

const renderEditor = (node) => render(
  <ThemeProvider theme={createTheme()}>{node}</ThemeProvider>,
);

const targetProduct = {
  id: 30,
  codigo: 'PT-000030',
  nombre: 'Colador #3',
  clase: 'PRODUCTO_TERMINADO',
  subtipo: { producto_terminado_id: 'PT-000030' },
};

const piece = {
  id: 11,
  codigo: 'PC-000011',
  nombre: 'Cuerpo colador azul',
  clase: 'PIEZA_COLOR',
};

const wip = {
  id: 20,
  codigo: 'WIP-000020',
  nombre: 'Colador prearmado',
  clase: 'SUBENSAMBLE_WIP',
};

describe('editores compartidos de Ingenieria SCM', () => {
  it('mantiene StructureRevisionEditor controlado y usa una sola validacion/payload', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const value = {
      notas: 'Primera revision',
      componentes: [{ articulo_id: '11', cantidad: '2', merma_tecnica_pct: '1.5' }],
    };

    function Harness() {
      const [current, setCurrent] = useState(value);
      return (
        <StructureRevisionEditor
          targetArticle={targetProduct}
          componentArticles={[piece, wip]}
          structures={[]}
          value={current}
          onChange={(next) => {
            onChange(next);
            setCurrent(next);
          }}
          onSubmit={onSubmit}
        />
      );
    }
    renderEditor(<Harness />);

    expect(screen.getByRole('heading', { name: /estructura de PT-000030/i })).toBeVisible();
    expect(screen.getByLabelText('Artículo resultado').value).toMatch(/PT-000030.*Colador #3/);
    expect(screen.getByLabelText('Artículo resultado')).toHaveAttribute('readonly');

    await user.clear(screen.getByLabelText('Cantidad UN'));
    await user.type(screen.getByLabelText('Cantidad UN'), '3');
    expect(onChange).toHaveBeenLastCalledWith({
      ...value,
      componentes: [{ ...value.componentes[0], cantidad: '3' }],
    });

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(onSubmit).toHaveBeenCalledWith(buildStructurePayload({
      ...value,
      componentes: [{ ...value.componentes[0], cantidad: '3' }],
    }));
  });

  it('bloquea la salida terminal de RouteRevisionEditor al PT de la sesion', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = {
      notas: '',
      operaciones: [{
        clave: 'OP1',
        secuencia_visible: '1',
        nombre: 'Soplado final',
        tipo: 'SOPLADO',
        executor_kind: 'OP_OT',
        centro_trabajo_id: '5',
        articulo_salida_id: '999',
        estructura_revision_id: '',
        permite_concurrente: false,
      }],
    };

    renderEditor(
      <RouteRevisionEditor
        targetArticle={targetProduct}
        articles={[piece, wip, targetProduct]}
        centers={[{ id: 5, codigo: 'CT-000005', nombre: 'Sopladora', tipo: 'SOPLADO', activo: true }]}
        structures={[]}
        value={value}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Salida terminal (bloqueada)').value)
      .toMatch(/PT-000030.*Colador #3/);
    expect(screen.getByText(/Esta ruta siempre termina en el producto de la sesión/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Agregar operación' }));
    const changed = onChange.mock.calls.at(-1)[0];
    expect(changed.operaciones).toHaveLength(2);
    expect(changed.operaciones.at(-1).articulo_salida_id).toBe('30');
    expect(changed.operaciones[0].articulo_salida_id).toBe('');
    expect(buildRoutePayload(value, targetProduct).operaciones[0].articulo_salida_id).toBe(30);
  });

  it('expone perfil y regla de empaque como formularios controlados, sin inventar aprobacion', async () => {
    const user = userEvent.setup();
    const profileChange = vi.fn();
    const ruleSubmit = vi.fn();
    const ruleValue = {
      perfil_empacable_id: '8',
      tipo_contenedor_id: '9',
      medicion_fisica_probada: false,
      cantidad_objetivo_un: '24',
      cantidad_maxima_probada_un: '30',
      peso_neto_operativo_max_kg: '8',
      margen_seguridad_kg: '0.5',
      tolerancia_peso_abs_g: '20',
      tolerancia_peso_pct: '1',
      notas: '',
    };

    function ProfileHarness() {
      const [current, setCurrent] = useState({
        nombre: 'Manga colador',
        descripcion_fisica: '',
      });
      return (
        <PackagingProfileEditor
          value={current}
          onChange={(next) => {
            profileChange(next);
            setCurrent(next);
          }}
          onSubmit={vi.fn()}
        />
      );
    }

    renderEditor(
      <>
        <ProfileHarness />
        <PackagingRuleEditor
          value={ruleValue}
          profiles={[{ id: 8, codigo: 'PEM-000008', nombre: 'Manga colador' }]}
          containers={[{ id: 9, codigo: 'TMG-000009', nombre: 'Manga grande' }]}
          onChange={vi.fn()}
          onSubmit={ruleSubmit}
        />
      </>,
    );

    await user.type(screen.getByLabelText('Descripción física'), 'Apilado vertical');
    expect(profileChange).toHaveBeenLastCalledWith({
      nombre: 'Manga colador',
      descripcion_fisica: 'Apilado vertical',
    });

    await user.click(screen.getByRole('button', { name: 'Guardar regla como borrador' }));
    expect(ruleSubmit).toHaveBeenCalledWith(buildPackagingRulePayload(ruleValue));
    expect(screen.getByText(/La medición física sigue pendiente/i)).toBeVisible();
  });

  it('muestra acciones honestas segun estado y capacidades canonicas', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { rerender } = renderEditor(
      <ApprovalActionPanel
        domain="ESTRUCTURA"
        revision={{ id: 1, estado: 'BORRADOR', creada_por_id: 7 }}
        actorId={7}
        capabilities={['ESTRUCTURA_ADMINISTRAR']}
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Borrador')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enviar a aprobación' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Aprobar$/ })).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <ApprovalActionPanel
          domain="ESTRUCTURA"
          revision={{ id: 1, estado: 'PENDIENTE_APROBACION', creada_por_id: 7 }}
          actorId={8}
          capabilities={['ESTRUCTURA_APROBAR']}
          onAction={onAction}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^Aprobar$/ }));
    expect(onAction).toHaveBeenCalledWith('approve', expect.objectContaining({ id: 1 }));
  });

  it('no edita una revision pendiente o aprobada como si siguiera en borrador', () => {
    const { rerender } = renderEditor(
      <StructureRevisionEditor
        targetArticle={targetProduct}
        componentArticles={[piece]}
        structures={[]}
        revision={{ id: 9, estado: 'PENDIENTE_APROBACION' }}
        value={{
          notas: 'En revisión',
          componentes: [{ articulo_id: '11', cantidad: '1', merma_tecnica_pct: '0' }],
        }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/Retírala mediante la acción canónica antes de editar/i))
      .toBeVisible();
    expect(screen.getByLabelText('Notas de revisión')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <StructureRevisionEditor
          targetArticle={targetProduct}
          componentArticles={[piece]}
          structures={[]}
          revision={{ id: 9, estado: 'APROBADA' }}
          value={{
            notas: 'Vigente',
            componentes: [{ articulo_id: '11', cantidad: '1', merma_tecnica_pct: '0' }],
          }}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Crea una nueva revisión basada en ella/i)).toBeVisible();
  });

  it('presenta readiness autoritativo y navega al paso sin finalizar ni crear OP', async () => {
    const user = userEvent.setup();
    const onOpenStep = vi.fn();
    renderEditor(
      <ReadinessReviewPanel
        readiness={{
          status: 'BLOCKED',
          checked_at: '2026-08-10T12:00:00Z',
          items: [{
            code: 'ROUTE_NOT_APPROVED',
            severity: 'BLOCKER',
            paso: 'RUTA_EMPAQUE',
            message: 'La ruta aún no está publicada.',
            action: 'OPEN_STEP',
          }],
        }}
        onValidate={vi.fn()}
        onOpenStep={onOpenStep}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Revisión técnica' })).toBeVisible();
    expect(screen.getByText('Bloqueado')).toBeVisible();
    const blocker = screen.getByRole('listitem', { name: /ruta aún no está publicada/i });
    await user.click(within(blocker).getByRole('button', { name: 'Corregir en Ruta y empaque' }));
    expect(onOpenStep).toHaveBeenCalledWith('RUTA_EMPAQUE');
    expect(screen.queryByRole('button', { name: /crear OP/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /finalizar/i })).not.toBeInTheDocument();
  });
});
