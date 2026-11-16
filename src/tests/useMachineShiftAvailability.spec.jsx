import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useMachineShiftAvailability } from '../hooks/useMachineShiftAvailability';
import { listarJornadasPlantaScm } from '../services/scmOtApi';

vi.mock('../services/scmOtApi', () => ({
  listarJornadasPlantaScm: vi.fn(),
}));

const feedbackNotify = vi.fn();
vi.mock('../context/FeedbackContext', () => ({
  useFeedback: () => ({ notify: feedbackNotify }),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ actorId: 7, can: () => true }),
}));

function Probe() {
  useMachineShiftAvailability('2026-11-14', 'DIA');
  return null;
}

describe('useMachineShiftAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deduplica StrictMode y evita solapamiento por foco sin polling', async () => {
    let resolveRequest;
    const readSpy = listarJornadasPlantaScm.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const { unmount } = render(<StrictMode><Probe /></StrictMode>);
    expect(readSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(3000);
    expect(readSpy).toHaveBeenCalledTimes(1);

    resolveRequest({ maquinas_no_trabajaran: [] });
    await Promise.resolve();
    unmount();
    expect(feedbackNotify).not.toHaveBeenCalled();
  });
});
