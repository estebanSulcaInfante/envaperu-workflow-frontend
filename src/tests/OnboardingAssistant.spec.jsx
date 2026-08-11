import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnboardingAssistant from '../components/productOnboarding/OnboardingAssistant';

const renderAssistant = () => render(
  <ThemeProvider theme={createTheme()}>
    <OnboardingAssistant stepCode="IDENTIDAD" />
  </ThemeProvider>,
);

describe('asistente opcional del alta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.localStorage?.clear();
  });

  it('elimina la animación de Collapse cuando el sistema prefiere movimiento reducido', () => {
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    renderAssistant();

    const note = screen.getByRole('note', { name: /Consejo del asistente/i });
    expect(note.closest('[data-motion]')).toHaveAttribute('data-motion', 'reduced');
  });
});
