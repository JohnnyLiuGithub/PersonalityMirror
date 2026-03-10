import { useCallback, useEffect, useState } from 'react';

export const useWaitTimer = () => {
  const [startedAt, setStartedAt] = useState(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setWaitSeconds(0);
      return undefined;
    }

    const tick = () => {
      setWaitSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };

    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  const start = useCallback(() => {
    setStartedAt(Date.now());
    setWaitSeconds(0);
  }, []);

  const stop = useCallback(() => {
    setStartedAt(null);
    setWaitSeconds(0);
  }, []);

  return {
    waitSeconds,
    start,
    stop,
    isRunning: startedAt !== null
  };
};
