import { describe, expect, it } from 'vitest';
import { fieldErrorProps } from '../utils/fieldValidation';

describe('field validation helpers', () => {
  it('exposes an inline error only for the known field supplied by the form', () => {
    expect(fieldErrorProps({ motivo: 'Motivo requerido' }, 'motivo'))
      .toEqual({ error: true, helperText: 'Motivo requerido' });
  });
});
