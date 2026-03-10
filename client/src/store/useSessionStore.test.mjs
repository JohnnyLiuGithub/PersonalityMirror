import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT } from '../lib/constants.js';
import { SESSION_SCHEMA_VERSION } from '../lib/session.js';
import { createInitialState, isCompatibleQuestionSet, sanitizeState } from './useSessionStore.js';

const buildQuestionState = () => ({
  schemaVersion: SESSION_SCHEMA_VERSION,
  sessionId: 'session-123',
  view: 'question',
  questions: structuredClone(BLUEPRINT),
  currentQuestionIndex: 99,
  answers: { q1: 'A', stray: 'x' },
  localAnswer: 'B',
  isLoading: true,
  loadingStep: 'questions',
  loadingMessage: 'loading',
  report: null,
  reportFolded: false,
  scores: null,
  types: null,
  error: null
});

test('isCompatibleQuestionSet accepts current blueprint shape', () => {
  assert.equal(isCompatibleQuestionSet(structuredClone(BLUEPRINT)), true);
});

test('sanitizeState clamps index and strips stray answers', () => {
  const sanitized = sanitizeState(buildQuestionState());

  assert.equal(sanitized.currentQuestionIndex, BLUEPRINT.length - 1);
  assert.deepEqual(sanitized.answers, { q1: 'A' });
  assert.equal(sanitized.localAnswer, '');
  assert.equal(sanitized.isLoading, false);
  assert.equal(sanitized.loadingStep, '');
});

test('sanitizeState converts interrupted loading state back to question flow', () => {
  const answered = Object.fromEntries(BLUEPRINT.map((question) => [question.id, question.type === 'short' ? 'answer text' : question.type === 'rank' ? [...question.rank_items] : 'A']));
  const sanitized = sanitizeState({
    ...buildQuestionState(),
    view: 'loading',
    answers: answered
  });

  assert.equal(sanitized.view, 'question');
  assert.equal(sanitized.currentQuestionIndex, BLUEPRINT.length - 1);
  assert.match(sanitized.error, /interrupted/i);
});

test('sanitizeState resets incompatible question payloads', () => {
  const brokenQuestions = structuredClone(BLUEPRINT);
  brokenQuestions[0].id = 'wrong';

  const sanitized = sanitizeState({
    ...buildQuestionState(),
    questions: brokenQuestions
  });

  assert.deepEqual(sanitized, createInitialState());
});

test('sanitizeState falls back to question flow when report is missing', () => {
  const sanitized = sanitizeState({
    ...buildQuestionState(),
    view: 'report',
    currentQuestionIndex: 2,
    answers: { q1: 'A', q2: 'B' }
  });

  assert.equal(sanitized.view, 'question');
  assert.match(sanitized.error, /incomplete/i);
});

test('sanitizeState drops invalid stored answer shapes', () => {
  const sanitized = sanitizeState({
    ...buildQuestionState(),
    currentQuestionIndex: 8,
    answers: {
      q1: 'Z',
      q9: ['not-in-list', BLUEPRINT[8].rank_items[0], BLUEPRINT[8].rank_items[0]]
    }
  });

  assert.deepEqual(sanitized.answers, { q9: [BLUEPRINT[8].rank_items[0]] });
});
