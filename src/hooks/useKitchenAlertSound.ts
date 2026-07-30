"use client";

/**
 * Alerta sonora para nuevas comandas / llamadas de mesa.
 * Asset: `/public/sounds/ping.wav` (también prueba `.mp3` / `.m4a` si existen).
 */

import { useCallback, useEffect, useRef } from "react";

const PING_SOURCES = [
  "/sounds/ping.wav",
  "/sounds/ping.m4a",
  "/sounds/ping.mp3",
] as const;

/**
 * Devuelve `playNewOrderCue()` para disparar en cada comanda nueva vía WS.
 * Si el archivo no existe o el navegador bloquea audio, falla en silencio.
 * Tras el primer gesto del usuario, desbloquea autoplay en tablets de cocina.
 */
export function useKitchenAlertSound(): () => void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceIndexRef = useRef(0);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio(PING_SOURCES[sourceIndexRef.current]);
      audio.preload = "auto";
      audio.volume = 0.85;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const playWithFallback = useCallback(async () => {
    const audio = ensureAudio();
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      const next = sourceIndexRef.current + 1;
      if (next < PING_SOURCES.length) {
        sourceIndexRef.current = next;
        audioRef.current = null;
        const retry = ensureAudio();
        retry.currentTime = 0;
        await retry.play().catch(() => {
          // Autoplay bloqueado o archivo ausente: la UI visual sigue avisando.
        });
      }
    }
  }, [ensureAudio]);

  useEffect(() => {
    const unlock = () => {
      try {
        const audio = ensureAudio();
        const wasMuted = audio.muted;
        audio.muted = true;
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = wasMuted;
          })
          .catch(() => {
            audio.muted = wasMuted;
          });
      } catch {
        // no-op
      }
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, [ensureAudio]);

  return useCallback(() => {
    void playWithFallback();
  }, [playWithFallback]);
}
