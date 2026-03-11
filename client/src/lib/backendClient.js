import { BLUEPRINT } from './constants';
import { normalizeQuestions, safeJsonParse, validateMatchSchema, validateReportSchema } from './aiGuards';
import { withApiBase } from './api';

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const buildHeaders = (token) => (
  token
    ? { ...DEFAULT_HEADERS, Authorization: `Bearer ${token}` }
    : DEFAULT_HEADERS
);

const requestJson = async (url, { method = 'GET', body, token, timeoutMs = 15000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.error ? ` - ${payload.error}` : '';
      } catch {
        detail = '';
      }
      throw new Error(`Request failed: ${response.status}${detail}`);
    }

    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const registerUser = (payload) => requestJson(withApiBase('/api/auth/register'), {
  method: 'POST',
  body: payload
});

export const loginUser = (payload) => requestJson(withApiBase('/api/auth/login'), {
  method: 'POST',
  body: payload
});

export const fetchCurrentUser = (token) => requestJson(withApiBase('/api/auth/me'), {
  token
});

export const fetchStats = (token) => requestJson(withApiBase('/api/stats'), {
  token,
  timeoutMs: 15000
});

export const logoutUser = (token) => requestJson(withApiBase('/api/auth/logout'), {
  method: 'POST',
  token,
  body: {}
});

export const listRecords = (token) => requestJson(withApiBase('/api/records'), {
  token,
  timeoutMs: 20000
});

export const fetchRecordDetail = (token, recordId) => requestJson(withApiBase(`/api/records/${recordId}`), {
  token,
  timeoutMs: 20000
});

export const importRecord = (token, payload) => requestJson(withApiBase('/api/records/import'), {
  method: 'POST',
  token,
  body: payload,
  timeoutMs: 30000
});

export const setRecordMatchEnabled = (token, recordId, enabled) => requestJson(withApiBase(`/api/records/${recordId}/match-pool`), {
  method: 'POST',
  token,
  body: { enabled },
  timeoutMs: 15000
});

export const fetchRandomMatch = async (token, recordId) => {
  const payload = await requestJson(withApiBase('/api/matches/random'), {
    method: 'POST',
    token,
    body: recordId ? { record_id: recordId } : {},
    timeoutMs: 90000
  });

  const validated = validateMatchSchema(payload?.match?.report);
  if (!validated) {
    throw new Error('AI compatibility report invalid');
  }

  return {
    ...payload.match,
    report: validated
  };
};

export const fetchQuestionSet = async (sessionId) => {
  const payload = await requestJson(withApiBase('/api/generate-questions'), {
    method: 'POST',
    body: {
      session_id: sessionId,
      blueprint: BLUEPRINT
    },
    timeoutMs: 12000
  });

  const parsed = normalizeQuestions(payload?.questions);
  if (!parsed) {
    throw new Error('AI questions invalid');
  }
  return parsed;
};

export const generateReportAI = async ({
  token,
  sessionId,
  scores,
  typeObj,
  evidence,
  shortAnswers,
  questions,
  answers,
  blueprintVersion
}) => {
  const payload = await requestJson(withApiBase('/api/generate-report'), {
    method: 'POST',
    token,
    body: {
      session_id: sessionId,
      scores,
      main_type: typeObj?.main,
      shadow_type: typeObj?.shadow,
      evidence,
      short_answers: shortAnswers,
      questions,
      answers,
      blueprint_version: blueprintVersion
    },
    timeoutMs: 210000
  });

  const parsed = safeJsonParse(payload?.report, 'object');
  const validated = validateReportSchema(parsed || payload?.report);
  if (!validated) {
    throw new Error('AI report invalid');
  }

  return {
    report: validated,
    record: payload?.record || null
  };
};
