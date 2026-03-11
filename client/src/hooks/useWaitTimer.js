import { useCallback, useEffect, useMemo, useState } from 'react';

export const useWaitTimer = () => {
  const [startedAt, setStartedAt] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTick(Date.now());
    }, 500);

    return () => clearInterval(timer);
  }, [startedAt]);

  const waitSeconds = useMemo(() => {
    if (!startedAt) {
      return 0;
    }

    return Math.max(0, Math.floor((tick - startedAt) / 1000));
  }, [startedAt, tick]);

  const start = useCallback(() => {
    const now = Date.now();
    setStartedAt(now);
    setTick(now);
  }, []);

  const stop = useCallback(() => {
    setStartedAt(null);
    setTick(0);
  }, []);

  return {
    waitSeconds,
    start,
    stop,
    isRunning: startedAt !== null
  };
};
