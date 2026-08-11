import { describe, expect, it } from 'vitest';
import { sessionRequiresPasswordSetup } from '../auth/authFlowModel';

describe('detecciÃ³n de credencial pendiente en invitaciones', () => {
  it('exige crear contraseÃ±a cuando Supabase conserva la marca en metadata', () => {
    expect(sessionRequiresPasswordSetup({
      user: { user_metadata: { password_setup_required: true } },
    })).toBe(true);
  });

  it('no interrumpe sesiones que ya completaron su contraseÃ±a', () => {
    expect(sessionRequiresPasswordSetup({
      user: { user_metadata: { password_setup_required: false } },
    })).toBe(false);
    expect(sessionRequiresPasswordSetup(null)).toBe(false);
  });
});
