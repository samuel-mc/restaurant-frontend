/**
  * Reproduce el sonido de alerta urgente para bad reviews (≤2 Estrellas).
  * Intenta cargar `/sounds/alert-critical.mp3` o genera una síntesis
  * bitono de alerta usando Web Audio API como fallback seguro.
  */

export function playCriticalAlertSound(): void {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/sounds/alert-critical.mp3");
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback Web Audio API si el archivo no responde o falta interactividad
        synthesizeCriticalBeep();
      });
    }
  } catch {
    synthesizeCriticalBeep();
  }
}

function synthesizeCriticalBeep(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Primer tono agudo (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Segundo tono estridente (587.33 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(587.33, now + 0.28);
    gain2.gain.setValueAtTime(0.4, now + 0.28);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.28);
    osc2.stop(now + 0.6);
  } catch {
    // Silencioso si el navegador bloquea el sintetizador de audio
  }
}
