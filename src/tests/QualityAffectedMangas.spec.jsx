import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import QualityAffectedMangas from '../components/QualityAffectedMangas';
import { obtenerOtScm } from '../services/scmOtApi';

vi.mock('../services/scmOtApi', () => ({ obtenerOtScm: vi.fn() }));

const ot = { public_id: 'ot-254', codigo_ot: 'OT-000254' };
const workRed = {
  id: 'work-red',
  color: 'ROJO',
  salidas: [{ pieza_id: 'base', nombre: 'Base' }, { pieza_id: 'tapa', nombre: 'Tapa' }],
  mangas: [
    { public_id: 'manga-1', codigo: 'OF-009-OT-254-M001', trabajo_color_actual_id: 'work-red', salida_id: 'base', etiqueta_vigente: { public_id: 'label-1' } },
    { public_id: 'manga-2', codigo: 'OF-009-OT-254-M002', trabajo_color_actual_id: 'work-red', salida_id: 'tapa', etiqueta_vigente: { public_id: 'label-2' } },
  ],
};
const workOt254RealShape = {
  id: '9a2f9951-88f1-425a-ae2f-7a92126fb2d4',
  articulos_salida: [
    { id: 436, codigo: 'PC-000380', nombre: 'BASE DE REGADERA PLAYERA LILA SÓLIDO' },
    { id: 447, codigo: 'PC-000391', nombre: 'TAPA DE REGADERA PLAYERA LILA SÓLIDO' },
    { id: 448, codigo: 'PC-000392', nombre: 'BOQUILLA DE REGADERA PLAYERA LILA SÓLIDO' },
  ],
  mangas: [{
    public_id: '7ae9ca4e-067b-4042-acc4-446e214dd0d0',
    codigo: 'OF000126-OT254-M001',
    trabajo_color_actual_id: '9a2f9951-88f1-425a-ae2f-7a92126fb2d4',
    pieza_color_sku: 'PC-000380',
    etiqueta_vigente: { public_id: '68f820ab-bc08-45de-8409-2a4d22564299', payload: { qr: { label_id: '68f820ab-bc08-45de-8409-2a4d22564299' } } },
  }],
};
const workOt254Full = {
  ...workOt254RealShape,
  mangas: [
    ...workOt254RealShape.mangas,
    {
      public_id: 'd8ac03bd-7a65-464f-af07-5aa0ff05ae47',
      codigo: 'OF000126-OT254-M002',
      trabajo_color_actual_id: '9a2f9951-88f1-425a-ae2f-7a92126fb2d4',
      pieza_color_sku: 'PC-000391',
      etiqueta_vigente: { public_id: '3a7dc706-13ab-4a47-969c-4c4f35886593', payload: { qr: { label_id: '3a7dc706-13ab-4a47-969c-4c4f35886593' } } },
    },
  ],
};

function Harness({ initial = [], onChangeSpy, ...props }) {
  const [value, setValue] = useState(initial);
  return <QualityAffectedMangas {...props} value={value} onChange={(next) => { setValue(next); onChangeSpy?.(next); }} />;
}

