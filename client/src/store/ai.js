import { BLUEPRINT } from '../lib/constants';
import { normalizeQuestions, safeJsonParse, validateReportSchema } from '../lib/aiGuards';
import { withApiBase } from '../lib/api';

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const postJson = async (url, body, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(body),
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

export const generateQuestionsAI = async (sessionId) => {
  const payload = await postJson(withApiBase('/api/generate-questions'), {
    session_id: sessionId,
    blueprint: BLUEPRINT
  }, 130000);

  const parsed = normalizeQuestions(payload?.questions);
  if (!parsed) {
    throw new Error('AI questions invalid');
  }
  return parsed;
};

export const generateReportAI = async ({ sessionId, scores, typeObj, evidence, shortAnswers }) => {
  const payload = await postJson(withApiBase('/api/generate-report'), {
    session_id: sessionId,
    scores,
    main_type: typeObj?.main,
    shadow_type: typeObj?.shadow,
    evidence,
    short_answers: shortAnswers
  }, 210000);

  const parsed = safeJsonParse(payload?.report, 'object');
  const validated = validateReportSchema(parsed || payload?.report);
  if (!validated) {
    throw new Error('AI report invalid');
  }

  return validated;
};
