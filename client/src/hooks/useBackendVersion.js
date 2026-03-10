import { useEffect, useState } from 'react';
import { withApiBase } from '../lib/api';

const VERSION_POLL_MS = 8000;
const VERSION_TIMEOUT_MS = 4000;

export const useBackendVersion = () => {
  const [backendVersion, setBackendVersion] = useState('checking...');

  useEffect(() => {
    let active = true;

    const loadVersion = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);

      try {
        const response = await fetch(withApiBase('/api/version'), {
          signal: controller.signal,
          cache: 'no-store'
        });
        if (!response.ok) {
          throw new Error('version request failed');
        }

        const payload = await response.json();
        if (active) {
          setBackendVersion(String(payload.backend_version || 'unknown'));
        }
      } catch {
        if (active) {
          setBackendVersion('unreachable');
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    loadVersion();
    const timer = setInterval(loadVersion, VERSION_POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return backendVersion;
};
