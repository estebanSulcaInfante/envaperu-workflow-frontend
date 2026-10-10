const MAX_ACTIVE_FEEDBACK = 4;
const FEEDBACK_PEAK = 0.16;

const FEEDBACK_TONES = {
  accepted: [{ frequency: 740, duration: 0.08 }],
  rejected: [{ frequency: 180, duration: 0.14 }, { frequency: 130, duration: 0.16 }],
  duplicate: [{ frequency: 420, duration: 0.08 }, { frequency: 420, duration: 0.08 }],
  confirmed: [{ frequency: 520, duration: 0.08 }, { frequency: 780, duration: 0.12 }],
};

let audioContext = null;
let status = 'suspended';
const listeners = new Set();
const activeFeedback = new Set();

function audioContextConstructor() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

function notify(nextStatus) {
  if (status === nextStatus) return;
  status = nextStatus;
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // A status observer cannot interrupt navigation or scanning.
    }
  });
}

function observeContext(context) {
  context.onstatechange = () => {
    notify(context.state === 'running' ? 'ready' : 'suspended');
  };
}

export function getScanAudioStatus() {
  if (!audioContextConstructor() && !audioContext) return 'unavailable';
  return status;
}

export async function activateScanAudio() {
  const Context = audioContextConstructor();
  if (!Context) {
    notify('unavailable');
    return false;
  }
  try {
    if (!audioContext) {
      audioContext = new Context();
      observeContext(audioContext);
    }
    if (audioContext.state === 'running') {
      notify('ready');
      return true;
    }
    await audioContext.resume();
    const ready = audioContext.state === 'running';
    notify(ready ? 'ready' : 'suspended');
    return ready;
  } catch {
    notify('suspended');
    return false;
  }
}

export function subscribeScanAudio(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  try {
    listener(getScanAudioStatus());
  } catch {
    // A status observer cannot interrupt navigation or scanning.
  }
  return () => listeners.delete(listener);
}

function releaseFeedback(oscillator) {
  activeFeedback.delete(oscillator);
  try {
    oscillator.disconnect();
  } catch {
    // Some test and browser implementations do not expose disconnect.
  }
}

export function playScanFeedback(kind) {
  const tones = FEEDBACK_TONES[kind];
  if (!tones || !audioContext || status !== 'ready' || audioContext.state !== 'running') return false;
  try {
    while (activeFeedback.size + tones.length > MAX_ACTIVE_FEEDBACK) {
      const oldest = activeFeedback.values().next().value;
      if (!oldest) break;
      try {
        oldest.stop();
      } catch {
        // The oscillator may already have ended.
      }
      releaseFeedback(oldest);
    }
    const startAt = audioContext.currentTime;
    tones.forEach((tone, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = startAt + index * 0.09;
      const end = start + tone.duration;
      oscillator.type = 'sine';
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(FEEDBACK_PEAK, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.addEventListener?.('ended', () => releaseFeedback(oscillator));
      activeFeedback.add(oscillator);
      oscillator.start(start);
      oscillator.stop(end);
    });
    return true;
  } catch {
    return false;
  }
}
