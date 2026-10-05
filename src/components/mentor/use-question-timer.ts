'use client';
import { useEffect, useRef, useState } from 'react';

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
    read.current = flush;
    setSeconds(Math.floor(value.current / 1000));
    const t = setInterval(flush, 500);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      clearInterval(t);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      read.current = () => value.current;
    };
  }, [id, active, savedMs]);
  return { seconds, readElapsed: () => Math.min(3_600_000, Math.floor(read.current())) };
}
