export const SESSION_SCHEMA_VERSION = 2;
export const SESSION_STORAGE_KEY = `pm_session_v${SESSION_SCHEMA_VERSION}`;

export const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const hashString = (value) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }

  return hash >>> 0;
};

export const toMirrorId = (sessionId) => {
  if (!sessionId) {
    return 'PM-0000';
  }

  const hash = hashString(sessionId).toString(36).toUpperCase();
  return `PM-${hash.padStart(6, '0').slice(0, 6)}`;
};
