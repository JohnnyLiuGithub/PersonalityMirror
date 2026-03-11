import { useEffect, useState } from 'react';
import { BLUEPRINT } from '../lib/constants.js';
import { SESSION_SCHEMA_VERSION, SESSION_STORAGE_KEY } from '../lib/session.js';

const INTERRUPTED_REQUEST_MESSAGE = 'Previous AI request was interrupted. Review your last answer and try again.';

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const hasNumericScoringKey = (value, expectedLength) => {
  if (!isObject(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return entries.length === expectedLength && entries.every(([, score]) => Number.isFinite(score));
};

const isCompatibleQuestion = (question, source) => {
  if (!isObject(question) || !isObject(source)) {
    return false;
  }

  if (
    question.id !== source.id ||
    question.type !== source.type ||
    question.dimension_primary !== source.dimension_primary ||
    typeof question.scenario !== 'string' ||
    typeof question.question_text !== 'string'
  ) {
    return false;
  }

  if (question.type === 'mcq') {
    return (
      Array.isArray(question.options) &&
      question.options.length === source.options.length &&
      hasNumericScoringKey(question.scoring_key, source.options.length)
    );
  }

  if (question.type === 'rank') {
    return (
      Array.isArray(question.rank_items) &&
      question.rank_items.length === source.rank_items.length &&
      isObject(question.rank_map) &&
      hasNumericScoringKey(question.scoring_key, source.rank_items.length)
    );
  }

  if (question.type === 'short') {
    return typeof question.answer_hint === 'string';
  }

  return false;
};

export const isCompatibleQuestionSet = (questions, blueprint = BLUEPRINT) => (
  Array.isArray(questions) &&
  questions.length === blueprint.length &&
  blueprint.every((source, index) => isCompatibleQuestion(questions[index], source))
);

const sanitizeAnswerValue = (question, answer) => {
  if (!question) {
    return undefined;
  }

  if (question.type === 'mcq') {
    return typeof answer === 'string' && answer in (question.scoring_key || {}) ? answer : undefined;
  }

  if (question.type === 'rank') {
    if (!Array.isArray(answer)) {
      return undefined;
    }

    const normalized = answer.filter((item, index) => (
      typeof item === 'string' &&
      question.rank_items.includes(item) &&
      answer.indexOf(item) === index
    ));
    return normalized.length > 0 ? normalized : undefined;
  }

  if (question.type === 'short') {
    return typeof answer === 'string' ? answer : undefined;
  }

  return undefined;
};

const sanitizeAnswers = (answers, questions) => {
  if (!isObject(answers)) {
    return {};
  }

  return Object.fromEntries(
    questions.flatMap((question) => {
      const value = sanitizeAnswerValue(question, answers[question.id]);
      return value === undefined ? [] : [[question.id, value]];
    })
  );
};

const clampQuestionIndex = (index, questions) => {
  if (questions.length === 0) {
    return 0;
  }

  if (!Number.isInteger(index)) {
    return 0;
  }

  return Math.max(0, Math.min(index, questions.length - 1));
};

const getFirstUnansweredIndex = (questions, answers) => {
  const firstPendingIndex = questions.findIndex((question) => answers[question.id] === undefined);
  return firstPendingIndex === -1 ? questions.length - 1 : firstPendingIndex;
};

const sanitizeLocalAnswer = (question, localAnswer, savedAnswer) => {
  if (!question) {
    return null;
  }

  const normalizedSavedAnswer = sanitizeAnswerValue(question, savedAnswer);
  if (normalizedSavedAnswer !== undefined) {
    return normalizedSavedAnswer;
  }

  const normalizedLocalAnswer = sanitizeAnswerValue(question, localAnswer);
  if (normalizedLocalAnswer !== undefined) {
    return normalizedLocalAnswer;
  }

  if (question.type === 'rank') {
    return [];
  }

  if (question.type === 'short') {
    return '';
  }

  return null;
};

const sanitizeUser = (value) => {
  if (!isObject(value)) {
    return null;
  }

  const userId = Number(value.user_id);
  const username = typeof value.username === 'string' ? value.username.trim() : '';
  if (!Number.isFinite(userId) || !username) {
    return null;
  }

  return {
    user_id: userId,
    username,
    created_at: Number(value.created_at) || null
  };
};

const sanitizeRecordSummary = (value) => {
  if (!isObject(value)) {
    return null;
  }

  const recordId = typeof value.record_id === 'string' ? value.record_id.trim() : '';
  if (!recordId) {
    return null;
  }

  return {
    record_id: recordId,
    created_at: Number(value.created_at) || 0,
    updated_at: Number(value.updated_at) || 0,
    headline: typeof value.headline === 'string' ? value.headline.trim() : '',
    brutal_summary: typeof value.brutal_summary === 'string' ? value.brutal_summary.trim() : '',
    main_label: typeof value.main_label === 'string' ? value.main_label.trim() : '',
    shadow_label: typeof value.shadow_label === 'string' ? value.shadow_label.trim() : '',
    is_match_enabled: Boolean(value.is_match_enabled)
  };
};

const sanitizeStats = (value, keys) => {
  if (!isObject(value)) {
    return null;
  }

  const next = {};
  for (const key of keys) {
    next[key] = Math.max(0, Number(value[key]) || 0);
  }
  return next;
};

const sanitizeMatchProfile = (value) => {
  if (!isObject(value)) {
    return null;
  }

  return {
    headline: typeof value.headline === 'string' ? value.headline.trim() : '',
    main_label: typeof value.main_label === 'string' ? value.main_label.trim() : '',
    shadow_label: typeof value.shadow_label === 'string' ? value.shadow_label.trim() : ''
  };
};

const sanitizeMatch = (value) => {
  if (!isObject(value)) {
    return null;
  }

  return {
    match_id: typeof value.match_id === 'string' ? value.match_id : '',
    compatibility_score: Number(value.compatibility_score) || 0,
    report: isObject(value.report) ? value.report : null,
    source: sanitizeMatchProfile(value.source),
    partner: sanitizeMatchProfile(value.partner),
    source_record_id: typeof value.source_record_id === 'string' ? value.source_record_id : '',
    matched_record_id: typeof value.matched_record_id === 'string' ? value.matched_record_id : ''
  };
};

const createAuthState = () => ({
  user: null,
  authToken: null,
  records: [],
  recordsLoaded: false,
  recordsError: null,
  globalStats: null,
  userStats: null
});

const createFlowState = () => ({
  sessionId: null,
  view: 'landing',
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  localAnswer: null,
  isLoading: false,
  loadingStep: '',
  loadingMessage: '',
  report: null,
  reportFolded: true,
  scores: null,
  types: null,
  error: null,
  savedRecordId: null,
  latestMatch: null
});

export const createInitialState = () => ({
  schemaVersion: SESSION_SCHEMA_VERSION,
  ...createAuthState(),
  ...createFlowState()
});

const buildQuestionResumeState = (state, message) => {
  if (!state.sessionId || state.questions.length === 0) {
    return createInitialState();
  }

  const resumedIndex = state.questions.every((question) => state.answers[question.id] !== undefined)
    ? state.questions.length - 1
    : getFirstUnansweredIndex(state.questions, state.answers);

  const currentQuestion = state.questions[resumedIndex];

  return {
    ...state,
    view: 'question',
    currentQuestionIndex: resumedIndex,
    localAnswer: sanitizeLocalAnswer(currentQuestion, state.localAnswer, state.answers[currentQuestion?.id]),
    isLoading: false,
    loadingStep: '',
    loadingMessage: '',
    error: state.error || message
  };
};

export const sanitizeState = (value) => {
  if (!isObject(value)) {
    return createInitialState();
  }

  const base = createInitialState();
  const questions = isCompatibleQuestionSet(value.questions) ? value.questions : base.questions;
  const answers = sanitizeAnswers(value.answers, questions);
  const requestedIndex = clampQuestionIndex(value.currentQuestionIndex, questions);

  const next = {
    ...base,
    ...value,
    schemaVersion: SESSION_SCHEMA_VERSION,
    user: sanitizeUser(value.user),
    authToken: typeof value.authToken === 'string' && value.authToken.trim() ? value.authToken.trim() : null,
    records: Array.isArray(value.records)
      ? value.records.map(sanitizeRecordSummary).filter(Boolean)
      : [],
    recordsLoaded: Boolean(value.recordsLoaded),
    recordsError: typeof value.recordsError === 'string' ? value.recordsError : null,
    globalStats: sanitizeStats(value.globalStats, ['total_tests', 'total_matches']),
    userStats: sanitizeStats(value.userStats, ['tested_count', 'initiated_matches', 'received_matches']),
    sessionId: typeof value.sessionId === 'string' && value.sessionId.trim() ? value.sessionId.trim() : null,
    view: typeof value.view === 'string' ? value.view : base.view,
    questions,
    answers,
    currentQuestionIndex: requestedIndex,
    reportFolded: typeof value.reportFolded === 'boolean' ? value.reportFolded : true,
    isLoading: Boolean(value.isLoading),
    loadingStep: typeof value.loadingStep === 'string' ? value.loadingStep : '',
    loadingMessage: typeof value.loadingMessage === 'string' ? value.loadingMessage : '',
    report: isObject(value.report) ? value.report : null,
    scores: isObject(value.scores) ? value.scores : null,
    types: isObject(value.types) ? value.types : null,
    error: typeof value.error === 'string' ? value.error : null,
    savedRecordId: typeof value.savedRecordId === 'string' && value.savedRecordId.trim() ? value.savedRecordId.trim() : null,
    latestMatch: sanitizeMatch(value.latestMatch)
  };

  const currentQuestion = next.questions[next.currentQuestionIndex];
  const localAnswerSeed = requestedIndex === value.currentQuestionIndex ? value.localAnswer : null;
  next.localAnswer = sanitizeLocalAnswer(currentQuestion, localAnswerSeed, next.answers[currentQuestion?.id]);

  if (!next.user || !next.authToken) {
    next.user = null;
    next.authToken = null;
    next.records = [];
    next.recordsLoaded = false;
    next.recordsError = null;
    next.userStats = null;
  }

  if (next.view === 'landing') {
    next.isLoading = false;
    next.loadingStep = '';
    next.loadingMessage = '';
    return next;
  }

  if (!next.sessionId || next.questions.length === 0) {
    if (next.view === 'report' && next.report) {
      return next;
    }
    return {
      ...createInitialState(),
      user: next.user,
      authToken: next.authToken,
      records: next.records,
      recordsLoaded: next.recordsLoaded,
      recordsError: next.recordsError
    };
  }

  if (next.view === 'loading') {
    return buildQuestionResumeState(next, INTERRUPTED_REQUEST_MESSAGE);
  }

  if (next.view === 'question') {
    next.isLoading = false;
    next.loadingStep = '';
    next.loadingMessage = '';
    return next;
  }

  if (next.view === 'report') {
    if (!next.report) {
      return buildQuestionResumeState(next, 'Saved report was incomplete. Please regenerate it.');
    }

    next.isLoading = false;
    next.loadingStep = '';
    next.loadingMessage = '';
    return next;
  }

  return createInitialState();
};

export const useSessionStore = () => {
  const [state, setState] = useState(() => {
    try {
      const cached = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!cached) {
        return createInitialState();
      }
      return sanitizeState(JSON.parse(cached));
    } catch {
      return createInitialState();
    }
  });

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const patch = (partial) => {
    setState((prev) => ({
      ...prev,
      ...partial
    }));
  };

  const clearSession = ({ preserveAuth = true } = {}) => {
    setState((prev) => {
      if (!preserveAuth) {
        return createInitialState();
      }

      return {
        ...createInitialState(),
        globalStats: prev.globalStats,
        user: prev.user,
        authToken: prev.authToken,
        records: prev.records,
        recordsLoaded: prev.recordsLoaded,
        recordsError: prev.recordsError
      };
    });
  };

  return {
    state,
    patch,
    clearSession,
    setState
  };
};
