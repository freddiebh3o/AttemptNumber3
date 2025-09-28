/* admin-web/src/components/feedback/TopLoader.tsx */
import { useEffect, useRef, useState } from 'react';
import { Progress } from '@mantine/core';
import { useLoadingBus } from '../../hooks/useLoadingBus';

const SHOW_DELAY_MS = 180; // 150–200ms sweet spot

export default function TopLoader() {
  const inFlight = useLoadingBus((s) => s.count > 0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any pending timer whenever state changes
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (inFlight) {
      // Debounce before showing
      timerRef.current = window.setTimeout(() => {
        setVisible(true);
        timerRef.current = null;
      }, SHOW_DELAY_MS);
    } else {
      // Hide immediately when nothing is in flight
      setVisible(false);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [inFlight]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000 }}>
      <Progress value={90} animated size="md"/>
    </div>
  );
}
