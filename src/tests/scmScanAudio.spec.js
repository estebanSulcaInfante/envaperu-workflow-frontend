import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeGain {
  static instances = [];

  constructor() {
    this.gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    FakeGain.instances.push(this);
  }

  connect() {}
}

class FakeOscillator {
  static emitEnded = true;

  constructor() {
    this.frequency = { value: 0 };
    this.type = null;
    this.handlers = {};
    this.start = vi.fn();
    this.stop = vi.fn(() => {
      if (FakeOscillator.emitEnded) this.handlers.ended?.();
    });
    this.connect = vi.fn();
    this.disconnect = vi.fn();
  }

  addEventListener(name, handler) {
    this.handlers[name] = handler;
  }
}

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.oscillators = [];
    this.resume = vi.fn(async () => {
      this.state = 'running';
      this.onstatechange?.();
    });
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    return new FakeGain();
  }
}

async function loadAudio() {
  vi.resetModules();
  return import('../services/scmScanAudio');
}

describe('scmScanAudio', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    FakeGain.instances = [];
    FakeOscillator.emitEnded = true;
    vi.unstubAllGlobals();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  it('creates and resumes the context from activation, then reports ready', async () => {
    const audio = await loadAudio();
    const activation = audio.activateScanAudio();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledTimes(1);
    await expect(activation).resolves.toBe(true);
    expect(audio.getScanAudioStatus()).toBe('ready');
  });

  it('falls back to suspended when resume rejects', async () => {
    const audio = await loadAudio();
    await audio.activateScanAudio();
    const context = FakeAudioContext.instances[0];
    context.state = 'suspended';
    context.resume.mockRejectedValueOnce(new Error('gesture required'));

    await expect(audio.activateScanAudio()).resolves.toBe(false);
    expect(audio.getScanAudioStatus()).toBe('suspended');
  });

  it('reports unavailable when the browser has no AudioContext', async () => {
    vi.unstubAllGlobals();
    const audio = await loadAudio();

    await expect(audio.activateScanAudio()).resolves.toBe(false);
    expect(audio.getScanAudioStatus()).toBe('unavailable');
  });

  it('does not emit pending sounds and uses distinct tones when ready', async () => {
    const audio = await loadAudio();
    const context = FakeAudioContext.instances;
    expect(audio.playScanFeedback('accepted')).toBe(false);
    await audio.activateScanAudio();
    const fakeContext = context[0];

    expect(audio.playScanFeedback('accepted')).toBe(true);
    expect(audio.playScanFeedback('rejected')).toBe(true);
    expect(audio.playScanFeedback('duplicate')).toBe(true);
    expect(audio.playScanFeedback('confirmed')).toBe(true);
    const frequencies = fakeContext.oscillators.map((oscillator) => oscillator.frequency.value);
    expect(new Set(frequencies).size).toBeGreaterThan(1);
  });

  it('ramps feedback tones to the authorized 0.16 peak', async () => {
    const audio = await loadAudio();
    await audio.activateScanAudio();

    expect(audio.playScanFeedback('accepted')).toBe(true);
    expect(FakeGain.instances[0].gain.exponentialRampToValueAtTime)
      .toHaveBeenCalledWith(0.16, 0.01);
  });

  it('reserves the feedback tone budget before scheduling a multi-tone cue', async () => {
    const audio = await loadAudio();
    FakeOscillator.emitEnded = false;
    await audio.activateScanAudio();
    const fakeContext = FakeAudioContext.instances[0];

    audio.playScanFeedback('accepted');
    audio.playScanFeedback('accepted');
    audio.playScanFeedback('accepted');
    const oldest = fakeContext.oscillators[0];
    expect(audio.playScanFeedback('confirmed')).toBe(true);

    expect(oldest.stop).toHaveBeenCalledTimes(2);
    expect(fakeContext.oscillators).toHaveLength(5);
  });

  it('notifies subscribers and allows unsubscribe', async () => {
    const audio = await loadAudio();
    const listener = vi.fn();
    const unsubscribe = audio.subscribeScanAudio(listener);

    expect(listener).toHaveBeenCalledWith('suspended');
    await audio.activateScanAudio();
    expect(listener).toHaveBeenCalledWith('ready');
    unsubscribe();
    FakeAudioContext.instances[0].state = 'suspended';
    FakeAudioContext.instances[0].onstatechange?.();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
