"use client";

/**
 * Alerta sonora para nuevas comandas en cocina.
 * Placeholder listo para `/public/sounds/ping.mp3`.
 */

import { useCallback, useRef } from "react";

const PING_SRC = "/sounds/ping.mp3";

/**
 * Devuelve `playNewOrderCue()` para disparar en cada comanda nueva vía WS.
 * Si el archivo no existe o el navegador bloquea audio, falla en silencio.
 */
export function useKitchenAlertSound(): () => void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(PING_SRC);
        audioRef.current.preload = "auto";
        audioRef.current.volume = 0.85;
      }
      const audio = audioRef.current;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Autoplay bloqueado o archivo ausente: la UI visual sigue avisando.
      });
    } catch {
      // no-op
    }
  }, []);
}
