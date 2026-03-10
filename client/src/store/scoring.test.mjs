import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT, PERSONALITY_TYPES } from '../lib/constants.js';
import { calculateScores, identifyType } from './scoring.js';

const buildAnswers = (rankOrder = null) => ({
  q1: 'A',
  q2: 'B',
  q3: 'C',
  q4: 'D',
  q5: 'A',
  q6: 'B',
  q7: 'A',
  q8: 'B',
  q9: rankOrder || [...BLUEPRINT.find((q) => q.id === 'q9').rank_items],
  q10: [...BLUEPRINT.find((q) => q.id === 'q10').rank_items],
  q11: '\u6211\u7ecf\u5e38\u8981\u6c42\u81ea\u5df1\u8868\u73b0\u5b8c\u7f8e\u3002',
  q12: '\u6211\u5bb3\u6015\u88ab\u770b\u89c1\u8106\u5f31\u540e\u88ab\u629b\u5f03\u3002'
});

test('calculateScores is deterministic for identical answers', () => {
  const answers = buildAnswers();
  const first = calculateScores(BLUEPRINT, answers);

  for (let i = 0; i < 100; i += 1) {
    const next = calculateScores(BLUEPRINT, answers);
    assert.deepEqual(next, first);
  }
});

test('rank ordering changes at least two dimensions', () => {
  const q9Items = BLUEPRINT.find((q) => q.id === 'q9').rank_items;
  const q10Items = BLUEPRINT.find((q) => q.id === 'q10').rank_items;

  const answersA = buildAnswers(q9Items);
  const answersB = {
    ...buildAnswers([...q9Items].reverse()),
    q10: [...q10Items].reverse()
  };

  const resultA = calculateScores(BLUEPRINT, answersA).scores;
  const resultB = calculateScores(BLUEPRINT, answersB).scores;

  const changedDimensions = Object.keys(resultA).filter((dim) => resultA[dim] !== resultB[dim]);
  assert.ok(changedDimensions.length >= 2);
});

test('identifyType returns stable main/shadow for fixed scores', () => {
  const scores = {
    attachment: 10,
    control: 80,
    self_value: -20,
    conflict: 45,
    action: -15,
    desire: 5,
    reflection: 12
  };

  const first = identifyType(scores);
  for (let i = 0; i < 50; i += 1) {
    const next = identifyType(scores);
    assert.equal(next.main?.id, first.main?.id);
    assert.equal(next.shadow?.id, first.shadow?.id);
    assert.equal(next.debug.mainDim, first.debug.mainDim);
    assert.equal(next.debug.shadowDim, first.debug.shadowDim);
  }
});

test('reflection dimension maps to OBSERVATION category', () => {
  const result = identifyType({
    attachment: 0,
    control: 0,
    self_value: 0,
    conflict: 0,
    action: 0,
    desire: 0,
    reflection: 90
  });

  const observationIds = new Set((PERSONALITY_TYPES.OBSERVATION || []).map((t) => t.id));
  assert.ok(observationIds.has(result.main?.id));
});

test('q11 short answer keywords add weak reflection bonus', () => {
  const noKeyword = {
    ...buildAnswers(),
    q11: '\u4eca\u5929\u6709\u70b9\u7d2f\uff0c\u60f3\u65e9\u70b9\u4f11\u606f\u3002'
  };
  const withKeyword = {
    ...buildAnswers(),
    q11: '\u6211\u4f1a\u53cd\u601d\u4e3a\u4ec0\u4e48\u8fd9\u6b21\u4f1a\u8fd9\u6837\uff0c\u4e5f\u4f1a\u7ee7\u7eed\u601d\u8003\u3002'
  };

  const scoreA = calculateScores(BLUEPRINT, noKeyword).scores.reflection;
  const scoreB = calculateScores(BLUEPRINT, withKeyword).scores.reflection;
  assert.equal(scoreB - scoreA, 5);
});
