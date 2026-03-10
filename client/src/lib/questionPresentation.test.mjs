import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT } from './constants.js';
import { calculateScores } from '../store/scoring.js';
import { randomizeQuestionPresentation, createSeededRng } from './questionPresentation.js';

const toLetter = (index) => String.fromCharCode(65 + index);

test('mcq option order changes and scoring semantics stay equivalent', () => {
  const baseQuestions = BLUEPRINT.filter((q) => q.id === 'q1' || q.id === 'q2');
  const randomized = randomizeQuestionPresentation(baseQuestions, createSeededRng('session-1234'));

  const q1Base = baseQuestions[0];
  const q1New = randomized[0];

  assert.notDeepEqual(q1New.options, q1Base.options);

  const originalPickedText = q1Base.options[0];
  const newIndex = q1New.options.findIndex((item) => item === originalPickedText);
  assert.ok(newIndex >= 0);

  const originalAnswers = { q1: 'A', q2: 'B' };
  const newAnswers = { q1: toLetter(newIndex), q2: 'B' };

  const originalScore = calculateScores(baseQuestions, originalAnswers).scores.attachment;
  const newScore = calculateScores(randomized, newAnswers).scores.attachment;

  assert.equal(newScore, originalScore);
});

test('rank item order changes but item set is preserved', () => {
  const rankQuestion = BLUEPRINT.find((q) => q.type === 'rank');
  const randomized = randomizeQuestionPresentation([rankQuestion], createSeededRng('rank-seed'))[0];

  assert.notDeepEqual(randomized.rank_items, rankQuestion.rank_items);
  assert.deepEqual([...randomized.rank_items].sort(), [...rankQuestion.rank_items].sort());
});
