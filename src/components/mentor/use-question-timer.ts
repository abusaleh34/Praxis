'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Accumulate only visible, active solving time. The exam deadline remains an
// independent wall-clock limit enforced by the server.
export function useQuestionTimer(id: string | undefined, active: boolean, savedMs = 0) {
  const [seconds, setSeconds] = useState(0);
  const value = useRef(0),
    read = useRef(() => value.current);
  useEffect(() => {
    if (!id) {
      value.current = 0;
      setSeconds(0);
      return;
    }
    const key = 'praxis-time:' + id;
    value.current = Math.max(savedMs, Number(sessionStorage.getItem(key)) || 0);
    let since = active && !document.hidden ? performance.now() : null;
    const flush = () => {
      const now = performance.now();
      if (since !== null) value.current += now - since;
      since = active && !document.hidden ? now : null;
      sessionStorage.setItem(key, String(Math.floor(value.current)));
      setSeconds(Math.floor(value.current / 1000));
      return value.current;
    };
    let lastSaved = savedMs;
    const persist = () => {
      const elapsedMs = Math.min(3_600_000, Math.floor(flush()));
      if (!active || elapsedMs <= lastSaved) return;
      lastSaved = elapsedMs;
      void fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'time', id, elapsedMs }),
        keepalive: true,
      })
        .then((r) => {
          if (!r.ok) lastSaved = savedMs;
        })
        .catch(() => {
          lastSaved = savedMs;
        });
    };
    read.current = flush;
    setSeconds(Math.floor(value.current / 1000));
    const t = setInterval(flush, 500);
    const saving = setInterval(persist, 10_000);
    document.addEventListener('visibilitychange', persist);
    window.addEventListener('pagehide', persist);
    return () => {
      persist();
      clearInterval(t);
      clearInterval(saving);
      document.removeEventListener('visibilitychange', persist);
      window.removeEventListener('pagehide', persist);
      read.current = () => value.current;
    };
  }, [id, active, savedMs]);
  const readElapsed = useCallback(() => Math.min(3_600_000, Math.floor(read.current())), []);
  return { seconds, readElapsed };
}
