import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorHexPickerField from '../components/ui/ColorHexPickerField';

function Harness({ initialValue = '', onValue = () => {} }) {
  const [value, setValue] = useState(initialValue);
  return (
    <ColorHexPickerField
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onValue(nextValue);
      }}
    />
  );
}

describe('ColorHexPickerField', () => {
  it('sincroniza la paleta con el texto y normaliza el HEX a mayúsculas', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Escoger color de la paleta'), {
      target: { value: '#3366cc' },
    });

    expect(screen.getByLabelText('HEX de referencia (opcional)')).toHaveValue('#3366CC');
    expect(screen.getByLabelText('Color #3366CC')).toBeInTheDocument();
  });

  it('conserva texto parcial inválido y no lo reemplaza por el fallback técnico', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('HEX de referencia (opcional)'), '#12ab');

    expect(screen.getByLabelText('HEX de referencia (opcional)')).toHaveValue('#12AB');
    expect(screen.getByLabelText('Escoger color de la paleta')).toHaveValue('#000000');
    expect(screen.getByLabelText('Color sin HEX')).toBeInTheDocument();
  });

  it('mantiene vacío como vacío y permite quitar un color explícitamente', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initialValue="#F2C94C" onValue={onValue} />);

    await user.click(screen.getByRole('button', { name: 'Sin color' }));

    expect(screen.getByLabelText('HEX de referencia (opcional)')).toHaveValue('');
    expect(onValue).toHaveBeenLastCalledWith('');
  });
});