describe('QualityAffectedMangas', () => {
  it('selects several mangas from the selected work and emits the minimum identity', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness ot={ot} work={workRed} onChangeSpy={onChange} />);

    const field = screen.getByRole('combobox', { name: 'Mangas afectadas de este trabajo' });
    await user.click(field);
    await user.click(screen.getByRole('option', { name: /OF-009-OT-254-M001.*Base/ }));
    await user.click(screen.getByRole('option', { name: /OF-009-OT-254-M002.*Tapa/ }));

    expect(onChange).toHaveBeenLastCalledWith([
      { id: 'manga-1', code: 'OF-009-OT-254-M001', outputId: 'base' },
      { id: 'manga-2', code: 'OF-009-OT-254-M002', outputId: 'tapa' },
    ]);
  });

  it('accepts an exact code and a compact label_id QR without duplicating a manga', async () => {
    const user = userEvent.setup();
    render(<Harness ot={ot} work={workRed} />);
    const entry = screen.getByRole('textbox', { name: 'Código o QR de manga' });

    await user.type(entry, 'OF-009-OT-254-M001');
    await user.click(screen.getByRole('button', { name: 'Agregar manga' }));
    expect(screen.getByText('OF-009-OT-254-M001')).toBeVisible();

    fireEvent.change(entry, { target: { value: 'L1:label-2' } });
    await user.keyboard('{Enter}');
    expect(screen.getByText('OF-009-OT-254-M002')).toBeVisible();
    fireEvent.change(entry, { target: { value: '{"v":1,"label_id":"label-2"}' } });
    await user.keyboard('{Enter}');
    expect(screen.getAllByText('OF-009-OT-254-M002')).toHaveLength(1);
  });

  it('fails closed for an ambiguous code and a manga belonging to another work', async () => {
    const user = userEvent.setup();
    const duplicate = { public_id: 'manga-duplicate', codigo: 'OF-009-OT-254-M001', trabajo_color_id: 'work-red', salida_id: 'base', etiqueta_vigente: { public_id: 'label-duplicate' } };
    const other = { public_id: 'manga-blue', codigo: 'OF-010-OT-254-M001', trabajo_color_id: 'work-blue', salida_id: 'base', etiqueta_vigente: { public_id: 'label-blue' } };
    const onChange = vi.fn();
    render(<QualityAffectedMangas ot={ot} work={{ ...workRed, mangas: [...workRed.mangas, duplicate, other] }} value={[]} onChange={onChange} />);
    const entry = screen.getByRole('textbox', { name: 'Código o QR de manga' });
    await user.type(entry, 'OF-009-OT-254-M001');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('más de una');
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(entry);
    await user.type(entry, 'OF-010-OT-254-M001');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('no pertenece');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('loads mangas from the OT detail when the work carries no list', async () => {
    obtenerOtScm.mockResolvedValue({
      ot: {
        ...ot,
        trabajos_color: [{ ...workRed, mangas: [workRed.mangas[0]] }],
      },
    });
    const user = userEvent.setup();
    render(<QualityAffectedMangas ot={ot} work={{ id: 'work-red', salidas: workRed.salidas }} value={[]} onChange={vi.fn()} />);
    expect(obtenerOtScm).toHaveBeenCalledWith('ot-254', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const field = await screen.findByRole('combobox', { name: 'Mangas afectadas de este trabajo' });
    await user.click(field);
    expect(await screen.findByRole('option', { name: /OF-009-OT-254-M001.*Base/ })).toBeVisible();
  });

  it('uses mangas already present in the full OT payload without issuing another GET', async () => {
    obtenerOtScm.mockClear();
    const user = userEvent.setup();
    render(<QualityAffectedMangas ot={{ ...ot, trabajos_color: [workRed] }} work={{ id: 'work-red', salidas: workRed.salidas }} value={[]} onChange={vi.fn()} />);
    expect(obtenerOtScm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Mangas afectadas de este trabajo' }));
    expect(screen.getByRole('option', { name: /OF-009-OT-254-M001.*Base/ })).toBeVisible();
  });

  it('resolves OT-254 real-shape manga output by pieza_color_sku and QR label_id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QualityAffectedMangas ot={{ public_id: 'ot-254' }} work={workOt254RealShape} value={[]} onChange={onChange} />);
    const field = screen.getByRole('combobox', { name: 'Mangas afectadas de este trabajo' });
    await user.click(field);
    await user.click(screen.getByRole('option', { name: /OF000126-OT254-M001.*BASE/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ id: '7ae9ca4e-067b-4042-acc4-446e214dd0d0', code: 'OF000126-OT254-M001', outputId: '436' }]);
  });

  it('resolves the OT-254 label_id inside the simulated compact QR envelope', () => {
    const onChange = vi.fn();
    render(<QualityAffectedMangas ot={{ public_id: 'ot-254' }} work={workOt254RealShape} value={[]} onChange={onChange} />);
    const entry = screen.getByRole('textbox', { name: 'Código o QR de manga' });
    fireEvent.change(entry, { target: { value: '{"v":1,"label_id":"68f820ab-bc08-45de-8409-2a4d22564299"}' } });
    fireEvent.keyDown(entry, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(onChange).toHaveBeenCalledWith([{ id: '7ae9ca4e-067b-4042-acc4-446e214dd0d0', code: 'OF000126-OT254-M001', outputId: '436' }]);
  });

  it('restricts options and QR/code resolution to allowed outputs from the complete wrapped OT', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <QualityAffectedMangas
        ot={{ ot: { trabajos_color: [workOt254Full] } }}
        work={{ id: workOt254Full.id, mangas: workOt254Full.mangas }}
        allowedOutputIds={[447]}
        value={[]}
        onChange={onChange}
      />,
    );
    const field = screen.getByRole('combobox', { name: 'Mangas afectadas de este trabajo' });
    await user.click(field);
    expect(screen.getByRole('option', { name: /OF000126-OT254-M002.*TAPA/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /OF000126-OT254-M001/ })).not.toBeInTheDocument();
    const entry = screen.getByRole('textbox', { name: 'Código o QR de manga' });
    await user.type(entry, 'OF000126-OT254-M001');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('pieza/salida distinta');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers no mangas and rejects a valid manga when allowedOutputIds is empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QualityAffectedMangas ot={workOt254Full} work={workOt254Full} allowedOutputIds={[]} value={[]} onChange={onChange} />);
    expect(screen.getByText('No hay mangas resolubles para este trabajo.')).toBeVisible();
    const entry = screen.getByRole('textbox', { name: 'Código o QR de manga' });
    await user.type(entry, 'OF000126-OT254-M001');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('pieza/salida distinta');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows removing a selected manga and respects disabled state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QualityAffectedMangas ot={ot} work={workRed} value={[{ id: 'manga-1', code: workRed.mangas[0].codigo, outputId: 'base' }]} onChange={onChange} disabled />);
    expect(screen.getByRole('button', { name: /Eliminar OF-009-OT-254-M001/ })).toHaveClass('Mui-disabled');
    expect(screen.getByRole('textbox', { name: 'Código o QR de manga' })).toBeDisabled();
    expect(user).toBeDefined();
  });

  it('keeps a saved association visible while the manga list is unavailable', () => {
    obtenerOtScm.mockImplementation(() => new Promise(() => {}));
    render(<QualityAffectedMangas ot={ot} work={{ id: 'work-red', salidas: workRed.salidas }} value={[{ id: 'manga-real', code: 'OF-009-OT-254-M099', outputId: 'base' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Eliminar OF-009-OT-254-M099/ })).toBeVisible();
  });
});
