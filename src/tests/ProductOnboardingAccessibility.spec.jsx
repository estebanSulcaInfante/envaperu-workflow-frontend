import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnboardingActions from '../components/productOnboarding/OnboardingActions';
import OnboardingAssistant from '../components/productOnboarding/OnboardingAssistant';
import OnboardingPhaseRail from '../components/productOnboarding/OnboardingPhaseRail';

const steps = [
  'IDENTIDAD',
  'COMPONENTES',
  'COLORES',
  'ESTRUCTURA',
  'RUTA_EMPAQUE',
  'REVISION',
];

const session = {
  pasos: steps.map((codigo, index) => ({
    codigo,
    estado: index === 0 ? 'EN_PROGRESO' : 'PENDIENTE',
    bloqueos: [],
  })),
};

const renderWithTheme = (content) => render(
  <ThemeProvider theme={createTheme()}>{content}</ThemeProvider>,
);

const expectKeyboardFocus = (element) => {
  expect(element).toHaveFocus();
};

const cssRulesInside = (container) => Array.from(container?.cssRules || []).flatMap((rule) => (
  rule.cssRules ? [rule, ...cssRulesInside(rule)] : [rule]
));

const focusVisibleRuleFor = (element) => {
  const generatedClass = [...element.classList].find((className) => className.startsWith('css-'));
  return Array.from(document.styleSheets)
    .flatMap(cssRulesInside)
    .find((rule) => (
      rule.selectorText?.includes(`.${generatedClass}:focus-visible`)
      && rule.style?.outline
    ));
};

function AssistantMountHarness() {
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMounted(true)}>Montar ayuda contextual</button>
      {mounted && <OnboardingAssistant stepCode="COMPONENTES" />}
    </>
  );
}

describe('AGP-B07: recorrido accesible del alta integral', () => {
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it('recorre las seis fases en orden, conserva el paso actual y activa una fase con teclado', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderWithTheme(
      <OnboardingPhaseRail
        session={session}
        activeCode="IDENTIDAD"
        onSelect={onSelect}
      />,
    );

    const rail = screen.getByRole('navigation', { name: /Fases del alta de producto/i });
    const phaseButtons = within(rail).getAllByRole('button');
    expect(phaseButtons).toHaveLength(6);
    expect(phaseButtons[0]).toHaveAttribute('aria-current', 'step');
    phaseButtons.slice(1).forEach((button) => {
      expect(button).not.toHaveAttribute('aria-current');
    });
    const focusRule = focusVisibleRuleFor(phaseButtons[0]);
    expect(focusRule?.style.outline).toBe('3px solid');
    expect(focusRule?.style.outlineOffset).toBe('2px');

    for (const button of phaseButtons) {
      await user.tab();
      expectKeyboardFocus(button);
    }

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'REVISION' }));

    await user.tab({ shift: true });
    expectKeyboardFocus(phaseButtons[4]);
  });

  it('mantiene accesibles por Tab y Shift+Tab las acciones persistentes', async () => {
    const user = userEvent.setup();
    const handlers = {
      onBack: vi.fn(),
      onSave: vi.fn(),
      onContinue: vi.fn(),
      onExit: vi.fn(),
    };

    renderWithTheme(
      <OnboardingActions
        canGoBack
        busy={false}
        saveState="idle"
        {...handlers}
      />,
    );

    const actions = [
      screen.getByRole('button', { name: 'Atrás' }),
      screen.getByRole('button', { name: /Guardar y salir/i }),
      screen.getByRole('button', { name: 'Guardar' }),
      screen.getByRole('button', { name: 'Guardar y continuar' }),
    ];

    for (const action of actions) {
      expect(action.tabIndex).toBe(0);
      await user.tab();
      expectKeyboardFocus(action);
    }

    await user.keyboard(' ');
    expect(handlers.onContinue).toHaveBeenCalledTimes(1);

    await user.tab({ shift: true });
    expectKeyboardFocus(actions[2]);
    await user.keyboard('{Enter}');
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
  });

  it('la ayuda contextual no roba foco y puede ocultarse y mostrarse sólo con teclado', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AssistantMountHarness />);

    await user.tab();
    const mount = screen.getByRole('button', { name: 'Montar ayuda contextual' });
    expectKeyboardFocus(mount);
    await user.keyboard('{Enter}');
    expectKeyboardFocus(mount);

    const note = screen.getByRole('note', { name: 'Consejo del asistente' });
    expect(note).toHaveTextContent(/molde y todas sus piezas/i);
    expect(note).toHaveTextContent(/Cavidades y peso operativo/i);

    await user.tab();
    const hide = screen.getByRole('button', { name: 'Ocultar asistente' });
    expectKeyboardFocus(hide);
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('note', { name: 'Consejo del asistente' })).not.toBeInTheDocument();
    const show = screen.getByRole('button', { name: 'Mostrar asistente' });
    expect(show).toBeVisible();

    await user.tab();
    expectKeyboardFocus(mount);
    await user.tab();
    expectKeyboardFocus(show);
    await user.keyboard(' ');

    expect(screen.getByRole('note', { name: 'Consejo del asistente' })).toBeVisible();
    expect(globalThis.localStorage?.getItem('envaperu_alta_producto_asistente_visible'))
      .toBe('true');
  });
});
